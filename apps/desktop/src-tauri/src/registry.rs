use std::fs;
use std::path::{Path, PathBuf};

use parking_lot::RwLock;

use chrono::{SecondsFormat, Utc};

use crate::core::project::EstimateSystem;
use crate::core::storage::{
    atomic_write, initialize_project, project_file_path, read_project, tickets_root,
    write_agent_instructions,
};
use crate::core::ticket::Property;
use crate::core::{AppError, AppResult, ErrorCode, ProjectReference};

/// What a failure writing the registry or its backup says the human was doing.
/// The registry lives in application support, so "saving a ticket" would name a
/// file in a folder they have never opened (V0-29).
const REGISTRY_ACTION: &str = "Saving the project list";

pub struct RegistryStore {
    path: PathBuf,
    backup_path: PathBuf,
    projects: RwLock<Vec<ProjectReference>>,
}

impl RegistryStore {
    pub fn load(app_data_dir: &Path) -> AppResult<Self> {
        fs::create_dir_all(app_data_dir).map_err(|error| {
            AppError::io("Creating application support folder", app_data_dir, error)
        })?;
        let path = app_data_dir.join("project-registry.json");
        let backup_path = app_data_dir.join("project-registry.backup.json");
        let mut projects: Vec<ProjectReference> = match fs::read(&path) {
            Ok(bytes) => {
                let projects = read_registry(&bytes, &path, &backup_path)?;
                preserve_registry_backup(&backup_path, &bytes)?;
                projects
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Vec::new(),
            Err(error) => return Err(AppError::io("Reading project registry", &path, error)),
        };
        // The file's `reachable` is a cache of somebody's last probe, not a fact
        // about this launch: a folder that was away when the app closed may be
        // mounted now. `refreshed` decides it on every read, so the persisted
        // value is dropped here rather than left to outlive the session that
        // wrote it — which is how a project stayed flagged unreachable across a
        // relaunch after the folder had come back (LC-141).
        for project in &mut projects {
            project.reachable = true;
        }
        // `read_registry` has already put the list in sidebar order; this only
        // restates each entry's place as the index it is stored at, which is
        // the shape every write below keeps it in.
        renumber(&mut projects);
        Ok(Self {
            path,
            backup_path,
            projects: RwLock::new(projects),
        })
    }

    /// Every registered project, refreshed from its own files. An entry whose
    /// folder has moved stays listed with its cached name so it can be relocated
    /// rather than lost.
    pub fn list(&self) -> Vec<ProjectReference> {
        self.projects
            .read()
            .iter()
            .cloned()
            .map(refreshed)
            .collect()
    }

    pub fn find(&self, project_id: &str) -> AppResult<ProjectReference> {
        self.projects
            .read()
            .iter()
            .find(|project| project.id == project_id)
            .cloned()
            .map(refreshed)
            .ok_or_else(|| unknown_project(project_id))
    }

    /// Validates a chosen folder and records a reference to it. Registering never
    /// changes the project's files.
    pub fn register(&self, root: &Path) -> AppResult<ProjectReference> {
        let canonical = root
            .canonicalize()
            .map_err(|error| AppError::io("Canonicalizing project folder", root, error))?;
        let document = read_project(&canonical)?;
        let project =
            ProjectReference::from_project(document.project(), canonical.display().to_string());
        self.remember(&project)?;
        self.find(&project.id)
    }

    pub fn create(
        &self,
        root: &Path,
        name: &str,
        key: &str,
        theme: &str,
    ) -> AppResult<ProjectReference> {
        let canonical = root
            .canonicalize()
            .map_err(|error| AppError::io("Canonicalizing project folder", root, error))?;
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);
        let document = initialize_project(&canonical, name, key, Some(theme), &now)?;
        let project =
            ProjectReference::from_project(document.project(), canonical.display().to_string());
        self.remember(&project)?;
        self.find(&project.id)
    }

    pub fn relocate(&self, project_id: &str, root: &Path) -> AppResult<ProjectReference> {
        let canonical = root
            .canonicalize()
            .map_err(|error| AppError::io("Canonicalizing project folder", root, error))?;
        let document = read_project(&canonical)?;
        if document.project().id != project_id {
            return Err(AppError::new(
                ErrorCode::InvalidProject,
                "The selected folder is a different LongClaw project",
                true,
            )
            .with_context("path", canonical.display().to_string()));
        }
        let project =
            ProjectReference::from_project(document.project(), canonical.display().to_string());
        self.remember(&project)?;
        self.find(&project.id)
    }

    pub fn set_starred(&self, project_id: &str, starred: bool) -> AppResult<ProjectReference> {
        let mut projects = self.projects.write();
        let Some(index) = projects.iter().position(|project| project.id == project_id) else {
            return Err(unknown_project(project_id));
        };
        let mut next = projects.clone();
        next[index].starred = starred;
        let updated = next[index].clone();
        self.persist(&next)?;
        *projects = next;
        Ok(refreshed(updated))
    }

    /// Moves one project to sit immediately after another, or to the top of the
    /// sidebar when `after` is `None` (LC-260j).
    ///
    /// A neighbour rather than an index, the way a checklist move names the row
    /// it follows: an index is a claim about the whole list, and this store is
    /// the one authority over that. The whole list comes back because the whole
    /// list changed — every row between the two ends of the move has a new
    /// number, and `⌘1`–`⌘9` is that number.
    ///
    /// Every refusal happens before `persist`, so a landing this registry
    /// cannot make sense of leaves the file and the list exactly as they were.
    pub fn move_after(
        &self,
        project_id: &str,
        after: Option<&str>,
    ) -> AppResult<Vec<ProjectReference>> {
        {
            let mut projects = self.projects.write();
            let Some(from) = projects.iter().position(|project| project.id == project_id) else {
                return Err(unknown_project(project_id));
            };
            // A row cannot follow itself. Left to the arithmetic below it would
            // be a silent no-op, which is a worse answer than a refusal: the
            // caller asked for something that does not exist.
            if after == Some(project_id) {
                return Err(AppError::new(
                    ErrorCode::InvalidProject,
                    "A project cannot be placed after itself",
                    true,
                ));
            }
            let mut next = projects.clone();
            let moved = next.remove(from);
            let at = match after {
                None => 0,
                Some(neighbour) => next
                    .iter()
                    .position(|project| project.id == neighbour)
                    .map(|index| index + 1)
                    .ok_or_else(|| unknown_project(neighbour))?,
            };
            next.insert(at, moved);
            // The move *is* the renumbering — the one gesture that is allowed to
            // take somebody's `⌘n` with it, because it is the one they asked for.
            renumber(&mut next);
            self.persist(&next)?;
            *projects = next;
        }
        Ok(self.list())
    }

    pub fn update_theme(&self, project_id: &str, theme: &str) -> AppResult<ProjectReference> {
        self.update_project_file(project_id, |document| document.set_theme(theme))
    }

    pub fn update_name(&self, project_id: &str, name: &str) -> AppResult<ProjectReference> {
        self.update_project_file(project_id, |document| document.set_name(name))
    }

    pub fn add_label(
        &self,
        project_id: &str,
        slug: &str,
        name: &str,
        color: &str,
    ) -> AppResult<ProjectReference> {
        self.update_project_file(project_id, |document| document.add_label(slug, name, color))
    }

    pub fn update_label(
        &self,
        project_id: &str,
        slug: &str,
        name: Option<&str>,
        color: Option<&str>,
    ) -> AppResult<ProjectReference> {
        self.update_project_file(project_id, |document| {
            document.update_label(slug, name, color)
        })
    }

    pub fn remove_label(&self, project_id: &str, slug: &str) -> AppResult<ProjectReference> {
        self.update_project_file(project_id, |document| document.remove_label(slug))
    }

    pub fn set_property_enabled(
        &self,
        project_id: &str,
        property: Property,
        enabled: bool,
    ) -> AppResult<ProjectReference> {
        self.update_project_file(project_id, |document| {
            document.set_property_enabled(property, enabled)
        })
    }

    pub fn set_attention_days(&self, project_id: &str, days: u32) -> AppResult<ProjectReference> {
        self.update_project_file(project_id, |document| document.set_attention_days(days))
    }

    pub fn set_estimate_system(
        &self,
        project_id: &str,
        system: EstimateSystem,
    ) -> AppResult<ProjectReference> {
        self.update_project_file(project_id, |document| document.set_estimate_system(system))
    }

    pub fn set_estimate_conversion(
        &self,
        project_id: &str,
        hours_per_day: f64,
        days_per_week: f64,
    ) -> AppResult<ProjectReference> {
        self.update_project_file(project_id, |document| {
            document.set_estimate_conversion(hours_per_day, days_per_week)
        })
    }

    pub fn set_tshirt_scale(
        &self,
        project_id: &str,
        values: &[String],
    ) -> AppResult<ProjectReference> {
        self.update_project_file(project_id, |document| document.set_tshirt_scale(values))
    }

    pub fn add_type_value(
        &self,
        project_id: &str,
        slug: &str,
        name: &str,
        color: &str,
    ) -> AppResult<ProjectReference> {
        self.update_project_file(project_id, |document| {
            document.add_type_value(slug, name, color)
        })
    }

    pub fn update_type_value(
        &self,
        project_id: &str,
        slug: &str,
        name: Option<&str>,
        color: Option<&str>,
    ) -> AppResult<ProjectReference> {
        self.update_project_file(project_id, |document| {
            document.update_type_value(slug, name, color)
        })
    }

    pub fn remove_type_value(&self, project_id: &str, slug: &str) -> AppResult<ProjectReference> {
        self.update_project_file(project_id, |document| document.remove_type_value(slug))
    }

    fn update_project_file(
        &self,
        project_id: &str,
        edit: impl FnOnce(
            &mut crate::core::project::ProjectDocument,
        ) -> Result<Vec<u8>, crate::core::Diagnostic>,
    ) -> AppResult<ProjectReference> {
        let current = self.find(project_id)?;
        let root = Path::new(&current.root_path);
        let mut document = read_project(root)?;
        let bytes = edit(&mut document).map_err(AppError::from)?;
        atomic_write("Saving project settings", &project_file_path(root), &bytes)?;
        write_agent_instructions(root, &document)?;
        let project = carrying_registry_state(
            ProjectReference::from_project(document.project(), current.root_path.clone()),
            &current,
        );
        self.remember(&project)?;
        Ok(project)
    }

    pub fn remove(&self, project_id: &str) -> AppResult<()> {
        let mut projects = self.projects.write();
        if !projects.iter().any(|project| project.id == project_id) {
            return Err(unknown_project(project_id));
        }
        let mut next = projects.clone();
        next.retain(|project| project.id != project_id);
        // The rows below a removed one do move up, and that is right: it is a
        // deletion the human performed rather than a surprise (LC-259y).
        renumber(&mut next);
        self.persist(&next)?;
        *projects = next;
        Ok(())
    }

    /// Updates the cached reference for a project that is already registered, or
    /// adds it. The project's own files remain the source of truth.
    pub fn remember(&self, project: &ProjectReference) -> AppResult<()> {
        let mut projects = self.projects.write();
        let mut next = projects.clone();
        let mut project = project.clone();
        // The star is the registry's to say rather than the caller's, which hands
        // in what it read out of `longclaw.yaml` and that file holds no star.
        // So is the row, and the row is where the entry sits: the list is
        // rewritten in place rather than re-sorted, which leaves no comparator
        // to disagree with what was persisted. `remember` runs on every update
        // to a registered project and not only on registration, so this is what
        // makes a rename move nothing (LC-259y).
        match next.iter().position(|candidate| candidate.id == project.id) {
            Some(index) => {
                project.starred = next[index].starred;
                next[index] = project;
            }
            // A project nobody has seen before goes after every one that exists.
            None => {
                project.starred = false;
                next.push(project);
            }
        }
        // Each entry's index is its place; this is where that gets written down.
        renumber(&mut next);
        self.persist(&next)?;
        *projects = next;
        Ok(())
    }

    fn persist(&self, projects: &[ProjectReference]) -> AppResult<()> {
        let bytes = serde_json::to_vec_pretty(projects).map_err(|error| {
            AppError::new(
                ErrorCode::Internal,
                format!("Serializing project registry failed: {error}"),
                false,
            )
        })?;
        if let Ok(current) = fs::read(&self.path) {
            atomic_write(REGISTRY_ACTION, &self.backup_path, &current)?;
            atomic_write(REGISTRY_ACTION, &self.path, &bytes)
        } else {
            atomic_write(REGISTRY_ACTION, &self.path, &bytes)?;
            preserve_registry_backup(&self.backup_path, &bytes)
        }
    }
}

fn preserve_registry_backup(backup_path: &Path, bytes: &[u8]) -> AppResult<()> {
    if backup_path.exists() {
        return Ok(());
    }
    atomic_write(REGISTRY_ACTION, backup_path, bytes)
}

/// A cached entry brought back up to date from the project's own files.
///
/// `longclaw.yaml` is the source of truth for the name, theme, and label
/// definitions; the registry caches them only so a folder that has moved or gone
/// stays listed with something to show rather than disappearing.
fn refreshed(project: ProjectReference) -> ProjectReference {
    let root = Path::new(&project.root_path);
    let Ok(document) = read_project(root) else {
        return unreachable(project);
    };
    if fs::read_dir(tickets_root(root)).is_err() {
        return unreachable(project);
    }
    carrying_registry_state(
        ProjectReference::from_project(document.project(), project.root_path.clone()),
        &project,
    )
}

/// A reference rebuilt from `longclaw.yaml`, carrying the two fields that file
/// does not hold.
///
/// The project file is the source of truth for the name, the theme and the
/// labels; the registry is the source of truth for the star and for the place.
/// Every rebuild has to carry both across or reading a project's own settings
/// would unstar it and move its row (LC-259y).
fn carrying_registry_state(
    mut rebuilt: ProjectReference,
    registry: &ProjectReference,
) -> ProjectReference {
    rebuilt.starred = registry.starred;
    rebuilt.order = registry.order;
    rebuilt
}

/// Restates each entry's place as the index it is stored at, so `order` is dense
/// and the two ways of reading the list cannot come apart.
///
/// The list's own order is the sidebar's order; `order` is that written down, so
/// that the file does not depend on the order of a JSON array and so that a
/// reference crossing IPC on its own can be put back where it came from
/// (LC-259y). Nothing here sorts — every caller has already placed the row it
/// changed.
fn renumber(projects: &mut [ProjectReference]) {
    for (index, project) in projects.iter_mut().enumerate() {
        project.order = index as u32;
    }
}

/// The registry file's entries, in sidebar order.
///
/// An entry that declares no `order` was written by a build from before the
/// field existed, and where it goes has to be worked out rather than read. Those
/// go in the order that build *drew* them, after every entry that does say where
/// it belongs — which for the ordinary case, a whole registry written before the
/// field, is the whole list.
fn read_registry(
    bytes: &[u8],
    path: &Path,
    backup_path: &Path,
) -> AppResult<Vec<ProjectReference>> {
    let invalid = |error: serde_json::Error| {
        AppError::new(
            ErrorCode::ParseFailed,
            format!("Project registry is invalid and was left untouched: {error}"),
            true,
        )
        .with_context("path", path.display().to_string())
        .with_context("backupPath", backup_path.display().to_string())
    };
    // Through a `Value` rather than straight into the struct, because
    // `serde(default)` cannot tell an entry that says `"order": 0` from one that
    // says nothing, and the difference is the whole migration. The bytes are
    // still lexed once; what this adds is a tree to ask that question of, and
    // one walk of it to build the references from.
    let entries: Vec<serde_json::Value> = serde_json::from_slice(bytes).map_err(invalid)?;
    let declared: Vec<bool> = entries
        .iter()
        .map(|entry| entry.get("order").is_some())
        .collect();
    let projects: Vec<ProjectReference> =
        serde_json::from_value(serde_json::Value::Array(entries)).map_err(invalid)?;
    let (mut placed, mut unplaced): (Vec<_>, Vec<_>) = projects
        .into_iter()
        .zip(declared)
        .partition(|(_, declared)| *declared);
    placed.sort_by_key(|(project, _)| project.order);
    unplaced.sort_by(|(left, _), (right, _)| as_drawn(&left.name, &right.name));
    Ok(placed
        .into_iter()
        .chain(unplaced)
        .map(|(project, _)| project)
        .collect())
}

/// Two project names in the order the sidebar *drew* them before it had an order
/// of its own — which is what the `⌘1`–`⌘9` in somebody's fingers actually were.
///
/// Deliberately not the order the old `remember` **wrote**. That sorted with
/// `String::cmp`, which is byte order and puts every capitalised name before
/// every lowercase one, while the list on screen was sorted a second time in the
/// frontend with `localeCompare`, which does not: a registry holding `Admin`,
/// `Zebra` and `apple` was filed in that order and drawn as `Admin`, `apple`,
/// `Zebra`. Seeding from the file's own order would therefore re-deal the
/// sidebar of everyone whose projects are not cased alike, which is the exact
/// defect this field exists to prevent (LC-259y).
///
/// `localeCompare`'s collation is reproduced as far as an unaccented name goes:
/// case-insensitive first, then lowercase before uppercase where two names
/// differ only in case. A pair that differs first at an accented or non-Latin
/// letter can land elsewhere than ICU would put it, and that is a decision
/// rather than an omission — `localeCompare` with no locale argument collates in
/// the *webview's* locale, so there is no single order to reproduce. A Swedish
/// sidebar drew `Åsa` after `Zebra`, because `Å` is the last letter of that
/// alphabet rather than a marked `A`; a French one drew it among the `A`s.
/// Comparing the lowercased codepoints, as this does, gives the Swedish answer,
/// and folding the mark away would give the French one; nothing here can tell
/// which sidebar this file came off, because the locale that drew it belonged to
/// a webview that does not exist yet when the registry loads. Getting it right
/// would mean collating in the frontend and writing the order back, which is a
/// second authority over the order and the thing this field exists to end. It
/// runs on the one launch that migrates a registry and never again, and what it
/// can get wrong is one row against another whose names disagree only there.
fn as_drawn(left: &str, right: &str) -> std::cmp::Ordering {
    left.to_lowercase()
        .cmp(&right.to_lowercase())
        // `"a".localeCompare("A")` is -1: the lowercase sorts first, which is
        // the opposite of what comparing the bytes says.
        .then_with(|| right.cmp(left))
}

fn unreachable(mut project: ProjectReference) -> ProjectReference {
    project.reachable = false;
    project
}

fn unknown_project(project_id: &str) -> AppError {
    AppError::new(
        ErrorCode::InvalidProject,
        format!("Unknown project id: {project_id}"),
        true,
    )
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use super::RegistryStore;
    use crate::core::{ErrorCode, ProjectReference};

    /// V0-29, review follow-up. `atomic_write` writes tickets, the registry,
    /// `longclaw.yaml` and the agent contract, so naming the operation inside it
    /// made a read-only application support folder report *"Saving ticket failed
    /// for project-registry.json"* — right about the file, wrong about
    /// everything else.
    #[cfg(unix)]
    #[test]
    fn a_registry_write_failure_does_not_call_itself_a_ticket_save() {
        use std::os::unix::fs::PermissionsExt;

        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        let store = RegistryStore::load(&app_data).unwrap();

        fs::set_permissions(&app_data, fs::Permissions::from_mode(0o555)).unwrap();
        let error = store
            .remember(&ProjectReference {
                id: "registry-copy-proof".to_owned(),
                name: "Registry Copy Proof".to_owned(),
                root_path: temp.path().join("project").display().to_string(),
                key: "RP".to_owned(),
                theme: "indigo".to_owned(),
                starred: false,
                reachable: true,
                order: 0,
                labels: Default::default(),
                properties: Default::default(),
            })
            .unwrap_err();
        fs::set_permissions(&app_data, fs::Permissions::from_mode(0o755)).unwrap();

        assert_eq!(error.code, ErrorCode::PermissionDenied);
        assert!(!error.message.contains("ticket"));
        assert!(error.message.contains("project list"));
        assert!(error.message.contains("project-registry.json"));
    }

    #[test]
    fn project_references_survive_restart_and_missing_folders_remain_listed() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        let project = temp.path().join("project");
        fs::create_dir_all(project.join(".longclaw/tickets")).unwrap();
        fs::write(
            project.join(".longclaw/longclaw.yaml"),
            "format: longclaw.project/v1\nid: registry-proof\nname: Registry Proof\nkey: RP\ntheme: indigo\ncreated_at: 2026-07-29T00:00:00Z\n",
        )
        .unwrap();

        let store = RegistryStore::load(&app_data).unwrap();
        let registered_path = store.register(&project).unwrap().root_path;
        drop(store);

        let restored = RegistryStore::load(&app_data).unwrap();
        let projects = restored.list();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].id, "registry-proof");
        assert!(!projects[0].starred);
        assert!(projects[0].reachable);

        let moved = temp.path().join("project-moved");
        fs::rename(&project, &moved).unwrap();
        let missing = restored.list();
        assert_eq!(missing.len(), 1);
        assert!(!missing[0].reachable);
        assert_eq!(missing[0].root_path, registered_path);
        assert!(moved.join(".longclaw/longclaw.yaml").is_file());
    }

    /// LC-141. A project that was away when the app closed stayed flagged
    /// unreachable after the folder came back, because the flag was read out of
    /// the registry file as though it were a fact about the disk. It is a cache
    /// of somebody's last probe, and this launch has to take its own.
    #[test]
    fn a_persisted_unreachable_flag_does_not_survive_the_folder_coming_back() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        let project = temp.path().join("project");
        fs::create_dir_all(project.join(".longclaw/tickets")).unwrap();
        fs::write(
            project.join(".longclaw/longclaw.yaml"),
            "format: longclaw.project/v1\nid: cache-proof\nname: Cache Proof\nkey: CP\ntheme: indigo\ncreated_at: 2026-07-29T00:00:00Z\n",
        )
        .unwrap();

        let store = RegistryStore::load(&app_data).unwrap();
        store.register(&project).unwrap();
        drop(store);

        // The registry as an older build could have left it: the folder is
        // there, and the file still says it is not.
        let registry_path = app_data.join("project-registry.json");
        let stale = fs::read_to_string(&registry_path)
            .unwrap()
            .replace("\"reachable\": true", "\"reachable\": false");
        assert!(stale.contains("\"reachable\": false"));
        fs::write(&registry_path, stale).unwrap();

        let restored = RegistryStore::load(&app_data).unwrap();
        let [listed] = restored.list().try_into().unwrap();
        assert!(listed.reachable);

        // And the stale flag is not written back out, so it cannot come round
        // again on the next launch.
        restored.set_starred("cache-proof", true).unwrap();
        let written = fs::read_to_string(&registry_path).unwrap();
        assert!(!written.contains("\"reachable\": false"));
    }

    #[test]
    fn a_corrupt_registry_fails_closed_and_can_be_restored_from_backup() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        let project = temp.path().join("project");
        fs::create_dir_all(project.join(".longclaw/tickets")).unwrap();
        fs::write(
            project.join(".longclaw/longclaw.yaml"),
            "format: longclaw.project/v1\nid: backup-proof\nname: Backup Proof\nkey: BP\ntheme: indigo\ncreated_at: 2026-07-29T00:00:00Z\n",
        )
        .unwrap();

        let store = RegistryStore::load(&app_data).unwrap();
        store.register(&project).unwrap();
        drop(store);

        let registry = app_data.join("project-registry.json");
        let backup = app_data.join("project-registry.backup.json");
        assert!(backup.is_file());
        let backup_bytes = fs::read(&backup).unwrap();
        fs::write(&registry, b"{ not valid json").unwrap();

        let error = match RegistryStore::load(&app_data) {
            Ok(_) => panic!("corruption must fail closed"),
            Err(error) => error,
        };
        assert_eq!(error.code, crate::core::ErrorCode::ParseFailed);
        assert_eq!(error.context["path"], registry.display().to_string());
        assert_eq!(error.context["backupPath"], backup.display().to_string());
        assert_eq!(fs::read(&registry).unwrap(), b"{ not valid json");

        fs::write(&registry, backup_bytes).unwrap();
        let restored = RegistryStore::load(&app_data).unwrap();
        let [project] = restored.list().try_into().unwrap();
        assert_eq!(project.id, "backup-proof");
        assert!(project.reachable);
    }

    #[test]
    fn a_registry_backup_holds_the_state_before_the_latest_save() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        let first = temp.path().join("first");
        let second = temp.path().join("second");
        let third = temp.path().join("third");
        for (root, id, key) in [
            (&first, "first-project", "FP"),
            (&second, "second-project", "SP"),
            (&third, "third-project", "TP"),
        ] {
            fs::create_dir_all(root.join(".longclaw/tickets")).unwrap();
            fs::write(
                root.join(".longclaw/longclaw.yaml"),
                format!(
                    "format: longclaw.project/v1\nid: {id}\nname: {id}\nkey: {key}\ntheme: indigo\ncreated_at: 2026-07-29T00:00:00Z\n"
                ),
            )
            .unwrap();
        }

        let store = RegistryStore::load(&app_data).unwrap();
        store.register(&first).unwrap();
        let backup = app_data.join("project-registry.backup.json");
        store.register(&second).unwrap();
        fs::write(&backup, b"{ truncated backup").unwrap();
        store.register(&third).unwrap();

        let backup = fs::read_to_string(&backup).unwrap();
        assert!(backup.contains("first-project"));
        assert!(backup.contains("second-project"));
        assert!(!backup.contains("third-project"));

        let live = fs::read_to_string(app_data.join("project-registry.json")).unwrap();
        assert!(live.contains("first-project"));
        assert!(live.contains("second-project"));
        assert!(live.contains("third-project"));
    }

    #[test]
    fn creating_and_removing_a_project_never_deletes_project_files() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        let project = temp.path().join("fresh");
        fs::create_dir_all(&project).unwrap();

        let store = RegistryStore::load(&app_data).unwrap();
        let reference = store
            .create(&project, "Fresh Project", "FP", "indigo")
            .unwrap();
        assert_eq!(reference.name, "Fresh Project");
        assert!(project.join(".longclaw/longclaw.yaml").is_file());
        assert!(project.join(".longclaw/tickets").is_dir());

        store.remove(&reference.id).unwrap();
        assert!(store.list().is_empty());
        assert!(project.join(".longclaw/longclaw.yaml").is_file());
    }

    const LABELLED_PROJECT: &str = concat!(
        "format: longclaw.project/v1\n",
        "id: label-proof\n",
        "name: Label Proof\n",
        "key: LB\n",
        "theme: indigo\n",
        "created_at: 2026-07-29T00:00:00Z\n",
        "people: {}\n",
        "labels:\n",
        "  storage:\n",
        "    name: Storage\n",
        "    color: blue\n",
    );

    const LABELLED_TICKET: &str = concat!(
        "---\n",
        "format: longclaw.ticket/v1\n",
        "id: 019c8ca0-0000-7000-8000-000000000001\n",
        "key: LB-1\n",
        "title: Carries a slug\n",
        "status: todo\n",
        "priority: p2\n",
        "labels:\n",
        "  - storage\n",
        "  - never-defined\n",
        "created_at: 2026-07-29T00:00:00Z\n",
        "updated_at: 2026-07-29T00:00:00Z\n",
        "---\n",
        "\n",
        "A ticket that carries a defined slug and an undefined one.\n",
    );

    fn labelled_project() -> (tempfile::TempDir, RegistryStore, super::ProjectReference) {
        let temp = tempfile::tempdir().unwrap();
        let project = temp.path().join("project");
        fs::create_dir_all(project.join(".longclaw/tickets/LB-1")).unwrap();
        fs::write(project.join(".longclaw/longclaw.yaml"), LABELLED_PROJECT).unwrap();
        fs::write(
            project.join(".longclaw/tickets/LB-1/ticket.md"),
            LABELLED_TICKET,
        )
        .unwrap();
        let store = RegistryStore::load(&temp.path().join("app-support")).unwrap();
        let reference = store.register(&project).unwrap();
        (temp, store, reference)
    }

    /// V0-10's hard invariant. A ticket stores slugs, so what a slug is *called*
    /// is project state: renaming it, recolouring it, or dropping the definition
    /// entirely rewrites `longclaw.yaml` and not one ticket byte.
    #[test]
    fn changing_a_label_definition_never_rewrites_a_ticket() {
        let (temp, store, reference) = labelled_project();
        let ticket = temp.path().join("project/.longclaw/tickets/LB-1/ticket.md");
        let before = fs::read(&ticket).unwrap();
        assert_eq!(reference.labels["storage"].name, "Storage");

        let renamed = store
            .update_label(&reference.id, "storage", Some("Persistence"), Some("amber"))
            .unwrap();
        assert_eq!(renamed.labels["storage"].name, "Persistence");
        assert_eq!(renamed.labels["storage"].color, "amber");
        assert_eq!(fs::read(&ticket).unwrap(), before);

        let added = store
            .add_label(&reference.id, "backend", "Backend", "teal")
            .unwrap();
        assert_eq!(added.labels["backend"].name, "Backend");
        assert_eq!(fs::read(&ticket).unwrap(), before);

        let removed = store.remove_label(&reference.id, "storage").unwrap();
        assert!(!removed.labels.contains_key("storage"));
        assert_eq!(fs::read(&ticket).unwrap(), before);
    }

    /// `longclaw.yaml` is the source of truth for label definitions. The registry
    /// entry only caches them so an unreachable project still has something to
    /// render, so an edit made outside the app shows up without a command.
    #[test]
    fn label_definitions_are_re_read_from_the_project_file() {
        let (temp, store, reference) = labelled_project();
        let file = temp.path().join("project/.longclaw/longclaw.yaml");
        fs::write(
            &file,
            LABELLED_PROJECT.replace("    name: Storage\n", "    name: Edited By Hand\n"),
        )
        .unwrap();

        let [listed] = store.list().try_into().unwrap();
        assert_eq!(listed.labels["storage"].name, "Edited By Hand");
        assert_eq!(
            store.find(&reference.id).unwrap().labels["storage"].name,
            "Edited By Hand"
        );
    }

    /// LC-259y. The sidebar was sorted by name in two places, so registering a
    /// project called `Admin` pushed every project after it down a row — and
    /// `⌘1`–`⌘9` is a row's position, so the chord a human had in their fingers
    /// opened something else. Registration order is the order.
    ///
    /// Named so that both of the comparators this replaced would reorder them:
    /// `Zebra`, `apple`, `Admin` is neither byte order (which puts every capital
    /// before every lowercase) nor locale order.
    const REGISTERED: [(&str, &str, &str); 3] = [
        ("zebra", "Zebra", "ZB"),
        ("apple", "apple", "AP"),
        ("admin", "Admin", "AD"),
    ];

    fn write_project(root: &Path, id: &str, name: &str, key: &str) {
        fs::create_dir_all(root.join(".longclaw/tickets")).unwrap();
        fs::write(
            root.join(".longclaw/longclaw.yaml"),
            format!(
                "format: longclaw.project/v1\nid: {id}\nname: {name}\nkey: {key}\ntheme: indigo\ncreated_at: 2026-07-29T00:00:00Z\n"
            ),
        )
        .unwrap();
    }

    /// `REGISTERED` registered in that order, and the roots it registered.
    fn registered_in_order(temp: &tempfile::TempDir) -> (RegistryStore, Vec<PathBuf>) {
        let store = RegistryStore::load(&temp.path().join("app-support")).unwrap();
        let mut roots = Vec::new();
        for (id, name, key) in REGISTERED {
            let root = temp.path().join(id);
            write_project(&root, id, name, key);
            store.register(&root).unwrap();
            roots.push(root);
        }
        (store, roots)
    }

    fn sidebar(store: &RegistryStore) -> Vec<String> {
        store.list().into_iter().map(|project| project.id).collect()
    }

    /// The reported defect: a new project joins last, wherever its name sorts.
    #[test]
    fn a_new_project_joins_the_sidebar_last_however_its_name_sorts() {
        let temp = tempfile::tempdir().unwrap();
        let (store, _roots) = registered_in_order(&temp);

        assert_eq!(sidebar(&store), ["zebra", "apple", "admin"]);
        // And the place is dense and says the index, on the way out as well as
        // in the file.
        assert_eq!(
            store
                .list()
                .into_iter()
                .map(|project| project.order)
                .collect::<Vec<_>>(),
            [0, 1, 2]
        );
    }

    /// The sharper half of the defect: `remember` runs on every update to a
    /// registered project, so a rename re-sorted the whole sidebar. Nothing
    /// about renaming a project suggests other projects' shortcuts change.
    #[test]
    fn renaming_a_project_moves_no_row() {
        let temp = tempfile::tempdir().unwrap();
        let (store, _roots) = registered_in_order(&temp);

        let renamed = store.update_name("zebra", "zzz last of all").unwrap();
        assert_eq!(renamed.name, "zzz last of all");
        assert_eq!(renamed.order, 0);
        assert_eq!(sidebar(&store), ["zebra", "apple", "admin"]);

        store.update_name("admin", "AAA first of all").unwrap();
        assert_eq!(sidebar(&store), ["zebra", "apple", "admin"]);
    }

    /// The registry file as a build from before this field wrote it: the same
    /// entries, sorted the way the old `remember` sorted them — `String::cmp`,
    /// which is byte order — and carrying no place at all.
    fn as_an_older_build_wrote_it(registry: &Path) {
        let mut older: Vec<serde_json::Value> =
            serde_json::from_str(&fs::read_to_string(registry).unwrap()).unwrap();
        for entry in &mut older {
            assert!(entry.as_object_mut().unwrap().remove("order").is_some());
        }
        older.sort_by_key(|entry| entry["name"].as_str().unwrap().to_owned());
        assert_eq!(
            older
                .iter()
                .map(|entry| entry["id"].as_str().unwrap())
                .collect::<Vec<_>>(),
            ["admin", "zebra", "apple"]
        );
        fs::write(registry, serde_json::to_vec_pretty(&older).unwrap()).unwrap();
    }

    /// The migration, and the part of this ticket that is easiest to get wrong.
    /// Every current human's muscle memory is built on the sidebar they have
    /// been looking at, so upgrading has to leave *that* order exactly where it
    /// is and take effect from the next project registered onward.
    ///
    /// Which means seeding from the order the old build **drew**, not the one it
    /// **wrote**: it filed the list in byte order (`Admin`, `Zebra`, `apple`)
    /// and the frontend sorted it again with `localeCompare` before drawing it
    /// (`Admin`, `apple`, `Zebra`). Seeding from the file would swap `⌘2` and
    /// `⌘3` for everyone whose projects are not cased alike — this ticket's own
    /// defect, served once on upgrade.
    #[test]
    fn a_registry_written_before_the_field_keeps_the_order_it_was_drawn_in() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        let (store, _roots) = registered_in_order(&temp);
        drop(store);

        let registry = app_data.join("project-registry.json");
        as_an_older_build_wrote_it(&registry);

        let restored = RegistryStore::load(&app_data).unwrap();
        assert_eq!(sidebar(&restored), ["admin", "apple", "zebra"]);

        // And from here on a new project appends rather than landing in the
        // middle of somebody's chords.
        let fourth = temp.path().join("bbb");
        write_project(&fourth, "bbb", "bbb", "BB");
        restored.register(&fourth).unwrap();
        assert_eq!(sidebar(&restored), ["admin", "apple", "zebra", "bbb"]);

        // The seed is written down on the first save, so the next launch reads
        // it rather than working it out again.
        let placed: Vec<serde_json::Value> =
            serde_json::from_str(&fs::read_to_string(&registry).unwrap()).unwrap();
        assert_eq!(
            placed
                .iter()
                .map(|entry| (
                    entry["id"].as_str().unwrap(),
                    entry["order"].as_u64().unwrap()
                ))
                .collect::<Vec<_>>(),
            [("admin", 0), ("apple", 1), ("zebra", 2), ("bbb", 3)]
        );
    }

    /// A registry that declares a place for some of its entries and not others
    /// can only come from a hand edit or a half-finished write. It gets an
    /// answer rather than a shuffle: what says where it goes keeps its place,
    /// and what does not joins the end, in the order the old build drew it.
    #[test]
    fn an_entry_with_no_place_joins_the_end_rather_than_the_front() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        let (store, _roots) = registered_in_order(&temp);
        drop(store);

        let registry = app_data.join("project-registry.json");
        let mut entries: Vec<serde_json::Value> =
            serde_json::from_str(&fs::read_to_string(&registry).unwrap()).unwrap();
        // `zebra` is first and says so; `apple` and `admin` say nothing, and 0
        // is what `serde(default)` would hand them — the value that would sort
        // them both above the row that does say it belongs there.
        for entry in &mut entries {
            if entry["id"] != "zebra" {
                entry.as_object_mut().unwrap().remove("order");
            }
        }
        fs::write(&registry, serde_json::to_vec_pretty(&entries).unwrap()).unwrap();

        let restored = RegistryStore::load(&app_data).unwrap();
        assert_eq!(sidebar(&restored), ["zebra", "admin", "apple"]);
    }

    /// Starred rows are the same rows pinned to the top rather than a second
    /// list, and an unreachable project is not a removed one: neither may
    /// renumber anybody. Removal is the one thing that does, and it closes the
    /// gap.
    #[test]
    fn starring_and_unreachability_leave_the_numbering_alone_and_removal_closes_the_gap() {
        let temp = tempfile::tempdir().unwrap();
        let (store, roots) = registered_in_order(&temp);

        store.set_starred("admin", true).unwrap();
        assert_eq!(sidebar(&store), ["zebra", "apple", "admin"]);
        store.set_starred("admin", false).unwrap();
        assert_eq!(sidebar(&store), ["zebra", "apple", "admin"]);

        let away = temp.path().join("apple-unplugged");
        fs::rename(&roots[1], &away).unwrap();
        let listed = store.list();
        assert_eq!(
            listed
                .iter()
                .map(|project| project.id.as_str())
                .collect::<Vec<_>>(),
            ["zebra", "apple", "admin"]
        );
        assert!(!listed[1].reachable);
        fs::rename(&away, &roots[1]).unwrap();

        store.remove("zebra").unwrap();
        assert_eq!(sidebar(&store), ["apple", "admin"]);
        assert_eq!(
            store
                .list()
                .into_iter()
                .map(|project| project.order)
                .collect::<Vec<_>>(),
            [0, 1]
        );
    }

    /// Dragging a row, which is the one gesture that is *allowed* to renumber
    /// (LC-260j). The move is stated as a neighbour rather than as an index —
    /// "after `zebra`" — so the registry places it and `renumber` writes the
    /// new places down.
    #[test]
    fn a_project_moves_to_sit_after_the_one_it_was_dropped_under() {
        let temp = tempfile::tempdir().unwrap();
        let (store, _roots) = registered_in_order(&temp);

        let listed = store.move_after("zebra", Some("apple")).unwrap();
        assert_eq!(
            listed
                .iter()
                .map(|project| (project.id.as_str(), project.order))
                .collect::<Vec<_>>(),
            [("apple", 0), ("zebra", 1), ("admin", 2)]
        );

        // No neighbour is the top of the list, which is the one landing that
        // cannot name the row above it.
        store.move_after("admin", None).unwrap();
        assert_eq!(sidebar(&store), ["admin", "apple", "zebra"]);
    }

    /// A move is the whole of the write: nothing about the project's own files
    /// changes, and the star does not move with the row or stay behind it.
    #[test]
    fn a_move_survives_restart_and_leaves_the_star_where_it_was() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        let (store, _roots) = registered_in_order(&temp);
        store.set_starred("admin", true).unwrap();

        store.move_after("admin", None).unwrap();
        drop(store);

        let restored = RegistryStore::load(&app_data).unwrap();
        assert_eq!(sidebar(&restored), ["admin", "zebra", "apple"]);
        let listed = restored.list();
        assert!(listed[0].starred);
        assert!(!listed[1].starred);
    }

    /// A landing this registry cannot make sense of is refused rather than
    /// guessed at, and the list it refused is the list it still has: a frontend
    /// holding a stale id must not be able to shuffle the sidebar by asking.
    #[test]
    fn a_move_naming_an_unknown_or_circular_neighbour_is_refused_and_writes_nothing() {
        let temp = tempfile::tempdir().unwrap();
        let (store, _roots) = registered_in_order(&temp);

        let unknown = store.move_after("zebra", Some("nobody")).unwrap_err();
        assert_eq!(unknown.code, ErrorCode::InvalidProject);
        let missing = store.move_after("nobody", None).unwrap_err();
        assert_eq!(missing.code, ErrorCode::InvalidProject);
        let itself = store.move_after("zebra", Some("zebra")).unwrap_err();
        assert_eq!(itself.code, ErrorCode::InvalidProject);

        assert_eq!(sidebar(&store), ["zebra", "apple", "admin"]);
    }

    /// The place has to survive a relaunch, or the fix only holds until the
    /// window is closed.
    #[test]
    fn registration_order_survives_restart() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        let (store, _roots) = registered_in_order(&temp);
        drop(store);

        let restored = RegistryStore::load(&app_data).unwrap();
        assert_eq!(sidebar(&restored), ["zebra", "apple", "admin"]);
    }

    #[test]
    fn stars_theme_changes_and_relocation_survive_restart() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().join("app-support");
        let project = temp.path().join("project");
        fs::create_dir_all(project.join(".longclaw/tickets")).unwrap();
        fs::write(
            project.join(".longclaw/longclaw.yaml"),
            "format: longclaw.project/v1\nid: settings-proof\nname: Settings Proof\nkey: SP\ntheme: indigo\ncreated_at: 2026-07-29T00:00:00Z\npeople: {}\nlabels: {}\n",
        )
        .unwrap();

        let store = RegistryStore::load(&app_data).unwrap();
        let reference = store.register(&project).unwrap();
        store.set_starred(&reference.id, true).unwrap();
        let themed = store.update_theme(&reference.id, "clay").unwrap();
        assert!(themed.starred);
        assert_eq!(themed.theme, "clay");

        let moved = temp.path().join("moved");
        fs::rename(&project, &moved).unwrap();
        let relocated = store.relocate(&reference.id, &moved).unwrap();
        assert!(relocated.starred);
        assert_eq!(
            relocated.root_path,
            moved.canonicalize().unwrap().display().to_string()
        );

        drop(store);
        let restored = RegistryStore::load(&app_data).unwrap();
        let [restored] = restored.list().try_into().unwrap();
        assert!(restored.starred);
        assert_eq!(restored.theme, "clay");
        assert!(restored.reachable);
    }
}
