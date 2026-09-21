//! The syscall half of [`crate::github`]: the browser hand-off and the one
//! request (LC-257s).
//!
//! Everything that is a *decision* is next door and nothing is here, the same
//! split the update path already makes between the module that decides and the
//! plugin half that carries it out. It exists so that the rules — one request
//! per slot, a failure that claims nothing — can be read and driven by the
//! suite without a network and without Tauri.
//!
//! **It adds no HTTP client.** The `reqwest` this uses is the one
//! `tauri-plugin-updater` already compiles into the binary, declared here so
//! the dependency is visible rather than borrowed in silence. No feature is
//! turned on that the updater did not already turn on, which is why the shipped
//! binary imports the same socket calls and links the same two frameworks after
//! this landed as before — `binary-audit.mjs` is what checks that claim, not
//! this comment.

use std::sync::mpsc::{self, RecvTimeoutError};

use crate::github::{StarSource, API_URL, FETCH_BUDGET, REPOSITORY_URL, USER_AGENT};
use crate::platform;

/// Opens the repository in the default browser.
///
/// LaunchServices rather than a shell, for the same reason `open_ticket_file`
/// uses it: the release boundary forbids a shell or process-launch plugin, and
/// `NSWorkspace` asks the system to open a URL this process already holds as a
/// constant — no argument string, and nothing for anything to be interpolated
/// into.
///
/// Returns whether the system accepted it.
pub fn open_repository() -> bool {
    platform::macos::open_web_url(REPOSITORY_URL)
}

/// The real source: one `GET`, bounded, off the caller's thread.
pub struct HttpStars;

impl StarSource for HttpStars {
    /// One request, and one answer.
    ///
    /// `None` is every failure there is — offline, refused, rate limited, a
    /// body that would not parse, a budget that ran out. They are one answer
    /// because the control draws one thing for all of them, and because a
    /// person cannot act on the difference.
    ///
    /// **Bounded, and abandoned rather than awaited.** The future is spawned on
    /// the app's runtime and this thread waits on a channel with a budget; when
    /// the budget runs out the attempt is left to finish or not, and the caller
    /// is told nothing was learned. Callers are on the blocking pool, so no
    /// frame, no keystroke and no ticket write is ever behind this.
    fn stars(&self) -> Option<u64> {
        let (tx, rx) = mpsc::channel();
        tauri::async_runtime::spawn(async move {
            let _ = tx.send(request().await);
        });
        match rx.recv_timeout(FETCH_BUDGET) {
            Ok(answer) => answer,
            Err(RecvTimeoutError::Timeout) | Err(RecvTimeoutError::Disconnected) => None,
        }
    }
}

/// The request itself.
///
/// Nothing is sent but the method, the address and the two headers GitHub needs
/// to answer: no cookie jar, no redirect chain to a host that is not the one
/// named, and no body. `User-Agent` is the product and its version, because an
/// unauthenticated request without one is refused.
async fn request() -> Option<u64> {
    let response = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        // A public endpoint that answers on the address it was asked at. A
        // redirect would mean the repository moved, and following one silently
        // is how a request ends up at a host no allowlist ever saw.
        .redirect(reqwest::redirect::Policy::none())
        .timeout(FETCH_BUDGET)
        .build()
        .ok()?
        .get(API_URL)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    let body = response.text().await.ok()?;
    parse_stars(&body)
}

/// The one field this app reads out of the answer.
///
/// `serde_json` rather than a typed struct, and one field rather than the
/// document: the response is some forty keys about a repository, none of which
/// this app has any business holding. Anything that is not a plausible count is
/// no count at all.
fn parse_stars(body: &str) -> Option<u64> {
    let value: serde_json::Value = serde_json::from_str(body).ok()?;
    value.get("stargazers_count")?.as_u64()
}

#[cfg(test)]
mod tests {
    use super::parse_stars;

    #[test]
    fn reads_the_count_and_nothing_else() {
        assert_eq!(
            parse_stars(r#"{"stargazers_count": 1284, "forks": 7}"#),
            Some(1_284)
        );
    }

    #[test]
    fn a_body_without_the_field_is_no_count() {
        assert_eq!(parse_stars(r#"{"message": "Not Found"}"#), None);
    }

    #[test]
    fn a_body_that_is_not_json_is_no_count() {
        assert_eq!(parse_stars("<html>502</html>"), None);
    }

    #[test]
    fn a_count_that_is_not_a_whole_number_is_no_count() {
        assert_eq!(parse_stars(r#"{"stargazers_count": "many"}"#), None);
        assert_eq!(parse_stars(r#"{"stargazers_count": -3}"#), None);
    }
}
