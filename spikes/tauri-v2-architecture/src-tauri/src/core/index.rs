use std::collections::HashMap;
use std::path::Path;
use std::time::Instant;

use parking_lot::RwLock;
use walkdir::WalkDir;

use super::error::{AppError, AppResult, ErrorCode};
use super::model::{IndexSnapshot, SearchResult, TicketRecord, TicketView};
use super::storage::{degraded_ticket, parse_ticket};

#[derive(Default)]
struct IndexState {
    records: HashMap<String, TicketRecord>,
    generation: u64,
}

#[derive(Default)]
pub struct TicketIndex {
    state: RwLock<IndexState>,
}

impl TicketIndex {
    pub fn rebuild(&self, project_root: &Path) -> AppResult<IndexSnapshot> {
        let started = Instant::now();
        let tickets_root = project_root.join(".longclaw/tickets");
        if !tickets_root.is_dir() {
            return Err(AppError::new(
                ErrorCode::InvalidProject,
                "Project is missing .longclaw/tickets",
                true,
            )
            .with_context("path", tickets_root.display().to_string()));
        }

        let mut records = HashMap::new();
        for entry in WalkDir::new(&tickets_root)
            .min_depth(2)
            .max_depth(2)
            .follow_links(false)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_file() && entry.file_name() == "ticket.md")
        {
            let path = entry.path();
            let record = match parse_ticket(path, project_root) {
                Ok(ticket) => ticket,
                Err(error) => degraded_ticket(path, project_root, &error),
            };
            records.insert(record.view.key.clone(), record);
        }

        let mut state = self.state.write();
        state.records = records;
        state.generation += 1;
        Ok(IndexSnapshot {
            tickets: sorted_views(state.records.values()),
            generation: state.generation,
            rebuilt_in_ms: started.elapsed().as_secs_f64() * 1_000.0,
        })
    }

    pub fn clear(&self) {
        self.state.write().records.clear();
    }

    pub fn ingest(&self, path: &Path, project_root: &Path) -> AppResult<TicketView> {
        let record = match parse_ticket(path, project_root) {
            Ok(ticket) => ticket,
            Err(error) => degraded_ticket(path, project_root, &error),
        };
        let view = record.view.clone();
        let mut state = self.state.write();
        state.records.insert(view.key.clone(), record);
        state.generation += 1;
        Ok(view)
    }

    pub fn remove_path(&self, path: &Path) -> Option<String> {
        let mut state = self.state.write();
        let key = state
            .records
            .iter()
            .find(|(_, record)| record.absolute_path == path)
            .map(|(key, _)| key.clone())?;
        state.records.remove(&key);
        state.generation += 1;
        Some(key)
    }

    pub fn snapshot(&self) -> IndexSnapshot {
        let state = self.state.read();
        IndexSnapshot {
            tickets: sorted_views(state.records.values()),
            generation: state.generation,
            rebuilt_in_ms: 0.0,
        }
    }

    pub fn search(&self, query: &str) -> SearchResult {
        let started = Instant::now();
        let needle = query.to_lowercase();
        let state = self.state.read();
        let mut tickets = state
            .records
            .values()
            .filter(|record| {
                needle.is_empty()
                    || record.view.key.to_lowercase().contains(&needle)
                    || record.view.title.to_lowercase().contains(&needle)
            })
            .map(|record| record.view.clone())
            .collect::<Vec<_>>();
        tickets.sort_by(|left, right| left.key.cmp(&right.key));
        tickets.truncate(100);
        SearchResult {
            tickets,
            elapsed_ms: started.elapsed().as_secs_f64() * 1_000.0,
        }
    }
}

fn sorted_views<'a>(records: impl Iterator<Item = &'a TicketRecord>) -> Vec<TicketView> {
    let mut tickets = records
        .map(|record| record.view.clone())
        .collect::<Vec<_>>();
    tickets.sort_by(|left, right| left.key.cmp(&right.key));
    tickets
}
