//! The update path's decisions, apart from the plugin that carries them out
//! (LC-256a, [ADR 0014](../../../../docs/adr/0014-one-optional-check-for-a-newer-longclaw.md)).
//!
//! **What is here and what is not.** Tauri's updater plugin does the request,
//! the minisign verification and the in-place bundle replacement; a
//! hand-written one would be a second implementation of a security-critical
//! path. What it cannot decide is when a check may be made, what a second
//! caller in the same window gets, whether a download may be installed yet, and
//! what each failure is called on the wire. Those are here, behind a port, so
//! the suite drives every state the pane can be in without a network — which is
//! the highest seam this feature has and where most of its logic is tested.
//!
//! The split is the one [`platform::command_line`] already makes between
//! `status` and the platform that answers it, and it exists for the same
//! reason: the part that is a *decision* should be readable without the part
//! that is a *syscall*.
//!
//! **Offline is the baseline.** Nothing else in the app calls into this module;
//! it is reached only from the frontend's schedule and the pane's buttons. A
//! build with no updater configured — a `npm run dev` window, the perf harness
//! — is [`UpdateState::Unavailable`], which is a state and never an error, the
//! way the *Command line* pane already answers `unavailable` when there is no
//! bundle to link. A check that fails, fails once: there is no retry loop and
//! no backoff here, and the only thing that makes a second request is the next
//! slot or the next press of *Check now*.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::core::{AppError, AppResult, ErrorCode};

/// Where a person goes when the in-app update cannot finish.
///
/// The site rather than the GitHub release, because the site is the download
/// the release notes and the install instructions are written about.
pub const DOWNLOAD_PAGE_URL: &str = "https://longclaw.io";

/// Every host the app may speak to, and the whole of the amendment ADR 0014
/// makes to the no-network promise.
///
/// One constant, named by the runtime audit's allowlist as well, so the two
/// cannot drift into disagreeing about what is sanctioned. `github.com` serves
/// the release and redirects its assets to the object store beside it.
pub const ALLOWED_HOSTS: [&str; 2] = ["github.com", "objects.githubusercontent.com"];

/// How long one scheduled slot is. A second check inside it is answered from
/// the first rather than made again.
pub const CHECK_INTERVAL_MS: u64 = 24 * 60 * 60 * 1000;

/// Where the update path stands, as a closed set the pane switches on — the
/// same shape and the same reason as `CommandLineState` and `ErrorCode`
/// (ADR 0010): each variant is a different sentence and a different button.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum UpdateState {
    /// This build has no updater to drive — a dev window rather than a bundle.
    /// Nothing is offered and nothing is wrong.
    Unavailable,
    /// A check has run and there is nothing newer.
    UpToDate,
    /// A newer version exists. It is not downloaded until someone presses.
    Available,
}

/// The version on offer, as the manifest describes it.
///
/// `notes` are not copy: they are the release notes the manifest carries, which
/// the release script takes from `docs/release-notes` — the same source the
/// site's changelog follows, so the app and the changelog cannot disagree.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Release {
    pub version: String,
    pub date: Option<String>,
    pub notes: Option<String>,
}

/// Everything the pane needs to draw itself, in one answer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub state: UpdateState,
    /// The version the running bundle carries. Present in every state, because
    /// the pane and the sidebar footer name it whether or not there is news.
    pub current_version: String,
    /// Absent unless `state` is `available`.
    pub available: Option<Release>,
    /// Whether the pending version is downloaded and verified, which is what
    /// turns the pane's one press into two.
    pub downloaded: bool,
}

/// The download, as it happens.
///
/// A channel rather than the project-event topic, per ADR 0007's rule for an
/// ordered stream that belongs to one caller: the project topic is for project
/// changes, and a download is neither a project change nor something a second
/// window should be told about.
///
/// `total` is optional because the host may not say. A pane that assumed a
/// total would draw a bar that is a lie about a number it does not have.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "event",
    content = "data",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum UpdateProgress {
    Started { version: String, total: Option<u64> },
    Progress { received: u64, total: Option<u64> },
    Finished { version: String },
}

/// Why the update path could not do what was asked.
///
/// A closed set, carried on the error's `reason` context, because the pane
/// turns each into a different sentence and — for two of them — a different
/// pair of buttons. ADR 0010's `code` says what kind of failure it is; this
/// says which one, and it is the thing the frontend switches on.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateFault {
    /// No network at all.
    Offline,
    /// A network that answered, but not with the manifest: a proxy, a captive
    /// portal, a firewall that blocks the host.
    Blocked,
    /// The manifest was fetched and is not a manifest this build can read.
    BadManifest,
    /// The download does not verify against the key inside this bundle. The
    /// file is discarded; this is the one failure that is about trust.
    BadSignature,
    /// The download did not finish, or finished damaged.
    CorruptDownload,
    /// The file arrived and verified, and replacing the installed bundle with
    /// it did not work. Separate from `CorruptDownload` because it is the
    /// opposite diagnosis — the download was the part that went right — and
    /// 0.3.0 was shipped and debugged under the wrong one (LC-265y).
    InstallFailed,
    /// There is no updater in this build to ask.
    Unavailable,
    /// A restart was asked for while a ticket write was still outstanding.
    WriteInFlight,
}

impl UpdateFault {
    /// Every reason, in wire order, for the contract pin.
    pub const ALL: [Self; 8] = [
        Self::Offline,
        Self::Blocked,
        Self::BadManifest,
        Self::BadSignature,
        Self::CorruptDownload,
        Self::InstallFailed,
        Self::Unavailable,
        Self::WriteInFlight,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Offline => "offline",
            Self::Blocked => "blocked",
            Self::BadManifest => "badManifest",
            Self::BadSignature => "badSignature",
            Self::CorruptDownload => "corruptDownload",
            Self::InstallFailed => "installFailed",
            Self::Unavailable => "unavailable",
            Self::WriteInFlight => "writeInFlight",
        }
    }

    /// The kind of failure this is, in ADR 0010's vocabulary.
    fn code(self) -> ErrorCode {
        match self {
            Self::Offline | Self::Blocked | Self::CorruptDownload | Self::InstallFailed => {
                ErrorCode::Io
            }
            Self::BadManifest | Self::BadSignature => ErrorCode::ParseFailed,
            Self::Unavailable => ErrorCode::Internal,
            // A write outstanding is the same shape as a ticket that moved
            // under an edit: not a failure of the thing asked for, but a
            // refusal to do it now.
            Self::WriteInFlight => ErrorCode::Conflict,
        }
    }

    /// Presentation text, for a surface that has no sentence of its own. The
    /// pane has one for every reason; a log and a test do not.
    fn message(self) -> &'static str {
        match self {
            Self::Offline => "LongClaw could not reach the update host.",
            Self::Blocked => "Something on this network answered instead of the update host.",
            Self::BadManifest => "The update manifest could not be read.",
            Self::BadSignature => "The download could not be verified and was discarded.",
            Self::CorruptDownload => "The download did not finish.",
            Self::InstallFailed => "The update could not be installed.",
            Self::Unavailable => "This build has no updater to check with.",
            Self::WriteInFlight => "LongClaw is still saving. The restart will wait for it.",
        }
    }

    /// Whether the person can do anything about it. Only an absent updater
    /// cannot be retried — every other reason is worth a second press.
    fn recoverable(self) -> bool {
        self != Self::Unavailable
    }
}

impl From<UpdateFault> for AppError {
    fn from(fault: UpdateFault) -> Self {
        AppError::new(fault.code(), fault.message(), fault.recoverable())
            .with_context("reason", fault.as_str())
    }
}

/// The plugin, as the only thing this module needs from it.
///
/// Three calls, each one bounded and each one a whole act. There is no
/// `is_online`, no `retry` and no cancellation: a failed attempt ends, which is
/// the offline invariant rather than a simplification.
pub trait Updater: Send + Sync {
    /// One attempt. `Ok(None)` means the running version is the newest.
    fn check(&self) -> Result<Option<Release>, UpdateFault>;

    /// Fetches and verifies the pending version, reporting received and — when
    /// the host said so — total bytes. A failure leaves the installed bundle
    /// untouched and keeps no partial file.
    fn download(&self, progress: &mut dyn FnMut(u64, Option<u64>)) -> Result<(), UpdateFault>;

    /// Replaces the bundle in place and relaunches. Never returns on success.
    fn install_and_restart(&self) -> Result<(), UpdateFault>;
}

/// The time, injected so the suite can drive a slot boundary rather than wait
/// for one.
pub trait Clock: Send + Sync {
    fn now_ms(&self) -> u64;
}

/// The wall clock, for the running app.
pub struct SystemClock;

impl Clock for SystemClock {
    fn now_ms(&self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|since| since.as_millis() as u64)
            .unwrap_or(0)
    }
}

/// What the last attempt was and when, so a second caller in the same slot is
/// answered rather than sent to the network.
#[derive(Default)]
struct Attempt {
    at_ms: Option<u64>,
    outcome: Option<Result<Option<Release>, UpdateFault>>,
}

/// The update path for one running process.
///
/// `updater` is `None` on a build that has none, which is the whole of what
/// "unavailable" means here: there is no separate configured flag to get out of
/// step with it.
pub struct UpdatePath {
    updater: Option<Arc<dyn Updater>>,
    clock: Arc<dyn Clock>,
    current_version: String,
    /// One mutex over the attempt record, which is also what serialises two
    /// concurrent checks into one request: the second caller waits, and then
    /// finds the first caller's answer already recorded for this slot.
    attempt: Mutex<Attempt>,
    pending: Mutex<Option<Release>>,
    downloaded: AtomicBool,
}

impl UpdatePath {
    pub fn new(
        updater: Option<Arc<dyn Updater>>,
        clock: Arc<dyn Clock>,
        current_version: impl Into<String>,
    ) -> Self {
        Self {
            updater,
            clock,
            current_version: current_version.into(),
            attempt: Mutex::new(Attempt::default()),
            pending: Mutex::new(None),
            downloaded: AtomicBool::new(false),
        }
    }

    /// What the pane should draw, without asking anything of the network.
    ///
    /// Safe to call on every render: it reads what the last check left and
    /// makes no request, which is what keeps a pane that is merely *open* from
    /// being a second schedule.
    pub fn status(&self) -> UpdateStatus {
        if self.updater.is_none() {
            return self.state(UpdateState::Unavailable, None);
        }
        let pending = self.pending.lock().expect("update pending lock").clone();
        match pending {
            Some(release) => self.state(UpdateState::Available, Some(release)),
            // Nothing pending and nothing checked read the same from here. The
            // pane tells them apart from its own record of the last successful
            // check, which is a device preference rather than a fact about this
            // process (ADR 0012).
            None => self.state(UpdateState::UpToDate, None),
        }
    }

    /// Asks whether there is a newer version.
    ///
    /// `force` is *Check now*, which always makes the request. A scheduled
    /// check makes one **only if no attempt has been made in this slot** — so
    /// two schedulers, a re-render and a failed attempt all cost one request
    /// between them, and a failure is never retried until the next slot.
    pub fn check(&self, force: bool) -> AppResult<UpdateStatus> {
        let Some(updater) = self.updater.as_ref() else {
            // Quiet: a build with no updater is a state, not a failure.
            return Ok(self.state(UpdateState::Unavailable, None));
        };

        let now = self.clock.now_ms();
        let mut attempt = self.attempt.lock().expect("update attempt lock");

        let fresh = attempt
            .at_ms
            .is_some_and(|at| now.saturating_sub(at) < CHECK_INTERVAL_MS);
        let outcome = if force || !fresh || attempt.outcome.is_none() {
            let outcome = updater.check();
            attempt.at_ms = Some(now);
            attempt.outcome = Some(outcome.clone());
            outcome
        } else {
            attempt.outcome.clone().expect("a recorded outcome")
        };

        match outcome {
            Ok(found) => {
                let mut pending = self.pending.lock().expect("update pending lock");
                // A version that is no longer on offer takes its download with
                // it: what was verified was the old file.
                if pending.as_ref() != found.as_ref() {
                    self.downloaded.store(false, Ordering::SeqCst);
                }
                *pending = found.clone();
                drop(pending);
                Ok(match found {
                    Some(release) => self.state(UpdateState::Available, Some(release)),
                    None => self.state(UpdateState::UpToDate, None),
                })
            }
            Err(fault) => Err(fault.into()),
        }
    }

    /// Fetches the pending version, once someone has pressed for it.
    ///
    /// Any failure leaves `downloaded` false and the installed bundle
    /// untouched, so losing the network halfway costs the partial file and
    /// nothing else.
    pub fn download(&self, progress: &mut dyn FnMut(u64, Option<u64>)) -> AppResult<UpdateStatus> {
        let updater = self.updater.as_ref().ok_or(UpdateFault::Unavailable)?;
        let pending = self.pending.lock().expect("update pending lock").clone();
        let Some(release) = pending else {
            // Nothing to fetch is not a network failure, and saying `offline`
            // for it would put the wrong sentence in the pane.
            return Ok(self.state(UpdateState::UpToDate, None));
        };

        self.downloaded.store(false, Ordering::SeqCst);
        updater.download(progress).map_err(AppError::from)?;
        self.downloaded.store(true, Ordering::SeqCst);
        Ok(self.state(UpdateState::Available, Some(release)))
    }

    /// The second press. Refuses while the disk has not settled, and refuses
    /// anything that was not downloaded and verified first.
    pub fn install_and_restart(&self, writes_in_flight: usize) -> AppResult<()> {
        let updater = self.updater.as_ref().ok_or(UpdateFault::Unavailable)?;
        restart_guard(writes_in_flight)?;
        if !self.downloaded.load(Ordering::SeqCst) {
            return Err(UpdateFault::CorruptDownload.into());
        }
        updater.install_and_restart().map_err(AppError::from)
    }

    fn state(&self, state: UpdateState, available: Option<Release>) -> UpdateStatus {
        UpdateStatus {
            state,
            current_version: self.current_version.clone(),
            available,
            downloaded: self.downloaded.load(Ordering::SeqCst),
        }
    }
}

/// Refuses a version change while a ticket write is outstanding.
///
/// The frontend disables the button and says why, and that is the experience;
/// this is the guarantee. ADR 0009 puts an invariant about a write with the
/// write, and the count this reads is kept around the atomic write seams
/// themselves — so a write the webview never started still holds the restart.
pub fn restart_guard(writes_in_flight: usize) -> AppResult<()> {
    if writes_in_flight > 0 {
        return Err(AppError::from(UpdateFault::WriteInFlight)
            .with_context("writesInFlight", writes_in_flight.to_string()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;

    /// A plugin that never touches a network, and counts what it was asked.
    struct FakeUpdater {
        check_result: Mutex<Result<Option<Release>, UpdateFault>>,
        download_result: Mutex<Result<(), UpdateFault>>,
        checks: AtomicUsize,
        downloads: AtomicUsize,
        installs: AtomicUsize,
    }

    impl FakeUpdater {
        fn new(check_result: Result<Option<Release>, UpdateFault>) -> Arc<Self> {
            Arc::new(Self {
                check_result: Mutex::new(check_result),
                download_result: Mutex::new(Ok(())),
                checks: AtomicUsize::new(0),
                downloads: AtomicUsize::new(0),
                installs: AtomicUsize::new(0),
            })
        }

        fn failing_download(self: &Arc<Self>, fault: UpdateFault) {
            *self.download_result.lock().unwrap() = Err(fault);
        }

        fn checks(&self) -> usize {
            self.checks.load(Ordering::SeqCst)
        }

        fn installs(&self) -> usize {
            self.installs.load(Ordering::SeqCst)
        }
    }

    impl Updater for FakeUpdater {
        fn check(&self) -> Result<Option<Release>, UpdateFault> {
            self.checks.fetch_add(1, Ordering::SeqCst);
            self.check_result.lock().unwrap().clone()
        }

        fn download(&self, progress: &mut dyn FnMut(u64, Option<u64>)) -> Result<(), UpdateFault> {
            self.downloads.fetch_add(1, Ordering::SeqCst);
            progress(512, Some(1024));
            *self.download_result.lock().unwrap()
        }

        fn install_and_restart(&self) -> Result<(), UpdateFault> {
            self.installs.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }
    }

    /// A clock a test moves by hand, so a slot boundary is an assignment.
    struct TestClock(Mutex<u64>);

    impl TestClock {
        fn new() -> Arc<Self> {
            Arc::new(Self(Mutex::new(1_000)))
        }

        fn advance(&self, ms: u64) {
            *self.0.lock().unwrap() += ms;
        }
    }

    impl Clock for TestClock {
        fn now_ms(&self) -> u64 {
            *self.0.lock().unwrap()
        }
    }

    fn release(version: &str) -> Release {
        Release {
            version: version.to_owned(),
            date: Some("2026-09-19".to_owned()),
            notes: Some("- A fix".to_owned()),
        }
    }

    fn path_with(updater: Option<Arc<dyn Updater>>, clock: Arc<dyn Clock>) -> UpdatePath {
        UpdatePath::new(updater, clock, "0.1.0")
    }

    #[test]
    fn a_build_with_no_updater_is_unavailable_and_never_an_error() {
        let path = path_with(None, Arc::new(SystemClock));

        assert_eq!(path.status().state, UpdateState::Unavailable);
        let checked = path
            .check(true)
            .expect("an absent updater is not a failure");
        assert_eq!(checked.state, UpdateState::Unavailable);
        assert_eq!(checked.current_version, "0.1.0");
        assert!(checked.available.is_none());
    }

    #[test]
    fn nothing_newer_reads_as_up_to_date() {
        let updater = FakeUpdater::new(Ok(None));
        let path = path_with(Some(updater.clone()), TestClock::new());

        let checked = path.check(false).expect("a check that found nothing");

        assert_eq!(checked.state, UpdateState::UpToDate);
        assert!(checked.available.is_none());
        assert!(!checked.downloaded);
        assert_eq!(updater.checks(), 1);
    }

    #[test]
    fn a_newer_version_is_named_with_its_date_and_notes() {
        let updater = FakeUpdater::new(Ok(Some(release("0.2.0"))));
        let path = path_with(Some(updater), TestClock::new());

        let checked = path.check(false).expect("a check that found a version");

        assert_eq!(checked.state, UpdateState::Available);
        assert_eq!(
            checked.available,
            Some(release("0.2.0")),
            "the pane shows the version, the date and the notes from the manifest"
        );
        assert!(
            !checked.downloaded,
            "finding a version downloads nothing — consent is the first press"
        );
        // And it survives to the next render without a second request.
        assert_eq!(path.status().state, UpdateState::Available);
    }

    #[test]
    fn every_failure_reason_crosses_as_itself() {
        for fault in [
            UpdateFault::Offline,
            UpdateFault::Blocked,
            UpdateFault::BadManifest,
        ] {
            let updater = FakeUpdater::new(Err(fault));
            let path = path_with(Some(updater), TestClock::new());

            let error = path.check(true).expect_err("the check failed");

            assert_eq!(
                error.context.get("reason").map(String::as_str),
                Some(fault.as_str()),
                "the pane switches on the reason, not on the prose"
            );
            assert!(error.recoverable, "a second press is worth offering");
            assert!(
                !error.message.is_empty(),
                "a surface with no sentence of its own still needs one"
            );
        }
    }

    #[test]
    fn a_failed_check_makes_one_request_per_slot_and_none_afterwards() {
        let updater = FakeUpdater::new(Err(UpdateFault::Offline));
        let clock = TestClock::new();
        let path = path_with(Some(updater.clone()), clock.clone());

        path.check(false).expect_err("offline");
        for _ in 0..5 {
            path.check(false).expect_err("still offline");
        }

        assert_eq!(
            updater.checks(),
            1,
            "a failed attempt ends; there is no retry loop and no backoff"
        );

        clock.advance(CHECK_INTERVAL_MS);
        path.check(false).expect_err("the next slot tries once");
        assert_eq!(updater.checks(), 2);
    }

    #[test]
    fn check_now_asks_again_inside_the_same_slot() {
        let updater = FakeUpdater::new(Ok(None));
        let path = path_with(Some(updater.clone()), TestClock::new());

        path.check(false).expect("the scheduled check");
        path.check(true).expect("Check now");

        assert_eq!(
            updater.checks(),
            2,
            "turning the automatic check off must never mean stranded"
        );
    }

    #[test]
    fn nothing_downloads_until_a_version_is_pending() {
        let updater = FakeUpdater::new(Ok(None));
        let path = path_with(Some(updater.clone()), TestClock::new());
        path.check(false).expect("up to date");

        let after = path
            .download(&mut |_, _| {})
            .expect("nothing to fetch is not a network failure");

        assert_eq!(after.state, UpdateState::UpToDate);
        assert!(!after.downloaded);
    }

    #[test]
    fn a_download_reports_progress_and_ends_verified() {
        let updater = FakeUpdater::new(Ok(Some(release("0.2.0"))));
        let path = path_with(Some(updater), TestClock::new());
        path.check(false).expect("a version is available");

        let mut frames = Vec::new();
        let after = path
            .download(&mut |received, total| frames.push((received, total)))
            .expect("the download finished");

        assert_eq!(frames, vec![(512, Some(1024))]);
        assert!(after.downloaded, "the pane's second press is now offered");
        assert_eq!(after.state, UpdateState::Available);
    }

    #[test]
    fn a_download_that_fails_leaves_the_installed_bundle_untouched() {
        let updater = FakeUpdater::new(Ok(Some(release("0.2.0"))));
        updater.failing_download(UpdateFault::BadSignature);
        let path = path_with(Some(updater.clone()), TestClock::new());
        path.check(false).expect("a version is available");

        let error = path
            .download(&mut |_, _| {})
            .expect_err("the download did not verify");

        assert_eq!(
            error.context.get("reason").map(String::as_str),
            Some("badSignature")
        );
        assert!(!path.status().downloaded);
        assert_eq!(
            path.install_and_restart(0)
                .expect_err("nothing verified to install")
                .context
                .get("reason")
                .map(String::as_str),
            Some("corruptDownload")
        );
        assert_eq!(updater.installs(), 0, "no half-applied update exists");
    }

    #[test]
    fn a_restart_is_refused_while_a_ticket_write_is_in_flight() {
        let updater = FakeUpdater::new(Ok(Some(release("0.2.0"))));
        let path = path_with(Some(updater.clone()), TestClock::new());
        path.check(false).expect("a version is available");
        path.download(&mut |_, _| {}).expect("downloaded");

        let error = path
            .install_and_restart(1)
            .expect_err("the disk has not settled");

        assert_eq!(error.code, ErrorCode::Conflict);
        assert_eq!(
            error.context.get("reason").map(String::as_str),
            Some("writeInFlight")
        );
        assert_eq!(
            error.context.get("writesInFlight").map(String::as_str),
            Some("1")
        );
        assert_eq!(
            updater.installs(),
            0,
            "an update must never lose the sentence somebody just typed"
        );

        path.install_and_restart(0).expect("the disk settled");
        assert_eq!(updater.installs(), 1);
    }

    #[test]
    fn a_version_that_is_withdrawn_takes_its_download_with_it() {
        let updater = FakeUpdater::new(Ok(Some(release("0.2.0"))));
        let path = path_with(Some(updater.clone()), TestClock::new());
        path.check(false).expect("a version is available");
        path.download(&mut |_, _| {}).expect("downloaded");
        assert!(path.status().downloaded);

        *updater.check_result.lock().unwrap() = Ok(None);
        let after = path.check(true).expect("Check now");

        assert_eq!(after.state, UpdateState::UpToDate);
        assert!(
            !after.downloaded,
            "what was verified was the old file, so the press it earned goes too"
        );
    }

    #[test]
    fn the_restart_guard_is_the_guarantee_the_button_only_describes() {
        assert!(restart_guard(0).is_ok());
        let error = restart_guard(3).expect_err("three writes outstanding");
        assert_eq!(
            error.context.get("writesInFlight").map(String::as_str),
            Some("3")
        );
    }

    #[test]
    fn the_reason_set_is_the_one_the_ipc_contract_pins() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../tests/fixtures/ipc-contract.json"))
                .expect("IPC contract fixture must be valid JSON");
        let emitted: Vec<&str> = UpdateFault::ALL
            .iter()
            .map(|fault| fault.as_str())
            .collect();

        assert_eq!(
            serde_json::to_value(&emitted).expect("reasons must serialize"),
            fixture["updateFailureReasons"],
            "the set of update failure reasons changed; `src/updates.ts` switches on it"
        );
    }

    #[test]
    fn the_progress_frames_are_the_shape_the_frontend_replays() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../tests/fixtures/ipc-contract.json"))
                .expect("IPC contract fixture must be valid JSON");

        for (name, frame) in [
            (
                "started",
                UpdateProgress::Started {
                    version: "0.2.0".to_owned(),
                    total: Some(1024),
                },
            ),
            (
                "progress",
                UpdateProgress::Progress {
                    received: 512,
                    total: Some(1024),
                },
            ),
            (
                "finished",
                UpdateProgress::Finished {
                    version: "0.2.0".to_owned(),
                },
            ),
        ] {
            assert_eq!(
                serde_json::to_value(&frame).expect("a frame must serialize"),
                fixture["updateProgressFrames"][name],
                "the {name} frame drifted from the contract the pane replays"
            );
        }
    }

    #[test]
    fn the_status_dto_is_the_shape_the_frontend_replays() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../tests/fixtures/ipc-contract.json"))
                .expect("IPC contract fixture must be valid JSON");
        let updater = FakeUpdater::new(Ok(Some(release("0.2.0"))));
        let path = path_with(Some(updater), TestClock::new());
        let status = path.check(false).expect("a version is available");

        assert_eq!(
            serde_json::to_value(&status).expect("the status must serialize"),
            fixture["updateStatus"]["available"]
        );
    }
}
