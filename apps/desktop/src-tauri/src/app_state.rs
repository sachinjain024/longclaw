use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use parking_lot::RwLock;

use crate::core::{AppResult, ProjectReference, ProjectSnapshot, StreamEnvelope};
use crate::engine::ProjectEngine;
use crate::registry::RegistryStore;

pub struct AppState {
    registry: RegistryStore,
    engines: RwLock<HashMap<String, Arc<ProjectEngine>>>,
}

impl AppState {
    pub fn new(app_data_dir: &Path) -> AppResult<Self> {
        Ok(Self {
            registry: RegistryStore::load(app_data_dir)?,
            engines: RwLock::new(HashMap::new()),
        })
    }

    pub fn list_projects(&self) -> Vec<ProjectReference> {
        self.registry.list()
    }

    pub fn register_project(&self, root: PathBuf) -> AppResult<ProjectReference> {
        self.registry.register(&root)
    }

    pub fn create_project(
        &self,
        root: PathBuf,
        name: &str,
        key: &str,
        theme: &str,
    ) -> AppResult<ProjectReference> {
        self.registry.create(&root, name, key, theme)
    }

    pub fn relocate_project(&self, project_id: &str, root: PathBuf) -> AppResult<ProjectReference> {
        let project = self.registry.relocate(project_id, &root)?;
        self.engines.write().remove(project_id);
        Ok(project)
    }

    pub fn set_project_starred(
        &self,
        project_id: &str,
        starred: bool,
    ) -> AppResult<ProjectReference> {
        self.registry.set_starred(project_id, starred)
    }

    pub fn update_project_theme(
        &self,
        project_id: &str,
        theme: &str,
    ) -> AppResult<ProjectReference> {
        let project = self.registry.update_theme(project_id, theme)?;
        self.engines.write().remove(project_id);
        Ok(project)
    }

    pub fn update_project_name(&self, project_id: &str, name: &str) -> AppResult<ProjectReference> {
        let project = self.registry.update_name(project_id, name)?;
        self.engines.write().remove(project_id);
        Ok(project)
    }

    pub fn remove_project(&self, project_id: &str) -> AppResult<()> {
        self.registry.remove(project_id)?;
        self.engines.write().remove(project_id);
        Ok(())
    }

    pub fn engine(
        &self,
        project_id: &str,
        sink: Arc<dyn Fn(StreamEnvelope) + Send + Sync + 'static>,
    ) -> AppResult<Arc<ProjectEngine>> {
        if let Some(engine) = self.engines.read().get(project_id).cloned() {
            return Ok(engine);
        }
        let project = self.registry.find(project_id)?;
        let engine = ProjectEngine::start(project, sink)?;
        self.engines
            .write()
            .insert(project_id.to_owned(), engine.clone());
        Ok(engine)
    }

    pub fn open_snapshot(
        &self,
        project_id: &str,
        sink: Arc<dyn Fn(StreamEnvelope) + Send + Sync + 'static>,
    ) -> AppResult<ProjectSnapshot> {
        Ok(self.engine(project_id, sink)?.snapshot())
    }
}
