//! Device-local preferences, kept in a file this process owns.
//!
//! These are the small choices that belong to the machine rather than to any
//! project: which appearance is in force, which project was open, and the view,
//! ordering and filter each project was last looked at with. ADR 0006 allowed
//! them to live in webview storage, and they did — until the clean-machine pass
//! found that neither the appearance override (LC-150) nor the open project
//! (LC-151) came back after a relaunch. Webview storage is the webview's to
//! keep, and on the packaged build it did not keep it; a preference that does
//! not survive the process is not a preference, it is a session default.
//!
//! So they are a file now, beside the project registry in application support,
//! written the same way every other file this app owns is written — atomically,
//! through `core::storage`. ADR 0012 records the change.
//!
//! **Rust does not read the document.** It is a JSON object the webview hands
//! over whole and takes back whole; the vocabulary inside it — view modes,
//! ordering, a filter string — is the frontend's, and a second copy of it here
//! would be a second place to change and no new invariant. What this owns is
//! what the frontend cannot: where the file is, that a write either lands or
//! does not, and that a file nobody can parse is never silently thrown away.

use std::fs;
use std::path::{Path, PathBuf};

use parking_lot::RwLock;
use serde_json::{Map, Value};

use crate::core::storage::atomic_write;
use crate::core::{AppError, AppResult, ErrorCode};

/// What a failed write says the human was doing. Not "saving a ticket": this
/// file is in a folder they have never opened, and the sentence has to make
/// sense to somebody who has never heard of it (V0-29).
const PREFERENCES_ACTION: &str = "Saving your preferences";

/// The document as it crosses IPC: an object, and nothing else assumed.
pub type PreferenceDocument = Map<String, Value>;

pub struct PreferencesStore {
    path: PathBuf,
    document: RwLock<PreferenceDocument>,
}

impl PreferencesStore {
    /// Reads the file, and **never fails**.
    ///
    /// The registry refuses to start on a registry it cannot parse, because the
    /// alternative is a human whose projects have silently disappeared. The
    /// opposite is true here: the worst an unreadable preferences file can cost
    /// is a window that comes up on System appearance, and refusing to launch
    /// over that would be a far larger fault than the one it reports. A file
    /// that does not parse is moved aside rather than read or overwritten, so
    /// whoever hand-edited it can still find what they wrote.
    pub fn load(app_data_dir: &Path) -> Self {
        let path = app_data_dir.join("device-preferences.json");
        let _ = fs::create_dir_all(app_data_dir);
        let document = match fs::read(&path) {
            Ok(bytes) => match serde_json::from_slice::<Value>(&bytes) {
                Ok(Value::Object(document)) => document,
                _ => {
                    let _ = fs::rename(&path, path.with_extension("invalid.json"));
                    PreferenceDocument::new()
                }
            },
            // Absent is the ordinary first launch, and unreadable degrades the
            // same way: this session cannot restore, and can still record.
            Err(_) => PreferenceDocument::new(),
        };
        Self {
            path,
            document: RwLock::new(document),
        }
    }

    pub fn read(&self) -> PreferenceDocument {
        self.document.read().clone()
    }

    /// Replaces the document wholesale — the webview owns its shape, so a merge
    /// here would make a key impossible to delete from the only side that knows
    /// the key exists.
    pub fn write(&self, document: PreferenceDocument) -> AppResult<()> {
        let bytes =
            serde_json::to_vec_pretty(&Value::Object(document.clone())).map_err(|error| {
                AppError::new(
                    ErrorCode::Internal,
                    format!("Preferences could not be serialized: {error}"),
                    false,
                )
            })?;
        atomic_write(PREFERENCES_ACTION, &self.path, &bytes)?;
        *self.document.write() = document;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use serde_json::{json, Map, Value};

    use super::PreferencesStore;

    fn document(pairs: &[(&str, Value)]) -> Map<String, Value> {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_owned(), value.clone()))
            .collect()
    }

    /// The whole point of the module: a second process reads what the first
    /// wrote. This is the assertion webview storage could not make (LC-150).
    #[test]
    fn a_preference_written_by_one_process_is_read_by_the_next() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");

        PreferencesStore::load(&app_data)
            .write(document(&[
                ("appearance", json!("light")),
                ("activeProjectId", json!("project-b")),
            ]))
            .unwrap();

        let relaunched = PreferencesStore::load(&app_data);
        assert_eq!(
            relaunched.read(),
            document(&[
                ("appearance", json!("light")),
                ("activeProjectId", json!("project-b")),
            ])
        );
    }

    #[test]
    fn a_first_launch_reads_an_empty_document_rather_than_failing() {
        let temp = tempfile::tempdir().unwrap();

        let store = PreferencesStore::load(&temp.path().join("app-support"));

        assert!(store.read().is_empty());
    }

    /// A hand-edited file that no longer parses is somebody's work. It is not
    /// read, it does not stop the launch, and the next write does not land on
    /// top of it.
    #[test]
    fn a_document_that_does_not_parse_is_moved_aside_rather_than_overwritten() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        fs::create_dir_all(&app_data).unwrap();
        let path = app_data.join("device-preferences.json");
        fs::write(&path, b"{ appearance: light, ").unwrap();

        let store = PreferencesStore::load(&app_data);
        assert!(store.read().is_empty());
        store
            .write(document(&[("appearance", json!("dark"))]))
            .unwrap();

        let kept = fs::read_to_string(app_data.join("device-preferences.invalid.json")).unwrap();
        assert_eq!(kept, "{ appearance: light, ");
        assert_eq!(
            PreferencesStore::load(&app_data).read(),
            document(&[("appearance", json!("dark"))])
        );
    }

    /// JSON that parses but is not an object is the same failure: the document
    /// is a map of preferences, and a list of them is not one.
    #[test]
    fn a_document_that_is_not_an_object_is_treated_as_unreadable() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        fs::create_dir_all(&app_data).unwrap();
        fs::write(app_data.join("device-preferences.json"), b"[\"light\"]").unwrap();

        let store = PreferencesStore::load(&app_data);

        assert!(store.read().is_empty());
        assert!(app_data.join("device-preferences.invalid.json").exists());
    }

    /// The failure the human sees names this file and this action. `atomic_write`
    /// is shared with tickets and the registry, and it takes the sentence from
    /// its caller (V0-29).
    #[cfg(unix)]
    #[test]
    fn a_write_failure_does_not_call_itself_a_ticket_save() {
        use std::os::unix::fs::PermissionsExt;

        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        let store = PreferencesStore::load(&app_data);

        fs::set_permissions(&app_data, fs::Permissions::from_mode(0o555)).unwrap();
        let error = store
            .write(document(&[("appearance", json!("dark"))]))
            .unwrap_err();
        fs::set_permissions(&app_data, fs::Permissions::from_mode(0o755)).unwrap();

        assert!(!error.message.contains("ticket"));
        assert!(error.message.contains("preferences"));
    }
}
