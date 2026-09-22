//! Tauri's updater plugin, behind the port [`crate::update::Updater`] defines.
//!
//! Everything that is a *decision* is in `update.rs` and nothing here: this
//! file is the syscall half of the seam, in the same way `platform/macos.rs`
//! is the syscall half of the command-line install. It exists so that
//! `update.rs` can be read, and driven by the suite, without a network and
//! without Tauri.
//!
//! **Bounded, and off the main thread.** The plugin's API is async and the port
//! is not, so each call spawns one future on the app's async runtime and waits
//! for it here with a budget. The caller is a blocking thread — the commands in
//! `lib.rs` hand this to `spawn_blocking` — so no frame, no keystroke and no
//! ticket write ever waits on a socket. When the budget runs out the attempt is
//! abandoned and reported as offline. There is no second try: the next request
//! is the next scheduled slot or the next press of *Check now* (D10).
//!
//! **A configuration fault is a failed check, never a failed launch.** The path
//! is available only from an installed `.app`, because an installed bundle is
//! the only thing an update can replace. A `npm run dev` window, a `cargo test`
//! binary and the perf harness are all [`crate::update::UpdateState::Unavailable`],
//! and so is a bundle whose updater configuration will not build.

use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::AppHandle;
use tauri_plugin_updater::{Error as PluginError, Update, UpdaterExt};

use crate::platform;
use crate::update::{Release, UpdateFault, Updater};

/// The whole budget for one check: connect, request and read.
///
/// Short on purpose. A blocked host, a captive portal or a firewall that
/// blackholes the connection must cost a background thread ten seconds and the
/// person nothing — the pane is not waiting on it and neither is anything else.
const CHECK_BUDGET: Duration = Duration::from_secs(10);

/// The budget for the download, which is a real file over a real connection and
/// is bounded rather than short.
const DOWNLOAD_BUDGET: Duration = Duration::from_secs(600);

/// One frame of a download, or its end.
///
/// One channel rather than two, so the waiting thread has a single thing to
/// select on and a partial download cannot outlive the result that ended it.
enum DownloadEvent {
    Chunk(u64, Option<u64>),
    Done(Result<Vec<u8>, UpdateFault>),
}

/// The plugin, holding what the two presses need between them.
pub struct PluginUpdater {
    app: AppHandle,
    /// What the last successful check found. Kept because `download` needs the
    /// plugin's own object and not merely the version string.
    pending: Mutex<Option<Arc<Update>>>,
    /// The verified bytes, waiting for the second press.
    downloaded: Mutex<Option<Vec<u8>>>,
}

impl PluginUpdater {
    /// The update path for this process, or `None` when there is none.
    ///
    /// `None` is the honest answer twice over: a window not running from a
    /// bundle has nothing to replace, and a bundle whose updater configuration
    /// will not build has nothing to ask. Both are states rather than failures,
    /// and both reach the pane as `unavailable`.
    pub fn attach(app: &AppHandle) -> Option<Arc<dyn Updater>> {
        if !platform::macos::running_from_bundle() {
            return None;
        }
        // Built and dropped: this asks whether the configuration is usable at
        // all, before anything has been promised to a person. A builder is
        // cheap and makes no request.
        app.updater_builder().build().ok()?;
        Some(Arc::new(Self {
            app: app.clone(),
            pending: Mutex::new(None),
            downloaded: Mutex::new(None),
        }))
    }
}

impl Updater for PluginUpdater {
    fn check(&self) -> Result<Option<Release>, UpdateFault> {
        let app = self.app.clone();
        let found = attempt(CHECK_BUDGET, async move {
            let updater = app
                .updater_builder()
                .timeout(CHECK_BUDGET)
                .build()
                .map_err(|error| fault_of(&error))?;
            updater.check().await.map_err(|error| fault_of(&error))
        })?;

        let release = found.as_ref().map(release_of);

        // A new answer retires the old download: what was verified was the file
        // the previous answer named. A check that comes back with *the same*
        // release retires nothing, and the distinction matters — this cleared
        // the cache unconditionally while `update.rs` cleared its own
        // `downloaded` flag only when the release changed, so a scheduled check
        // landing between the two presses left the flag true and the bytes
        // gone. The guard passed, the plugin found `None`, and the restart
        // failed as a download that had in fact succeeded (LC-265y).
        //
        // The comparison is over `Release`, which is the same value and the
        // same `PartialEq` that `update.rs` decides with. Comparing the
        // plugin's own `Update` instead would be a second predicate over
        // richer data — its `date` is a whole `OffsetDateTime` where a
        // `Release`'s is the ISO day — so a re-publish at a different hour
        // would clear the bytes here and leave the flag true there. That is
        // the state this is meant to make impossible.
        {
            let pending = self.pending.lock().expect("update pending lock");
            if pending.as_ref().map(|update| release_of(update)) != release {
                *self.downloaded.lock().expect("update download lock") = None;
            }
        }

        *self.pending.lock().expect("update pending lock") = found.map(Arc::new);
        Ok(release)
    }

    fn download(&self, progress: &mut dyn FnMut(u64, Option<u64>)) -> Result<(), UpdateFault> {
        let pending = self
            .pending
            .lock()
            .expect("update pending lock")
            .clone()
            .ok_or(UpdateFault::CorruptDownload)?;

        let (sender, receiver) = mpsc::channel();
        let frames = sender.clone();
        tauri::async_runtime::spawn(async move {
            let mut received: u64 = 0;
            let downloaded = pending
                .download(
                    |chunk, total| {
                        received += chunk as u64;
                        let _ = frames.send(DownloadEvent::Chunk(received, total));
                    },
                    || {},
                )
                .await
                .map_err(|error| fault_of(&error));
            let _ = sender.send(DownloadEvent::Done(downloaded));
        });

        loop {
            match receiver.recv_timeout(DOWNLOAD_BUDGET) {
                Ok(DownloadEvent::Chunk(received, total)) => progress(received, total),
                Ok(DownloadEvent::Done(Ok(bytes))) => {
                    *self.downloaded.lock().expect("update download lock") = Some(bytes);
                    return Ok(());
                }
                // The partial file is the plugin's and is dropped with the
                // future; the installed bundle was never touched.
                Ok(DownloadEvent::Done(Err(fault))) => return Err(fault),
                Err(RecvTimeoutError::Timeout) => return Err(UpdateFault::CorruptDownload),
                Err(RecvTimeoutError::Disconnected) => return Err(UpdateFault::CorruptDownload),
            }
        }
    }

    fn install_and_restart(&self) -> Result<(), UpdateFault> {
        let pending = self
            .pending
            .lock()
            .expect("update pending lock")
            .clone()
            .ok_or(UpdateFault::CorruptDownload)?;

        install_keeping_bytes(&self.downloaded, |bytes| {
            pending
                .install(bytes)
                .map_err(|error| install_fault_of(&error))
        })?;

        // macOS has the bundle replaced in place and the process still running
        // the old one, so the relaunch is ours to do. `restart` never returns.
        self.app.restart();
    }
}

/// Runs one future on the app's async runtime and waits for it here, once.
///
/// The wait is a blocking thread's to make: the commands hand these calls to
/// `spawn_blocking`, so nothing that draws a frame is on this stack. A budget
/// that runs out is reported as offline rather than retried, which is the whole
/// of the retry policy.
fn attempt<T, F>(budget: Duration, future: F) -> Result<T, UpdateFault>
where
    F: std::future::Future<Output = Result<T, UpdateFault>> + Send + 'static,
    T: Send + 'static,
{
    let (sender, receiver) = mpsc::channel();
    tauri::async_runtime::spawn(async move {
        let _ = sender.send(future.await);
    });
    match receiver.recv_timeout(budget) {
        Ok(result) => result,
        Err(_) => Err(UpdateFault::Offline),
    }
}

/// What one of the plugin's releases is, in the port's own vocabulary.
///
/// One function rather than a mapping at each call site, because `check` both
/// returns this value and decides against it whether the cached download still
/// belongs to the release on offer — and `update.rs` decides the same question
/// over the same type with the same `PartialEq`. Two spellings of "the same
/// release" is the shape of the defect this file is fixing.
fn release_of(update: &Update) -> Release {
    Release {
        version: update.version.clone(),
        // `Date`'s own spelling is the ISO one, which is what the pane formats
        // from and what the manifest carries.
        date: update.date.map(|when| when.date().to_string()),
        notes: update.body.clone(),
    }
}

/// Hands the verified bytes to an install, and keeps them when it fails.
///
/// **The bytes are the retry.** Taking them out of the cache and installing in
/// one movement is what made `Try again` a button that could not work: the
/// press consumed the only copy of a 6MB file that had already been downloaded
/// and cryptographically verified, and every press after the first found an
/// empty cache and returned `CorruptDownload` before touching a disk. The pane
/// showed the same sentence instantly, which is indistinguishable from nothing
/// happening — and is how LC-265y was reported.
///
/// The lock is not held across the install, deliberately: on macOS that call
/// can put an AppleScript prompt on the main thread and wait for a person, and
/// a mutex held for the length of that would be a mutex held for minutes.
/// Taking the bytes out and putting them back is the version of this that
/// blocks nothing.
///
/// This is a free function so the behaviour has a seam: `PluginUpdater` needs a
/// real `AppHandle` and a real release, and neither exists in the suite.
fn install_keeping_bytes<F>(cache: &Mutex<Option<Vec<u8>>>, install: F) -> Result<(), UpdateFault>
where
    F: FnOnce(&[u8]) -> Result<(), UpdateFault>,
{
    let bytes = cache
        .lock()
        .expect("update download lock")
        .take()
        .ok_or(UpdateFault::CorruptDownload)?;

    match install(&bytes) {
        Ok(()) => Ok(()),
        Err(fault) => {
            *cache.lock().expect("update download lock") = Some(bytes);
            Err(fault)
        }
    }
}

/// What a failed *install* is. Never a download that did not arrive.
///
/// `fault_of` ends in a `_` arm that reads an unnamed error as a damaged
/// download, which is the right default while a file is being fetched and the
/// wrong one once it is on disk and verified. Every filesystem failure while
/// replacing the bundle — permission denied, a rename across mount points, a
/// full disk — came through that arm and reached the pane as *The download
/// didn't finish*, pointing every diagnosis at the network. 0.3.0's real fault
/// was an archive the updater could not extract, and the sentence describing it
/// named the one step that had worked (LC-265y).
///
/// **Every one of them, with no exception carved out.** Sorting an install
/// failure into `Unavailable` would say *this build has no updater to check
/// with* to someone whose build had just checked, downloaded and verified —
/// the same kind of lie, told one arm further along. By the time this runs,
/// `attach` has confirmed a bundle, a check has succeeded and a file is on
/// disk: whatever went wrong, it went wrong while installing.
fn install_fault_of(_error: &PluginError) -> UpdateFault {
    UpdateFault::InstallFailed
}

/// What one of the plugin's failures is, in the closed set the pane switches on.
///
/// The variants are grouped by what a person can do about them, which is the
/// only distinction a reason is for: reach the network, read the manifest,
/// trust the file, or nothing. `Error` is `#[non_exhaustive]`, so an unnamed
/// variant is a download that did not arrive intact rather than a silent
/// success — the safe default when the alternative is installing something.
fn fault_of(error: &PluginError) -> UpdateFault {
    match error {
        PluginError::EmptyEndpoints
        | PluginError::UnsupportedArch
        | PluginError::UnsupportedOs
        | PluginError::UrlParse(_)
        | PluginError::FailedToDetermineExtractPath => UpdateFault::Unavailable,
        PluginError::Reqwest(inner) => {
            if inner.is_connect() || inner.is_timeout() {
                UpdateFault::Offline
            } else {
                UpdateFault::Blocked
            }
        }
        PluginError::Network(_) => UpdateFault::Offline,
        PluginError::ReleaseNotFound
        | PluginError::Serialization(_)
        | PluginError::Semver(_)
        | PluginError::TargetNotFound(_)
        | PluginError::TargetsNotFound(_) => UpdateFault::BadManifest,
        PluginError::Minisign(_) | PluginError::Base64(_) | PluginError::SignatureUtf8(_) => {
            UpdateFault::BadSignature
        }
        _ => UpdateFault::CorruptDownload,
    }
}

/// Opens the site's download page in the default browser.
///
/// The one way out when the in-app update cannot finish, and the reason the URL
/// is a constant here rather than a parameter: the webview asks for *the
/// download page* and names nothing, the shape `open_ticket_file` and
/// `install_command_line` already take.
pub fn open_download_page() -> bool {
    platform::macos::open_web_url(crate::update::DOWNLOAD_PAGE_URL)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The defect LC-265y was reported as: `Try again` does nothing.
    ///
    /// Nothing about the *cause* of the install failure matters here — what
    /// matters is that the second press is a real second attempt rather than a
    /// refusal issued against a cache the first press emptied.
    #[test]
    fn a_failed_install_leaves_the_bytes_for_the_next_press() {
        let cache = Mutex::new(Some(b"the verified archive".to_vec()));

        let first = install_keeping_bytes(&cache, |_| Err(UpdateFault::InstallFailed));
        assert_eq!(first, Err(UpdateFault::InstallFailed));

        let mut seen: Option<Vec<u8>> = None;
        let second = install_keeping_bytes(&cache, |bytes| {
            seen = Some(bytes.to_vec());
            Ok(())
        });
        assert_eq!(second, Ok(()));
        assert_eq!(
            seen.as_deref(),
            Some(&b"the verified archive"[..]),
            "the retry must install the file the first press downloaded, not refuse"
        );
    }

    /// The other half: a success consumes them, so a restart that did not
    /// happen cannot install a second time from a stale copy.
    #[test]
    fn a_successful_install_consumes_the_bytes() {
        let cache = Mutex::new(Some(b"the verified archive".to_vec()));

        assert_eq!(install_keeping_bytes(&cache, |_| Ok(())), Ok(()));
        assert!(cache.lock().expect("lock").is_none());

        assert_eq!(
            install_keeping_bytes(&cache, |_| Ok(())),
            Err(UpdateFault::CorruptDownload),
            "with nothing downloaded there is nothing to install"
        );
    }

    /// With no download at all the install is never attempted — the refusal
    /// comes from the cache being empty, not from a failed replacement.
    #[test]
    fn nothing_downloaded_is_refused_without_attempting_an_install() {
        let cache: Mutex<Option<Vec<u8>>> = Mutex::new(None);
        let mut attempted = false;

        let result = install_keeping_bytes(&cache, |_| {
            attempted = true;
            Ok(())
        });

        assert_eq!(result, Err(UpdateFault::CorruptDownload));
        assert!(!attempted);
    }

    /// An install that fails on the filesystem is an install failure, and says
    /// so. Reporting it as a download that did not finish is what sent
    /// LC-265y's diagnosis at the network for a day.
    #[test]
    fn a_filesystem_failure_while_installing_is_not_a_failed_download() {
        let io = PluginError::Io(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "failed to unpack `._LongClaw.app`",
        ));
        assert_eq!(install_fault_of(&io), UpdateFault::InstallFailed);
        assert_eq!(
            fault_of(&io),
            UpdateFault::CorruptDownload,
            "the download path keeps its default: mid-fetch, an unnamed error is a damaged file"
        );

        assert_eq!(
            install_fault_of(&PluginError::FailedToDetermineExtractPath),
            UpdateFault::InstallFailed,
            "by install time a bundle has been confirmed, so this is not `no updater here`"
        );
    }
}
