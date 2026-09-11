//! Who made the change the watcher just saw.
//!
//! This is not the same question as "who is the newest actor in this file", and
//! answering it with that is how an agent gets credit for a person's edit. A
//! person editing a description in an editor appends no activity record; the
//! newest record is still whatever an agent wrote an hour ago, and a board that
//! reads it says the agent did this.
//!
//! The rule here is the register's: **the actor of an observed change is the actor
//! of a record that was not there before.** Anything else is `None`, which the
//! surfaces render as `⚠ file changed on disk — actor unknown`. That is the honest
//! answer and a designed state, not a fallback to apologise for — inferring an
//! actor from a timestamp or an mtime would be guessing with extra steps.

use super::model::ActivitySummary;
use super::ticket::ActivityEvent;

/// The record that explains an observed change, or `None` for actor unknown.
///
/// `previously_seen` is the id of the newest record the app had already indexed
/// for this ticket, and `now_present` is the file's records as they are now.
///
/// Three cases produce `None`, all of them deliberate:
///
/// - the file gained no records, so nothing in it describes this change;
/// - the record the app last saw is gone, so the history was rewritten and the
///   position of "new" cannot be established;
/// - the app had never seen a record and the file still has none.
pub fn attribute_change(
    previously_seen: Option<&str>,
    now_present: &[ActivityEvent],
) -> Option<ActivitySummary> {
    let appended = match previously_seen {
        // Everything in the file is new to us, so the newest record is this change.
        None => now_present,
        Some(id) => {
            let position = now_present.iter().position(|event| event.id == id)?;
            &now_present[position + 1..]
        }
    };
    appended.last().map(summarize)
}

fn summarize(event: &ActivityEvent) -> ActivitySummary {
    ActivitySummary {
        id: event.id.clone(),
        kind: event.kind.as_str().to_owned(),
        occurred_at: event.occurred_at.clone(),
        actor: event.actor.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::ticket::{Actor, ActorType, EventKind};

    fn event(id: &str, actor_type: ActorType, name: Option<&str>) -> ActivityEvent {
        ActivityEvent {
            id: id.to_owned(),
            kind: EventKind::Update,
            occurred_at: "2026-07-31T09:00:00Z".to_owned(),
            edited_at: None,
            actor: Actor {
                actor_type,
                id: name.map(|_| "claude-code".to_owned()),
                name: name.map(str::to_owned),
            },
            changes: Vec::new(),
            body: String::new(),
        }
    }

    #[test]
    fn an_appended_record_is_the_actor_of_the_change() {
        let after = vec![
            event("evt_1", ActorType::Human, None),
            event("evt_2", ActorType::Agent, Some("Claude Code")),
        ];

        let attributed = attribute_change(Some("evt_1"), &after).expect("a record was appended");

        assert_eq!(attributed.id, "evt_2");
        assert_eq!(attributed.actor.actor_type, ActorType::Agent);
    }

    #[test]
    fn the_newest_of_several_appended_records_wins() {
        let after = vec![
            event("evt_1", ActorType::Agent, Some("Claude Code")),
            event("evt_2", ActorType::Agent, Some("Claude Code")),
            event("evt_3", ActorType::Human, None),
        ];

        let attributed = attribute_change(Some("evt_1"), &after).expect("records were appended");

        assert_eq!(attributed.id, "evt_3");
    }

    #[test]
    fn a_change_that_appended_nothing_is_unknown() {
        // The person edited the description in an editor. The agent's record is
        // still the newest one in the file, and it is not what happened here.
        let after = vec![event("evt_1", ActorType::Agent, Some("Claude Code"))];

        assert!(attribute_change(Some("evt_1"), &after).is_none());
    }

    #[test]
    fn rewritten_history_is_unknown_rather_than_guessed() {
        let after = vec![event("evt_9", ActorType::Agent, Some("Claude Code"))];

        // The record we had indexed is gone, so there is no position from which
        // "appended" means anything.
        assert!(attribute_change(Some("evt_1"), &after).is_none());
    }

    #[test]
    fn a_first_record_on_a_ticket_we_had_no_record_for_is_attributed() {
        let after = vec![event("evt_1", ActorType::Human, None)];

        let attributed = attribute_change(None, &after).expect("the record is new to us");

        assert_eq!(attributed.actor.actor_type, ActorType::Human);
    }

    #[test]
    fn a_ticket_with_no_records_at_all_is_unknown() {
        assert!(attribute_change(None, &[]).is_none());
    }
}
