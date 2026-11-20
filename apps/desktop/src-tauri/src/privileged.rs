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

use std::fmt;
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

/// Why a [`Script`] did not succeed — the three outcomes besides success.
///
/// Typed, so a caller tells a person's choice from a failure without reading
/// AppleScript's prose: a cancel is not an error to report, a refusal wants the
/// line an administrator can run, and only a failure has a reason worth showing.
#[derive(Debug, PartialEq, Eq)]
pub enum PromptError {
    /// The person pressed Cancel. Nothing ran.
    Cancelled,
    /// macOS did not authorize an administrator: no name and password it
    /// would accept. Nothing ran.
    Refused,
    /// The script ran and did not succeed, or the prompt itself broke.
    Failed {
        /// The script's exit status, so a caller can tell a refusal the script
        /// was written to make from any other; `None` for anything that is not
        /// an exit status — the prompt broke, or AppleScript raised an error of
        /// its own.
        code: Option<i32>,
        /// What the script wrote to standard error, or what broke.
        reason: String,
    },
}

impl fmt::Display for PromptError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PromptError::Cancelled => f.write_str("the administrator prompt was cancelled"),
            PromptError::Refused => f.write_str("macOS did not authorize an administrator"),
            PromptError::Failed { reason, .. } if !reason.trim().is_empty() => {
                f.write_str(reason.trim())
            }
            PromptError::Failed {
                code: Some(code), ..
            } => write!(f, "the script exited {code}"),
            PromptError::Failed { code: None, .. } => f.write_str("the prompt failed"),
        }
    }
}

impl std::error::Error for PromptError {}

impl PromptError {
    /// A prompt that broke before its script could exit.
    pub fn broken(reason: impl Into<String>) -> Self {
        PromptError::Failed {
            code: None,
            reason: reason.into(),
        }
    }
}

/// Runs a [`Script`] with administrator rights, or says why it did not.
///
/// A port rather than a call, because the real one puts a password prompt on
/// the main thread and waits for a person. The suite runs the same script with
/// `/bin/sh` and no rights at all, and stands in for a cancelled prompt with a
/// fake that cancels.
pub trait Privileged {
    fn run(&self, script: &Script) -> Result<(), PromptError>;
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
    fn run(&self, script: &Script) -> Result<(), PromptError> {
        let (sender, receiver) = mpsc::channel();
        let script = script.source();
        self.app
            .run_on_main_thread(move || {
                let _ = sender.send(run_as_administrator(&script));
            })
            .map_err(|error| PromptError::broken(error.to_string()))?;
        receiver
            .recv()
            .map_err(|_| PromptError::broken("the main thread dropped the prompt"))?
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

/// The AppleScript that runs `script` through one administrator prompt.
///
/// `do shell script` raises an error for a cancel, a refusal and a non-zero
/// exit alike, and osakit hands back only its prose. So the prompt catches its
/// own error and returns the number first: `0` on success, otherwise the error
/// number (the shell's exit status, or macOS's code for a cancel or refusal), a
/// line feed, and the message.
fn prompt_source(script: &str) -> String {
    format!(
        "try\n\
         do shell script {} with administrator privileges\n\
         return \"0\"\n\
         on error message number code\n\
         return (code as text) & linefeed & message\n\
         end try",
        applescript_string(script)
    )
}

/// What the prompt's reply says happened.
///
/// A shell's exit status is 1 to 255, and `do shell script` raises it as the
/// error number. Every other number is AppleScript's or macOS's: -128
/// (`userCanceledErr`) for Cancel, and Security's for an authorization that
/// ended without one (-60006, cancelled; -60005, denied; -60007, no
/// interaction allowed). The -128 and exit-status numbers were seen through
/// `osascript`; the Security ones are from its headers and still owe the
/// spec's check at a real sheet (the release-candidate row). Any other
/// negative number is a failure with no exit status.
fn outcome_of(reply: &str) -> Result<(), PromptError> {
    let (number, message) = reply.split_once('\n').unwrap_or((reply, ""));
    match number.trim().parse::<i32>() {
        Ok(0) => Ok(()),
        Ok(-128 | -60006) => Err(PromptError::Cancelled),
        Ok(-60005 | -60007) => Err(PromptError::Refused),
        Ok(code @ 1..=255) => Err(PromptError::Failed {
            code: Some(code),
            reason: message.to_string(),
        }),
        Ok(number) => Err(PromptError::broken(format!("{message} ({number})"))),
        Err(_) => Err(PromptError::broken(reply)),
    }
}

/// Runs `script` through one administrator prompt.
///
/// The prompt is AppKit's, so this must run on the main thread, which is why
/// it is reachable only through `MainThreadPrompt`.
fn run_as_administrator(script: &str) -> Result<(), PromptError> {
    let mut prompt =
        osakit::Script::new_from_source(osakit::Language::AppleScript, &prompt_source(script));
    prompt
        .compile()
        .map_err(|error| PromptError::broken(format!("{error:?}")))?;
    match prompt.execute() {
        Ok(osakit::Value::String(reply)) => outcome_of(&reply),
        Ok(other) => Err(PromptError::broken(format!(
            "an unexpected reply: {other:?}"
        ))),
        Err(error) => Err(PromptError::broken(format!("{error:?}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn applescript_quoting_escapes_backslashes_and_quotes() {
        assert_eq!(applescript_string(r#"a "b" \c"#), r#""a \"b\" \\c""#);
    }

    #[test]
    fn the_prompt_reports_the_error_number_instead_of_raising_it() {
        let source = prompt_source("/usr/bin/true");
        assert!(
            source.contains(r#"do shell script "/usr/bin/true" with administrator privileges"#),
            "{source}"
        );
        assert!(source.contains("on error message number code"), "{source}");
    }

    /// A name AppleScript reserves would fail to compile, and every prompt
    /// would then report a broken prompt while the reply tests stayed green.
    #[test]
    fn the_prompt_compiles() {
        let mut prompt = osakit::Script::new_from_source(
            osakit::Language::AppleScript,
            &prompt_source("/usr/bin/true"),
        );
        assert_eq!(prompt.compile(), Ok(()));
    }

    #[test]
    fn a_script_that_ran_succeeded() {
        assert_eq!(outcome_of("0"), Ok(()));
    }

    #[test]
    fn pressing_cancel_is_a_cancel_not_a_failure() {
        assert_eq!(
            outcome_of("-128\nUser canceled."),
            Err(PromptError::Cancelled)
        );
        assert_eq!(outcome_of("-60006\nCanceled."), Err(PromptError::Cancelled));
    }

    #[test]
    fn an_administrator_macos_would_not_authorize_is_refused() {
        assert_eq!(
            outcome_of("-60005\nThe administrator user name or password was incorrect."),
            Err(PromptError::Refused)
        );
        assert_eq!(
            outcome_of("-60007\nNot allowed."),
            Err(PromptError::Refused)
        );
    }

    #[test]
    fn a_script_that_exits_non_zero_failed_with_its_status_and_reason() {
        assert_eq!(
            outcome_of("3\nln: /usr/local/bin/longclaw: File exists"),
            Err(PromptError::Failed {
                code: Some(3),
                reason: "ln: /usr/local/bin/longclaw: File exists".into(),
            })
        );
    }

    #[test]
    fn an_applescript_error_is_not_mistaken_for_an_exit_status() {
        assert_eq!(
            outcome_of("-1743\nNot authorized to send Apple events."),
            Err(PromptError::broken(
                "Not authorized to send Apple events. (-1743)"
            ))
        );
    }

    #[test]
    fn a_failure_with_nothing_on_stderr_still_says_something() {
        let silent = PromptError::Failed {
            code: Some(3),
            reason: String::new(),
        };
        assert_eq!(silent.to_string(), "the script exited 3");
    }

    #[test]
    fn a_reply_that_cannot_be_read_failed_without_a_status() {
        assert_eq!(
            outcome_of("something else"),
            Err(PromptError::Failed {
                code: None,
                reason: "something else".into(),
            })
        );
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
