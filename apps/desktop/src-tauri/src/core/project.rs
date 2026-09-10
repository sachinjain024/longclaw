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
use super::ticket::{
    render_example_ticket, validate_property, Property, TicketEdit, TicketProperties,
};
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

    /// Whether this project reads `property` at all, as a refusal a write can
    /// return.
    ///
    /// Both halves of an edit are held to this, including a clear: a disabled
    /// property is one this build declines to interpret, and deleting a value it
    /// is deliberately not reading is the one thing "disabling hides, it never
    /// deletes" rules out.
    pub fn require_enabled(&self, property: Property) -> Result<(), Diagnostic> {
        if self.is_enabled(property) {
            return Ok(());
        }
        let name = property.as_str();
        Err(Diagnostic::parse(format!(
            "This project has not enabled the {name} property, so a ticket in it carries no \
             {name}. Turn it on in Settings under Ticket properties, or in \
             .longclaw/longclaw.yaml under properties.{name}.enabled."
        )))
    }

    /// The project half of a property check, returning the value as it would be
    /// written.
    ///
    /// [`validate_property`] has already held the value to the format's own
    /// rule, which is all a date has. Type and estimate have a vocabulary, and
    /// this is where an undefined value is refused — the same refusal an
    /// undefined label gets, for the same reason: a slug nothing defines renders
    /// as itself, and writing one is how that happens by accident.
    pub fn accept(&self, property: Property, value: &str) -> Result<String, Diagnostic> {
        self.require_enabled(property)?;
        let value = validate_property(property, value)?;
        match property {
            Property::Due | Property::Start => {}
            Property::Type => {
                if !self.ticket_type.values.contains_key(&value) {
                    let defined = self.ticket_type.values.keys().cloned().collect::<Vec<_>>();
                    return Err(Diagnostic::parse(format!(
                        "The type {value:?} is not defined in this project. {} Define it in \
                         Settings under Ticket properties, or in .longclaw/longclaw.yaml under \
                         properties.type.values.",
                        if defined.is_empty() {
                            "It defines no type values yet.".to_owned()
                        } else {
                            format!("It defines {}.", defined.join(", "))
                        }
                    )));
                }
            }
            Property::Estimate => {
                if !self.estimate.accepts(&value) {
                    return Err(Diagnostic::parse(format!(
                        "The estimate {value:?} is not one this project's {} scale can read. \
                         Expected {}.",
                        self.estimate.system.as_str(),
                        self.estimate.vocabulary()
                    )));
                }
            }
        }
        Ok(value)
    }

    /// Holds everything a create asks for to what this project configures.
    ///
    /// A create has no clear: there is nothing on a ticket that does not exist
    /// yet to remove.
    pub fn accept_new(&self, properties: &TicketProperties) -> Result<(), Diagnostic> {
        for property in Property::ALL {
            if let Some(value) = properties.get(property) {
                self.accept(property, value)?;
            }
        }
        Ok(())
    }

    /// The same for an edit, which asks two different things of a property.
    ///
    /// Every surface that holds the project calls this before the edit reaches
    /// [`super::ticket::TicketDocument::apply_as`], which deliberately does not:
    /// applying an edit is the format's business, and what a *project* accepts
    /// is not a question the file it is writing can answer.
    pub fn accept_edit(&self, edit: &TicketEdit) -> Result<(), Diagnostic> {
        for (property, requested) in edit.properties() {
            let Some(requested) = requested else { continue };
            match requested.as_deref() {
                Some(value) => {
                    self.accept(property, value)?;
                }
                // A clear names no value, so the enabled half is all there is to
                // ask — and it is asked, deliberately.
                None => self.require_enabled(property)?,
            }
        }
        Ok(())
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
        self.mapping.remove_path(&["labels", slug]);
        Ok(self.render().into_bytes())
    }

    fn write_label(&mut self, slug: &str, name: Option<&str>, color: Option<&str>) {
        for (field, value) in [("name", name), ("color", color)] {
            if let Some(value) = value {
                self.mapping.set_path_scalar(
                    &["labels", slug, field],
                    value,
                    &["created_at", "people"],
                );
            }
        }
    }

    // ------------------------------------ configuring the four properties

    /// Turns one property on or off.
    ///
    /// Off writes one line and nothing else: a ticket keeps its `due:` and the
    /// project keeps the window it configured, because disabling is a build
    /// declining to interpret a key rather than anything being deleted.
    ///
    /// On seeds the vocabulary the property needs to be usable at all, and only
    /// when there is none — a project that dropped `spike` and turned Type off
    /// and on again keeps it dropped. The seed is where a vocabulary starts, not
    /// what it is reset to.
    pub fn set_property_enabled(
        &mut self,
        property: Property,
        enabled: bool,
    ) -> Result<Vec<u8>, Diagnostic> {
        self.set_property_flag(property, enabled);
        if enabled {
            match property {
                Property::Type if !self.has_property_key(Property::Type, "values") => {
                    for (slug, name, color) in SEEDED_TYPE_VALUES {
                        self.write_type_value(slug, Some(name), Some(color));
                        self.project.properties.ticket_type.values.insert(
                            slug.to_owned(),
                            Label {
                                name: name.to_owned(),
                                color: color.to_owned(),
                            },
                        );
                    }
                }
                Property::Estimate if !self.has_property_key(Property::Estimate, "values") => {
                    // The system before the scale, which is the order the format
                    // documents and the order it reads in. An absent system is
                    // already `tshirt`, so this line is not news — but a block
                    // that names the system it is on says what a reader of the
                    // file would otherwise have to know the default to work out.
                    let system = self.project.properties.estimate.system;
                    self.write_property_scalar(Property::Estimate, "system", system.as_str());
                    let scale = SEEDED_TSHIRT_SCALE.map(str::to_owned).to_vec();
                    self.write_property_sequence(Property::Estimate, "values", &scale);
                    self.project.properties.estimate.values = scale;
                }
                _ => {}
            }
        }
        Ok(self.render().into_bytes())
    }

    /// The width of the approaching window, in days.
    ///
    /// `0` is legal and empties that rung, leaving overdue, today and beyond —
    /// both of the first two are absolute, so this is the only boundary a
    /// project can move.
    ///
    /// There is no ceiling. The format is exhaustive here — `0` is legal, and a
    /// negative value is refused, which the unsigned type is the whole of — so a
    /// limit invented on top would refuse a write for a rule nothing wrote down.
    /// A window wider than the project is silly rather than wrong.
    pub fn set_attention_days(&mut self, days: u32) -> Result<Vec<u8>, Diagnostic> {
        self.write_property_number(Property::Due, "attention_days", f64::from(days));
        self.project.properties.due.attention_days = days;
        Ok(self.render().into_bytes())
    }

    /// The scale estimates are written on. A project is on exactly one.
    ///
    /// No ticket is rewritten and no vocabulary is dropped: a value written
    /// under the old system stays exactly as it was and reads as unreadable
    /// until the project switches back, which is what makes this reversible
    /// (invariant 16).
    pub fn set_estimate_system(&mut self, system: EstimateSystem) -> Result<Vec<u8>, Diagnostic> {
        self.write_property_scalar(Property::Estimate, "system", system.as_str());
        self.project.properties.estimate.system = system;
        Ok(self.render().into_bytes())
    }

    /// How long a working day and a working week are, which is what makes `4h`
    /// and `1d` comparable. Changing it changes no stored value.
    pub fn set_estimate_conversion(
        &mut self,
        hours_per_day: f64,
        days_per_week: f64,
    ) -> Result<Vec<u8>, Diagnostic> {
        for (field, value, ceiling) in [
            ("A working day", hours_per_day, 24.0),
            ("A working week", days_per_week, 7.0),
        ] {
            if !(value.is_finite() && value > 0.0 && value <= ceiling) {
                return Err(Diagnostic::parse(format!(
                    "{field} is more than none of one and no more than {ceiling:.0}; found {value}"
                )));
            }
        }
        self.write_property_number(Property::Estimate, "hours_per_day", hours_per_day);
        self.write_property_number(Property::Estimate, "days_per_week", days_per_week);
        self.project.properties.estimate.hours_per_day = hours_per_day;
        self.project.properties.estimate.days_per_week = days_per_week;
        Ok(self.render().into_bytes())
    }

    /// The t-shirt scale, in order.
    ///
    /// Written whole rather than one size at a time, because the order *is* the
    /// scale: `xs` before `s` before `m` is the only thing that says which of
    /// them is the bigger. Held to the label grammar, because a size is a slug a
    /// ticket stores.
    pub fn set_tshirt_scale(&mut self, values: &[String]) -> Result<Vec<u8>, Diagnostic> {
        let mut seen = BTreeMap::new();
        for value in values {
            if !is_label_slug(value) {
                return Err(Diagnostic::parse(format!(
                    "An estimate size is a slug, so {LABEL_SLUG_RULE}; found {value:?}"
                )));
            }
            if seen.insert(value.clone(), ()).is_some() {
                return Err(Diagnostic::parse(format!(
                    "The size {value} is already on this project's scale"
                )));
            }
        }
        self.write_property_sequence(Property::Estimate, "values", values);
        self.project.properties.estimate.values = values.to_vec();
        Ok(self.render().into_bytes())
    }

    /// Defines a type value. Shaped exactly like `add_label`, because a type
    /// value is the same kind of thing: a name and a colour that tickets refer
    /// to by slug.
    pub fn add_type_value(
        &mut self,
        slug: &str,
        name: &str,
        color: &str,
    ) -> Result<Vec<u8>, Diagnostic> {
        if !is_label_slug(slug) {
            return Err(Diagnostic::parse(format!(
                "A type slug is a label slug, so {LABEL_SLUG_RULE}; found {slug:?}"
            )));
        }
        if self
            .project
            .properties
            .ticket_type
            .values
            .contains_key(slug)
        {
            return Err(Diagnostic::parse(format!(
                "The type {slug} is already defined in this project"
            )));
        }
        let name = validated_label_name(name)?;
        validate_label_color(color)?;
        self.write_type_value(slug, Some(&name), Some(color));
        self.project.properties.ticket_type.values.insert(
            slug.to_owned(),
            Label {
                name,
                color: color.to_owned(),
            },
        );
        Ok(self.render().into_bytes())
    }

    /// Renames a type value, recolours it, or both. The slug never moves: it is
    /// what every ticket carrying this type stores.
    pub fn update_type_value(
        &mut self,
        slug: &str,
        name: Option<&str>,
        color: Option<&str>,
    ) -> Result<Vec<u8>, Diagnostic> {
        let Some(mut value) = self
            .project
            .properties
            .ticket_type
            .values
            .get(slug)
            .cloned()
        else {
            return Err(unknown_type_value(slug));
        };
        if name.is_none() && color.is_none() {
            return Err(Diagnostic::parse("A type edit has to change something"));
        }
        let name = name.map(validated_label_name).transpose()?;
        if let Some(color) = color {
            validate_label_color(color)?;
        }
        self.write_type_value(slug, name.as_deref(), color);
        if let Some(name) = name {
            value.name = name;
        }
        if let Some(color) = color {
            value.color = color.to_owned();
        }
        self.project
            .properties
            .ticket_type
            .values
            .insert(slug.to_owned(), value);
        Ok(self.render().into_bytes())
    }

    /// Removes a type value's definition, and only the definition. This is the
    /// label case exactly: every ticket carrying the slug keeps it, and renders
    /// it as itself in the fallback hue.
    pub fn remove_type_value(&mut self, slug: &str) -> Result<Vec<u8>, Diagnostic> {
        if self
            .project
            .properties
            .ticket_type
            .values
            .remove(slug)
            .is_none()
        {
            return Err(unknown_type_value(slug));
        }
        self.mapping
            .remove_path(&["properties", "type", "values", slug]);
        Ok(self.render().into_bytes())
    }

    /// Whether the file carries one of a property's configuration keys.
    ///
    /// The question the seed has to ask, and it cannot be asked of the parsed
    /// value: an empty vocabulary and an absent one both read as empty, and they
    /// are not the same thing. A project that deleted all five of its type
    /// values deleted them, and a toggle handing them back would be the seed
    /// acting as a reset — which is what this type's own doc comment promises it
    /// is not.
    fn has_property_key(&self, property: Property, field: &str) -> bool {
        self.mapping
            .has_path(&["properties", property.as_str(), field])
    }

    fn set_property_flag(&mut self, property: Property, enabled: bool) {
        self.write_property_bool(property, "enabled", enabled);
        match property {
            Property::Type => self.project.properties.ticket_type.enabled = enabled,
            Property::Due => self.project.properties.due.enabled = enabled,
            Property::Start => self.project.properties.start.enabled = enabled,
            Property::Estimate => self.project.properties.estimate.enabled = enabled,
        }
    }

    fn write_type_value(&mut self, slug: &str, name: Option<&str>, color: Option<&str>) {
        for (field, value) in [("name", name), ("color", color)] {
            if let Some(value) = value {
                self.mapping.set_path_scalar(
                    &["properties", "type", "values", slug, field],
                    value,
                    PROPERTIES_AFTER,
                );
            }
        }
    }

    fn write_property_scalar(&mut self, property: Property, field: &str, value: &str) {
        self.mapping.set_path_scalar(
            &["properties", property.as_str(), field],
            value,
            PROPERTIES_AFTER,
        );
    }

    fn write_property_bool(&mut self, property: Property, field: &str, value: bool) {
        self.mapping.set_path_bool(
            &["properties", property.as_str(), field],
            value,
            PROPERTIES_AFTER,
        );
    }

    fn write_property_number(&mut self, property: Property, field: &str, value: f64) {
        self.mapping.set_path_number(
            &["properties", property.as_str(), field],
            value,
            PROPERTIES_AFTER,
        );
    }

    fn write_property_sequence(&mut self, property: Property, field: &str, values: &[String]) {
        self.mapping.set_path_sequence(
            &["properties", property.as_str(), field],
            values,
            PROPERTIES_AFTER,
        );
    }
}

/// Where a `properties:` block this build writes for the first time lands: after
/// `labels`, which is where the format documents it, and after whichever of the
/// keys before that the file has if it has no labels at all.
const PROPERTIES_AFTER: &[&str] = &["created_at", "people", "labels"];

fn unknown_type_value(slug: &str) -> Diagnostic {
    Diagnostic::parse(format!("This project defines no type {slug}"))
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

/// The version stamped into every file LongClaw generates for an agent.
///
/// It is there so a later build can tell what it is looking at. Nothing reads it
/// yet — regenerating an older project's files on open is a decision this build
/// does not make — but a file that may be overwritten had better say which
/// generation wrote it, and a version added after the fact tells you nothing
/// about the files already on disk.
pub const GENERATED_INSTRUCTIONS_VERSION: &str = "1";

/// The generated agent-facing contract for a project.
///
/// LongClaw owns `.longclaw/AGENTS.md` and never touches an unrelated
/// `AGENTS.md` at the repository root.
///
/// It teaches the CLI first and the file format second. That order is the whole
/// point of the rewrite: `longclaw` allocates keys, refuses an undefined label,
/// writes atomically and records who acted, so an agent that drives the project
/// through it gets those guarantees for free — where an agent following a
/// hand-editing contract has to be told each of them and can still get one
/// wrong. The format stays documented, because a machine without the app
/// installed is a real case and the file format is the durable contract; it is
/// the fallback rather than the path.
pub fn render_agent_contract(project: &Project) -> String {
    let mut contract = String::new();
    contract.push_str(&format!(
        concat!(
            "<!-- longclaw:generated file=AGENTS.md version={version} -->\n",
            "# Working on {name} with an agent\n",
            "\n",
            "LongClaw generated this file and rewrites it whenever this project changes.\n",
            "Do not edit it — an edit here is overwritten without warning. Your own\n",
            "instructions go in `PROJECT.md`, beside this file, which LongClaw creates\n",
            "once and never writes to again.\n",
            "\n",
            "## This project\n",
            "\n",
            "- Name: {name}\n",
            "- Key: `{key}`\n",
            "- Ticket format: `longclaw.ticket/v1`\n",
            "\n",
            "The project is the folder that holds `.longclaw/`, so a ticket named in a\n",
            "sentence resolves without searching: `{key}-42` is the directory\n",
            "`.longclaw/tickets/{key}-42/`, and its record is\n",
            "`.longclaw/tickets/{key}-42/ticket.md`. A recently minted key may carry a\n",
            "trailing lowercase letter — `{key}-42n` — because two branches allocating\n",
            "from one working tree would otherwise mint the same number. Both forms are\n",
            "keys and both are read the same way.\n",
            "\n",
            "## Canonical files\n",
            "\n",
            "- `.longclaw/longclaw.yaml` — project identity, people, label definitions,\n",
            "  and which ticket properties this project has turned on.\n",
            "- `.longclaw/tickets/<KEY>/ticket.md` — the complete structured record for\n",
            "  one ticket.\n",
            "- `.longclaw/tickets/<KEY>/attachments/` — that ticket's attachment bytes.\n",
            "\n",
            "Read a ticket's `ticket.md` first: it is the whole record rather than a\n",
            "summary of one. Open a file under `attachments/` only when the ticket\n",
            "references it and you need it. This file, `CLAUDE.md` and `PROJECT.md` are\n",
            "documentation; they are not project data.\n",
            "\n",
            "## Use the CLI\n",
            "\n",
            "`longclaw` is how this project is driven, and it ships with the LongClaw\n",
            "app. Start with:\n",
            "\n",
            "```sh\n",
            "longclaw help\n",
            "```\n",
            "\n",
            "That prints every command, the `status` and `priority` sets, the date format\n",
            "and the attribution rule. It is compiled into the binary, so it cannot go\n",
            "stale the way a generated file can — read it rather than working from\n",
            "memory, and rather than trusting a command spelled out here.\n",
            "\n",
            "Three things are worth knowing before the first one:\n",
            "\n",
            "- A command prints JSON on stdout. A failure prints a typed error on stderr\n",
            "  and exits non-zero, and the error says what to fix.\n",
            "- `--path` defaults to the working directory, so run commands from this\n",
            "  project's folder or pass `--path` explicitly.\n",
            "- An edit carries the hash of the bytes it read, so a command built from a\n",
            "  stale read is refused rather than written over whoever changed the file\n",
            "  first.\n",
            "\n",
            "Create a ticket:\n",
            "\n",
            "```sh\n",
            "longclaw ticket create \\\n",
            "  --title \"Search returns archived tickets\" \\\n",
            "  --description \"Steps, expected, actual.\" \\\n",
            "  --status todo --priority p2 \\\n",
            "  --agent-id your-tool-id --agent-name \"Your Tool\"\n",
            "```\n",
            "\n",
            "Edit one — a status, a checklist tick and a note are one command, and one\n",
            "activity entry:\n",
            "\n",
            "```sh\n",
            "longclaw ticket edit {example_key} \\\n",
            "  --status in_progress \\\n",
            "  --check ck_1b8e4f02 \\\n",
            "  --comment \"Reproduced. The archived filter runs after the query.\" \\\n",
            "  --agent-id your-tool-id --agent-name \"Your Tool\"\n",
            "```\n",
            "\n",
            "## This project's vocabulary\n",
            "\n",
        ),
        version = GENERATED_INSTRUCTIONS_VERSION,
        name = project.name,
        key = project.key,
        example_key = example_key(&project.key),
    ));
    contract.push_str(&label_vocabulary(&project.labels));
    contract.push_str(&property_vocabulary(&project.properties));
    contract.push_str(concat!(
        "## Rules `longclaw help` does not state\n",
        "\n",
        "- **Never create `.longclaw/tickets/<KEY>/` by hand.** A key is allocated by\n",
        "  claiming its directory, which is the one thing that stops two agents\n",
        "  minting the same key at the same moment. `longclaw ticket create` is the\n",
        "  only thing that may spend one.\n",
        "- **Always pass `--agent-id`,** and `--agent-name` when you have one. The\n",
        "  format declares who acted and never infers it, so an entry without it says\n",
        "  a human did the work.\n",
        "- **Activity is append-only.** Correct a mistake by appending another entry,\n",
        "  never by editing or deleting one that is already there.\n",
        "- **`id` and `key` are one identity and do not change.** The single exception\n",
        "  is `ticket renumber`, and it exists for two branches that minted the same\n",
        "  key rather than for renaming.\n",
        "- **Never silently overwrite an external edit.** When a write is refused as\n",
        "  stale, re-read the ticket and decide what to do with what changed. Do not\n",
        "  retry the same command until it lands.\n",
        "- **Keep what you do not understand.** A key this build does not read is\n",
        "  preserved rather than dropped, and so is a value under a property this\n",
        "  project has turned off — turning it off hides the value; it does not delete\n",
        "  it.\n",
        "- **If a file will not parse, leave it alone and say so.** LongClaw shows an\n",
        "  unreadable ticket with its raw contents and a diagnostic rather than\n",
        "  repairing it, and so should you.\n",
        "\n",
        "## If the CLI is not available\n",
        "\n",
        "An agent, an editor or a script on a machine without LongClaw installed can\n",
        "still read and write these files: the file format is the durable contract and\n",
        "the CLI is the recommended path through it, not a gate in front of it. What\n",
        "you cannot do this way is create a ticket — a key is spent by claiming its\n",
        "directory, and nothing outside LongClaw may spend one.\n",
        "\n",
        "### What you may change\n",
        "\n",
        "| Field | Rule |\n",
        "|---|---|\n",
        "| `title` | one line |\n",
        "| `status` | one of `backlog`, `todo`, `in_progress`, `in_review`, `done`, `canceled` |\n",
        "| `priority` | one of `urgent`, `p1`, `p2`, `p3`, `p4`, `none` |\n",
        "| `labels` | slugs defined in `longclaw.yaml` |\n",
    ));
    contract.push_str(&property_rules(&project.properties));
    contract.push_str(concat!(
        "| description | any CommonMark outside the reserved sections |\n",
        "| checklist | flip `[ ]` to `[x]`, or append a task |\n",
        "| activity | append a bounded record; never edit or delete an existing one |\n",
        "\n",
        "Do not change `format`, `id`, `key`, `created_at` or `rank`. LongClaw owns\n",
        "`rank`; preserve any value you find and do not invent one. Keep every key you\n",
        "do not understand exactly as it is. `.longclaw/longclaw.yaml` is the source of\n",
        "truth for the label slugs, the people and the enabled properties a ticket may\n",
        "use — read it rather than guessing, and do not add a value it does not define.\n",
        "\n",
        "### Timestamps and attribution\n",
        "\n",
        "Timestamps are UTC RFC 3339 strings such as `2026-07-29T09:12:31Z`. Set\n",
        "`updated_at` when you change ticket state. Attribute yourself explicitly:\n",
        "\n",
        "```yaml\n",
        "actor:\n",
        "  type: agent\n",
        "  id: your-tool-id\n",
        "  name: Your Tool\n",
        "```\n",
        "\n",
        "`type` is one of `human`, `agent` or `unknown` — never guess. An agent is\n",
        "never an assignee.\n",
        "\n",
        "### Checking off a checklist item\n",
        "\n",
        "Before:\n",
        "\n",
        "```md\n",
        "- [ ] Add retry policy <!-- longclaw:item=ck_7d2a -->\n",
        "```\n",
        "\n",
        "After:\n",
        "\n",
        "```md\n",
        "- [x] Add retry policy <!-- longclaw:item=ck_7d2a -->\n",
        "```\n",
        "\n",
        "Keep the `longclaw:item` marker: it is how a change is attributed to that\n",
        "item. A task you append without one still works — LongClaw adopts it and mints\n",
        "an id on its next write.\n",
        "\n",
        "### Appending an activity entry\n",
        "\n",
        "Add to the end of the `## Activity` section, inside the markers:\n",
        "\n",
        "```md\n",
        "<!-- longclaw:event\n",
        "id: evt_4b91c07a\n",
        "kind: update\n",
        "occurred_at: 2026-07-29T09:12:31Z\n",
        "actor:\n",
        "  type: agent\n",
        "  id: your-tool-id\n",
        "  name: Your Tool\n",
        "changes:\n",
        "  - field: status\n",
        "    from: todo\n",
        "    to: in_progress\n",
        "-->\n",
        "### Your Tool updated this ticket\n",
        "\n",
        "What you did and what is left.\n",
        "<!-- /longclaw:event -->\n",
        "```\n",
        "\n",
        "Use `kind: comment` with no `changes` for a plain comment. Every `id` must be\n",
        "unique within the ticket. If you change state without appending an entry, the\n",
        "state still stands and the history is merely incomplete — LongClaw never rolls\n",
        "state back to match history.\n",
        "\n",
        "### Attachments\n",
        "\n",
        "Copy the file into the ticket's `attachments/` directory as\n",
        "`<attachment-id>-<sanitized-name>`, then register it under `## Attachments`\n",
        "with its id, relative `file` path, original `name`, `media_type`, `size`,\n",
        "`added_at` and `added_by`. Copy the bytes first and register second, so an\n",
        "interruption leaves a recoverable file rather than an entry pointing at\n",
        "nothing. Treat registered files as immutable: replacement means a new id.\n",
        "\n",
        "### Writing safely\n",
        "\n",
        "- Write atomically: write a sibling temporary file, then rename it over\n",
        "  `ticket.md`. LongClaw's watcher expects that pattern and will not mistake\n",
        "  your write for its own.\n",
        "- The YAML subset allows mappings, lists, strings, booleans, nulls and\n",
        "  numbers. No anchors, aliases, tags, merge keys, multiple documents or\n",
        "  duplicate keys. Files are UTF-8 with LF line endings.\n",
        "- The frontmatter `key` and the ticket's directory name are one identity.\n",
        "  Never change either.\n",
        "\n",
        "## Your own instructions\n",
        "\n",
        "`PROJECT.md`, beside this file, is yours: this project's conventions, the words\n",
        "it wants used, anything an agent should know that LongClaw cannot generate.\n",
        "LongClaw creates it once and never writes to it again, so what you put there\n",
        "survives every rename, label change and property change that rewrites this\n",
        "file.\n",
        "\n",
    ));
    contract.push_str(&example_ticket(&example_key(&project.key)));
    contract
}

/// The pointer Claude Code reads.
///
/// `CLAUDE.md` is the filename that tool looks for, and `@AGENTS.md` is its
/// include convention, so the whole file is one line of content plus the banner
/// every generated file carries. Constant on purpose: a reprint of a file that
/// says nothing about the project is a no-op diff, which is what lets every
/// project-edit path rewrite it without thinking about churn.
pub fn render_claude_pointer() -> String {
    format!(
        concat!(
            "<!-- longclaw:generated file=CLAUDE.md version={version} -->\n",
            "# Claude instructions\n",
            "\n",
            "LongClaw generated this file and may overwrite it. Do not edit it; your own\n",
            "instructions go in `PROJECT.md`, in this directory.\n",
            "\n",
            "@AGENTS.md\n",
        ),
        version = GENERATED_INSTRUCTIONS_VERSION,
    )
}

/// What `PROJECT.md` holds the moment it is created, and the only thing LongClaw
/// ever writes into it.
///
/// A heading and nothing else. The file is the user's, so it arrives empty of
/// content and stays whatever they make it; what the file is *for* is explained
/// in `AGENTS.md`, which is the file an agent reads and the file LongClaw is
/// allowed to rewrite when that explanation changes.
pub const PROJECT_INSTRUCTIONS_TEMPLATE: &str = "# Project instructions\n";

/// The first key this project would mint, which is the one the worked examples
/// use.
fn example_key(key: &str) -> String {
    format!("{key}-1")
}

/// The label slugs a ticket in this project may carry, as a table, plus the two
/// commands that read and extend the set.
///
/// The slugs themselves rather than a pointer to `longclaw.yaml`: an agent
/// reading this is about to pass `--label`, and a refusal is the expensive way
/// to learn which ones exist.
fn label_vocabulary(labels: &BTreeMap<String, Label>) -> String {
    let mut section = String::from("### Labels\n\n");
    if labels.is_empty() {
        section.push_str(concat!(
            "This project defines no labels yet, so a ticket here carries none. A\n",
            "`--label` naming a slug the project has not defined is refused rather than\n",
            "written.\n",
        ));
    } else {
        section.push_str(concat!(
            "A ticket may carry only a slug this project defines; a `--label` naming one\n",
            "it does not is refused rather than written.\n",
            "\n",
            "| Slug | Name |\n",
            "|---|---|\n",
        ));
        for (slug, label) in labels {
            section.push_str(&format!("| `{slug}` | {} |\n", label.name));
        }
    }
    section.push_str(concat!(
        "\n",
        "`longclaw project show` prints what the project defines now. To add one:\n",
        "\n",
        "```sh\n",
        "longclaw label add --slug security --name Security --color blue\n",
        "```\n",
        "\n",
    ));
    section
}

/// The ticket properties this project has turned on, what each accepts, and the
/// flags that write it.
///
/// The four are opt-in (ADR 0013), so this describes the enabled set rather than
/// all of them: a property an agent is told it may write had better be one the
/// project reads, and a flag for a disabled one is refused. A project with none
/// on is the common case and says so, because silence would read as "all four,
/// probably".
fn property_vocabulary(properties: &PropertiesConfig) -> String {
    let mut section = String::from("### Ticket properties\n\n");
    let enabled = properties.enabled();
    if enabled.is_empty() {
        section.push_str(concat!(
            "`type`, `due`, `start` and `estimate` are opt-in, and this project has all\n",
            "four turned off — so a ticket here carries none of them, and a flag for one\n",
            "is refused rather than written. `longclaw project show` is where that\n",
            "changes.\n",
            "\n",
        ));
        return section;
    }
    section.push_str(concat!(
        "`type`, `due`, `start` and `estimate` are opt-in. This project has turned on:\n",
        "\n",
        "| Property | Accepts | Flags |\n",
        "|---|---|---|\n",
    ));
    for property in enabled {
        let name = property.as_str();
        // The placeholder `longclaw help` uses for the same flag, because the
        // two are read side by side and a second spelling of one flag reads as
        // two flags.
        let placeholder = match property {
            Property::Type => "<slug>",
            Property::Due | Property::Start => "<date>",
            Property::Estimate => "<value>",
        };
        section.push_str(&format!(
            "| `{name}` | {} | `--{name} {placeholder}`, `--clear-{name}` |\n",
            property_rule(property, properties),
        ));
    }
    section.push_str(concat!(
        "\n",
        "Do not write a property that is not listed. An unlisted one is a property\n",
        "this project does not read, and a value you find under it is being hidden\n",
        "rather than deleted — keep it exactly as it is.\n",
        "\n",
    ));
    section
}

/// The table rows for the properties this project has turned on, and nothing at
/// all when it has turned none on.
///
/// The hand-editing fallback's copy of the same set: it is describing frontmatter
/// keys rather than flags, so it carries the rule and not the command.
fn property_rules(properties: &PropertiesConfig) -> String {
    properties
        .enabled()
        .into_iter()
        .map(|property| {
            format!(
                "| `{}` | {} |\n",
                property.as_str(),
                property_rule(property, properties)
            )
        })
        .collect()
}

/// What one enabled property accepts, in the words a refusal would use.
///
/// The vocabulary itself rather than a pointer to it. An agent reading this is
/// about to write a value, and `one of bug, feature` is an answer where "the
/// slugs defined in longclaw.yaml" is another file to open.
fn property_rule(property: Property, properties: &PropertiesConfig) -> String {
    match property {
        Property::Due | Property::Start => "a date, `YYYY-MM-DD`".to_owned(),
        Property::Type => {
            let defined = properties
                .ticket_type
                .values
                .keys()
                .cloned()
                .collect::<Vec<_>>();
            if defined.is_empty() {
                "this project defines no type values yet".to_owned()
            } else {
                format!("one of {}", defined.join(", "))
            }
        }
        // The same sentence a refusal uses, so the contract cannot promise a
        // vocabulary the write then rejects.
        Property::Estimate => properties.estimate.vocabulary(),
    }
}

fn example_ticket(key: &str) -> String {
    let rendered = render_example_ticket(
        key,
        "An example of the shape you are editing",
        super::ticket::Status::Todo,
        super::ticket::Priority::P2,
        "The description is ordinary CommonMark.",
        &["An example task".to_owned()],
        "2026-07-29T00:00:00Z",
    );
    format!("## A complete example\n\n```md\n{rendered}```\n")
}

#[cfg(test)]
mod tests {
    use super::{
        parse_duration, render_new_project, EstimateConfig, EstimateSystem, ProjectDocument,
        Property, TicketEdit, TicketProperties, DEFAULT_ATTENTION_DAYS, DEFAULT_DAYS_PER_WEEK,
        DEFAULT_HOURS_PER_DAY, DEFAULT_THEME, PROJECT_FORMAT, SEEDED_TSHIRT_SCALE,
        SEEDED_TYPE_VALUES,
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

    /// The contract teaches the CLI first, and points at `longclaw help` for the
    /// command surface rather than re-typing it.
    ///
    /// Re-typing it is the failure this asserts against: `cli.rs`'s `USAGE` is
    /// compiled into the binary and cannot drift, while a command spelled out
    /// here is a copy that goes stale the first time a flag is renamed — and
    /// goes stale silently, because a generated file reads as freshly generated
    /// whatever it says.
    #[test]
    fn the_generated_contract_teaches_the_cli_first() {
        let document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let contract = super::render_agent_contract(document.project());

        assert!(contract.contains("longclaw help"), "{contract}");
        assert!(contract.contains("longclaw ticket create"), "{contract}");
        assert!(contract.contains("longclaw ticket edit LC-1"), "{contract}");
        // Both worked examples attribute themselves, because an entry without
        // `--agent-id` says a human did the work.
        assert_eq!(contract.matches("--agent-id your-tool-id").count(), 2);

        // The two enums `longclaw help` prints appear once each, in the
        // hand-editing fallback where there is no `longclaw help` to read.
        assert_eq!(
            contract
                .matches("one of `backlog`, `todo`, `in_progress`, `in_review`, `done`, `canceled`")
                .count(),
            1,
            "{contract}"
        );
        assert_eq!(
            contract
                .matches("one of `urgent`, `p1`, `p2`, `p3`, `p4`, `none`")
                .count(),
            1,
            "{contract}"
        );
    }

    /// A ticket key in a sentence has to resolve to a path without searching,
    /// which is the brief's question: an agent told "work on LC-42" needs the
    /// project's own key and the directory it maps to, in the file it is
    /// already reading.
    #[test]
    fn the_generated_contract_maps_this_projects_key_to_a_directory() {
        let document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let contract = super::render_agent_contract(document.project());

        assert!(contract.contains("- Key: `LC`"), "{contract}");
        assert!(
            contract.contains("`.longclaw/tickets/LC-42/ticket.md`"),
            "{contract}"
        );
        // The trailing-letter form is a key too, and an agent that has not met
        // one reads it as a typo.
        assert!(contract.contains("`LC-42n`"), "{contract}");
    }

    /// The rules that are LongClaw's rather than the CLI's, which is why
    /// `longclaw help` cannot carry them: they are about what an agent must not
    /// do, and a usage string lists what it may.
    #[test]
    fn the_generated_contract_carries_the_rules_help_does_not_state() {
        let document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let contract = super::render_agent_contract(document.project());

        for rule in [
            "Never create `.longclaw/tickets/<KEY>/` by hand",
            "Always pass `--agent-id`",
            "Activity is append-only",
            "`id` and `key` are one identity and do not change",
            "Never silently overwrite an external edit",
            "If a file will not parse, leave it alone and say so",
        ] {
            assert!(contract.contains(rule), "missing {rule}\n{contract}");
        }
    }

    /// The fallback is the whole point of keeping the format documented: a
    /// machine without the app installed still has to write a legal file, and
    /// the format is the durable contract underneath the CLI.
    #[test]
    fn the_generated_contract_keeps_a_hand_edit_fallback() {
        let document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let contract = super::render_agent_contract(document.project());

        assert!(contract.contains("## If the CLI is not available"));
        assert!(contract.contains("atomically"));
        assert!(contract.contains("No anchors, aliases, tags, merge keys"));
        assert!(contract.contains("longclaw:item=ck_7d2a"));
        assert!(contract.contains("<!-- longclaw:event"));
        assert!(contract.contains("<!-- /longclaw:event -->"));
        assert!(contract.contains("`type` is one of `human`, `agent` or `unknown`"));
        assert!(contract.contains("`.longclaw/longclaw.yaml` is the source of\ntruth"));
        // What the CLI would have done for it, said outright: nothing outside
        // LongClaw may spend a key.
        assert!(contract.contains("What\nyou cannot do this way is create a ticket"));
    }

    /// Both generated files say who wrote them, which generation wrote them, and
    /// where the reader's own instructions go instead.
    #[test]
    fn the_generated_files_carry_a_version_and_a_do_not_edit_banner() {
        let document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let contract = super::render_agent_contract(document.project());
        let pointer = super::render_claude_pointer();

        assert!(contract.starts_with(&format!(
            "<!-- longclaw:generated file=AGENTS.md version={} -->\n",
            super::GENERATED_INSTRUCTIONS_VERSION
        )));
        assert!(pointer.starts_with(&format!(
            "<!-- longclaw:generated file=CLAUDE.md version={} -->\n",
            super::GENERATED_INSTRUCTIONS_VERSION
        )));
        assert!(contract.contains("Do not edit it"), "{contract}");
        assert!(pointer.contains("Do not edit it"), "{pointer}");
        // Both send an edit somewhere it will survive.
        assert!(contract.contains("`PROJECT.md`"), "{contract}");
        assert!(pointer.contains("`PROJECT.md`"), "{pointer}");
        // The pointer is a pointer: Claude Code's include convention and
        // nothing that could disagree with the file it includes.
        assert!(pointer.contains("@AGENTS.md"), "{pointer}");
        assert!(pointer.lines().count() < 10, "{pointer}");
    }

    /// The example carries a readable ticket, and the same file says what a
    /// project with no properties enabled means.
    #[test]
    fn the_generated_agent_contract_carries_a_readable_example() {
        let document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let contract = super::render_agent_contract(document.project());
        assert!(contract.contains("Representative Project"));
        assert!(contract.contains("key: LC-1"));
        assert!(contract.contains("longclaw:item=ck_7d2a"));
        assert!(contract.contains("<!-- /longclaw:event -->"));
        assert!(contract.contains("atomically"));
        // All four properties are off, so the contract offers no property row
        // and says so in a sentence rather than by omission.
        assert!(!contract.contains("| `type` |"));
        assert!(contract.contains("this project has all\nfour turned off"));
    }

    /// The generated contract offers the enabled set and no more.
    ///
    /// An agent reads this file to learn which fields it may write, so listing
    /// all four would name three fields this project does not read — and the
    /// write would then be refused by
    /// [`PropertiesConfig::accept`], which is a contract disagreeing with the
    /// build that generated it.
    #[test]
    fn the_generated_contract_offers_the_properties_the_project_turned_on() {
        let document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        let contract = super::render_agent_contract(document.project());

        // The vocabulary section names the flag that writes each one, because
        // the CLI is the path this file recommends.
        assert!(
            contract.contains(concat!(
                "| Property | Accepts | Flags |\n",
                "|---|---|---|\n",
                "| `type` | one of bug, feature | `--type <slug>`, `--clear-type` |\n",
                "| `due` | a date, `YYYY-MM-DD` | `--due <date>`, `--clear-due` |\n",
                "| `estimate` | a number and a unit, such as 2h, 1.5d or 1w | \
                 `--estimate <value>`, `--clear-estimate` |\n",
            )),
            "{contract}"
        );
        // And the fallback's frontmatter table carries the same set in the
        // documented order, between the other fields and the description —
        // each with the vocabulary itself rather than a pointer to another file.
        assert!(
            contract.contains(concat!(
                "| `labels` | slugs defined in `longclaw.yaml` |\n",
                "| `type` | one of bug, feature |\n",
                "| `due` | a date, `YYYY-MM-DD` |\n",
                "| `estimate` | a number and a unit, such as 2h, 1.5d or 1w |\n",
                "| description |",
            )),
            "{contract}"
        );
        // Off, so it is not offered.
        assert!(!contract.contains("| `start` |"), "{contract}");
        // And what an unlisted property means is said outright, because silence
        // reads as permission.
        assert!(
            contract.contains("Do not write a property that is not listed"),
            "{contract}"
        );

        // The estimate rule is the refusal's own sentence, so the contract
        // cannot promise a vocabulary the write then rejects. Switching systems
        // seeds nothing — it keeps every value written under the old one — so a
        // project that arrives at t-shirt this way has an empty scale, and the
        // contract says exactly that rather than inventing five sizes.
        let mut document = document;
        document
            .set_estimate_system(EstimateSystem::Tshirt)
            .expect("switching systems is a one-line write");
        let contract = super::render_agent_contract(document.project());
        assert!(
            contract.contains(
                "| `estimate` | this project's t-shirt scale, which defines no values yet |\n"
            ),
            "{contract}"
        );

        document
            .set_tshirt_scale(&["s".to_owned(), "m".to_owned(), "l".to_owned()])
            .expect("a scale of three sizes");
        let contract = super::render_agent_contract(document.project());
        assert!(
            contract.contains("| `estimate` | one of s, m, l |\n"),
            "{contract}"
        );
    }

    /// A project's own label slugs, in the file the agent is already reading.
    ///
    /// A pointer to `longclaw.yaml` would be another file to open, and the
    /// answer it holds is the one an agent needs before it passes `--label` —
    /// a refusal is the expensive way to learn which slugs exist.
    #[test]
    fn the_generated_contract_lists_this_projects_labels() {
        let document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let contract = super::render_agent_contract(document.project());
        assert!(contract.contains("| `storage` | Storage |\n"), "{contract}");
        assert!(contract.contains("longclaw label add"), "{contract}");

        // A project with none says so, rather than printing an empty table for
        // an agent to read as "any slug, then".
        let bare = ProjectDocument::parse(&render_new_project(
            "019c8c31-4d7e-71ad-8997-e67700962b55",
            "Bare",
            "BR",
            DEFAULT_THEME,
            "2026-07-29T00:00:00Z",
        ))
        .expect("a new project should parse");
        let contract = super::render_agent_contract(bare.project());
        assert!(
            contract.contains("This project defines no labels yet"),
            "{contract}"
        );
        assert!(!contract.contains("| Slug | Name |"), "{contract}");
    }

    /// LC-66, closed: rendering the same project twice produces the same bytes.
    ///
    /// Every project write reprints this file — a rename, a label, any of
    /// LC-227's eight property controls — and the worked example used to be
    /// rendered with minted ids, so each reprint carried a fresh `id`, `ck_` and
    /// `evt_` and nothing else. The user guide recommends committing
    /// `.longclaw/`, so that landed in a review as three changed lines that
    /// meant nothing, which is what trains a reader to skim the diffs where the
    /// contract really did change.
    ///
    /// Whole bytes rather than the property rows alone: the ids are the part
    /// that moved, and a test that filtered the file down to its tables would
    /// have passed throughout the bug it exists to catch.
    #[test]
    fn the_contract_is_byte_identical_two_renders_running() {
        for raw in [PROJECT, CONFIGURED] {
            let document = ProjectDocument::parse(raw).expect("the fixture should parse");
            assert_eq!(
                super::render_agent_contract(document.project()),
                super::render_agent_contract(document.project())
            );
        }
        assert_eq!(
            super::render_claude_pointer(),
            super::render_claude_pointer()
        );
    }

    /// The worked example is a real render, so what it teaches is what the app
    /// writes — and it has to survive the round trip it is asking an agent to
    /// make.
    #[test]
    fn the_worked_example_is_a_ticket_the_parser_accepts() {
        let document = ProjectDocument::parse(PROJECT).expect("the project should parse");
        let contract = super::render_agent_contract(document.project());
        let example = contract
            .split_once("## A complete example\n\n```md\n")
            .and_then(|(_, rest)| rest.split_once("\n```"))
            .map(|(example, _)| format!("{example}\n"))
            .expect("the contract should carry a fenced example");

        let parsed = crate::core::ticket::TicketDocument::parse(&example, "LC-1")
            .expect("the example the contract teaches should parse");
        assert_eq!(parsed.ticket().key, "LC-1");
        assert_eq!(parsed.ticket().checklist.len(), 1);
        assert_eq!(parsed.ticket().activity.len(), 1);
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

    /// Every surface that writes a property asks this, so there is one refusal
    /// rather than one per surface. `apply_as` holds a value to the format's own
    /// rule and nothing more, which left the app able to write a type no project
    /// defined — and an undefined slug renders as itself, with no name and no
    /// colour.
    #[test]
    fn a_value_is_held_to_the_vocabulary_the_project_configures() {
        let document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        let properties = &document.project().properties;

        assert_eq!(
            properties.accept(Property::Type, " bug ").as_deref(),
            Ok("bug")
        );
        assert_eq!(
            properties.accept(Property::Due, "2026-09-28").as_deref(),
            Ok("2026-09-28")
        );
        assert_eq!(
            properties.accept(Property::Estimate, "1.5d").as_deref(),
            Ok("1.5d")
        );

        // Enabled, and a slug this project never defined.
        let refused = properties
            .accept(Property::Type, "epic")
            .expect_err("epic is not one of this project's types");
        assert_eq!(refused.code, ErrorCode::ParseFailed);
        assert!(
            refused.message.contains("It defines bug, feature."),
            "{}",
            refused.message
        );

        // Enabled, and a value the project's *system* cannot read: `m` is a
        // t-shirt size and this project estimates in durations.
        let refused = properties
            .accept(Property::Estimate, "m")
            .expect_err("m is not a duration");
        assert!(
            refused.message.contains("2h, 1.5d or 1w"),
            "{}",
            refused.message
        );

        // Off, so there is no vocabulary to check a value against at all.
        let refused = properties
            .accept(Property::Start, "2026-09-28")
            .expect_err("this project has no start dates");
        assert!(
            refused
                .message
                .contains("has not enabled the start property"),
            "{}",
            refused.message
        );
    }

    /// A clear is refused on a disabled property as firmly as a set is.
    ///
    /// `TicketEdit` distinguishes absent from cleared so a Clear row has
    /// something to send, and a property this build declines to interpret is the
    /// one place that row must not reach: the value is being hidden, not
    /// deleted, and the ticket still holds it.
    #[test]
    fn an_edit_is_refused_for_a_property_the_project_does_not_read() {
        let document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        let properties = &document.project().properties;

        let named_none = TicketEdit {
            title: Some("Renamed".to_owned()),
            ..TicketEdit::default()
        };
        properties
            .accept_edit(&named_none)
            .expect("an edit that names no property is nobody's business but the format's");

        for refused in [
            TicketEdit {
                start: Some(Some("2026-09-28".to_owned())),
                ..TicketEdit::default()
            },
            TicketEdit {
                start: Some(None),
                ..TicketEdit::default()
            },
        ] {
            let refused = properties
                .accept_edit(&refused)
                .expect_err("this project has no start dates");
            assert!(
                refused
                    .message
                    .contains("has not enabled the start property"),
                "{}",
                refused.message
            );
        }

        // The same clear, on a property the project does read.
        properties
            .accept_edit(&TicketEdit {
                due: Some(None),
                ..TicketEdit::default()
            })
            .expect("clearing a due date is what the Clear row is for");
    }

    /// The create side of the same check. It has no clear — there is nothing on
    /// a ticket that does not exist yet to remove — so every value it carries is
    /// a set.
    #[test]
    fn a_create_is_held_to_the_same_vocabulary_as_an_edit() {
        let document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        let properties = &document.project().properties;

        properties
            .accept_new(&TicketProperties {
                ticket_type: Some("feature".to_owned()),
                due: Some("2026-09-28".to_owned()),
                ..TicketProperties::default()
            })
            .expect("both values are ones this project configures");

        let refused = properties
            .accept_new(&TicketProperties {
                estimate: Some("m".to_owned()),
                ..TicketProperties::default()
            })
            .expect_err("m is not a duration");
        assert!(
            refused.message.contains("scale can read"),
            "{}",
            refused.message
        );
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
    ///
    /// And it refuses the **file**, rather than degrading the one setting the
    /// way a ticket's malformed value degrades (invariants 10, 11, 14). This is
    /// the file whose contents decide what every other file means, so a project
    /// that opened while quietly substituting a default for a setting it could
    /// not read would be a project whose configuration is not what its file
    /// says — and every write made under it would be made under a rule nobody
    /// chose. `system: banana` is refused for the same reason.
    #[test]
    fn a_negative_attention_window_refuses_the_file_and_zero_does_not() {
        let zero =
            format!("{PROJECT}properties:\n  due:\n    enabled: true\n    attention_days: 0\n");
        let parsed = ProjectDocument::parse(&zero).expect("zero should be legal");
        assert_eq!(parsed.project().properties.due.attention_days, 0);

        let negative =
            format!("{PROJECT}properties:\n  due:\n    enabled: true\n    attention_days: -1\n");
        assert!(ProjectDocument::parse(&negative).is_err());
    }

    // ------------------------------------ configuring the properties block

    /// Every write here has to leave a file the reader still accepts, which is
    /// the one assertion that catches a quoted boolean or a lost indent.
    fn written(bytes: Vec<u8>) -> String {
        let rendered = String::from_utf8(bytes).expect("UTF-8");
        ProjectDocument::parse(&rendered).expect("a property write leaves a readable project");
        rendered
    }

    #[test]
    fn turning_a_property_on_writes_the_block_and_seeds_its_vocabulary() {
        let mut document = ProjectDocument::parse(PROJECT).expect("the fixture should parse");
        let rendered = written(
            document
                .set_property_enabled(Property::Type, true)
                .expect("Type can be turned on"),
        );

        // After `labels`, which is where the format documents it.
        assert!(rendered.contains("    color: blue\nproperties:\n  type:\n    enabled: true\n"));
        for (slug, name, color) in SEEDED_TYPE_VALUES {
            assert!(
                rendered.contains(&format!(
                    "      {slug}:\n        name: {name}\n        color: {color}\n"
                )),
                "the seed should carry {slug}"
            );
        }
        let values = &document.project().properties.ticket_type.values;
        assert_eq!(values.len(), SEEDED_TYPE_VALUES.len());
        assert!(document.project().properties.is_enabled(Property::Type));
        // The key it was inserted beside keeps its own bytes.
        assert!(rendered.contains("x_extension: kept\n"));
    }

    #[test]
    fn turning_estimates_on_seeds_the_scale_the_default_system_reads() {
        let mut document = ProjectDocument::parse(PROJECT).expect("the fixture should parse");
        let rendered = written(
            document
                .set_property_enabled(Property::Estimate, true)
                .expect("Estimate can be turned on"),
        );
        assert_eq!(
            document.project().properties.estimate.values,
            SEEDED_TSHIRT_SCALE.map(str::to_owned).to_vec()
        );
        // The block reads in the order the format documents it, which is a
        // question of what the seed writes first rather than of what YAML means.
        assert!(rendered.contains(concat!(
            "  estimate:\n",
            "    enabled: true\n",
            "    system: tshirt\n",
            "    values:\n",
            "      - xs\n",
        )));
    }

    /// The whole of "disabling hides, it never deletes": one line flips, and the
    /// vocabulary and the window the project configured are still there to come
    /// back to.
    #[test]
    fn turning_a_property_off_flips_one_line_and_keeps_its_configuration() {
        let mut document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        let rendered = written(
            document
                .set_property_enabled(Property::Due, false)
                .expect("Due can be turned off"),
        );
        assert_eq!(
            rendered,
            CONFIGURED.replace(
                "  due:\n    enabled: true\n",
                "  due:\n    enabled: false\n"
            )
        );
        assert!(!document.project().properties.due.enabled);
        assert_eq!(document.project().properties.due.attention_days, 3);
    }

    /// The seed is what a property that has never been configured starts from,
    /// not what it is reset to. A project that dropped `spike` keeps it dropped.
    #[test]
    fn turning_a_property_on_again_keeps_the_vocabulary_it_was_left_with() {
        let mut document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        written(
            document
                .set_property_enabled(Property::Type, false)
                .expect("Type can be turned off"),
        );
        written(
            document
                .set_property_enabled(Property::Type, true)
                .expect("Type can be turned back on"),
        );
        assert_eq!(
            document
                .project()
                .properties
                .ticket_type
                .values
                .keys()
                .collect::<Vec<_>>(),
            vec!["bug", "feature"]
        );
    }

    /// The seed acting as a reset is the failure mode, and emptying the
    /// vocabulary is the only way to reach it: an empty registry and an absent
    /// one both read as empty off the parsed value, so the question has to be
    /// asked of the file.
    #[test]
    fn a_vocabulary_a_project_emptied_is_not_handed_back_on_the_next_toggle() {
        let mut document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        for slug in ["bug", "feature"] {
            written(document.remove_type_value(slug).expect("both are defined"));
        }
        assert!(document.project().properties.ticket_type.values.is_empty());

        written(
            document
                .set_property_enabled(Property::Type, false)
                .expect("Type can be turned off"),
        );
        let rendered = written(
            document
                .set_property_enabled(Property::Type, true)
                .expect("Type can be turned back on"),
        );
        assert!(
            document.project().properties.ticket_type.values.is_empty(),
            "the five seeds came back: {rendered}"
        );
    }

    /// The type registry is the label registry, so a rename reaches inside a
    /// value the format contract's own example writes in flow style.
    #[test]
    fn renaming_a_type_value_leaves_every_other_value_alone() {
        let mut document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        let rendered = written(
            document
                .update_type_value("bug", Some("Defect"), None)
                .expect("bug is defined"),
        );
        assert!(rendered.contains("      bug:\n        name: Defect\n        color: red\n"));
        assert!(rendered.contains("      feature: { name: Feature, color: cyan }\n"));
        assert_eq!(
            document.project().properties.ticket_type.values["bug"].name,
            "Defect"
        );
        assert_eq!(
            document.project().properties.ticket_type.values["bug"].color,
            "red"
        );
    }

    #[test]
    fn defining_and_removing_a_type_value_touches_only_that_value() {
        let mut document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        let added = written(
            document
                .add_type_value("spike", "Spike", "purple")
                .expect("a well-formed definition"),
        );
        assert!(added.contains("      spike:\n        name: Spike\n        color: purple\n"));

        let removed = written(document.remove_type_value("bug").expect("bug is defined"));
        assert!(!removed.contains("      bug:"));
        assert!(removed.contains("      feature: { name: Feature, color: cyan }\n"));
        assert!(document
            .project()
            .properties
            .ticket_type
            .values
            .contains_key("spike"));
    }

    #[test]
    fn a_type_value_is_held_to_the_grammar_labels_are() {
        let mut document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        assert!(document
            .add_type_value("Not A Slug", "Nope", "red")
            .is_err());
        assert!(document.add_type_value("bug", "Bug again", "red").is_err());
        assert!(document
            .add_type_value("spike", "Spike", "not a color!")
            .is_err());
        assert!(document
            .update_type_value("absent", Some("Nope"), None)
            .is_err());
        assert!(document.remove_type_value("absent").is_err());
        // None of the refusals wrote anything.
        assert_eq!(document.render(), CONFIGURED);
    }

    #[test]
    fn the_attention_window_takes_zero_and_has_no_ceiling_of_its_own() {
        let mut document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        let rendered = written(
            document
                .set_attention_days(0)
                .expect("zero empties the rung"),
        );
        assert!(rendered.contains("    attention_days: 0\n"));
        assert_eq!(document.project().properties.due.attention_days, 0);
    }

    #[test]
    fn switching_the_estimate_system_rewrites_one_line_and_no_value() {
        let mut document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        let rendered = written(
            document
                .set_estimate_system(EstimateSystem::Fibonacci)
                .expect("Fibonacci is a system"),
        );
        assert_eq!(
            rendered,
            CONFIGURED.replace("    system: duration\n", "    system: fibonacci\n")
        );
        assert_eq!(
            document.project().properties.estimate.system,
            EstimateSystem::Fibonacci
        );
    }

    #[test]
    fn the_conversion_takes_a_fraction_of_an_hour_and_refuses_an_impossible_day() {
        let mut document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        let rendered = written(
            document
                .set_estimate_conversion(7.5, 4.0)
                .expect("a seven-and-a-half-hour day"),
        );
        assert!(rendered.contains("    hours_per_day: 7.5\n"));
        assert!(rendered.contains("    days_per_week: 4\n"));
        assert_eq!(document.project().properties.estimate.hours_per_day, 7.5);
        assert!(document.set_estimate_conversion(25.0, 5.0).is_err());
        assert!(document.set_estimate_conversion(8.0, 0.0).is_err());
    }

    #[test]
    fn the_tshirt_scale_is_written_as_the_ordered_sequence_it_is() {
        let mut document = ProjectDocument::parse(CONFIGURED).expect("the fixture should parse");
        let scale = ["xs", "s", "m"].map(str::to_owned).to_vec();
        let rendered = written(
            document
                .set_tshirt_scale(&scale)
                .expect("a well-formed scale"),
        );
        assert!(rendered.contains("    values:\n      - xs\n      - s\n      - m\n"));
        assert_eq!(document.project().properties.estimate.values, scale);

        assert!(document
            .set_tshirt_scale(&["m".to_owned(), "m".to_owned()])
            .is_err());
        assert!(document
            .set_tshirt_scale(&["Not A Slug".to_owned()])
            .is_err());
    }
}
