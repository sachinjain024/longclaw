//! The repository this app is built from: the one page the window may open, and
//! the one number it may ask for (LC-257s).
//!
//! **The webview names no URL.** It asks for *the repository* and this module
//! decides which one, the shape `open_ticket_file`, `install_command_line` and
//! `open_download_page` already take. A command that accepted a URL would be a
//! network capability spelled differently, and the capability document says
//! there is none.
//!
//! **This is the second caller on ADR 0014's road, and nothing more.**
//! [ADR 0015](../../../../docs/adr/0015-the-star-count-rides-the-update-path.md)
//! records what that costs. The promise the app makes is *no information*
//! rather than *no connection*: one identifier-free `GET` for one public
//! number, at most once a day, refusable before it is made, and carrying
//! nothing about the person or their projects. The request adds no crate and no
//! TLS stack to the binary — it is the updater's own `reqwest`, which is why
//! `binary-audit.mjs` reads the same symbols and the same two frameworks after
//! this landed as before.
//!
//! **A failure claims nothing.** There is no retry, no backoff and no second
//! request inside a slot: a check that does not work leaves the control in the
//! no-count state, which is the state it is in on first paint anyway. The count
//! is the enhancement and the bare mark is the control.

use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Where the control goes. One constant, because the webview has no say in it.
pub const REPOSITORY_URL: &str = "https://github.com/sachinjain024/longclaw";

/// The one API address this app may reach, spelled out rather than composed.
///
/// A constant rather than a host plus a path built at the call site: there is
/// exactly one repository to ask about, and a builder would be a place for a
/// second one to arrive.
pub const API_URL: &str = "https://api.github.com/repos/sachinjain024/longclaw";

/// The host `release-audit.mjs` and `perf/network-audit.mjs` both check for.
///
/// Named here and read there, so the allowlist and the code cannot drift into
/// disagreeing about what is sanctioned — the same arrangement
/// [`crate::update::ALLOWED_HOSTS`] already has.
pub const API_HOST: &str = "api.github.com";

/// How long one slot is. A second request inside it is refused rather than made.
///
/// The same 24 hours the update check uses, and held here as well as in the
/// frontend for the same reason: a schedule that lived only in a webview is a
/// schedule a reload resets.
pub const FETCH_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);

/// The whole budget for one request: connect, send and read.
///
/// Short, and shorter than the update check's ten seconds, because nothing is
/// waiting on this. A blocked host or a captive portal must cost a background
/// thread a few seconds and the person nothing at all.
pub const FETCH_BUDGET: Duration = Duration::from_secs(5);

/// What the app calls itself on the wire.
///
/// GitHub refuses an unauthenticated request with no `User-Agent`, so there has
/// to be one. It is the product and its version and nothing else — no machine
/// id, no install id, no locale, no counter. The version is already in the
/// update check's own agent string, so this adds nothing that was not already
/// leaving.
pub const USER_AGENT: &str = concat!("LongClaw/", env!("CARGO_PKG_VERSION"));

/// Where a star count comes from, so the decisions below can be driven without
/// a network.
///
/// The same seam `update.rs` puts between what is a *decision* and what is a
/// *syscall*, and it exists for the same reason: every rule in this file —
/// one request per slot, a failure that claims nothing, a number that has to be
/// plausible — is tested against a source that never opens a socket.
pub trait StarSource: Send + Sync {
    /// One request. `None` is every failure there is: offline, refused, rate
    /// limited, a body that would not parse. The caller cannot tell them apart
    /// and neither can the person, which is why they are one answer.
    fn stars(&self) -> Option<u64>;
}

/// The star count for this process.
pub struct StarCount {
    source: Box<dyn StarSource>,
    last: Mutex<Option<Instant>>,
}

impl StarCount {
    pub fn new(source: Box<dyn StarSource>) -> Self {
        Self {
            source,
            last: Mutex::new(None),
        }
    }

    /// The count, or `None` when there is nothing to say.
    ///
    /// **At most one request per slot, counted here rather than promised by the
    /// caller.** Two schedulers, a reload and a re-render cost one request
    /// between them, and a failure is not retried until the next slot — the
    /// same rule D10 puts on the update check, and for the same reason: a
    /// control that is merely on screen must never become a second schedule.
    ///
    /// The slot is consumed before the request rather than after it, so a
    /// failure costs a slot too. That is deliberate, and it is worth being
    /// exact about what it buys, because the first draft of this comment was
    /// not: this slot lives in the process, so it bounds one *run* of the app
    /// rather than one machine forever. A failure that left it open would let
    /// a blocked proxy be retried by every re-render and every reload for as
    /// long as the window is up. Across launches the frontend's timestamp is
    /// what holds, and that is written only on success — so a machine that can
    /// never reach the host does ask once per launch, exactly as the update
    /// check does, and asks nothing at all once automatic checks are off.
    pub fn fetch(&self) -> Option<u64> {
        {
            let mut last = self.last.lock().ok()?;
            let now = Instant::now();
            if let Some(at) = *last {
                if now.duration_since(at) < FETCH_INTERVAL {
                    return None;
                }
            }
            *last = Some(now);
        }
        self.source.stars()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    struct Counting {
        calls: Arc<AtomicUsize>,
        answer: Option<u64>,
    }

    impl StarSource for Counting {
        fn stars(&self) -> Option<u64> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            self.answer
        }
    }

    fn with(answer: Option<u64>) -> (StarCount, Arc<AtomicUsize>) {
        let calls = Arc::new(AtomicUsize::new(0));
        let source = Counting {
            calls: Arc::clone(&calls),
            answer,
        };
        (StarCount::new(Box::new(source)), calls)
    }

    #[test]
    fn returns_what_the_source_said() {
        let (stars, calls) = with(Some(1_284));
        assert_eq!(stars.fetch(), Some(1_284));
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn makes_one_request_per_slot() {
        let (stars, calls) = with(Some(1_284));
        assert_eq!(stars.fetch(), Some(1_284));
        assert_eq!(stars.fetch(), None, "a second ask inside the slot");
        assert_eq!(stars.fetch(), None, "and a third");
        assert_eq!(
            calls.load(Ordering::SeqCst),
            1,
            "one request, however many times it is asked"
        );
    }

    #[test]
    fn a_failure_claims_nothing_and_is_not_retried() {
        let (stars, calls) = with(None);
        assert_eq!(stars.fetch(), None);
        assert_eq!(stars.fetch(), None);
        assert_eq!(
            calls.load(Ordering::SeqCst),
            1,
            "a failed check costs its slot too, or a blocked machine asks forever"
        );
    }

    #[test]
    fn the_addresses_are_the_ones_the_audits_check_for() {
        assert!(API_URL.starts_with("https://"));
        assert!(
            API_URL.contains(API_HOST),
            "the audits read API_HOST; it has to be the host API_URL names"
        );
        assert!(REPOSITORY_URL.starts_with("https://github.com/"));
        assert!(
            USER_AGENT.starts_with("LongClaw/"),
            "the agent is the product and its version, and nothing else"
        );
    }
}
