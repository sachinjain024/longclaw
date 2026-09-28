//! How large the app is drawn (LC-258c).
//!
//! The webview names an **intent** — in, out, back to actual size — and this
//! decides what level that is. It is the shape every other OS touch here takes,
//! and it keeps the ladder in one place: the frontend never computes a scale,
//! so it cannot compute one this build has not been looked at.
//!
//! The level is applied to the webview from Rust rather than by scaling CSS. A
//! transform on the shell would fight every layout rule the app has; page zoom
//! is what the layout was built for — `styles.css` has a query below the
//! window's minimum width that only zoom can reach, and `a11y:audit`'s A5 row
//! has been testing 200% since before anything could get there.
//!
//! **The level is remembered by the frontend, not here.** It is a device
//! preference, and that document is the webview's (`preferences.rs`, ADR 0012).
//! What comes back across a relaunch is handed to [`Zoom::restore`], which
//! accepts it only if it is a rung of this build's ladder.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::{AppHandle, Emitter, Runtime};

/// Every level the app can be drawn at, as a percentage, smallest first.
///
/// A fixed ladder rather than a free multiplier, so every level is one the
/// layout has been looked at. 200% is the ceiling because it is what WCAG asks
/// for and what the accessibility gate already tests; under 50% the text stops
/// being readable and the setting stops being useful. The rungs between are
/// the ones Safari steps through, so the chord moves as far as a Mac user
/// expects it to.
pub const ZOOM_LADDER: [u16; 11] = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200];

/// Actual size, and the level a launch that has remembered nothing opens at.
pub const ZOOM_ACTUAL_SIZE: u16 = 100;

/// What the webview asks for. It never names a level.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ZoomIntent {
    In,
    Out,
    Reset,
}

/// The level `intent` leads to from `level`.
///
/// At either end of the ladder the press does nothing rather than wrapping:
/// `⌘-` at 50% jumping to 200% would be the one outcome worse than no answer.
/// A `level` that is not a rung — which [`Zoom`] never holds — steps to the
/// nearest rung in the direction asked, so the function has an answer for
/// every input rather than a panic for some.
pub fn next_level(level: u16, intent: ZoomIntent) -> u16 {
    match intent {
        ZoomIntent::Reset => ZOOM_ACTUAL_SIZE,
        ZoomIntent::In => ZOOM_LADDER
            .iter()
            .copied()
            .find(|&rung| rung > level)
            .unwrap_or_else(|| on_the_ladder(level)),
        ZoomIntent::Out => ZOOM_LADDER
            .iter()
            .rev()
            .copied()
            .find(|&rung| rung < level)
            .unwrap_or_else(|| on_the_ladder(level)),
    }
}

/// `level` held inside the ladder's ends — the answer at a wall.
fn on_the_ladder(level: u16) -> u16 {
    level.clamp(ZOOM_LADDER[0], ZOOM_LADDER[ZOOM_LADDER.len() - 1])
}

/// Whether `level` is one this build draws at.
pub fn is_zoom_level(level: u16) -> bool {
    ZOOM_LADDER.contains(&level)
}

/// The scale factor the webview is handed for `level`.
pub fn scale_factor(level: u16) -> f64 {
    f64::from(level) / 100.0
}

/// The level in force, for the one window this app has.
pub struct Zoom {
    level: Mutex<u16>,
}

impl Default for Zoom {
    fn default() -> Self {
        Self {
            level: Mutex::new(ZOOM_ACTUAL_SIZE),
        }
    }
}

impl Zoom {
    /// Moves one step and applies it, answering with the level now in force.
    ///
    /// The lock is held across `apply`, and the level is recorded only once it
    /// has succeeded: commands are served from a pool, so two presses can be in
    /// flight at once, and a level recorded before the webview took it would
    /// leave this answering with a size the window is not drawn at.
    pub fn step<E>(
        &self,
        intent: ZoomIntent,
        apply: impl FnOnce(f64) -> Result<(), E>,
    ) -> Result<u16, E> {
        let mut held = self.level.lock();
        let next = next_level(*held, intent);
        if next != *held {
            apply(scale_factor(next))?;
            *held = next;
        }
        Ok(next)
    }

    /// Puts back a level the last launch remembered, if this build knows it.
    ///
    /// `None` is the answer for a level that is not a rung — a hand-edited
    /// document, or one a later build wrote with a ladder this one does not
    /// have — and nothing is applied for it. The caller drops the value rather
    /// than carrying it, the way every other unrecognised preference is
    /// dropped.
    pub fn restore<E>(
        &self,
        level: u16,
        apply: impl FnOnce(f64) -> Result<(), E>,
    ) -> Result<Option<u16>, E> {
        if !is_zoom_level(level) {
            return Ok(None);
        }
        let mut held = self.level.lock();
        apply(scale_factor(level))?;
        *held = level;
        Ok(Some(level))
    }

    #[cfg(test)]
    fn level(&self) -> u16 {
        *self.level.lock()
    }
}

/// What a View-menu item sends the webview: the intent, as a chord would name
/// it. The menu does not zoom anything itself — it hands the webview the same
/// request `⌘+` makes, so there is one path from a request to a remembered
/// level and the menu cannot record a size the chord would not.
pub const ZOOM_EVENT: &str = "longclaw://zoom";

const ZOOM_IN_ID: &str = "zoom-in";
const ZOOM_OUT_ID: &str = "zoom-out";
const ACTUAL_SIZE_ID: &str = "zoom-actual-size";

/// The platform's default menu, with `Actual Size`, `Zoom In` and `Zoom Out`
/// at the top of its View menu — where a Mac user looks first, and how someone
/// finds out the chords exist.
///
/// The accelerators are shown, not relied on. WebKit offers a key equivalent to
/// the page before the menu, and the page's handler takes the press
/// (`zoom.ts`), so a chord reaches the menu only when nothing in the page
/// answered it — and then the menu sends the same intent the page would have.
/// `=` rather than `+`: `+` is `⇧=` on a US layout, and the menu cannot name a
/// key the chord does not require.
///
/// Tauri's default menu has a View submenu only on macOS, and this is only
/// installed there; elsewhere the menu comes back unchanged.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub fn menu_with_zoom<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(app)?;
    let view = menu.items()?.into_iter().find_map(|item| {
        let submenu = item.as_submenu()?;
        (submenu.text().ok()? == "View").then(|| submenu.clone())
    });
    if let Some(view) = view {
        view.prepend_items(&[
            &MenuItem::with_id(
                app,
                ACTUAL_SIZE_ID,
                "Actual Size",
                true,
                Some("CmdOrCtrl+0"),
            )?,
            &MenuItem::with_id(app, ZOOM_IN_ID, "Zoom In", true, Some("CmdOrCtrl+="))?,
            &MenuItem::with_id(app, ZOOM_OUT_ID, "Zoom Out", true, Some("CmdOrCtrl+-"))?,
            &PredefinedMenuItem::separator(app)?,
        ])?;
    }
    Ok(menu)
}

/// The intent a menu item stands for, or `None` for an item that is not ours.
fn menu_intent(id: &str) -> Option<ZoomIntent> {
    match id {
        ZOOM_IN_ID => Some(ZoomIntent::In),
        ZOOM_OUT_ID => Some(ZoomIntent::Out),
        ACTUAL_SIZE_ID => Some(ZoomIntent::Reset),
        _ => None,
    }
}

/// Passes a View-menu zoom item on to the webview as an intent.
pub fn on_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    if let Some(intent) = menu_intent(event.id().as_ref()) {
        let _ = app.emit(ZOOM_EVENT, intent);
    }
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::convert::Infallible;

    use super::*;

    /// A stand-in for the webview: records every scale it is handed.
    fn recording(log: &RefCell<Vec<f64>>) -> impl FnOnce(f64) -> Result<(), Infallible> + '_ {
        move |scale| {
            log.borrow_mut().push(scale);
            Ok(())
        }
    }

    #[test]
    fn the_ladder_runs_from_half_to_double_through_actual_size() {
        assert_eq!(ZOOM_LADDER.first(), Some(&50));
        assert_eq!(ZOOM_LADDER.last(), Some(&200));
        assert!(ZOOM_LADDER.contains(&ZOOM_ACTUAL_SIZE));
        assert!(ZOOM_LADDER.windows(2).all(|pair| pair[0] < pair[1]));
    }

    #[test]
    fn in_and_out_move_one_rung() {
        assert_eq!(next_level(100, ZoomIntent::In), 110);
        assert_eq!(next_level(100, ZoomIntent::Out), 90);
        assert_eq!(next_level(150, ZoomIntent::In), 175);
        assert_eq!(next_level(67, ZoomIntent::Out), 50);
    }

    /// The ends are walls, not a loop.
    #[test]
    fn a_step_past_either_end_does_nothing() {
        assert_eq!(next_level(200, ZoomIntent::In), 200);
        assert_eq!(next_level(50, ZoomIntent::Out), 50);
    }

    #[test]
    fn reset_is_actual_size_from_anywhere() {
        for rung in ZOOM_LADDER {
            assert_eq!(next_level(rung, ZoomIntent::Reset), 100);
        }
    }

    #[test]
    fn a_level_between_rungs_steps_to_the_next_rung_in_that_direction() {
        assert_eq!(next_level(105, ZoomIntent::In), 110);
        assert_eq!(next_level(105, ZoomIntent::Out), 100);
        assert_eq!(next_level(900, ZoomIntent::In), 200);
        assert_eq!(next_level(10, ZoomIntent::Out), 50);
    }

    #[test]
    fn the_intent_is_read_as_the_webview_spells_it() {
        let intent: ZoomIntent = serde_json::from_str("\"in\"").unwrap();
        assert_eq!(intent, ZoomIntent::In);
        let intent: ZoomIntent = serde_json::from_str("\"reset\"").unwrap();
        assert_eq!(intent, ZoomIntent::Reset);
        assert!(serde_json::from_str::<ZoomIntent>("\"1.5\"").is_err());
    }

    /// The event carries what the webview's own `zoom.ts` sends, so the menu
    /// and the chord are one request.
    #[test]
    fn a_menu_item_names_the_intent_its_chord_would() {
        assert_eq!(menu_intent("zoom-in"), Some(ZoomIntent::In));
        assert_eq!(menu_intent("zoom-out"), Some(ZoomIntent::Out));
        assert_eq!(menu_intent("zoom-actual-size"), Some(ZoomIntent::Reset));
        assert_eq!(menu_intent("fullscreen"), None);
        assert_eq!(serde_json::to_string(&ZoomIntent::In).unwrap(), "\"in\"");
    }

    #[test]
    fn a_step_applies_the_scale_and_records_the_level() {
        let zoom = Zoom::default();
        let log = RefCell::new(Vec::new());

        let level = zoom.step(ZoomIntent::In, recording(&log)).unwrap();

        assert_eq!(level, 110);
        assert_eq!(zoom.level(), 110);
        assert_eq!(*log.borrow(), vec![1.1]);
    }

    /// A press at the wall answers with the level and touches nothing.
    #[test]
    fn a_step_that_goes_nowhere_applies_nothing() {
        let zoom = Zoom::default();
        let log = RefCell::new(Vec::new());

        let level = zoom.step(ZoomIntent::Reset, recording(&log)).unwrap();

        assert_eq!(level, 100);
        assert!(log.borrow().is_empty());
    }

    /// The level held is the level the window is drawn at, so a refused
    /// apply leaves it where it was.
    #[test]
    fn a_step_the_webview_refuses_is_not_recorded() {
        let zoom = Zoom::default();

        let result = zoom.step(ZoomIntent::In, |_| Err("no webview"));

        assert_eq!(result, Err("no webview"));
        assert_eq!(zoom.level(), 100);
    }

    #[test]
    fn a_remembered_rung_is_restored_and_applied() {
        let zoom = Zoom::default();
        let log = RefCell::new(Vec::new());

        let restored = zoom.restore(150, recording(&log)).unwrap();

        assert_eq!(restored, Some(150));
        assert_eq!(zoom.level(), 150);
        assert_eq!(*log.borrow(), vec![1.5]);
        assert_eq!(
            zoom.step(ZoomIntent::In, |_| Ok::<_, Infallible>(())),
            Ok(175)
        );
    }

    /// A level this build does not know is refused whole: not rounded to a
    /// rung, and not applied.
    #[test]
    fn a_remembered_level_that_is_not_a_rung_is_refused() {
        let zoom = Zoom::default();
        let log = RefCell::new(Vec::new());

        for level in [0, 33, 105, 300] {
            let restored = zoom.restore(level, recording(&log)).unwrap();
            assert_eq!(restored, None);
        }

        assert_eq!(zoom.level(), 100);
        assert!(log.borrow().is_empty());
    }
}
