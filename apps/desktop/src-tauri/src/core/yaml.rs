//! The constrained YAML subset that `.longclaw` files may use.
//!
//! `docs/file_format.md` § "Markdown and YAML subset" narrows YAML to mappings,
//! lists, strings, booleans, nulls, and numbers, with no anchors, aliases,
//! custom tags, merge keys, multiple documents, or duplicate keys. A general
//! YAML parser resolves all of those constructs silently, so the subset is
//! enforced here before anything is deserialized: a file whose meaning depends
//! on graph resolution has to be reported rather than guessed at.
//!
//! The mapping keeps the exact bytes of every top-level entry. That is what lets
//! a read-modify-write touch only the keys it means to change and hand unknown
//! keys back unaltered, which the format contract requires.

use std::collections::HashSet;

use super::error::Diagnostic;

/// A top-level frontmatter entry, or the comments and blank lines that precede
/// the first one. Every variant owns its bytes including trailing newlines, so
/// concatenating blocks reproduces the input exactly.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Block {
    Preamble(String),
    Entry { key: String, raw: String },
}

/// A frontmatter mapping that survives a round trip byte-for-byte.
#[derive(Debug, Clone, Default)]
pub struct Mapping {
    blocks: Vec<Block>,
}

impl Mapping {
    /// Validates the subset and splits `raw` into top-level entries.
    pub fn parse(raw: &str) -> Result<Self, Diagnostic> {
        validate_subset(raw)?;
        let mut blocks: Vec<Block> = Vec::new();
        for (number, line) in lines_with_endings(raw) {
            if let Some(key) = top_level_key(line) {
                blocks.push(Block::Entry {
                    key: key.to_owned(),
                    raw: line.to_owned(),
                });
                continue;
            }
            if !line.starts_with([' ', '\t']) && !is_ignorable(line) {
                return Err(Diagnostic::parse_at(
                    format!(
                        "Frontmatter line is not a top-level key: {:?}",
                        line.trim_end()
                    ),
                    number,
                ));
            }
            match blocks.last_mut() {
                Some(Block::Entry { raw: block, .. }) | Some(Block::Preamble(block)) => {
                    block.push_str(line);
                }
                None => blocks.push(Block::Preamble(line.to_owned())),
            }
        }
        Ok(Self { blocks })
    }

    pub fn render(&self) -> String {
        self.blocks
            .iter()
            .map(|block| match block {
                Block::Preamble(raw) | Block::Entry { raw, .. } => raw.as_str(),
            })
            .collect()
    }

    pub fn keys(&self) -> impl Iterator<Item = &str> {
        self.blocks.iter().filter_map(|block| match block {
            Block::Entry { key, .. } => Some(key.as_str()),
            Block::Preamble(_) => None,
        })
    }

    /// The 1-based line `key` is written on, counted inside the mapping's own
    /// text.
    ///
    /// A field that fails validation is not a YAML error, so `serde_yaml` has no
    /// location to hand over — but the mapping already holds every entry's exact
    /// bytes, which is enough to say where the field is. That is what turns
    /// "status must be one of …" into a line the raw-file view can point at
    /// (`screen-specs.md:353`, D-52).
    pub fn line_of(&self, key: &str) -> Option<u32> {
        let mut line = 1;
        for block in &self.blocks {
            match block {
                Block::Entry { key: name, raw } => {
                    if name == key {
                        return Some(line);
                    }
                    line += line_count(raw);
                }
                Block::Preamble(raw) => line += line_count(raw),
            }
        }
        None
    }

    pub fn set_scalar(&mut self, key: &str, value: &str) {
        self.set_path_scalar(&[key], value, &[]);
    }

    /// Sets a scalar, inserting a missing key directly after the last of
    /// `after` that exists so app-written keys keep the documented order.
    pub fn set_scalar_after(&mut self, key: &str, value: &str, after: &[&str]) {
        self.set_path_scalar(&[key], value, after);
    }

    pub fn set_sequence_after(&mut self, key: &str, values: &[String], after: &[&str]) {
        self.set_path_sequence(&[key], values, after);
    }

    pub fn remove(&mut self, key: &str) {
        self.blocks.retain(|block| match block {
            Block::Entry { key: name, .. } => name != key,
            Block::Preamble(_) => true,
        });
    }

    /// Sets a scalar at a nested path — `labels` → `storage` → `name`, or
    /// `properties` → `type` → `values` → `bug` → `name` — creating every
    /// mapping on the way down that is not there yet. `after` places the
    /// top-level key when it is the one being created.
    ///
    /// Every other child of every mapping the path descends through keeps its
    /// bytes, and so does every other line of the child that is edited. That is
    /// what lets a label rename, or turning one property on, leave a key this
    /// build does not interpret exactly where its author put it.
    pub fn set_path_scalar(&mut self, path: &[&str], value: &str, after: &[&str]) {
        self.set_path(path, after, &Leaf::Scalar(value));
    }

    /// The same, for a key whose value is a sequence — `estimate.values`, the
    /// one ordered vocabulary either file holds.
    pub fn set_path_sequence(&mut self, path: &[&str], values: &[String], after: &[&str]) {
        self.set_path(path, after, &Leaf::Sequence(values));
    }

    /// The same, for a boolean. Not a scalar string: `encode_scalar` quotes
    /// `true` into the string "true" precisely so a *name* of "true" survives a
    /// round trip, and `enabled` is the other case — a flag that has to read
    /// back as a flag.
    pub fn set_path_bool(&mut self, path: &[&str], value: bool, after: &[&str]) {
        self.set_path(
            path,
            after,
            &Leaf::Literal(if value { "true" } else { "false" }),
        );
    }

    /// The same, for a number. Written as YAML resolves it, so a whole `8` stays
    /// `8` and a seven-and-a-half-hour day stays `7.5`.
    pub fn set_path_number(&mut self, path: &[&str], value: f64, after: &[&str]) {
        self.set_path(path, after, &Leaf::Literal(&value.to_string()));
    }

    /// Removes the child a path names, and only that child. A mapping the
    /// removal empties collapses to flow style rather than losing its key,
    /// because a bare `key:` reads back as null and would stop the file parsing.
    pub fn remove_path(&mut self, path: &[&str]) {
        let Some((key, rest)) = path.split_first() else {
            return;
        };
        if rest.is_empty() {
            self.remove(key);
            return;
        }
        let Some(block) = self.block(key).map(|raw| expanded(raw, key, 0)) else {
            return;
        };
        if let Some(rendered) = remove_in_block(&block, rest) {
            self.set_block(key, rendered, &[]);
        }
    }

    fn set_path(&mut self, path: &[&str], after: &[&str], leaf: &Leaf) {
        let Some((key, rest)) = path.split_first() else {
            return;
        };
        if rest.is_empty() {
            self.set_block(key, leaf.render(0, key), after);
            return;
        }
        let block = self
            .block(key)
            .map_or_else(|| format!("{key}:\n"), |raw| expanded(raw, key, 0));
        self.set_block(key, set_in_block(&block, rest, leaf), after);
    }

    /// Whether a path is written in the file at all, which is a different
    /// question from what it holds: `values: {}` is a vocabulary a project
    /// emptied, and no `values` key is one it has never had.
    pub fn has_path(&self, path: &[&str]) -> bool {
        let Some((key, rest)) = path.split_first() else {
            return false;
        };
        let Some(block) = self.block(key) else {
            return false;
        };
        let mut nested = NestedMapping::parse(&expanded(block, key, 0));
        for (index, step) in rest.iter().enumerate() {
            let Some(child) = nested.child(step) else {
                return false;
            };
            if index + 1 == rest.len() {
                return true;
            }
            let indent = nested.child_indent();
            nested = NestedMapping::parse(&expanded(child, step, indent));
        }
        true
    }

    fn block(&self, key: &str) -> Option<&str> {
        self.blocks.iter().find_map(|block| match block {
            Block::Entry { key: name, raw } if name == key => Some(raw.as_str()),
            _ => None,
        })
    }

    fn set_block(&mut self, key: &str, rendered: String, after: &[&str]) {
        let existing = self.blocks.iter_mut().find(|block| match block {
            Block::Entry { key: name, .. } => name == key,
            Block::Preamble(_) => false,
        });
        if let Some(Block::Entry { raw, .. }) = existing {
            *raw = rendered;
            return;
        }
        let block = Block::Entry {
            key: key.to_owned(),
            raw: rendered,
        };
        let anchor = after.iter().rev().find_map(|name| {
            self.blocks.iter().position(|block| match block {
                Block::Entry { key: candidate, .. } => candidate == name,
                Block::Preamble(_) => false,
            })
        });
        match anchor {
            Some(position) => self.blocks.insert(position + 1, block),
            None => self.blocks.push(block),
        }
    }
}

/// What a path write puts at the end of the path, rendered at whatever
/// indentation the mapping that will hold it uses.
enum Leaf<'a> {
    Scalar(&'a str),
    /// Already YAML: a boolean or a number, which must not be quoted.
    Literal(&'a str),
    Sequence(&'a [String]),
}

impl Leaf<'_> {
    fn render(&self, indent: usize, key: &str) -> String {
        match self {
            Self::Scalar(value) => format!("{:indent$}{key}: {}\n", "", encode_scalar(value)),
            Self::Literal(value) => format!("{:indent$}{key}: {value}\n", ""),
            Self::Sequence(values) => render_sequence(indent, key, values),
        }
    }
}

/// Rewrites the descendant `path` names inside one entry's block, whose first
/// line is that entry's own key line.
///
/// Recursive because the `properties:` block is four mappings deep, and each
/// level answers the same question: which of my children does this path enter,
/// and what does the rest of it do inside that child.
fn set_in_block(block: &str, path: &[&str], leaf: &Leaf) -> String {
    let mut nested = NestedMapping::parse(block);
    let (key, rest) = path.split_first().expect("a path names at least one key");
    let indent = nested.child_indent();
    let rendered = if rest.is_empty() {
        leaf.render(indent, key)
    } else {
        let child = nested.child(key).map_or_else(
            || format!("{:indent$}{key}:\n", ""),
            |raw| expanded(raw, key, indent),
        );
        set_in_block(&child, rest, leaf)
    };
    nested.set_child(key, rendered);
    nested.render()
}

/// The same descent, removing what the path names. `None` means nothing on the
/// path was there, and so nothing is rewritten at all.
fn remove_in_block(block: &str, path: &[&str]) -> Option<String> {
    let mut nested = NestedMapping::parse(block);
    let (key, rest) = path.split_first().expect("a path names at least one key");
    if rest.is_empty() {
        return nested.remove_child(key).then(|| nested.render());
    }
    let indent = nested.child_indent();
    let child = expanded(nested.child(key)?, key, indent);
    let rendered = remove_in_block(&child, rest)?;
    nested.set_child(key, rendered);
    Some(nested.render())
}

/// A child's block, ready to be descended into.
///
/// A child written in flow style — `bug: { name: Bug, color: red }`, which is
/// exactly how the format contract writes a type value — is expanded into block
/// style first. Appending a field line under a mapping that is already closed is
/// not YAML at all, so the one-line form has to become a block before an edit
/// can reach inside it. Nothing else is reformatted: this happens only to the
/// child being written into.
fn expanded(raw: &str, key: &str, indent: usize) -> String {
    let value = header_value(raw);
    if !value.starts_with(['{', '[']) {
        return raw.to_owned();
    }
    let header = raw.split_inclusive('\n').next().unwrap_or(raw);
    let block = serde_yaml::from_str::<serde_yaml::Value>(value)
        .ok()
        .and_then(|parsed| render_block_value(key, &parsed, indent))
        // A construct the block form cannot hold is replaced rather than
        // written into: a file that lost one is recoverable, and one whose
        // frontmatter no longer parses is what takes the whole project down.
        .unwrap_or_else(|| format!("{:indent$}{key}:\n", ""));
    // Whatever followed the one-line form followed the *child*, not the mapping
    // above it — a comment about this label belongs to this label. Only the
    // header is rewritten; the rest is carried across as its own bytes.
    block + &raw[header.len()..]
}

/// One parsed YAML value as block-style lines under `key`. `None` for anything
/// the subset does not put inside these registries — a sequence of mappings,
/// say — which the caller reads as "do not try".
fn render_block_value(key: &str, value: &serde_yaml::Value, indent: usize) -> Option<String> {
    let inner = indent + 2;
    match value {
        serde_yaml::Value::Mapping(entries) if !entries.is_empty() => {
            let mut rendered = format!("{:indent$}{key}:\n", "");
            for (name, entry) in entries {
                // Encoded, not written through: a key of `a: b` set down plainly
                // is `a: b: 1`, which is not a mapping entry at all and takes
                // the whole file with it.
                let name = encode_scalar(name.as_str()?);
                rendered.push_str(&render_block_value(&name, entry, inner)?);
            }
            Some(rendered)
        }
        serde_yaml::Value::Mapping(_) => Some(format!("{:indent$}{key}: {{}}\n", "")),
        serde_yaml::Value::Sequence(items) if !items.is_empty() => {
            let mut rendered = format!("{:indent$}{key}:\n", "");
            for item in items {
                rendered.push_str(&format!("{:inner$}- {}\n", "", encoded_value(item)?));
            }
            Some(rendered)
        }
        serde_yaml::Value::Sequence(_) => Some(format!("{:indent$}{key}: []\n", "")),
        scalar => Some(format!("{:indent$}{key}: {}\n", "", encoded_value(scalar)?)),
    }
}

/// A scalar as bytes that read back as the value they came from. Booleans and
/// numbers are written as they are rather than through `encode_scalar`, which
/// would quote `true` into the string "true" and change what the key means.
fn encoded_value(value: &serde_yaml::Value) -> Option<String> {
    Some(match value {
        serde_yaml::Value::String(text) => encode_scalar(text),
        serde_yaml::Value::Bool(flag) => flag.to_string(),
        serde_yaml::Value::Number(number) => number.to_string(),
        serde_yaml::Value::Null => "null".to_owned(),
        _ => return None,
    })
}

/// The key one line opens, as the key it *means* rather than as it is spelled.
///
/// `"bug":` and `bug:` are one key, and matching on the raw text made them two —
/// which does not fail loudly: the write appends a second `bug:` beside the
/// quoted one, the subset check compares the raw text and passes it, and the
/// duplicate only surfaces when the reader refuses the file it just wrote.
fn child_key(line: &str) -> String {
    let raw = line
        .trim()
        .split_once(':')
        .map_or("", |(key, _)| key.trim_end());
    if raw.starts_with(['"', '\'']) {
        if let Ok(decoded) = serde_yaml::from_str::<String>(raw) {
            return decoded;
        }
    }
    raw.to_owned()
}

/// The text after the colon on an entry's own key line — empty when the key
/// opens a block, or carries nothing but a comment.
fn header_value(block: &str) -> &str {
    let header = block.split_inclusive('\n').next().unwrap_or(block);
    let value = header
        .trim()
        .split_once(':')
        .map_or("", |(_, value)| value.trim());
    if value.starts_with('#') {
        ""
    } else {
        value
    }
}

/// The children of one entry whose value is a mapping, such as `labels:` or
/// `properties.type.values`. Each child owns the exact bytes of its own block,
/// so an edit to one of them is the only thing that changes.
#[derive(Debug, Default)]
struct NestedMapping {
    /// The entry's own key line, kept verbatim so a trailing comment on it
    /// survives a write to one of its children.
    header: String,
    /// The column the key line starts at, which is what a child of a child is
    /// indented from when the file has none yet to copy.
    indent: usize,
    key: String,
    /// Comments and blank lines between the key and its first child.
    preamble: String,
    children: Vec<(String, String)>,
    /// The indentation the file already uses, so an edit matches the surrounding
    /// file rather than imposing its own.
    child_indent: Option<usize>,
}

impl NestedMapping {
    /// Splits a whole entry block, header line included, into its children.
    fn parse(raw: &str) -> Self {
        let lines = lines_with_endings(raw);
        let header = lines.first().map_or("", |(_, line)| *line);
        let mut nested = Self {
            header: header.to_owned(),
            indent: indent_of(header),
            key: child_key(header),
            ..Self::default()
        };
        for (_, line) in lines.into_iter().skip(1) {
            let indent = indent_of(line);
            let opens_child = !is_ignorable(line)
                && nested
                    .child_indent
                    .is_none_or(|expected| indent == expected)
                && line.trim_start().split_once(':').is_some();
            if opens_child {
                nested.child_indent.get_or_insert(indent);
                nested.children.push((child_key(line), line.to_owned()));
                continue;
            }
            match nested.children.last_mut() {
                Some((_, block)) => block.push_str(line),
                None => nested.preamble.push_str(line),
            }
        }
        nested
    }

    /// Where this mapping's children sit: what the file already does, or two
    /// columns in from the key when it has none to copy.
    fn child_indent(&self) -> usize {
        self.child_indent.unwrap_or(self.indent + 2)
    }

    fn child(&self, name: &str) -> Option<&str> {
        self.children
            .iter()
            .find_map(|(key, block)| (key == name).then_some(block.as_str()))
    }

    fn render(&self) -> String {
        let mut rendered = if self.children.is_empty() {
            format!("{:indent$}{}: {{}}\n", "", self.key, indent = self.indent)
        } else if header_value(&self.header).is_empty() {
            // The line as its author wrote it, comment and all. Reconstructing
            // it would be the one byte this write did not need to touch.
            self.header.clone()
        } else {
            // It was `key: {}`, or a flow mapping that has just been expanded.
            format!("{:indent$}{}:\n", "", self.key, indent = self.indent)
        };
        rendered.push_str(&self.preamble);
        for (_, block) in &self.children {
            rendered.push_str(block);
        }
        rendered
    }

    /// Replaces a child, or appends one that is not there yet.
    ///
    /// A new child lands *with* its siblings rather than below a trailing
    /// comment: comments after the last child belong to that child's block, so
    /// appending blindly would put a field the app just wrote under a note about
    /// the one above it.
    fn set_child(&mut self, name: &str, rendered: String) {
        if let Some((_, block)) = self.children.iter_mut().find(|(key, _)| key == name) {
            *block = rendered;
            return;
        }
        let trailing = self
            .children
            .last_mut()
            .map(|(_, block)| split_trailing_comments(block))
            .unwrap_or_default();
        self.children.push((name.to_owned(), rendered + &trailing));
    }

    fn remove_child(&mut self, child: &str) -> bool {
        let before = self.children.len();
        self.children.retain(|(name, _)| name != child);
        self.children.len() != before
    }
}

/// Takes the comments and blank lines off the end of a child's block and hands
/// them back, so they can be re-attached after whatever is appended next.
fn split_trailing_comments(block: &mut String) -> String {
    let lines = lines_with_endings(block);
    let Some(last_content) = lines.iter().rposition(|(_, line)| !is_ignorable(line)) else {
        return String::new();
    };
    let kept: String = lines[..=last_content]
        .iter()
        .map(|(_, line)| *line)
        .collect();
    let trailing = block[kept.len()..].to_owned();
    block.truncate(kept.len());
    trailing
}

fn indent_of(line: &str) -> usize {
    line.len() - line.trim_start_matches(' ').len()
}

fn render_sequence(indent: usize, key: &str, values: &[String]) -> String {
    if values.is_empty() {
        return format!("{:indent$}{key}: []\n", "");
    }
    let item = indent + 2;
    let mut rendered = format!("{:indent$}{key}:\n", "");
    for value in values {
        rendered.push_str(&format!("{:item$}- {}\n", "", encode_scalar(value)));
    }
    rendered
}

/// Renders a string as YAML, using plain style when that is unambiguous and
/// double-quoted style otherwise. Plain style keeps app-written files looking
/// like the hand-written examples in the format contract; quoting is applied
/// whenever a plain scalar could read back as anything but this exact string.
pub fn encode_scalar(value: &str) -> String {
    if is_plain_safe(value) {
        return value.to_owned();
    }
    serde_json::to_string(value).unwrap_or_else(|_| format!("{value:?}"))
}

/// Characters that open a YAML node type rather than a plain scalar.
const LEADING_INDICATORS: [char; 19] = [
    '-', '?', ':', ',', '[', ']', '{', '}', '#', '&', '*', '!', '|', '>', '\'', '"', '%', '@', '`',
];

const YAML_KEYWORDS: [&str; 23] = [
    "true", "True", "TRUE", "false", "False", "FALSE", "null", "Null", "NULL", "~", "yes", "Yes",
    "YES", "no", "No", "NO", "on", "On", "ON", "off", "Off", "OFF", "",
];

fn is_plain_safe(value: &str) -> bool {
    let Some(first) = value.chars().next() else {
        return false;
    };
    if LEADING_INDICATORS.contains(&first) || first == '~' || first.is_whitespace() {
        return false;
    }
    if value.ends_with(char::is_whitespace) || value.ends_with(':') {
        return false;
    }
    if value.contains(": ") || value.contains(" #") {
        return false;
    }
    if value.chars().any(char::is_control) {
        return false;
    }
    if YAML_KEYWORDS.contains(&value) {
        return false;
    }
    if is_sexagesimal(value) {
        return false;
    }
    // A plain scalar that reads as a number would come back as a number.
    value.parse::<i64>().is_err() && value.parse::<f64>().is_err()
}

/// YAML 1.1 readers resolve `12:30` as a base-60 integer, so quote it.
fn is_sexagesimal(value: &str) -> bool {
    let mut parts = value.split(':');
    let Some(first) = parts.next() else {
        return false;
    };
    if first.is_empty() || !first.bytes().all(|byte| byte.is_ascii_digit()) {
        return false;
    }
    let mut segments = 0;
    for part in parts {
        if part.len() != 2 || !part.bytes().all(|byte| byte.is_ascii_digit()) {
            return false;
        }
        segments += 1;
    }
    segments > 0
}

/// Splits text into lines that keep their newline, paired with 1-based numbers.
pub fn lines_with_endings(raw: &str) -> Vec<(u32, &str)> {
    let mut lines = Vec::new();
    let mut start = 0;
    let mut number = 1;
    for (index, character) in raw.char_indices() {
        if character == '\n' {
            lines.push((number, &raw[start..=index]));
            start = index + 1;
            number += 1;
        }
    }
    if start < raw.len() {
        lines.push((number, &raw[start..]));
    }
    lines
}

/// How many lines a block occupies. A final line without a newline still counts,
/// which is what keeps `line_of` right for a frontmatter that ends unterminated.
fn line_count(raw: &str) -> u32 {
    lines_with_endings(raw).len() as u32
}

fn is_ignorable(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.is_empty() || trimmed.starts_with('#')
}

fn top_level_key(line: &str) -> Option<&str> {
    if line.starts_with([' ', '\t']) || is_ignorable(line) {
        return None;
    }
    let (key, _) = line.split_once(':')?;
    let key = key.trim_end();
    if key.is_empty() || !key.chars().all(is_key_character) {
        return None;
    }
    Some(key)
}

fn is_key_character(character: char) -> bool {
    character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.')
}

/// Rejects the YAML constructs the format contract excludes, reporting the first
/// violation with its line so the raw-file view can point at it.
pub fn validate_subset(raw: &str) -> Result<(), Diagnostic> {
    let mut scopes: Vec<(usize, HashSet<String>)> = Vec::new();
    let mut block_scalar_indent: Option<usize> = None;

    for (number, line) in lines_with_endings(raw) {
        let content = line.trim_end_matches(['\n', '\r']);
        let trimmed = content.trim();
        let indent = content.len() - content.trim_start().len();

        if let Some(open_indent) = block_scalar_indent {
            // Literal and folded scalars carry arbitrary text; only a return to
            // shallower indentation ends them.
            if trimmed.is_empty() || indent > open_indent {
                continue;
            }
            block_scalar_indent = None;
        }
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if content.contains('\t') {
            return Err(Diagnostic::subset(
                "a tab character is used for structure",
                number,
            ));
        }
        if trimmed == "---" || trimmed.starts_with("--- ") || trimmed == "..." {
            return Err(Diagnostic::subset(
                "more than one YAML document in a single block",
                number,
            ));
        }

        let (key, value) = split_key_and_value(trimmed);
        if let Some(key) = key {
            if key == "<<" {
                return Err(Diagnostic::subset("a merge key", number));
            }
            while scopes.last().is_some_and(|(scope, _)| *scope > indent) {
                scopes.pop();
            }
            let opens_sequence_item = trimmed.starts_with("- ");
            if opens_sequence_item || scopes.last().is_none_or(|(scope, _)| *scope != indent) {
                scopes.push((indent, HashSet::new()));
            }
            if let Some((_, seen)) = scopes.last_mut() {
                if !seen.insert(key.to_owned()) {
                    return Err(Diagnostic::subset(
                        format!("a duplicate key: {key}"),
                        number,
                    ));
                }
            }
        }

        if let Some(violation) = value_violation(value) {
            return Err(Diagnostic::subset(violation, number));
        }
        if matches!(value, "|" | ">" | "|-" | ">-" | "|+" | ">+") {
            block_scalar_indent = Some(indent);
        }
    }
    Ok(())
}

/// Splits a trimmed line into its mapping key, if it has one, and the value text
/// that follows. Sequence entries (`- field: status`) report the inner key.
fn split_key_and_value(trimmed: &str) -> (Option<&str>, &str) {
    if trimmed == "-" {
        return (None, "");
    }
    let after_dash = trimmed.strip_prefix("- ").unwrap_or(trimmed);
    if after_dash.starts_with(['"', '\'']) {
        return (None, after_dash);
    }
    match after_dash.split_once(':') {
        Some((key, value)) if value.is_empty() || value.starts_with(' ') => {
            (Some(key.trim_end()), value.trim())
        }
        _ => (None, after_dash),
    }
}

fn value_violation(value: &str) -> Option<&'static str> {
    match value.chars().next() {
        Some('&') => Some("a YAML anchor"),
        Some('*') => Some("a YAML alias"),
        Some('!') => Some("an explicit YAML tag"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::{encode_scalar, validate_subset, Mapping};

    const FRONTMATTER: &str = concat!(
        "format: longclaw.ticket/v1\n",
        "title: Keep the bytes\n",
        "labels:\n",
        "  - storage\n",
        "  - reliability\n",
        "x_extension:\n",
        "  owner: future-version\n",
    );

    #[test]
    fn a_mapping_renders_the_bytes_it_parsed() {
        let mapping = Mapping::parse(FRONTMATTER).unwrap();
        assert_eq!(mapping.render(), FRONTMATTER);
        assert_eq!(
            mapping.keys().collect::<Vec<_>>(),
            vec!["format", "title", "labels", "x_extension"]
        );
    }

    #[test]
    fn a_key_reports_the_line_it_is_written_on() {
        let mapping = Mapping::parse(FRONTMATTER).unwrap();
        assert_eq!(mapping.line_of("format"), Some(1));
        assert_eq!(mapping.line_of("title"), Some(2));
        // Past a three-line sequence, not past one line of it.
        assert_eq!(mapping.line_of("x_extension"), Some(6));
        assert_eq!(mapping.line_of("status"), None);
    }

    #[test]
    fn comments_and_blank_lines_count_toward_a_key_line() {
        let raw =
            "# leading note\n\nformat: longclaw.ticket/v1\n\n# about the title\ntitle: Kept\n";
        let mapping = Mapping::parse(raw).unwrap();
        assert_eq!(mapping.line_of("format"), Some(3));
        assert_eq!(mapping.line_of("title"), Some(6));
    }

    #[test]
    fn comments_and_blank_lines_survive_a_round_trip() {
        let raw =
            "# leading note\n\nformat: longclaw.ticket/v1\n\n# about the title\ntitle: Kept\n";
        assert_eq!(Mapping::parse(raw).unwrap().render(), raw);
    }

    #[test]
    fn replacing_a_scalar_leaves_every_other_byte_alone() {
        let mut mapping = Mapping::parse(FRONTMATTER).unwrap();
        mapping.set_scalar("title", "Changed");
        assert_eq!(
            mapping.render(),
            FRONTMATTER.replace("title: Keep the bytes", "title: Changed")
        );
    }

    #[test]
    fn replacing_a_sequence_replaces_its_whole_block() {
        let mut mapping = Mapping::parse(FRONTMATTER).unwrap();
        mapping.set_sequence_after("labels", &["backend".to_owned()], &[]);
        assert!(mapping
            .render()
            .contains("labels:\n  - backend\nx_extension:"));
    }

    #[test]
    fn an_empty_sequence_renders_in_flow_style() {
        let mut mapping = Mapping::parse(FRONTMATTER).unwrap();
        mapping.set_sequence_after("labels", &[], &[]);
        assert!(mapping.render().contains("labels: []\n"));
    }

    #[test]
    fn a_new_key_lands_after_its_documented_predecessor() {
        let mut mapping = Mapping::parse(FRONTMATTER).unwrap();
        mapping.set_scalar_after("rank", "a0V", &["title"]);
        assert!(mapping
            .render()
            .contains("title: Keep the bytes\nrank: a0V\nlabels:"));
    }

    #[test]
    fn a_new_key_without_a_known_predecessor_is_appended() {
        let mut mapping = Mapping::parse(FRONTMATTER).unwrap();
        mapping.set_scalar_after("archived_at", "2026-07-29T00:00:00Z", &["updated_at"]);
        assert!(mapping
            .render()
            .ends_with("archived_at: 2026-07-29T00:00:00Z\n"));
    }

    #[test]
    fn removing_a_key_removes_its_whole_block() {
        let mut mapping = Mapping::parse(FRONTMATTER).unwrap();
        mapping.remove("labels");
        assert_eq!(
            mapping.render(),
            concat!(
                "format: longclaw.ticket/v1\n",
                "title: Keep the bytes\n",
                "x_extension:\n",
                "  owner: future-version\n",
            )
        );
    }

    const NESTED: &str = concat!(
        "name: Representative Project\n",
        "labels:\n",
        "  storage:\n",
        "    name: Storage\n",
        "    color: blue\n",
        "    x_note: a key this build does not read\n",
        "  reliability:\n",
        "    name: Reliability\n",
        "people: {}\n",
    );

    #[test]
    fn setting_a_nested_field_leaves_every_sibling_untouched() {
        let mut mapping = Mapping::parse(NESTED).unwrap();
        mapping.set_path_scalar(&["labels", "storage", "name"], "Persistence", &["people"]);
        assert_eq!(
            mapping.render(),
            NESTED.replace("    name: Storage\n", "    name: Persistence\n")
        );
    }

    #[test]
    fn a_nested_field_the_child_lacks_joins_the_ones_it_has() {
        let mut mapping = Mapping::parse(NESTED).unwrap();
        mapping.set_path_scalar(&["labels", "reliability", "color"], "amber", &["people"]);
        assert!(mapping
            .render()
            .contains("  reliability:\n    name: Reliability\n    color: amber\npeople: {}\n"));
    }

    #[test]
    fn a_nested_child_that_is_not_there_yet_is_appended() {
        let mut mapping = Mapping::parse(NESTED).unwrap();
        mapping.set_path_scalar(&["labels", "backend", "name"], "Backend", &["people"]);
        assert!(mapping
            .render()
            .contains("  backend:\n    name: Backend\npeople: {}\n"));
    }

    #[test]
    fn a_nested_mapping_that_is_not_there_yet_lands_after_its_predecessor() {
        let mut mapping = Mapping::parse("name: Minimal\npeople: {}\n").unwrap();
        mapping.set_path_scalar(
            &["labels", "backend", "name"],
            "Backend",
            &["name", "people"],
        );
        assert_eq!(
            mapping.render(),
            "name: Minimal\npeople: {}\nlabels:\n  backend:\n    name: Backend\n"
        );
    }

    #[test]
    fn a_flow_style_empty_mapping_becomes_a_block_when_it_gains_a_child() {
        let mut mapping = Mapping::parse("labels: {}\n").unwrap();
        mapping.set_path_scalar(&["labels", "backend", "name"], "Backend", &[]);
        assert_eq!(mapping.render(), "labels:\n  backend:\n    name: Backend\n");
    }

    #[test]
    fn removing_a_nested_child_removes_only_that_child() {
        let mut mapping = Mapping::parse(NESTED).unwrap();
        mapping.remove_path(&["labels", "storage"]);
        assert_eq!(
            mapping.render(),
            "name: Representative Project\nlabels:\n  reliability:\n    name: Reliability\npeople: {}\n"
        );
    }

    /// A bare `labels:` reads back as null rather than as an empty mapping, so the
    /// last child leaving has to collapse the key to flow style.
    #[test]
    fn removing_the_last_nested_child_collapses_to_an_empty_mapping() {
        let mut mapping = Mapping::parse("labels:\n  storage:\n    name: Storage\n").unwrap();
        mapping.remove_path(&["labels", "storage"]);
        assert_eq!(mapping.render(), "labels: {}\n");
    }

    #[test]
    fn removing_a_nested_child_that_is_not_there_changes_nothing() {
        let mut mapping = Mapping::parse(NESTED).unwrap();
        mapping.remove_path(&["labels", "absent"]);
        assert_eq!(mapping.render(), NESTED);
    }

    /// The `properties:` block, which is the deepest thing either file holds:
    /// `properties` → `type` → `values` → `bug` → `name` is four mappings down.
    const PROPERTIES: &str = concat!(
        "name: Representative Project\n",
        "properties:\n",
        "  type:\n",
        "    enabled: true\n",
        "    values:\n",
        "      bug:\n",
        "        name: Bug\n",
        "        color: red\n",
        "      chore:\n",
        "        name: Chore\n",
        "        color: gray\n",
        "  due:\n",
        "    # how wide the approaching window is\n",
        "    attention_days: 7\n",
        "    x_note: a key this build does not read\n",
        "created_at: 2026-07-29T00:00:00Z\n",
    );

    #[test]
    fn a_path_four_mappings_deep_rewrites_one_line() {
        let mut mapping = Mapping::parse(PROPERTIES).unwrap();
        mapping.set_path_scalar(
            &["properties", "type", "values", "bug", "name"],
            "Defect",
            &[],
        );
        assert_eq!(
            mapping.render(),
            PROPERTIES.replace("        name: Bug\n", "        name: Defect\n")
        );
    }

    #[test]
    fn a_path_leaves_every_mapping_it_descends_through_untouched() {
        let mut mapping = Mapping::parse(PROPERTIES).unwrap();
        mapping.set_path_number(&["properties", "due", "attention_days"], 3.0, &[]);
        assert_eq!(
            mapping.render(),
            PROPERTIES.replace("    attention_days: 7\n", "    attention_days: 3\n")
        );
    }

    #[test]
    fn a_field_a_child_lacks_lands_with_its_siblings_not_below_a_comment() {
        let mut mapping = Mapping::parse(concat!(
            "properties:\n",
            "  due:\n",
            "    enabled: true\n",
            "    # the window, in days\n",
        ))
        .unwrap();
        mapping.set_path_number(&["properties", "due", "attention_days"], 7.0, &[]);
        assert_eq!(
            mapping.render(),
            concat!(
                "properties:\n",
                "  due:\n",
                "    enabled: true\n",
                "    attention_days: 7\n",
                "    # the window, in days\n",
            )
        );
    }

    #[test]
    fn a_path_that_is_not_there_yet_is_created_the_whole_way_down() {
        let mut mapping =
            Mapping::parse("name: Minimal\ncreated_at: 2026-07-29T00:00:00Z\n").unwrap();
        mapping.set_path_bool(
            &["properties", "estimate", "enabled"],
            true,
            &["labels", "name"],
        );
        assert_eq!(
            mapping.render(),
            concat!(
                "name: Minimal\n",
                "properties:\n",
                "  estimate:\n",
                "    enabled: true\n",
                "created_at: 2026-07-29T00:00:00Z\n",
            )
        );
    }

    #[test]
    fn a_sequence_down_a_path_replaces_its_whole_block() {
        let mut mapping = Mapping::parse(concat!(
            "properties:\n",
            "  estimate:\n",
            "    system: tshirt\n",
            "    values:\n",
            "      - xs\n",
            "      - s\n",
        ))
        .unwrap();
        mapping.set_path_sequence(
            &["properties", "estimate", "values"],
            &["s".to_owned(), "m".to_owned(), "l".to_owned()],
            &[],
        );
        assert_eq!(
            mapping.render(),
            concat!(
                "properties:\n",
                "  estimate:\n",
                "    system: tshirt\n",
                "    values:\n",
                "      - s\n",
                "      - m\n",
                "      - l\n",
            )
        );
    }

    #[test]
    fn removing_down_a_path_removes_only_that_child() {
        let mut mapping = Mapping::parse(PROPERTIES).unwrap();
        mapping.remove_path(&["properties", "type", "values", "bug"]);
        assert_eq!(
            mapping.render(),
            PROPERTIES.replace(
                concat!(
                    "      bug:\n",
                    "        name: Bug\n",
                    "        color: red\n",
                ),
                ""
            )
        );
    }

    /// The format contract writes a type value in flow style, so a file whose
    /// author copied the example out of it has to survive an edit reaching
    /// inside one.
    #[test]
    fn a_flow_style_child_becomes_a_block_when_an_edit_reaches_inside_it() {
        let mut mapping = Mapping::parse(concat!(
            "properties:\n",
            "  type:\n",
            "    values:\n",
            "      bug: { name: Bug, color: red }\n",
            "      chore: { name: Chore, color: gray }\n",
        ))
        .unwrap();
        mapping.set_path_scalar(
            &["properties", "type", "values", "bug", "color"],
            "amber",
            &[],
        );
        assert_eq!(
            mapping.render(),
            concat!(
                "properties:\n",
                "  type:\n",
                "    values:\n",
                "      bug:\n",
                "        name: Bug\n",
                "        color: amber\n",
                "      chore: { name: Chore, color: gray }\n",
            )
        );
    }

    /// Expansion re-renders what it read, so a `true` has to come back a boolean
    /// rather than the string "true", which is what quoting it would mean.
    #[test]
    fn expanding_a_flow_child_keeps_every_value_the_type_it_had() {
        let mut mapping = Mapping::parse(concat!(
            "properties:\n",
            "  estimate: { enabled: true, system: duration, hours_per_day: 7.5 }\n",
        ))
        .unwrap();
        mapping.set_path_number(&["properties", "estimate", "days_per_week"], 4.0, &[]);
        assert_eq!(
            mapping.render(),
            concat!(
                "properties:\n",
                "  estimate:\n",
                "    enabled: true\n",
                "    system: duration\n",
                "    hours_per_day: 7.5\n",
                "    days_per_week: 4\n",
            )
        );
    }

    /// The four ways a hand-written file can meet a path write, all found by
    /// probing rather than by reasoning — and two of them wrote a file the
    /// reader then refused, which is the worst failure this module has.
    #[test]
    fn a_path_write_survives_every_shape_a_hand_written_file_can_be_in() {
        for (name, raw, path, expected) in [
            (
                "a top-level key in flow style keeps its other children",
                "properties: { type: { enabled: true } }\n",
                vec!["properties", "due", "enabled"],
                concat!(
                    "properties:\n",
                    "  type:\n",
                    "    enabled: true\n",
                    "  due:\n",
                    "    enabled: red\n",
                ),
            ),
            (
                "a comment after a flow child stays with that child",
                concat!(
                    "labels:\n",
                    "  bug: { name: Bug }\n",
                    "  # a note about bug\n",
                    "  storage:\n",
                    "    name: Storage\n",
                ),
                vec!["labels", "bug", "color"],
                concat!(
                    "labels:\n",
                    "  bug:\n",
                    "    name: Bug\n",
                    "    color: red\n",
                    "  # a note about bug\n",
                    "  storage:\n",
                    "    name: Storage\n",
                ),
            ),
            (
                "a quoted key is the key it spells, not a second one",
                "labels:\n  \"bug\": { name: Bug }\n",
                vec!["labels", "bug", "color"],
                "labels:\n  bug:\n    name: Bug\n    color: red\n",
            ),
            (
                "a flow key that needs quoting keeps its quotes",
                "labels:\n  bug: { \"a: b\": 1 }\n",
                vec!["labels", "bug", "color"],
                "labels:\n  bug:\n    \"a: b\": 1\n    color: red\n",
            ),
        ] {
            let mut mapping = Mapping::parse(raw).unwrap();
            mapping.set_path_scalar(&path, "red", &[]);
            let rendered = mapping.render();
            assert_eq!(rendered, expected, "{name}");
            // The one that matters: a file this module wrote is a file the
            // reader still takes. Both of the last two failed here.
            validate_subset(&rendered).unwrap_or_else(|_| panic!("subset: {name}"));
            serde_yaml::from_str::<serde_yaml::Value>(&rendered)
                .unwrap_or_else(|error| panic!("{name} no longer parses: {error}"));
        }
    }

    #[test]
    fn a_path_write_reads_back_as_the_subset_it_claims_to_be() {
        let mut mapping = Mapping::parse(PROPERTIES).unwrap();
        mapping.set_path_bool(&["properties", "start", "enabled"], true, &[]);
        mapping.set_path_sequence(
            &["properties", "estimate", "values"],
            &["xs".to_owned(), "s".to_owned()],
            &[],
        );
        let rendered = mapping.render();
        validate_subset(&rendered).expect("a path write stays inside the subset");
        assert!(serde_yaml::from_str::<serde_yaml::Value>(&rendered).is_ok());
    }

    #[test]
    fn plain_style_is_used_only_when_it_reads_back_unchanged() {
        assert_eq!(encode_scalar("Add retry support"), "Add retry support");
        assert_eq!(
            encode_scalar("2026-07-29T00:00:00Z"),
            "2026-07-29T00:00:00Z"
        );
        assert_eq!(encode_scalar("in_progress"), "in_progress");
        assert_eq!(encode_scalar("Fix bug, then ship"), "Fix bug, then ship");
        assert_eq!(encode_scalar("emoji 🦉 title"), "emoji 🦉 title");
        assert_eq!(encode_scalar("Fix: the worker"), "\"Fix: the worker\"");
        assert_eq!(encode_scalar("42"), "\"42\"");
        assert_eq!(encode_scalar("1.5"), "\"1.5\"");
        assert_eq!(encode_scalar("12:30"), "\"12:30\"");
        assert_eq!(encode_scalar("true"), "\"true\"");
        assert_eq!(encode_scalar("no"), "\"no\"");
        assert_eq!(encode_scalar(""), "\"\"");
        assert_eq!(encode_scalar("- leading dash"), "\"- leading dash\"");
        assert_eq!(encode_scalar("*emphasis*"), "\"*emphasis*\"");
        assert_eq!(encode_scalar("trailing space "), "\"trailing space \"");
        assert_eq!(encode_scalar("line\nbreak"), "\"line\\nbreak\"");
        assert_eq!(encode_scalar("hash # comment"), "\"hash # comment\"");
        // A quote only opens a quoted scalar in first position.
        assert_eq!(encode_scalar("quote \" inside"), "quote \" inside");
        assert_eq!(encode_scalar("\"quoted\""), "\"\\\"quoted\\\"\"");
    }

    #[test]
    fn every_encoded_scalar_deserializes_back_to_itself() {
        for value in [
            "Add retry support",
            "2026-07-29T00:00:00Z",
            "Fix: the worker",
            "Fix bug, then ship",
            "42",
            "1.5",
            "12:30",
            "true",
            "no",
            "",
            "- leading dash",
            "*emphasis*",
            "trailing space ",
            "line\nbreak",
            "quote \" inside",
            "hash # comment",
            "emoji 🦉 title",
            "a0V",
            "[bracketed]",
            "100% faster",
        ] {
            let document = format!("title: {}\n", encode_scalar(value));
            let parsed: BTreeMap<String, String> =
                serde_yaml::from_str(&document).unwrap_or_else(|error| {
                    panic!("{value:?} encoded to invalid YAML {document:?}: {error}")
                });
            assert_eq!(parsed["title"], value, "round trip changed {value:?}");
        }
    }

    #[test]
    fn the_subset_accepts_the_constructs_the_format_documents() {
        validate_subset(FRONTMATTER).unwrap();
        validate_subset("people: {}\nlabels: {}\n").unwrap();
        validate_subset("body: |\n  *not* an alias\n  &nor an anchor\nnext: 1\n").unwrap();
        validate_subset("quoted: \"* not an alias\"\nlist:\n  - \"- item\"\n").unwrap();
        validate_subset("nested:\n  a: 1\n  b: 2\nother:\n  a: 1\n").unwrap();
        validate_subset("items:\n  - name: a\n    id: 1\n  - name: b\n    id: 2\n").unwrap();
        validate_subset("actor:\n  type: agent\n  id: claude-code\nkind: update\n").unwrap();
    }

    #[test]
    fn the_subset_rejects_graph_and_ambiguity_constructs() {
        let cases = [
            ("base: &anchor\n  a: 1\n", "anchor"),
            ("use: *anchor\n", "alias"),
            ("merged:\n  <<: { a: 1 }\n", "merge key"),
            ("tagged: !!binary aGk=\n", "tag"),
            ("a: 1\n...\nb: 2\n", "document"),
            ("a: 1\na: 2\n", "duplicate key: a"),
            ("outer:\n  a: 1\n  a: 2\n", "duplicate key: a"),
            ("a:\n\tb: 1\n", "tab"),
        ];
        for (raw, expected) in cases {
            let message = validate_subset(raw).unwrap_err().message;
            assert!(
                message.contains(expected),
                "{raw:?} should be rejected for {expected}, got {message}"
            );
        }
    }

    #[test]
    fn a_line_that_is_not_a_key_is_reported_with_its_line_number() {
        let diagnostic = Mapping::parse("format: longclaw.ticket/v1\nloose text\n").unwrap_err();
        assert_eq!(diagnostic.line, Some(2));
    }
}
