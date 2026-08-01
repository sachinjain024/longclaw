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

    pub fn set_scalar(&mut self, key: &str, value: &str) {
        self.set_block(key, format!("{key}: {}\n", encode_scalar(value)), &[]);
    }

    /// Sets a scalar, inserting a missing key directly after the last of
    /// `after` that exists so app-written keys keep the documented order.
    pub fn set_scalar_after(&mut self, key: &str, value: &str, after: &[&str]) {
        self.set_block(key, format!("{key}: {}\n", encode_scalar(value)), after);
    }

    pub fn set_sequence_after(&mut self, key: &str, values: &[String], after: &[&str]) {
        self.set_block(key, render_sequence(key, values), after);
    }

    pub fn remove(&mut self, key: &str) {
        self.blocks.retain(|block| match block {
            Block::Entry { key: name, .. } => name != key,
            Block::Preamble(_) => true,
        });
    }

    /// Sets one field of one child of a nested mapping — `labels` → `storage` →
    /// `name` — creating the child, or the mapping itself, when it is not there
    /// yet. Every other child keeps its bytes, and so does every other line of
    /// the edited child, which is what lets a label rename leave a key this build
    /// does not interpret exactly where its author put it.
    pub fn set_nested_scalar(
        &mut self,
        key: &str,
        child: &str,
        field: &str,
        value: &str,
        after: &[&str],
    ) {
        let mut nested = self.nested(key);
        nested.set_field(child, field, value);
        self.set_block(key, nested.render(key), after);
    }

    /// Removes one child of a nested mapping. An emptied mapping collapses to
    /// flow style rather than losing its key, because a bare `key:` reads back as
    /// null and would stop the file parsing.
    pub fn remove_nested(&mut self, key: &str, child: &str) {
        let mut nested = self.nested(key);
        if nested.remove_child(child) {
            self.set_block(key, nested.render(key), &[]);
        }
    }

    fn nested(&self, key: &str) -> NestedMapping {
        self.blocks
            .iter()
            .find_map(|block| match block {
                Block::Entry { key: name, raw } if name == key => Some(NestedMapping::parse(raw)),
                _ => None,
            })
            .unwrap_or_default()
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

/// The children of one top-level entry whose value is a mapping, such as
/// `labels:`. Each child owns the exact bytes of its own block, so an edit to one
/// of them is the only thing that changes.
#[derive(Debug, Default)]
struct NestedMapping {
    /// Comments and blank lines between the key and its first child.
    preamble: String,
    children: Vec<(String, String)>,
    /// The indentation the file already uses, so an edit matches the surrounding
    /// file rather than imposing its own.
    child_indent: Option<usize>,
    field_indent: Option<usize>,
}

impl NestedMapping {
    /// Splits a whole entry block, header line included, into its children.
    fn parse(raw: &str) -> Self {
        let mut nested = Self::default();
        for (_, line) in lines_with_endings(raw).into_iter().skip(1) {
            let indent = indent_of(line);
            let opens_child = !is_ignorable(line)
                && nested
                    .child_indent
                    .is_none_or(|expected| indent == expected)
                && line.trim_start().split_once(':').is_some();
            if opens_child {
                nested.child_indent.get_or_insert(indent);
                let key = line
                    .trim()
                    .split_once(':')
                    .map_or_else(String::new, |(key, _)| key.trim_end().to_owned());
                nested.children.push((key, line.to_owned()));
                continue;
            }
            if !is_ignorable(line) && !nested.children.is_empty() {
                nested.field_indent.get_or_insert(indent);
            }
            match nested.children.last_mut() {
                Some((_, block)) => block.push_str(line),
                None => nested.preamble.push_str(line),
            }
        }
        nested
    }

    fn render(&self, key: &str) -> String {
        let mut rendered = if self.children.is_empty() {
            format!("{key}: {{}}\n")
        } else {
            format!("{key}:\n")
        };
        rendered.push_str(&self.preamble);
        for (_, block) in &self.children {
            rendered.push_str(block);
        }
        rendered
    }

    fn set_field(&mut self, child: &str, field: &str, value: &str) {
        let child_indent = self.child_indent.unwrap_or(2);
        let field_indent = self.field_indent.unwrap_or(child_indent + 2);
        let line = format!(
            "{:field_indent$}{field}: {}\n",
            "",
            encode_scalar(value),
            field_indent = field_indent
        );
        match self.children.iter_mut().find(|(name, _)| name == child) {
            Some((_, block)) => *block = set_child_field(block, field, &line),
            None => self.children.push((
                child.to_owned(),
                format!(
                    "{:child_indent$}{child}:\n{line}",
                    "",
                    child_indent = child_indent
                ),
            )),
        }
    }

    fn remove_child(&mut self, child: &str) -> bool {
        let before = self.children.len();
        self.children.retain(|(name, _)| name != child);
        self.children.len() != before
    }
}

/// Rewrites one field line inside a child's block, or adds it after the last line
/// that carries content so a new field lands with the fields rather than below a
/// trailing comment.
fn set_child_field(block: &str, field: &str, rendered_line: &str) -> String {
    let lines = lines_with_endings(block);
    // From index 1: index 0 is the child's own key line, which is not a field.
    let existing = lines.iter().skip(1).position(|(_, line)| {
        line.trim_start()
            .split_once(':')
            .is_some_and(|(key, _)| key.trim_end() == field)
    });
    let last_content = lines.iter().rposition(|(_, line)| !is_ignorable(line));
    let mut rendered = String::with_capacity(block.len() + rendered_line.len());
    for (index, (_, line)) in lines.iter().enumerate() {
        if existing.map(|found| found + 1) == Some(index) {
            rendered.push_str(rendered_line);
        } else {
            rendered.push_str(line);
        }
        if existing.is_none() && Some(index) == last_content {
            rendered.push_str(rendered_line);
        }
    }
    rendered
}

fn indent_of(line: &str) -> usize {
    line.len() - line.trim_start_matches(' ').len()
}

fn render_sequence(key: &str, values: &[String]) -> String {
    if values.is_empty() {
        return format!("{key}: []\n");
    }
    let mut rendered = format!("{key}:\n");
    for value in values {
        rendered.push_str("  - ");
        rendered.push_str(&encode_scalar(value));
        rendered.push('\n');
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
        mapping.set_nested_scalar("labels", "storage", "name", "Persistence", &["people"]);
        assert_eq!(
            mapping.render(),
            NESTED.replace("    name: Storage\n", "    name: Persistence\n")
        );
    }

    #[test]
    fn a_nested_field_the_child_lacks_joins_the_ones_it_has() {
        let mut mapping = Mapping::parse(NESTED).unwrap();
        mapping.set_nested_scalar("labels", "reliability", "color", "amber", &["people"]);
        assert!(mapping
            .render()
            .contains("  reliability:\n    name: Reliability\n    color: amber\npeople: {}\n"));
    }

    #[test]
    fn a_nested_child_that_is_not_there_yet_is_appended() {
        let mut mapping = Mapping::parse(NESTED).unwrap();
        mapping.set_nested_scalar("labels", "backend", "name", "Backend", &["people"]);
        assert!(mapping
            .render()
            .contains("  backend:\n    name: Backend\npeople: {}\n"));
    }

    #[test]
    fn a_nested_mapping_that_is_not_there_yet_lands_after_its_predecessor() {
        let mut mapping = Mapping::parse("name: Minimal\npeople: {}\n").unwrap();
        mapping.set_nested_scalar("labels", "backend", "name", "Backend", &["name", "people"]);
        assert_eq!(
            mapping.render(),
            "name: Minimal\npeople: {}\nlabels:\n  backend:\n    name: Backend\n"
        );
    }

    #[test]
    fn a_flow_style_empty_mapping_becomes_a_block_when_it_gains_a_child() {
        let mut mapping = Mapping::parse("labels: {}\n").unwrap();
        mapping.set_nested_scalar("labels", "backend", "name", "Backend", &[]);
        assert_eq!(mapping.render(), "labels:\n  backend:\n    name: Backend\n");
    }

    #[test]
    fn removing_a_nested_child_removes_only_that_child() {
        let mut mapping = Mapping::parse(NESTED).unwrap();
        mapping.remove_nested("labels", "storage");
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
        mapping.remove_nested("labels", "storage");
        assert_eq!(mapping.render(), "labels: {}\n");
    }

    #[test]
    fn removing_a_nested_child_that_is_not_there_changes_nothing() {
        let mut mapping = Mapping::parse(NESTED).unwrap();
        mapping.remove_nested("labels", "absent");
        assert_eq!(mapping.render(), NESTED);
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
