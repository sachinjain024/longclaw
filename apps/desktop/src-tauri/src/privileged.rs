//! Everything the app does as an administrator (ADR 0018, LC-285r).
//!
//! One module because one prompt: macOS's own password sheet, raised through
//! AppleScript's `do shell script … with administrator privileges`. The bundle
//! replacement is its first caller; installing the `longclaw` command will be
//! its second (LC-285r). Each caller hands over a script, and this module owns
//! the rest — the quoting that keeps a path one word, the AppleScript literal
//! that carries the script, and the hop onto the main thread that AppKit's
//! sheet insists on. A second way to run a shell as root would be a second set of
//! those, so the release audit holds `osakit` to this file and no other.

use std::io;
use std::path::Path;
use std::sync::mpsc;

use tauri::AppHandle;

/// Runs a shell script with administrator rights, or refuses.
///
/// A port rather than a call, because the real one puts a password prompt on
/// the main thread and waits for a person. The suite runs the same script with
/// `/bin/sh` and no rights at all, and stands in for a cancelled prompt with a
/// fake that refuses.
pub trait Privileged {
    fn run(&self, script: &str) -> io::Result<()>;
}

/// The real prompt: macOS's password sheet, raised on the main thread.
///
/// `run` blocks the calling thread until a person answers, so it must not be
/// called *from* the main thread — that is the thread the sheet needs.
pub struct MainThreadPrompt {
    app: AppHandle,
}

impl MainThreadPrompt {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl Privileged for MainThreadPrompt {
    fn run(&self, script: &str) -> io::Result<()> {
        let (sender, receiver) = mpsc::channel();
        let script = script.to_owned();
        self.app
            .run_on_main_thread(move || {
                let _ = sender.send(run_as_administrator(&script));
            })
            .map_err(|error| io::Error::other(error.to_string()))?;
        receiver
            .recv()
            .map_err(|_| io::Error::other("the main thread dropped the prompt"))?
    }
}

/// `path` as one shell word, whatever it contains.
///
/// Single quotes, with each embedded `'` closed, escaped and reopened — the one
/// quoting that has no other character `/bin/sh` reads inside it. Shared by the
/// scripts run as root and by the `sudo` line the command-line pane hands over
/// to paste: a path with a space in it is ordinary on a Mac (`/Volumes/My
/// Disk`), and a line that has to be edited before it runs is not the exact
/// line a refusal promises.
pub fn shell_quote(path: &Path) -> String {
    format!("'{}'", path.to_string_lossy().replace('\'', r"'\''"))
}

/// An AppleScript string literal holding `text`.
fn applescript_string(text: &str) -> String {
    format!("\"{}\"", text.replace('\\', r"\\").replace('"', "\\\""))
}

/// Runs `script` through one administrator prompt.
///
/// The prompt is AppKit's, so this must run on the main thread, which is why
/// it is reachable only through `MainThreadPrompt`.
fn run_as_administrator(script: &str) -> io::Result<()> {
    let source = format!(
        "do shell script {} with administrator privileges",
        applescript_string(script)
    );
    let mut prompt = osakit::Script::new_from_source(osakit::Language::AppleScript, &source);
    prompt
        .compile()
        .map_err(|error| io::Error::other(format!("{error:?}")))?;
    prompt
        .execute()
        .map(|_| ())
        .map_err(|error| io::Error::other(format!("{error:?}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn applescript_quoting_escapes_backslashes_and_quotes() {
        assert_eq!(applescript_string(r#"a "b" \c"#), r#""a \"b\" \\c""#);
    }

    #[test]
    fn shell_quoting_keeps_a_path_one_word() {
        assert_eq!(shell_quote(Path::new("/a b/c")), "'/a b/c'");
        assert_eq!(shell_quote(Path::new("/it's")), r"'/it'\''s'");
    }
}
