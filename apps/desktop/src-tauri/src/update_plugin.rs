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

        // A new answer retires the old download: what was verified was the file
        // the previous answer named.
        *self.downloaded.lock().expect("update download lock") = None;
        let release = found.as_ref().map(|update| Release {
            version: update.version.clone(),
            // `Date`'s own spelling is the ISO one, which is what the pane
            // formats from and what the manifest carries.
            date: update.date.map(|when| when.date().to_string()),
            notes: update.body.clone(),
        });
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
        let bytes = self
            .downloaded
            .lock()
            .expect("update download lock")
            .take()
            .ok_or(UpdateFault::CorruptDownload)?;

        pending.install(bytes).map_err(|error| fault_of(&error))?;
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
