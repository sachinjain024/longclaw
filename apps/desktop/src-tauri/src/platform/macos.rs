use std::path::Path;
use std::ptr::NonNull;
use std::sync::Arc;

use block2::RcBlock;
use objc2::rc::Retained;
use objc2::runtime::{AnyObject, ProtocolObject};
use objc2_app_kit::{NSWorkspace, NSWorkspaceDidWakeNotification};
use objc2_foundation::{NSNotification, NSNotificationCenter, NSObjectProtocol, NSString, NSURL};

#[allow(dead_code)]
pub struct WakeObserver {
    center: Retained<NSNotificationCenter>,
    block: RcBlock<dyn Fn(NonNull<NSNotification>)>,
    token: Retained<ProtocolObject<dyn NSObjectProtocol>>,
}

unsafe impl Send for WakeObserver {}

impl Drop for WakeObserver {
    fn drop(&mut self) {
        let observer: &AnyObject = self.token.as_ref();
        unsafe { self.center.removeObserver(observer) };
    }
}

/// Installs a wake observer owned by one project watcher. Its token and callback
/// are released when that watcher is replaced or dropped.
pub fn observe_wake(callback: Arc<dyn Fn() + Send + Sync + 'static>) -> WakeObserver {
    let center = NSWorkspace::sharedWorkspace().notificationCenter();
    let block = RcBlock::new(move |_notification: NonNull<NSNotification>| callback());
    let token = unsafe {
        center.addObserverForName_object_queue_usingBlock(
            Some(NSWorkspaceDidWakeNotification),
            None,
            None,
            &block,
        )
    };
    WakeObserver {
        center,
        block,
        token,
    }
}

/// Hands one file to whatever the human has already chosen to open `.md` with.
///
/// LaunchServices rather than a shell: the release boundary forbids a shell or
/// process-launch plugin and the audit fails the build on `Command::new`
/// (`docs/acceptance/release-candidate.md`). `NSWorkspace` asks the system to
/// open a file the app already holds a canonical path to, which is the same
/// AppKit surface the wake observer above uses — no `$EDITOR`, no argument
/// string, nothing for a ticket key to be interpolated into.
///
/// Returns whether the system accepted the file.
pub fn open_in_default_app(path: &Path) -> bool {
    let Some(text) = path.to_str() else {
        return false;
    };
    let url = NSURL::fileURLWithPath(&NSString::from_str(text));
    NSWorkspace::sharedWorkspace().openURL(&url)
}
