use std::ptr::NonNull;
use std::sync::Arc;

use block2::RcBlock;
use objc2::rc::Retained;
use objc2::runtime::{AnyObject, ProtocolObject};
use objc2_app_kit::{NSWorkspace, NSWorkspaceDidWakeNotification};
use objc2_foundation::{NSNotification, NSNotificationCenter, NSObjectProtocol};

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
