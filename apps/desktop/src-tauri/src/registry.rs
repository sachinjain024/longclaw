use std::fs;
use std::path::{Path, PathBuf};

use parking_lot::RwLock;

use chrono::{SecondsFormat, Utc};

use crate::core::storage::{
    atomic_write, initialize_project, project_file_path, read_project, tickets_root,
    write_agent_contract,
};
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
                let projects = serde_json::from_slice(&bytes).map_err(|error| {
                    AppError::new(
                        ErrorCode::ParseFailed,
                        format!("Project registry is invalid and was left untouched: {error}"),
                        true,
                    )
                    .with_context("path", path.display().to_string())
                    .with_context("backupPath", backup_path.display().to_string())
                })?;
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
        write_agent_contract(root, &document)?;
        let mut project =
            ProjectReference::from_project(document.project(), current.root_path.clone());
        project.starred = current.starred;
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
        self.persist(&next)?;
        *projects = next;
        Ok(())
    }

    /// Updates the cached reference for a project that is already registered, or
    /// adds it. The project's own files remain the source of truth.
    pub fn remember(&self, project: &ProjectReference) -> AppResult<()> {
        let mut projects = self.projects.write();
        let mut next = projects.clone();
        let starred = next
            .iter()
            .find(|candidate| candidate.id == project.id)
            .is_some_and(|candidate| candidate.starred);
        let mut project = project.clone();
        project.starred = starred;
        next.retain(|candidate| candidate.id != project.id);
        next.push(project);
        next.sort_by(|left, right| left.name.cmp(&right.name));
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
    let mut current = ProjectReference::from_project(document.project(), project.root_path.clone());
    current.starred = project.starred;
    current
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
                labels: Default::default(),
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
