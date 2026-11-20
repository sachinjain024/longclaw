//! Everything the app does as an administrator (ADR 0018, LC-285r).
//!
//! One module because one prompt: macOS's own password sheet, raised through
//! AppleScript's `do shell script … with administrator privileges`. The bundle
//! replacement is its first caller; installing the `longclaw` command will be
//! its second (LC-285r). Each caller names a script, and this module owns the
//! rest — the script's text, the quoting that keeps a path one word, the AppleScript literal
//! that carries the script, and the hop onto the main thread that AppKit's
//! sheet insists on. A second way to run a shell as root would be a second set of
//! those, so the release audit holds `osakit` to this file and no other.
//!
//! **What a caller hands over is a [`Script`], never a shell string.** The
//! scripts the app may run as root are a closed set, each written out once
//! below, so everything LongClaw could ever do as an administrator can be read
//! in one place — and a caller can choose which and with what paths, but not
//! what the shell is told.

use std::io;
use std::path::{Path, PathBuf};
use std::sync::mpsc;

use tauri::AppHandle;

/// Every script the app may run as an administrator.
///
/// A caller names one and the paths it acts on; the shell text is written here
/// and nowhere else, with every path single-quoted.
#[derive(Debug, PartialEq, Eq)]
pub enum Script {
    /// Puts a staged bundle where the installed one is (ADR 0018): copy the new
    /// version beside the bundle, give it the bundle's owner, move the old one
    /// aside, move the new one in, and only then remove the old. The bundle is
    /// never the target of an `rm`, and a failure before the new version is in
    /// place leaves the old one where it was.
    ReplaceBundle {
        /// The verified new version, unpacked by the app with the user's own
        /// rights.
        staged: PathBuf,
        /// The installed bundle.
        bundle: PathBuf,
        /// The new version's copy beside the bundle, on the bundle's volume.
        copy: PathBuf,
        /// Where the old version waits until the new one is in place.
        previous: PathBuf,
    },
}

impl Script {
    /// The shell text this script runs.
    pub fn source(&self) -> String {
        match self {
            Script::ReplaceBundle {
                staged,
                bundle,
                copy,
                previous,
            } => {
                let staged = shell_quote(staged);
                let bundle = shell_quote(bundle);
                let copy = shell_quote(copy);
                let previous = shell_quote(previous);
                [
                    format!("/usr/bin/ditto {staged} {copy} || {{ /bin/rm -rf {copy}; exit 1; }}"),
                    // `ditto` as root keeps the owner of what it copies, which is
                    // the user who unpacked it: a standard account would come to
                    // own an app every account runs. The copy takes the replaced
                    // bundle's owner.
                    format!(
                        "/usr/sbin/chown -R -h \"$(/usr/bin/stat -f %u:%g {bundle})\" {copy} || {{ /bin/rm -rf {copy}; exit 1; }}"
                    ),
                    format!("/bin/mv {bundle} {previous} || {{ /bin/rm -rf {copy}; exit 1; }}"),
                    format!("if ! /bin/mv {copy} {bundle}; then /bin/mv {previous} {bundle}; /bin/rm -rf {copy}; exit 1; fi"),
                    format!("/bin/rm -rf {previous}"),
                    format!("/usr/bin/touch {bundle}"),
                ]
                .join("\n")
            }
        }
    }
}

/// Runs a [`Script`] with administrator rights, or refuses.
///
/// A port rather than a call, because the real one puts a password prompt on
/// the main thread and waits for a person. The suite runs the same script with
/// `/bin/sh` and no rights at all, and stands in for a cancelled prompt with a
/// fake that refuses.
pub trait Privileged {
    fn run(&self, script: &Script) -> io::Result<()>;
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
    fn run(&self, script: &Script) -> io::Result<()> {
        let (sender, receiver) = mpsc::channel();
        let script = script.source();
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

    /// The bundle replacement as an installed app in `/Applications` would
    /// hand it over.
    fn replacing_applications_bundle() -> Script {
        Script::ReplaceBundle {
            staged: PathBuf::from("/tmp/staged/LongClaw.app"),
            bundle: PathBuf::from("/Applications/LongClaw.app"),
            copy: PathBuf::from("/Applications/.LongClaw.app.lc-update-abc"),
            previous: PathBuf::from("/Applications/.LongClaw.app.lc-previous-abc"),
        }
    }

    #[test]
    fn the_prompt_is_never_asked_to_remove_the_bundle_before_the_new_one_is_beside_it() {
        let script = replacing_applications_bundle().source();
        let copy = script.find("/usr/bin/ditto").unwrap();
        let first_move = script.find("/bin/mv").unwrap();
        assert!(
            copy < first_move,
            "the copy must come before anything moves: {script}"
        );
        assert!(
            !script.contains("/bin/rm -rf '/Applications/LongClaw.app'"),
            "the bundle itself is never removed: {script}"
        );
    }

    #[test]
    fn the_copy_takes_the_replaced_bundles_owner_before_anything_moves() {
        let script = replacing_applications_bundle().source();
        let copy = script.find("/usr/bin/ditto").unwrap();
        let owner = script
            .find("/usr/sbin/chown -R -h \"$(/usr/bin/stat -f %u:%g '/Applications/LongClaw.app')\" '/Applications/.LongClaw.app.lc-update-abc'")
            .unwrap_or_else(|| panic!("the copy is not given the bundle's owner: {script}"));
        let first_move = script.find("/bin/mv").unwrap();
        assert!(copy < owner && owner < first_move, "{script}");
    }

    #[test]
    fn the_prompt_quotes_every_path_it_names() {
        let script = Script::ReplaceBundle {
            staged: PathBuf::from("/tmp/it's/LongClaw.app"),
            bundle: PathBuf::from("/Apps it's 'quoted' $HOME/LongClaw.app"),
            copy: PathBuf::from("/Apps it's 'quoted' $HOME/.LongClaw.app.lc-update-abc"),
            previous: PathBuf::from("/Apps it's 'quoted' $HOME/.LongClaw.app.lc-previous-abc"),
        }
        .source();
        assert!(
            script.contains(r"'/Apps it'\''s '\''quoted'\'' $HOME/LongClaw.app'"),
            "{script}"
        );
        assert!(
            !script.contains(" /Apps it"),
            "a path appears unquoted: {script}"
        );
        assert!(
            script.contains(r"'/tmp/it'\''s/LongClaw.app'"),
            "the staged path is quoted too: {script}"
        );
    }
}
