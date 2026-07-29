use std::fs;
use std::path::{Path, PathBuf};

use parking_lot::RwLock;

use crate::core::storage::{atomic_write, parse_project};
use crate::core::{AppError, AppResult, ErrorCode, ProjectReference};

pub struct RegistryStore {
    path: PathBuf,
    projects: RwLock<Vec<ProjectReference>>,
}

impl RegistryStore {
    pub fn load(app_data_dir: &Path) -> AppResult<Self> {
        fs::create_dir_all(app_data_dir).map_err(|error| {
            AppError::io("Creating application support folder", app_data_dir, error)
        })?;
        let path = app_data_dir.join("project-registry.json");
        let projects = match fs::read(&path) {
            Ok(bytes) => serde_json::from_slice(&bytes).map_err(|error| {
                AppError::new(
                    ErrorCode::ParseFailed,
                    format!("Project registry is invalid and was left untouched: {error}"),
                    true,
                )
                .with_context("path", path.display().to_string())
            })?,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Vec::new(),
            Err(error) => return Err(AppError::io("Reading project registry", &path, error)),
        };
        Ok(Self {
            path,
            projects: RwLock::new(projects),
        })
    }

    pub fn list(&self) -> Vec<ProjectReference> {
        self.projects
            .read()
            .iter()
            .cloned()
            .map(|mut project| {
                project.reachable = Path::new(&project.root_path)
                    .join(".longclaw/longclaw.yaml")
                    .is_file();
                project
            })
            .collect()
    }

    pub fn find(&self, project_id: &str) -> AppResult<ProjectReference> {
        self.projects
            .read()
            .iter()
            .find(|project| project.id == project_id)
            .cloned()
            .ok_or_else(|| {
                AppError::new(
                    ErrorCode::InvalidProject,
                    format!("Unknown project id: {project_id}"),
                    true,
                )
            })
    }

    pub fn register(&self, root: &Path) -> AppResult<ProjectReference> {
        let project = parse_project(root)?;
        let mut projects = self.projects.write();
        let mut next = projects.clone();
        next.retain(|candidate| candidate.id != project.id);
        next.push(project.clone());
        next.sort_by(|left, right| left.name.cmp(&right.name));
        self.persist(&next)?;
        *projects = next;
        Ok(project)
    }

    fn persist(&self, projects: &[ProjectReference]) -> AppResult<()> {
        let bytes = serde_json::to_vec_pretty(projects).map_err(|error| {
            AppError::new(
                ErrorCode::Internal,
                format!("Serializing project registry failed: {error}"),
                false,
            )
        })?;
        atomic_write(&self.path, &bytes)
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::RegistryStore;

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
        assert!(projects[0].reachable);

        let moved = temp.path().join("project-moved");
        fs::rename(&project, &moved).unwrap();
        let missing = restored.list();
        assert_eq!(missing.len(), 1);
        assert!(!missing[0].reachable);
        assert_eq!(missing[0].root_path, registered_path);
        assert!(moved.join(".longclaw/longclaw.yaml").is_file());
    }
}
