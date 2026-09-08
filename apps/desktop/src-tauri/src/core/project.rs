//! `.longclaw/longclaw.yaml`: project identity, the people registry, and label
//! definitions.
//!
//! Small and infrequently changed, but it is the file that decides whether a
//! folder is a LongClaw project at all. Invalid metadata is therefore a
//! project-level failure that is reported rather than repaired (ADR 0010), and
//! like a ticket, the document keeps its bytes so a theme change does not
//! reformat a registry the app did not touch.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::error::Diagnostic;
use super::ticket::{render_new_ticket, Property};
use super::yaml::{encode_scalar, Mapping};

pub const PROJECT_FORMAT: &str = "longclaw.project/v1";
const FORMAT_FAMILY: &str = "longclaw.project/v";
pub const DEFAULT_THEME: &str = "indigo";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Label {
    pub name: String,
    pub color: String,
}

// --------------------------------------------------- the four ticket properties

/// The estimate scale a project is on.
///
/// A project is on exactly one. Switching never rewrites a ticket: a value
/// written under the old system stays exactly as it was and reads as unreadable
/// under the new one, which is format invariant 16.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EstimateSystem {
    /// The fallback for a project that enables estimates without naming a
    /// system. It is the one system whose vocabulary is already in the file —
    /// `values` is seeded for it — so a bare `enabled: true` is usable rather
    /// than a project that refuses to open over a missing key.
    #[default]
    Tshirt,
    Fibonacci,
    Duration,
}

impl EstimateSystem {
    pub const ALL: [Self; 3] = [Self::Tshirt, Self::Fibonacci, Self::Duration];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Tshirt => "tshirt",
            Self::Fibonacci => "fibonacci",
            Self::Duration => "duration",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|system| system.as_str() == value)
    }
}

/// The Fibonacci scale, which is fixed: a project on Fibonacci has nothing to
/// configure, so unlike the other two systems this is not a project setting.
pub const FIBONACCI_SCALE: [&str; 6] = ["1", "2", "3", "5", "8", "13"];

/// What `properties.type.values` holds when Type is first enabled. Seeds rather
/// than constants — the registry is editable afterwards, and a project that
/// deletes `spike` keeps it deleted.
pub const SEEDED_TYPE_VALUES: [(&str, &str, &str); 5] = [
    ("bug", "Bug", "red"),
    ("feature", "Feature", "cyan"),
    ("chore", "Chore", "gray"),
    ("docs", "Docs", "blue"),
    ("spike", "Spike", "purple"),
];

/// What `properties.estimate.values` holds when Estimate is first enabled, in
/// order.
pub const SEEDED_TSHIRT_SCALE: [&str; 5] = ["xs", "s", "m", "l", "xl"];

pub const DEFAULT_ATTENTION_DAYS: u32 = 7;
pub const DEFAULT_HOURS_PER_DAY: f64 = 8.0;
pub const DEFAULT_DAYS_PER_WEEK: f64 = 5.0;

/// Type: one project-defined slug per ticket.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeConfig {
    #[serde(default)]
    pub enabled: bool,
    /// Slug to definition, shaped exactly like `labels`, because a type value is
    /// the same kind of thing: a name and a colour that tickets refer to by
    /// slug. Renaming or recolouring one therefore rewrites no ticket.
    #[serde(default)]
    pub values: BTreeMap<String, Label>,
}

/// Due date, and the width of its approaching window.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DueConfig {
    #[serde(default)]
    pub enabled: bool,
    /// How many days ahead count as approaching. `0` is legal and empties that
    /// rung, leaving today and beyond; a negative value is refused, which is
    /// what the unsigned type says. Overdue and today are absolute, so this is
    /// the only boundary a project can move.
    #[serde(default = "default_attention_days", alias = "attention_days")]
    pub attention_days: u32,
}

impl Default for DueConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            attention_days: DEFAULT_ATTENTION_DAYS,
        }
    }
}

/// Start date. `enabled` is the only key every property has, and start has
/// nothing else: a start date is a day, and no window is measured from it.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartConfig {
    #[serde(default)]
    pub enabled: bool,
}

/// Estimate: the system, its vocabulary, and the conversion that makes durations
/// comparable.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EstimateConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub system: EstimateSystem,
    /// The t-shirt scale, in order, read only under `tshirt`.
    ///
    /// A sequence rather than a mapping because a scale is ordered and a mapping
    /// is not: `xs s m l xl` keyed by slug comes back `l m s xl xs`, which is
    /// not a scale at all. `type.values` can be a mapping precisely because
    /// types have no order to lose.
    #[serde(default)]
    pub values: Vec<String>,
    /// Read only under `duration`. The conversion is a project setting rather
    /// than a constant because `4h` against `1d` cannot be ordered without
    /// knowing how long a working day is.
    #[serde(default = "default_hours_per_day", alias = "hours_per_day")]
    pub hours_per_day: f64,
    #[serde(default = "default_days_per_week", alias = "days_per_week")]
    pub days_per_week: f64,
}

impl Default for EstimateConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            system: EstimateSystem::default(),
            values: Vec::new(),
            hours_per_day: DEFAULT_HOURS_PER_DAY,
            days_per_week: DEFAULT_DAYS_PER_WEEK,
        }
    }
}

impl EstimateConfig {
    /// Whether this project's current system can read `value`.
    ///
    /// This decides what may be newly *written*, never what is kept: a stored
    /// value the system cannot read is preserved and simply reads as unreadable
    /// (invariant 16), which is what makes switching systems reversible.
    pub fn accepts(&self, value: &str) -> bool {
        match self.system {
            EstimateSystem::Tshirt => self.values.iter().any(|slug| slug == value),
            EstimateSystem::Fibonacci => FIBONACCI_SCALE.contains(&value),
            EstimateSystem::Duration => parse_duration(value).is_some(),
        }
    }

    /// What this system accepts, phrased for a refusal message.
    pub fn vocabulary(&self) -> String {
        match self.system {
            EstimateSystem::Tshirt => {
                if self.values.is_empty() {
                    "this project's t-shirt scale, which defines no values yet".to_owned()
                } else {
                    format!("one of {}", self.values.join(", "))
                }
            }
            EstimateSystem::Fibonacci => format!("one of {}", FIBONACCI_SCALE.join(", ")),
            EstimateSystem::Duration => "a number and a unit, such as 2h, 1.5d or 1w".to_owned(),
        }
    }
}

/// The four opt-in ticket properties as this project configures them.
///
/// Every field defaults, so a `longclaw.yaml` with no `properties:` block at all
/// — which is every project file written before this build — reads as all four
/// disabled and needs no migration.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PropertiesConfig {
    /// `type` on disk and on the wire. The field cannot be called that in Rust,
    /// and renaming the wire key instead would make the config disagree with the
    /// ticket key it configures.
    #[serde(default, rename = "type")]
    pub ticket_type: TypeConfig,
    #[serde(default)]
    pub due: DueConfig,
    #[serde(default)]
    pub start: StartConfig,
    #[serde(default)]
    pub estimate: EstimateConfig,
}

impl PropertiesConfig {
    /// Whether a property may be written at all. A disabled property is refused
    /// by the creation surfaces and preserved by the reader — the two halves of
    /// "disabling hides, it never deletes".
    pub fn is_enabled(&self, property: Property) -> bool {
        match property {
            Property::Type => self.ticket_type.enabled,
            Property::Due => self.due.enabled,
            Property::Start => self.start.enabled,
            Property::Estimate => self.estimate.enabled,
        }
    }

    /// The enabled set, in the order the format documents them. What
    /// `.longclaw/AGENTS.md` lists and what a menu offers.
    pub fn enabled(&self) -> Vec<Property> {
        Property::ALL
            .into_iter()
            .filter(|property| self.is_enabled(*property))
            .collect()
    }
}

fn default_attention_days() -> u32 {
    DEFAULT_ATTENTION_DAYS
}

fn default_hours_per_day() -> f64 {
    DEFAULT_HOURS_PER_DAY
}

fn default_days_per_week() -> f64 {
    DEFAULT_DAYS_PER_WEEK
}

/// Splits a duration estimate into its amount and unit, or `None` when it is not
/// one.
///
/// One number and one unit. `1d4h` is refused rather than summed: two units in
/// one value make its meaning depend on `hours_per_day`, which the project can
/// change underneath the ticket. Decimals carry that case instead — `1.5d`.
pub fn parse_duration(value: &str) -> Option<(f64, char)> {
    if !value.is_ascii() {
        return None;
    }
    let (amount, unit) = value.split_at(value.len().checked_sub(1)?);
    let unit = unit.chars().next()?;
    if !matches!(unit, 'm' | 'h' | 'd' | 'w') {
        return None;
    }
    let digits = amount.bytes().filter(u8::is_ascii_digit).count();
    let points = amount.bytes().filter(|byte| *byte == b'.').count();
    if digits + points != amount.len() || points > 1 || digits == 0 {
        return None;
    }
    // A leading or trailing point would parse — `.5` and `5.` are both f64 — and
    // both are spellings of a number this format does not write.
    if amount.starts_with('.') || amount.ends_with('.') {
        return None;
    }
    let parsed: f64 = amount.parse().ok()?;
    (parsed > 0.0).then_some((parsed, unit))
}

/// A project as its file describes it.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    /// Immutable after the first ticket exists: changing it would rename every
    /// human-facing ticket key and directory.
    pub key: String,
    /// A fixed preset id. The frontend owns the preset list and falls back to its
    /// default for a value it does not recognize, without rewriting the file.
    pub theme: String,
    pub created_at: String,
    pub people: BTreeMap<String, Person>,
    pub labels: BTreeMap<String, Label>,
    /// How this project configures the four opt-in ticket properties, and where
    /// their vocabularies live (ADR 0013). Absent from the file means all four
    /// off.
    pub properties: PropertiesConfig,
    pub unknown_keys: Vec<String>,
}

/// `longclaw.yaml`, parsed but never rewritten wholesale.
#[derive(Debug, Clone)]
pub struct ProjectDocument {
    mapping: Mapping,
    project: Project,
}

impl ProjectDocument {
    pub fn parse(raw: &str) -> Result<Self, Diagnostic> {
        let mapping = Mapping::parse(raw)?;
        let fields: ProjectFields = serde_yaml::from_str(raw).map_err(|error| {
            let diagnostic = Diagnostic::parse(format!("Project metadata is invalid: {error}"));
            match error.location() {
                Some(location) => diagnostic.at_line(location.line() as u32),
                None => diagnostic,
            }
        })?;

        if fields.format != PROJECT_FORMAT {
            return Err(if fields.format.starts_with(FORMAT_FAMILY) {
                Diagnostic::unsupported_version(format!(
                    "This project declares {}. This build reads {PROJECT_FORMAT}, so the \
                     project is shown read-only instead of being migrated.",
                    fields.format
                ))
            } else {
                Diagnostic::parse(format!(
                    "format must be {PROJECT_FORMAT}; found {}",
                    fields.format
                ))
            });
        }
        for (field, value) in [("id", &fields.id), ("name", &fields.name)] {
            if value.trim().is_empty() {
                return Err(Diagnostic::parse(format!("{field} must not be empty")));
            }
        }
        if !is_project_key(&fields.key) {
            return Err(Diagnostic::parse(format!(
                "key is the immutable prefix of every ticket key, so it must be uppercase \
                 letters and digits starting with a letter; found {:?}",
                fields.key
            )));
        }
        validate_theme(&fields.theme)?;
        if chrono::DateTime::parse_from_rfc3339(&fields.created_at)
            .is_ok_and(|parsed| parsed.offset().local_minus_utc() == 0)
        {
            // Accepted.
        } else {
            return Err(Diagnostic::parse(format!(
                "created_at must be a UTC RFC 3339 timestamp such as 2026-07-29T00:00:00Z; \
                 found {}",
                fields.created_at
            )));
        }

        let unknown_keys = mapping
            .keys()
            .filter(|key| !KNOWN_KEYS.contains(key))
            .map(str::to_owned)
            .collect();

        Ok(Self {
            mapping,
            project: Project {
                id: fields.id,
                name: fields.name,
                key: fields.key,
                theme: fields.theme,
                created_at: fields.created_at,
                people: fields.people,
                labels: fields.labels,
                properties: fields.properties,
                unknown_keys,
            },
        })
    }

    pub fn project(&self) -> &Project {
        &self.project
    }

    pub fn render(&self) -> String {
        self.mapping.render()
    }

    /// Rewrites the theme line and nothing else.
    pub fn set_theme(&mut self, theme: &str) -> Result<Vec<u8>, Diagnostic> {
        validate_theme(theme)?;
        self.mapping.set_scalar("theme", theme);
        self.project.theme = theme.to_owned();
        Ok(self.render().into_bytes())
    }

    /// Rewrites the display name and nothing else. The key stays immutable.
    pub fn set_name(&mut self, name: &str) -> Result<Vec<u8>, Diagnostic> {
        let name = name.trim();
        if !is_project_name(name) {
            return Err(Diagnostic::parse(PROJECT_NAME_RULE));
        }
        self.mapping.set_scalar("name", name);
        self.project.name = name.to_owned();
        Ok(self.render().into_bytes())
    }

    /// Defines a label. Only the definition is written: a ticket carries the slug,
    /// so there is nothing on a ticket for this to create.
    pub fn add_label(
        &mut self,
        slug: &str,
        name: &str,
        color: &str,
    ) -> Result<Vec<u8>, Diagnostic> {
        if !is_label_slug(slug) {
            return Err(Diagnostic::parse(format!(
                "{LABEL_SLUG_RULE}; found {slug:?}"
            )));
        }
        if self.project.labels.contains_key(slug) {
            return Err(Diagnostic::parse(format!(
                "The label {slug} is already defined in this project"
            )));
        }
        let name = validated_label_name(name)?;
        validate_label_color(color)?;
        self.write_label(slug, Some(&name), Some(color));
        self.project.labels.insert(
            slug.to_owned(),
            Label {
                name,
                color: color.to_owned(),
            },
        );
        Ok(self.render().into_bytes())
    }

    /// Renames a label, recolours it, or both.
    ///
    /// The slug never moves: it is what every ticket carrying this label stores,
    /// so renaming a definition rewrites no ticket at all. Absent means "leave
    /// this alone", matching how a ticket edit reads its fields.
    pub fn update_label(
        &mut self,
        slug: &str,
        name: Option<&str>,
        color: Option<&str>,
    ) -> Result<Vec<u8>, Diagnostic> {
        let Some(mut label) = self.project.labels.get(slug).cloned() else {
            return Err(unknown_label(slug));
        };
        if name.is_none() && color.is_none() {
            return Err(Diagnostic::parse("A label edit has to change something"));
        }
        let name = name.map(validated_label_name).transpose()?;
        if let Some(color) = color {
            validate_label_color(color)?;
        }
        self.write_label(slug, name.as_deref(), color);
        if let Some(name) = name {
            label.name = name;
        }
        if let Some(color) = color {
            label.color = color.to_owned();
        }
        self.project.labels.insert(slug.to_owned(), label);
        Ok(self.render().into_bytes())
    }

    /// Removes a label definition, and only the definition.
    ///
    /// Tickets keep the slug. An undefined slug is preserved and rendered as
    /// itself, so losing a definition is never a reason to rewrite the tickets
    /// that carry it.
    pub fn remove_label(&mut self, slug: &str) -> Result<Vec<u8>, Diagnostic> {
        if self.project.labels.remove(slug).is_none() {
            return Err(unknown_label(slug));
        }
        self.mapping.remove_nested("labels", slug);
        Ok(self.render().into_bytes())
    }

    fn write_label(&mut self, slug: &str, name: Option<&str>, color: Option<&str>) {
        for (field, value) in [("name", name), ("color", color)] {
            if let Some(value) = value {
                self.mapping.set_nested_scalar(
                    "labels",
                    slug,
                    field,
                    value,
                    &["created_at", "people"],
                );
            }
        }
    }
}

fn unknown_label(slug: &str) -> Diagnostic {
    Diagnostic::parse(format!("This project defines no label {slug}"))
}

fn validated_label_name(name: &str) -> Result<String, Diagnostic> {
    let name = name.trim();
    if !is_label_name(name) {
        return Err(Diagnostic::parse(LABEL_NAME_RULE));
    }
    Ok(name.to_owned())
}

fn validate_label_color(color: &str) -> Result<(), Diagnostic> {
    if !is_label_color(color) {
        return Err(Diagnostic::parse(format!(
            "A label color is a preset id without whitespace; found {color:?}"
        )));
    }
    Ok(())
}

const KNOWN_KEYS: [&str; 9] = [
    "format",
    "id",
    "name",
    "key",
    "theme",
    "created_at",
    "people",
    "labels",
    "properties",
];

#[derive(Debug, Deserialize)]
struct ProjectFields {
    format: String,
    id: String,
    name: String,
    key: String,
    #[serde(default = "default_theme")]
    theme: String,
    created_at: String,
    #[serde(default)]
    people: BTreeMap<String, Person>,
    #[serde(default)]
    labels: BTreeMap<String, Label>,
    #[serde(default)]
    properties: PropertiesConfig,
}

fn default_theme() -> String {
    DEFAULT_THEME.to_owned()
}

impl<'de> Deserialize<'de> for Person {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        struct Fields {
            name: String,
        }
        Fields::deserialize(deserializer).map(|fields| Self { name: fields.name })
    }
}

impl<'de> Deserialize<'de> for Label {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        struct Fields {
            name: String,
            #[serde(default = "default_label_color")]
            color: String,
        }
        Fields::deserialize(deserializer).map(|fields| Self {
            name: fields.name,
            color: fields.color,
        })
    }
}

pub const DEFAULT_LABEL_COLOR: &str = "slate";

fn default_label_color() -> String {
    DEFAULT_LABEL_COLOR.to_owned()
}

pub const PROJECT_NAME_RULE: &str = "A project name is a single line of 1 to 120 characters";

/// The one project-name rule, so creating a project and renaming one cannot
/// disagree about what a name is. Callers trim first.
pub fn is_project_name(name: &str) -> bool {
    !name.is_empty() && name.chars().count() <= 120 && !name.contains('\n')
}

pub const LABEL_NAME_RULE: &str = "A label name is a single line of 1 to 60 characters";
pub const LABEL_SLUG_RULE: &str = "A label slug is lowercase letters and digits, \
                                   optionally separated by - or _, starting with a letter";

/// The one label-slug grammar.
///
/// A slug is a key in `longclaw.yaml` and a value in the `labels` list of every
/// ticket that carries the label, so it has to stay a plain YAML scalar in both
/// places, and it has to be typeable in a label menu. Only new definitions are
/// held to it: a slug an agent already wrote is preserved and rendered as itself.
pub fn is_label_slug(slug: &str) -> bool {
    let mut characters = slug.chars();
    characters
        .next()
        .is_some_and(|first| first.is_ascii_lowercase())
        && characters.all(|character| {
            character.is_ascii_lowercase()
                || character.is_ascii_digit()
                || matches!(character, '-' | '_')
        })
}

/// The display name of a label. Shorter than a project name, because it renders
/// as a chip on a card rather than as a heading.
pub fn is_label_name(name: &str) -> bool {
    !name.is_empty() && name.chars().count() <= 60 && !name.contains('\n')
}

/// A preset id, like the project theme: the frontend owns the palette and falls
/// back for a value it does not recognize, instead of the file being rewritten.
pub fn is_label_color(color: &str) -> bool {
    is_theme_id(color)
}

/// A preset id. The frontend owns the preset list, so an unfamiliar-but-well-formed
/// value is accepted here and falls back to the default when rendered, rather than
/// making the project unopenable.
pub fn is_theme_id(theme: &str) -> bool {
    !theme.is_empty() && !theme.chars().any(char::is_whitespace)
}

fn validate_theme(theme: &str) -> Result<(), Diagnostic> {
    if !is_theme_id(theme) {
        return Err(Diagnostic::parse(format!(
            "theme is a preset id without whitespace; found {theme:?}"
        )));
    }
    Ok(())
}

/// The one project-key grammar: uppercase ASCII letters and digits, starting
/// with a letter.
///
/// The key is the immutable prefix of every ticket key and of every ticket
/// directory name, so `storage::valid_ticket_key` enforces this same rule on a
/// prefix rather than a second, looser one. Length is deliberately not part of
/// the grammar: an existing project keeps whatever key it was created with, and
/// the creation surfaces cap a new key instead. The shared case table is
/// `fixtures/project-key-grammar.json`.
pub fn is_project_key(key: &str) -> bool {
    let mut characters = key.chars();
    characters
        .next()
        .is_some_and(|first| first.is_ascii_uppercase())
        && characters.all(|character| character.is_ascii_uppercase() || character.is_ascii_digit())
}

/// Renders a new project file. The one place `longclaw.yaml` is written from
/// nothing; every later change edits the lines it owns.
pub fn render_new_project(id: &str, name: &str, key: &str, theme: &str, now: &str) -> String {
    let mut rendered = String::new();
    rendered.push_str(&format!("format: {PROJECT_FORMAT}\n"));
    rendered.push_str(&format!("id: {}\n", encode_scalar(id)));
    rendered.push_str(&format!("name: {}\n", encode_scalar(name)));
    rendered.push_str(&format!("key: {}\n", encode_scalar(key)));
    rendered.push_str(&format!("theme: {}\n", encode_scalar(theme)));
    rendered.push_str(&format!("created_at: {}\n", encode_scalar(now)));
    rendered.push_str("people: {}\n");
    rendered.push_str("labels: {}\n");
    rendered
}

/// The generated agent-facing editing contract for a project.
///
/// LongClaw owns `.longclaw/AGENTS.md` and never touches an unrelated `AGENTS.md`
/// at the repository root.
pub fn render_agent_contract(project: &Project) -> String {
    let example_key = format!("{}-1", project.key);
    format!(
        "# Editing {name} with an agent\n\
         \n\
         LongClaw generated this file. It describes how to read and change this\n\
         project's canonical files without losing data.\n\
         \n\
         ## Canonical files\n\
         \n\
         - `.longclaw/longclaw.yaml` — project identity, people, and label definitions.\n\
         - `.longclaw/tickets/<KEY>/ticket.md` — the complete structured record for one ticket.\n\
         - `.longclaw/tickets/<KEY>/attachments/` — that ticket's attachment bytes.\n\
         \n\
         Read a ticket's `ticket.md` first. Open files under `attachments/` only when\n\
         the ticket references one and you need it. This file is documentation, not\n\
         project data.\n\
         \n\
         ## What you may change\n\
         \n\
         | Field | Rule |\n\
         |---|---|\n\
         | `title` | one line |\n\
         | `status` | one of `backlog`, `todo`, `in_progress`, `in_review`, `done`, `canceled` |\n\
         | `priority` | one of `urgent`, `p1`, `p2`, `p3`, `p4`, `none` |\n\
         | `labels` | slugs defined in `longclaw.yaml` |\n\
         | description | any CommonMark outside the reserved sections |\n\
         | checklist | flip `[ ]` to `[x]`, or append a task |\n\
         | activity | append a bounded record; never edit or delete an existing one |\n\
         \n\
         Do not change `format`, `id`, `key`, `created_at`, or `rank`. LongClaw owns\n\
         `rank`; preserve any value you find and do not invent one. Keep every key you\n\
         do not understand exactly as it is.\n\
         \n\
         ## Timestamps and attribution\n\
         \n\
         Timestamps are UTC RFC 3339 strings such as `2026-07-29T09:12:31Z`. Set\n\
         `updated_at` when you change ticket state. Attribute yourself explicitly:\n\
         \n\
         ```yaml\n\
         actor:\n\
         \x20 type: agent\n\
         \x20 id: your-tool-id\n\
         \x20 name: Your Tool\n\
         ```\n\
         \n\
         `type` is `human`, `agent`, or `unknown` — never guess. An agent is never an\n\
         assignee.\n\
         \n\
         ## Checking off a checklist item\n\
         \n\
         Before:\n\
         \n\
         ```md\n\
         - [ ] Add retry policy <!-- longclaw:item=ck_7d2a -->\n\
         ```\n\
         \n\
         After:\n\
         \n\
         ```md\n\
         - [x] Add retry policy <!-- longclaw:item=ck_7d2a -->\n\
         ```\n\
         \n\
         Keep the `longclaw:item` marker. It is how a change is attributed to that\n\
         item. A task you append without a marker still works; LongClaw adopts it and\n\
         mints an id on its next write.\n\
         \n\
         ## Appending an activity entry\n\
         \n\
         Add to the end of the `## Activity` section, inside the markers:\n\
         \n\
         ```md\n\
         <!-- longclaw:event\n\
         id: evt_4b91c07a\n\
         kind: update\n\
         occurred_at: 2026-07-29T09:12:31Z\n\
         actor:\n\
         \x20 type: agent\n\
         \x20 id: your-tool-id\n\
         \x20 name: Your Tool\n\
         changes:\n\
         \x20 - field: status\n\
         \x20   from: todo\n\
         \x20   to: in_progress\n\
         -->\n\
         ### Your Tool updated this ticket\n\
         \n\
         What you did and what is left.\n\
         <!-- /longclaw:event -->\n\
         ```\n\
         \n\
         Activity is append-only: correct a mistake by appending another entry. Use\n\
         `kind: comment` with no `changes` for a plain comment. Every `id` must be\n\
         unique within the ticket. If you change state without appending an entry, the\n\
         state still stands and the history is merely incomplete — LongClaw never rolls\n\
         state back to match history.\n\
         \n\
         ## Attachments\n\
         \n\
         Copy the file into the ticket's `attachments/` directory as\n\
         `<attachment-id>-<sanitized-name>`, then register it under `## Attachments`\n\
         with its id, relative `file` path, original `name`, `media_type`, `size`,\n\
         `added_at`, and `added_by`. Copy the bytes first and register second, so an\n\
         interruption leaves a recoverable file rather than an entry pointing at\n\
         nothing. Treat registered files as immutable: replacement means a new id.\n\
         \n\
         ## Writing safely\n\
         \n\
         - Write atomically: write a sibling temporary file, then rename it over\n\
         \x20 `ticket.md`. LongClaw's watcher expects that pattern and will not mistake\n\
         \x20 your write for its own.\n\
         - The YAML subset allows mappings, lists, strings, booleans, nulls, and\n\
         \x20 numbers. No anchors, aliases, tags, merge keys, multiple documents, or\n\
         \x20 duplicate keys. Files are UTF-8 with LF line endings.\n\
         - The frontmatter `key` and the ticket's directory name are one identity. Never\n\
         \x20 change either.\n\
         - If a file will not parse, leave it alone and say so. LongClaw shows an\n\
         \x20 unreadable ticket with its raw contents and a diagnostic rather than\n\
         \x20 repairing it, and so should you.\n\
         \n\
         ## This project\n\
         \n\
         - Name: {name}\n\
         - Ticket keys: `{example_key}`, `{key}-2`, and so on\n\
         - Ticket format: `longclaw.ticket/v1`\n\
         \n\
         {example}\n",
        name = project.name,
        key = project.key,
        example_key = example_key,
        example = example_ticket(&example_key),
    )
}

fn example_ticket(key: &str) -> String {
    let rendered = render_new_ticket(
        key,
        "An example of the shape you are editing",
        super::ticket::Status::Todo,
        super::ticket::Priority::P2,
        "The description is ordinary CommonMark.",
        &["An example task".to_owned()],
        "2026-07-29T00:00:00Z",
    );
    format!("## A complete example\n\n```md\n{rendered}```")
}

#[cfg(test)]
mod tests {
    use super::{
        parse_duration, render_new_project, EstimateConfig, EstimateSystem, ProjectDocument,
        Property, DEFAULT_ATTENTION_DAYS, DEFAULT_DAYS_PER_WEEK, DEFAULT_HOURS_PER_DAY,
        DEFAULT_THEME, PROJECT_FORMAT, SEEDED_TSHIRT_SCALE,
    };
    use crate::core::ErrorCode;

    const PROJECT: &str = concat!(
        "format: longclaw.project/v1\n",
        "id: 019c8c31-4d7e-71ad-8997-e67700962b55\n",
        "name: Representative Project\n",
        "key: LC\n",
        "theme: indigo\n",
        "created_at: 2026-07-29T00:00:00Z\n",
        "people:\n",
        "  sachin:\n",
        "    name: Sachin Jain\n",
        "labels:\n",
        "  storage:\n",
        "    name: Storage\n",
        "    color: blue\n",
        "x_extension: kept\n",
    );

    #[test]
    fn a_project_file_round_trips_and_exposes_its_registries() {
        let document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let project = document.project();
        assert_eq!(document.render(), PROJECT);
        assert_eq!(project.key, "LC");
        assert_eq!(project.theme, "indigo");
        assert_eq!(project.people["sachin"].name, "Sachin Jain");
        assert_eq!(project.labels["storage"].name, "Storage");
        assert_eq!(project.labels["storage"].color, "blue");
        assert_eq!(project.unknown_keys, vec!["x_extension".to_owned()]);
    }

    #[test]
    fn changing_the_theme_rewrites_one_line() {
        let mut document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let bytes = document.set_theme("clay").expect("clay is a preset id");
        let rendered = String::from_utf8(bytes).expect("UTF-8");
        assert_eq!(rendered, PROJECT.replace("theme: indigo", "theme: clay"));
        assert_eq!(document.project().theme, "clay");
    }

    #[test]
    fn changing_the_name_leaves_the_immutable_key_alone() {
        let mut document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let bytes = document.set_name("Renamed Project").expect("a valid name");
        let rendered = String::from_utf8(bytes).expect("UTF-8");
        assert!(rendered.contains("name: Renamed Project\n"));
        assert!(rendered.contains("key: LC\n"));
        assert_eq!(document.project().key, "LC");
    }

    #[test]
    fn defining_a_label_adds_only_its_own_lines() {
        let mut document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let bytes = document
            .add_label("backend", "Backend", "amber")
            .expect("a well-formed definition");
        let rendered = String::from_utf8(bytes).expect("UTF-8");
        // Appended rather than sorted in: the file keeps the order its author
        // chose, and no existing line moves.
        assert_eq!(
            rendered,
            PROJECT.replace(
                "    color: blue\n",
                "    color: blue\n  backend:\n    name: Backend\n    color: amber\n",
            )
        );
        assert_eq!(document.project().labels["backend"].name, "Backend");
        assert_eq!(document.project().labels["backend"].color, "amber");
    }

    #[test]
    fn defining_a_label_twice_is_refused_rather_than_overwriting_it() {
        let mut document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let diagnostic = document
            .add_label("storage", "Something else", "amber")
            .expect_err("storage is already defined");
        assert!(diagnostic.message.contains("storage"), "{diagnostic}");
        assert_eq!(document.render(), PROJECT);
    }

    #[test]
    fn renaming_a_label_changes_the_display_name_and_leaves_the_slug_alone() {
        let mut document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let bytes = document
            .update_label("storage", Some("Persistence"), None)
            .expect("a well-formed name");
        let rendered = String::from_utf8(bytes).expect("UTF-8");
        assert_eq!(
            rendered,
            PROJECT.replace("    name: Storage\n", "    name: Persistence\n")
        );
        assert_eq!(document.project().labels["storage"].name, "Persistence");
        assert_eq!(document.project().labels["storage"].color, "blue");
    }

    #[test]
    fn recolouring_a_label_touches_only_the_colour() {
        let mut document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let bytes = document
            .update_label("storage", None, Some("amber"))
            .expect("a preset colour id");
        let rendered = String::from_utf8(bytes).expect("UTF-8");
        assert_eq!(
            rendered,
            PROJECT.replace("    color: blue\n", "    color: amber\n")
        );
    }

    /// A definition may carry keys a newer writer added. Renaming the label must
    /// leave them where their author put them.
    #[test]
    fn a_key_inside_a_definition_that_this_build_does_not_read_survives_a_rename() {
        let raw = PROJECT.replace(
            "    color: blue\n",
            "    color: blue\n    x_owner: future-version\n",
        );
        let mut document = ProjectDocument::parse(&raw).expect("the project should parse");
        let bytes = document
            .update_label("storage", Some("Persistence"), None)
            .expect("a well-formed name");
        let rendered = String::from_utf8(bytes).expect("UTF-8");
        assert!(rendered.contains("    x_owner: future-version\n"));
        assert_eq!(
            rendered,
            raw.replace("    name: Storage\n", "    name: Persistence\n")
        );
    }

    #[test]
    fn removing_a_definition_removes_its_lines_and_nothing_else() {
        let mut document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let bytes = document.remove_label("storage").expect("a known slug");
        let rendered = String::from_utf8(bytes).expect("UTF-8");
        assert_eq!(
            rendered,
            PROJECT.replace(
                "labels:\n  storage:\n    name: Storage\n    color: blue\n",
                "labels: {}\n",
            )
        );
        assert!(document.project().labels.is_empty());
        // The emptied registry still parses: a bare `labels:` would read as null.
        ProjectDocument::parse(&rendered).expect("an emptied registry should still parse");
    }

    #[test]
    fn a_project_without_a_labels_key_gains_one_in_the_documented_place() {
        let raw = concat!(
            "format: longclaw.project/v1\n",
            "id: minimal\n",
            "name: Minimal\n",
            "key: MIN\n",
            "created_at: 2026-07-29T00:00:00Z\n",
        );
        let mut document = ProjectDocument::parse(raw).expect("the project should parse");
        let bytes = document
            .add_label("backend", "Backend", "amber")
            .expect("a well-formed definition");
        let rendered = String::from_utf8(bytes).expect("UTF-8");
        assert_eq!(
            rendered,
            format!("{raw}labels:\n  backend:\n    name: Backend\n    color: amber\n")
        );
        ProjectDocument::parse(&rendered).expect("the written file should parse back");
    }

    #[test]
    fn a_malformed_label_definition_is_refused_before_anything_is_written() {
        let cases = [
            ("Has Space", "Spaced", "amber", "slug"),
            ("", "Empty", "amber", "slug"),
            ("UPPER", "Upper", "amber", "slug"),
            ("backend", "", "amber", "label name"),
            ("backend", "Backend", "two words", "color"),
            ("backend", "Backend", "", "color"),
        ];
        for (slug, name, color, fragment) in cases {
            let mut document = ProjectDocument::parse(PROJECT).expect("the project should parse");
            let diagnostic = document
                .add_label(slug, name, color)
                .expect_err(&format!("{slug:?}/{name:?}/{color:?} should be refused"));
            assert!(
                diagnostic.message.contains(fragment),
                "{:?} should mention {fragment}",
                diagnostic.message
            );
            assert_eq!(document.render(), PROJECT);
        }
    }

    #[test]
    fn editing_or_removing_a_label_that_is_not_defined_is_refused() {
        let mut document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        assert!(document
            .update_label("absent", Some("Absent"), None)
            .is_err());
        assert!(document.remove_label("absent").is_err());
        assert!(document.update_label("storage", None, None).is_err());
        assert_eq!(document.render(), PROJECT);
    }

    #[test]
    fn a_missing_registry_is_an_empty_registry() {
        let raw = concat!(
            "format: longclaw.project/v1\n",
            "id: minimal\n",
            "name: Minimal\n",
            "key: MIN\n",
            "created_at: 2026-07-29T00:00:00Z\n",
        );
        let document = ProjectDocument::parse(raw).expect("the project should parse");
        assert!(document.project().people.is_empty());
        assert!(document.project().labels.is_empty());
        assert_eq!(document.project().theme, DEFAULT_THEME);
    }

    #[test]
    fn invalid_project_metadata_is_reported_and_never_replaced() {
        let cases = [
            (
                &PROJECT.replace("format: longclaw.project/v1", "format: someone-else/v1"),
                ErrorCode::ParseFailed,
                "format",
            ),
            (
                &PROJECT.replace("format: longclaw.project/v1", "format: longclaw.project/v9"),
                ErrorCode::UnsupportedVersion,
                "longclaw.project/v9",
            ),
            (
                &PROJECT.replace("key: LC", "key: lower"),
                ErrorCode::ParseFailed,
                "key",
            ),
            (
                &PROJECT.replace("name: Representative Project", "name: \"\""),
                ErrorCode::ParseFailed,
                "name",
            ),
            (
                &PROJECT.replace(
                    "created_at: 2026-07-29T00:00:00Z",
                    "created_at: 2026-07-29T05:30:00+05:30",
                ),
                ErrorCode::ParseFailed,
                "UTC",
            ),
            (
                &PROJECT.replace("id: 019c8c31-4d7e-71ad-8997-e67700962b55\n", ""),
                ErrorCode::ParseFailed,
                "id",
            ),
        ];
        for (raw, code, fragment) in cases {
            let diagnostic = ProjectDocument::parse(raw)
                .err()
                .unwrap_or_else(|| panic!("{raw:?} should be rejected"));
            assert_eq!(diagnostic.code, code, "for {raw:?}");
            assert!(
                diagnostic.message.contains(fragment),
                "{:?} should mention {fragment}",
                diagnostic.message
            );
        }
    }

    #[test]
    fn a_new_project_file_parses_back() {
        let rendered = render_new_project(
            "019c8c31-4d7e-71ad-8997-e67700962b55",
            "Fresh Project",
            "FP",
            DEFAULT_THEME,
            "2026-07-29T00:00:00Z",
        );
        let document = ProjectDocument::parse(&rendered).expect("a new project should be readable");
        assert!(rendered.starts_with(&format!("format: {PROJECT_FORMAT}\n")));
        assert_eq!(document.render(), rendered);
        assert_eq!(document.project().name, "Fresh Project");
        assert_eq!(document.project().key, "FP");
        assert!(document.project().unknown_keys.is_empty());
    }

    #[test]
    fn the_generated_agent_contract_carries_a_readable_example() {
        let document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let contract = super::render_agent_contract(document.project());
        assert!(contract.contains("Representative Project"));
        assert!(contract.contains("`LC-1`"));
        assert!(contract.contains("longclaw:item=ck_7d2a"));
        assert!(contract.contains("<!-- /longclaw:event -->"));
        assert!(contract.contains("atomically"));
    }

    // -------------------------------------------- the properties block

    const CONFIGURED: &str = concat!(
        "format: longclaw.project/v1\n",
        "id: project-fixture\n",
        "name: Fixture\n",
        "key: LC\n",
        "theme: indigo\n",
        "created_at: 2026-07-29T00:00:00Z\n",
        "people: {}\n",
        "labels: {}\n",
        "properties:\n",
        "  type:\n",
        "    enabled: true\n",
        "    values:\n",
        "      bug: { name: Bug, color: red }\n",
        "      feature: { name: Feature, color: cyan }\n",
        "  due:\n",
        "    enabled: true\n",
        "    attention_days: 3\n",
        "  estimate:\n",
        "    enabled: true\n",
        "    system: duration\n",
        "    hours_per_day: 6\n",
        "    x_future_key: kept\n",
    );

    /// Every project file written before this block existed. All four off, and
    /// nothing to migrate.
    #[test]
    fn a_project_with_no_properties_block_has_every_property_off() {
        let document = ProjectDocument::parse(PROJECT).expect("the fixture should parse");
        let properties = &document.project().properties;
        assert!(properties.enabled().is_empty());
        assert_eq!(properties.due.attention_days, DEFAULT_ATTENTION_DAYS);
        assert_eq!(properties.estimate.hours_per_day, DEFAULT_HOURS_PER_DAY);
        assert!(!document
            .project()
            .unknown_keys
            .iter()
            .any(|key| key == "properties"));
    }

    #[test]
    fn the_properties_block_is_read_and_its_bytes_are_kept() {
        let document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        let properties = &document.project().properties;

        assert_eq!(
            properties.enabled(),
            vec![Property::Type, Property::Due, Property::Estimate]
        );
        assert!(!properties.is_enabled(Property::Start));
        assert_eq!(properties.due.attention_days, 3);
        assert_eq!(properties.ticket_type.values.len(), 2);
        assert_eq!(properties.ticket_type.values["bug"].color, "red");
        assert_eq!(properties.estimate.system, EstimateSystem::Duration);
        assert_eq!(properties.estimate.hours_per_day, 6.0);
        // Not named in the file, so the documented default stands.
        assert_eq!(properties.estimate.days_per_week, DEFAULT_DAYS_PER_WEEK);
        // A key inside the block that this build does not interpret is part of
        // the file, and the file comes back as it was.
        assert_eq!(document.render(), CONFIGURED);
    }

    /// A property this build declines to read is not a property that vanishes.
    #[test]
    fn a_project_enabling_estimates_without_a_system_is_on_the_seeded_one() {
        let raw = format!("{PROJECT}properties:\n  estimate:\n    enabled: true\n");
        let document = ProjectDocument::parse(&raw).expect("the fixture should parse");
        assert_eq!(
            document.project().properties.estimate.system,
            EstimateSystem::Tshirt
        );
    }

    #[test]
    fn each_estimate_system_reads_its_own_scale_and_no_other() {
        let mut estimate = EstimateConfig {
            enabled: true,
            values: SEEDED_TSHIRT_SCALE.map(str::to_owned).to_vec(),
            ..EstimateConfig::default()
        };
        assert!(estimate.accepts("m"));
        assert!(!estimate.accepts("5"));
        assert!(!estimate.accepts("2h"));

        estimate.system = EstimateSystem::Fibonacci;
        assert!(estimate.accepts("5"));
        assert!(!estimate.accepts("4"));
        assert!(!estimate.accepts("m"));

        estimate.system = EstimateSystem::Duration;
        assert!(estimate.accepts("2h"));
        assert!(estimate.accepts("1.5d"));
        assert!(!estimate.accepts("5"));
        assert!(!estimate.accepts("m"));
    }

    #[test]
    fn a_duration_carries_one_number_and_one_unit() {
        assert_eq!(parse_duration("2h"), Some((2.0, 'h')));
        assert_eq!(parse_duration("1.5d"), Some((1.5, 'd')));
        assert_eq!(parse_duration("30m"), Some((30.0, 'm')));
        assert_eq!(parse_duration("1w"), Some((1.0, 'w')));
        for refused in [
            "1d4h", "2", "h", "0h", "-1d", "1.5.5d", ".5h", "5.h", "2y", "2 h", "",
        ] {
            assert_eq!(
                parse_duration(refused),
                None,
                "{refused:?} should be refused"
            );
        }
    }

    /// `0` empties the approaching rung; a negative value is not a width.
    #[test]
    fn a_negative_attention_window_is_refused_and_zero_is_not() {
        let zero =
            format!("{PROJECT}properties:\n  due:\n    enabled: true\n    attention_days: 0\n");
        let parsed = ProjectDocument::parse(&zero).expect("zero should be legal");
        assert_eq!(parsed.project().properties.due.attention_days, 0);

        let negative =
            format!("{PROJECT}properties:\n  due:\n    enabled: true\n    attention_days: -1\n");
        assert!(ProjectDocument::parse(&negative).is_err());
    }
}
