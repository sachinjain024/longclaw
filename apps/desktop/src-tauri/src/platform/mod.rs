#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(not(target_os = "macos"))]
pub mod macos {
    use std::sync::Arc;

    pub struct WakeObserver;

    pub fn observe_wake(_callback: Arc<dyn Fn() + Send + Sync + 'static>) -> WakeObserver {
        WakeObserver
    }
}
