//! The project-key grammar, read from the shared fixture.
//!
//! The frontend derives a key and the backend accepts or refuses it. When those
//! two rules were written in different languages with no shared case table they
//! drifted, and the create form suggested keys the backend rejected. Both sides
//! now assert against `fixtures/project-key-grammar.json`, so a change to one
//! rule that is not a change to the fixture fails here.
//!
//! The frontend half of the same fixture is `apps/desktop/src/projectKey.test.ts`.

use std::fs;
use std::path::{Path, PathBuf};

use longclaw_desktop_lib::core::project::is_project_key;
use longclaw_desktop_lib::core::storage::{
    random_key_suffix, valid_ticket_key, KEY_SUFFIX_ALPHABET,
};
use serde_json::Value;

fn repository_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .expect("repository root")
        .to_path_buf()
}

fn grammar() -> Value {
    let path = repository_root().join("fixtures/project-key-grammar.json");
    let raw = fs::read_to_string(&path).expect("the shared project-key grammar fixture");
    serde_json::from_str(&raw).expect("the fixture is JSON")
}

fn cases(fixture: &Value, section: &str, field: &str) -> Vec<(String, bool, String)> {
    fixture[section]
        .as_array()
        .unwrap_or_else(|| panic!("fixture section {section} is an array"))
        .iter()
        .map(|case| {
            (
                case[field]
                    .as_str()
                    .unwrap_or_else(|| panic!("case {case} has a {field}"))
                    .to_owned(),
                case["valid"].as_bool().expect("case declares valid"),
                case["note"].as_str().unwrap_or("").to_owned(),
            )
        })
        .collect()
}

#[test]
fn the_project_key_validator_matches_the_shared_grammar() {
    let fixture = grammar();
    let keys = cases(&fixture, "keys", "key");
    assert!(keys.len() > 10, "the fixture carries a real case table");

    for (key, valid, note) in keys {
        assert_eq!(
            is_project_key(&key),
            valid,
            "project key {key:?} should be {}: {note}",
            if valid { "accepted" } else { "refused" }
        );
    }
}

#[test]
fn a_ticket_key_prefix_obeys_the_same_grammar() {
    let fixture = grammar();
    for (ticket_key, valid, note) in cases(&fixture, "ticketKeys", "ticketKey") {
        assert_eq!(
            valid_ticket_key(&ticket_key),
            valid,
            "ticket key {ticket_key:?} should be {}: {note}",
            if valid { "accepted" } else { "refused" }
        );
    }
}

/// The bug in one assertion: the frontend derives, this validator accepts. The
/// frontend's own test proves it produces the fixture's keys; this proves the
/// backend takes every one of them, so neither side has to trust the other.
#[test]
fn every_key_the_form_can_derive_is_a_key_this_build_accepts() {
    let fixture = grammar();
    let derivations = fixture["derivations"]
        .as_array()
        .expect("a derivation table");
    assert!(derivations.len() > 5, "the table is a real one");

    for case in derivations {
        let name = case["name"].as_str().expect("a name");
        let derived = case["key"].as_str().expect("a derived key");
        assert!(
            is_project_key(derived),
            "the form derives {derived:?} from {name:?}, so creation must accept it"
        );
    }
}

/// The suffix half of the ticket-key grammar, held to the fixture rather than to
/// a second copy of the rule. The allocator draws from `mintingAlphabet`; the
/// reader accepts any lowercase letter, so every character the allocator can draw
/// has to be a character `valid_ticket_key` takes.
#[test]
fn every_character_the_allocator_can_draw_is_one_the_reader_accepts() {
    let fixture = grammar();
    let suffix = &fixture["ticketKeySuffix"];
    let alphabet = suffix["mintingAlphabet"]
        .as_str()
        .expect("the minting alphabet");
    let dropped = suffix["droppedLetters"]
        .as_str()
        .expect("the dropped letters");

    assert_eq!(
        alphabet.as_bytes(),
        KEY_SUFFIX_ALPHABET,
        "the fixture and the allocator name the same alphabet"
    );
    assert_eq!(
        suffix["length"].as_u64(),
        Some(1),
        "one character is the length that was chosen"
    );
    assert_eq!(
        alphabet.len(),
        26 - dropped.len(),
        "the alphabet is the lowercase letters minus {dropped:?}"
    );

    for character in alphabet.chars() {
        assert!(
            character.is_ascii_lowercase(),
            "{character} is lowercase, because macOS folds case onto one directory"
        );
        assert!(
            !dropped.contains(character),
            "{character} is a confusable and should not be drawable"
        );
        assert!(
            valid_ticket_key(&format!("LC-211{character}")),
            "the reader must accept LC-211{character}, which the allocator can mint"
        );
    }
    for character in dropped.chars() {
        assert!(
            !alphabet.contains(character),
            "{character} is dropped from the alphabet"
        );
    }
}

/// Forty draws is not a distribution test; it is enough to fail a constant.
#[test]
fn a_drawn_suffix_comes_out_of_the_alphabet() {
    let alphabet = KEY_SUFFIX_ALPHABET;
    let mut seen = std::collections::BTreeSet::new();
    for _ in 0..40 {
        let drawn = random_key_suffix();
        assert!(
            alphabet.contains(&(drawn as u8)),
            "{drawn} is not in the alphabet"
        );
        seen.insert(drawn);
    }
    assert!(seen.len() > 1, "the suffix is drawn, not fixed: {seen:?}");
}

#[test]
fn length_is_not_part_of_the_grammar() {
    let fixture = grammar();
    let creation_cap = fixture["creationMaxLength"]
        .as_u64()
        .expect("a creation cap") as usize;
    let longer_than_the_form_allows = "L".repeat(creation_cap + 3);

    assert!(
        is_project_key(&longer_than_the_form_allows),
        "a project created before or outside the form's cap must stay openable"
    );
}
