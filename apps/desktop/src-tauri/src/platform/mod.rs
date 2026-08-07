#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(not(target_os = "macos"))]
pub mod macos {
    use std::path::Path;
    use std::sync::Arc;

    pub struct WakeObserver;

    pub fn observe_wake(_callback: Arc<dyn Fn() + Send + Sync + 'static>) -> WakeObserver {
        WakeObserver
    }

    /// v0 ships macOS only, so there is no second implementation to keep honest:
    /// off the shipped platform this reports that nothing was opened rather than
    /// claiming a window the human will never see.
    pub fn open_in_default_app(_path: &Path) -> bool {
        false
    }
}
