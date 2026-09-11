//! The four properties' grammar, read from the shared fixture.
//!
//! Two implementations decide what a property value means: this core, which
//! settles what a project accepts and what the CLI and the app may write, and
//! `apps/desktop/src/properties.ts`, which settles what a stored value renders
//! as and what a control offers. The Fibonacci scale, the duration grammar and
//! the three conversion defaults were written out in both, in two languages,
//! with nothing holding them together — the shape `fixtures/project-key-grammar.json`
//! already exists to prevent, and the shape that had already drifted here: a
//! zero amount was a duration to one side and not to the other.
//!
//! Both sides now assert against `fixtures/property-grammar.json`, so a rule
//! changed on one side and not the other fails here.
//!
//! The frontend half of the same fixture is `apps/desktop/src/propertyGrammar.test.ts`.

use std::fs;
use std::path::{Path, PathBuf};

use longclaw_desktop_lib::core::project::{
    parse_duration, EstimateConfig, EstimateSystem, DEFAULT_ATTENTION_DAYS, DEFAULT_DAYS_PER_WEEK,
    DEFAULT_HOURS_PER_DAY, FIBONACCI_SCALE, SEEDED_TSHIRT_SCALE,
};
use longclaw_desktop_lib::core::ticket::is_property_date;
use serde_json::Value;

fn repository_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .expect("repository root")
        .to_path_buf()
}

fn grammar() -> Value {
    let path = repository_root().join("fixtures/property-grammar.json");
    let raw = fs::read_to_string(&path).expect("the shared property grammar fixture");
    serde_json::from_str(&raw).expect("the fixture is JSON")
}

/// `(value, valid, note)` from a `cases` array under `section`.
fn cases(fixture: &Value, section: &str) -> Vec<(String, bool, String)> {
    fixture[section]["cases"]
        .as_array()
        .unwrap_or_else(|| panic!("fixture section {section} has a cases array"))
        .iter()
        .map(|case| {
            (
                case["value"]
                    .as_str()
                    .unwrap_or_else(|| panic!("case {case} has a value"))
                    .to_owned(),
                case["valid"].as_bool().expect("case declares valid"),
                case["note"].as_str().unwrap_or("").to_owned(),
            )
        })
        .collect()
}

fn strings(fixture: &Value, section: &str) -> Vec<String> {
    fixture[section]["values"]
        .as_array()
        .unwrap_or_else(|| panic!("fixture section {section} has a values array"))
        .iter()
        .map(|value| value.as_str().expect("a string").to_owned())
        .collect()
}

#[test]
fn a_duration_is_what_the_shared_grammar_says_it_is() {
    let fixture = grammar();
    let table = cases(&fixture, "durations");
    assert!(table.len() > 15, "the fixture carries a real case table");

    for (value, valid, note) in table {
        assert_eq!(
            parse_duration(&value).is_some(),
            valid,
            "duration {value:?} should be {}: {note}",
            if valid { "accepted" } else { "refused" }
        );
    }
}

/// The same table through the seam a project actually refuses at, so the two
/// cannot come apart either: `accepts` is what decides a write.
#[test]
fn a_duration_project_accepts_exactly_the_same_table() {
    let fixture = grammar();
    let config = EstimateConfig {
        enabled: true,
        system: EstimateSystem::Duration,
        ..EstimateConfig::default()
    };

    for (value, valid, note) in cases(&fixture, "durations") {
        assert_eq!(
            config.accepts(&value),
            valid,
            "duration {value:?} should be {}: {note}",
            if valid { "accepted" } else { "refused" }
        );
    }
}

#[test]
fn the_fibonacci_scale_is_the_fixture_scale_in_the_fixture_order() {
    let fixture = grammar();
    assert_eq!(
        FIBONACCI_SCALE.to_vec(),
        strings(&fixture, "fibonacciScale")
    );
}

#[test]
fn the_seeded_tshirt_scale_is_the_fixture_seed_in_the_fixture_order() {
    let fixture = grammar();
    assert_eq!(
        SEEDED_TSHIRT_SCALE.to_vec(),
        strings(&fixture, "tshirtScale")
    );
}

#[test]
fn the_estimate_systems_and_the_default_are_the_fixture_s() {
    let fixture = grammar();
    assert_eq!(
        EstimateSystem::ALL
            .iter()
            .map(|system| system.as_str().to_owned())
            .collect::<Vec<_>>(),
        strings(&fixture, "estimateSystems")
    );
    assert_eq!(
        EstimateSystem::default().as_str(),
        fixture["estimateSystems"]["default"]
            .as_str()
            .expect("a default system")
    );
}

/// The three numbers a project file that omits them reads as. The frontend
/// carries the same three in `NO_PROPERTIES`, which is the other half of this.
#[test]
fn the_conversion_defaults_are_the_fixture_defaults() {
    let fixture = grammar();
    let defaults = &fixture["defaults"];
    assert_eq!(
        u64::from(DEFAULT_ATTENTION_DAYS),
        defaults["attentionDays"].as_u64().expect("attentionDays")
    );
    assert_eq!(
        DEFAULT_HOURS_PER_DAY,
        defaults["hoursPerDay"].as_f64().expect("hoursPerDay")
    );
    assert_eq!(
        DEFAULT_DAYS_PER_WEEK,
        defaults["daysPerWeek"].as_f64().expect("daysPerWeek")
    );
}

/// The minute counts the fixture states, arrived at from the fixture's own
/// defaults rather than from a table of constants — which is the point: the
/// conversion is a project setting, and `1d` is 480 minutes only because the
/// default working day is eight hours long.
#[test]
fn a_duration_converts_to_the_fixture_s_minutes() {
    let fixture = grammar();
    let per_hour = fixture["conversions"]["minutesPerHour"]
        .as_f64()
        .expect("minutesPerHour");
    let hours_per_day = fixture["defaults"]["hoursPerDay"].as_f64().expect("hours");
    let days_per_week = fixture["defaults"]["daysPerWeek"].as_f64().expect("days");

    for case in fixture["conversions"]["cases"]
        .as_array()
        .expect("a conversion table")
    {
        let value = case["value"].as_str().expect("a value");
        let (amount, unit) = parse_duration(value).unwrap_or_else(|| panic!("{value} parses"));
        let minutes = match unit {
            'm' => amount,
            'h' => amount * per_hour,
            'd' => amount * hours_per_day * per_hour,
            'w' => amount * days_per_week * hours_per_day * per_hour,
            other => panic!("{other} is not a unit"),
        };
        assert_eq!(
            minutes,
            case["minutes"].as_f64().expect("minutes"),
            "{value} in minutes"
        );
    }
}

#[test]
fn a_property_date_is_what_the_shared_grammar_says_it_is() {
    let fixture = grammar();
    for (value, valid, note) in cases(&fixture, "dates") {
        assert_eq!(
            is_property_date(&value),
            valid,
            "date {value:?} should be {}: {note}",
            if valid { "accepted" } else { "refused" }
        );
    }
}
