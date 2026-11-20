//! Everything the app does as an administrator (ADR 0018, LC-285r).
//!
//! One module because one prompt: macOS's own password sheet, raised through
//! AppleScript's `do shell script … with administrator privileges`. The bundle
//! replacement is its first caller; installing the `longclaw` command is its
//! second (LC-285r). Each caller names a script, and this module owns the
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
    /// Puts the bundled `longclaw` on `PATH` (LC-285r): make the folder if
    /// there is none, refuse with [`LINK_OCCUPIED`] if the name is held by
    /// anything but a link, then make the link under a temporary name beside
    /// it and rename it in. The installed name is never removed first, and a
    /// file somebody else put there is never replaced — re-checked here, as
    /// root, because a file can arrive between the app's own look and the
    /// password.
    LinkCommand {
        /// The app's own copy of the command, inside the bundle.
        source: PathBuf,
        /// The name on `PATH`.
        link: PathBuf,
        /// The link's name until it is renamed in, beside `link`.
        temporary: PathBuf,
    },
}

/// The exit status [`Script::LinkCommand`] refuses an occupied name with.
///
/// Its own number so the caller can tell *somebody else's file is there* from
/// every other failure: it is the one that must read as the occupied refusal
/// rather than as a script that broke. The script's other failures exit 1.
pub const LINK_OCCUPIED: i32 = 3;

/// What the password sheet says LongClaw wants, for a script that supplies
/// it. The copy deck's `mac.prompt` (LC-285r).
const LINK_COMMAND_PROMPT: &str = "LongClaw wants to add the longclaw command to /usr/local/bin.";

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
            Script::LinkCommand {
                source,
                link,
                temporary,
            } => {
                let folder = shell_quote(link.parent().unwrap_or(Path::new("/")));
                let source = shell_quote(source);
                let link = shell_quote(link);
                let temporary = shell_quote(temporary);
                [
                    format!("/bin/mkdir -p {folder} || exit 1"),
                    format!("if [ -e {link} ] && [ ! -L {link} ]; then exit {LINK_OCCUPIED}; fi"),
                    format!("/bin/ln -s {source} {temporary} || exit 1"),
                    // `-h`, so a stale link that points at a folder is replaced
                    // rather than having the new link moved inside it.
                    format!(
                        "/bin/mv -f -h {temporary} {link} || {{ /bin/rm -f {temporary}; exit 1; }}"
                    ),
                ]
                .join("\n")
            }
        }
    }

    /// The sentence macOS's password sheet shows, when the script has one.
    ///
    /// The bundle replacement has none and keeps macOS's own wording, which is
    /// unchanged by this module.
    pub fn prompt(&self) -> Option<&'static str> {
        match self {
            Script::ReplaceBundle { .. } => None,
            Script::LinkCommand { .. } => Some(LINK_COMMAND_PROMPT),
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
        let source = prompt_source(&script.source(), script.prompt());
        self.app
            .run_on_main_thread(move || {
                let _ = sender.send(run_as_administrator(&source));
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
/// line feed, and the message. `sentence`, when there is one, is what the
/// sheet says LongClaw wants.
fn prompt_source(script: &str, sentence: Option<&str>) -> String {
    let prompt = sentence
        .map(|sentence| format!(" with prompt {}", applescript_string(sentence)))
        .unwrap_or_default();
    format!(
        "try\n\
         do shell script {}{prompt} with administrator privileges\n\
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

/// Runs one administrator prompt, given its AppleScript from `prompt_source`.
///
/// The prompt is AppKit's, so this must run on the main thread, which is why
/// it is reachable only through `MainThreadPrompt`.
fn run_as_administrator(source: &str) -> Result<(), PromptError> {
    let mut prompt = osakit::Script::new_from_source(osakit::Language::AppleScript, source);
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

    fn linking_the_command() -> Script {
        Script::LinkCommand {
            source: PathBuf::from("/Applications/LongClaw.app/Contents/MacOS/longclaw"),
            link: PathBuf::from("/usr/local/bin/longclaw"),
            temporary: PathBuf::from("/usr/local/bin/.longclaw.longclaw-abc.tmp"),
        }
    }

    #[test]
    fn the_link_is_made_under_a_temporary_name_and_renamed_into_place() {
        let script = linking_the_command().source();
        let folder = script
            .find("/bin/mkdir -p '/usr/local/bin'")
            .unwrap_or_else(|| panic!("the folder is not created: {script}"));
        let link = script
            .find("/bin/ln -s '/Applications/LongClaw.app/Contents/MacOS/longclaw' '/usr/local/bin/.longclaw.longclaw-abc.tmp'")
            .unwrap_or_else(|| panic!("the link is not made beside: {script}"));
        let rename = script
            .find("/bin/mv -f -h '/usr/local/bin/.longclaw.longclaw-abc.tmp' '/usr/local/bin/longclaw'")
            .unwrap_or_else(|| panic!("the link is not renamed in: {script}"));
        assert!(folder < link && link < rename, "{script}");
        assert!(
            !script.contains("/bin/rm -f '/usr/local/bin/longclaw'"),
            "the installed name is never removed: {script}"
        );
    }

    #[test]
    fn a_file_at_the_link_is_refused_as_root_before_anything_is_made() {
        let script = linking_the_command().source();
        let check = script
            .find(&format!(
                "if [ -e '/usr/local/bin/longclaw' ] && [ ! -L '/usr/local/bin/longclaw' ]; then exit {LINK_OCCUPIED}; fi"
            ))
            .unwrap_or_else(|| panic!("the occupied path is not re-checked: {script}"));
        assert!(check < script.find("/bin/ln").unwrap(), "{script}");
    }

    #[test]
    fn linking_the_command_says_why_on_the_sheet_and_replacing_the_bundle_does_not() {
        assert_eq!(
            linking_the_command().prompt(),
            Some("LongClaw wants to add the longclaw command to /usr/local/bin.")
        );
        assert_eq!(replacing_applications_bundle().prompt(), None);
        let source = prompt_source("/usr/bin/true", Some("Say \"why\"."));
        assert!(source.contains(r#"with prompt "Say \"why\".""#), "{source}");
    }

    #[test]
    fn the_prompt_with_a_sentence_compiles() {
        let mut prompt = osakit::Script::new_from_source(
            osakit::Language::AppleScript,
            &prompt_source("/usr/bin/true", linking_the_command().prompt()),
        );
        assert_eq!(prompt.compile(), Ok(()));
    }

    #[test]
    fn the_prompt_reports_the_error_number_instead_of_raising_it() {
        let source = prompt_source("/usr/bin/true", None);
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
            &prompt_source("/usr/bin/true", None),
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
