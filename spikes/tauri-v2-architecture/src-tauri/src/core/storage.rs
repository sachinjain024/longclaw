use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::Utc;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::error::{AppError, AppResult, ErrorCode};
use super::model::{
    ActivityHeader, ActorSummary, ProjectDisk, ProjectReference, TicketFrontmatter, TicketRecord,
    TicketView,
};

const PROJECT_FORMAT: &str = "longclaw.project/v1";
const TICKET_FORMAT: &str = "longclaw.ticket/v1";

pub fn content_hash(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

pub fn parse_project(root: &Path) -> AppResult<ProjectReference> {
    let root = root
        .canonicalize()
        .map_err(|error| AppError::io("Canonicalizing project folder", root, error))?;
    let project_path = root.join(".longclaw/longclaw.yaml");
    let bytes = fs::read(&project_path)
        .map_err(|error| AppError::io("Reading project metadata", &project_path, error))?;
    let disk: ProjectDisk = serde_yaml::from_slice(&bytes).map_err(|error| {
        AppError::parse(
            &project_path,
            format!("Project metadata is not valid constrained YAML: {error}"),
        )
    })?;
    if disk.format != PROJECT_FORMAT {
        return Err(AppError::new(
            ErrorCode::UnsupportedVersion,
            format!("Expected {PROJECT_FORMAT}, found {}", disk.format),
            false,
        )
        .with_context("path", project_path.display().to_string()));
    }
    if disk.id.trim().is_empty() || disk.name.trim().is_empty() || disk.key.trim().is_empty() {
        return Err(AppError::new(
            ErrorCode::InvalidProject,
            "Project metadata requires non-empty id, name, and key",
            true,
        )
        .with_context("path", project_path.display().to_string()));
    }

    Ok(ProjectReference {
        id: disk.id,
        name: disk.name,
        root_path: root.display().to_string(),
        theme: disk.theme,
        reachable: true,
    })
}

fn split_frontmatter<'a>(raw: &'a str, path: &Path) -> AppResult<(&'a str, &'a str)> {
    let without_open = raw
        .strip_prefix("---\n")
        .ok_or_else(|| AppError::parse(path, "ticket.md must start with a YAML delimiter"))?;
    let close = without_open
        .find("\n---\n")
        .ok_or_else(|| AppError::parse(path, "ticket.md is missing its closing YAML delimiter"))?;
    Ok((&without_open[..close], &without_open[close + 5..]))
}

fn validate_ticket_format(frontmatter: &TicketFrontmatter, path: &Path) -> AppResult<()> {
    if frontmatter.format == TICKET_FORMAT {
        return Ok(());
    }
    let code = if frontmatter.format.starts_with("longclaw.ticket/v") {
        ErrorCode::UnsupportedVersion
    } else {
        ErrorCode::ParseFailed
    };
    Err(AppError::new(
        code,
        format!("Expected {TICKET_FORMAT}, found {}", frontmatter.format),
        code != ErrorCode::UnsupportedVersion,
    )
    .with_context("path", path.display().to_string()))
}

fn checklist_counts(body: &str) -> (usize, usize) {
    body.lines().fold((0, 0), |(checked, total), line| {
        let trimmed = line.trim_start();
        if trimmed.starts_with("- [x] ") || trimmed.starts_with("- [X] ") {
            (checked + 1, total + 1)
        } else if trimmed.starts_with("- [ ] ") {
            (checked, total + 1)
        } else {
            (checked, total)
        }
    })
}

fn last_actor(body: &str) -> Option<ActorSummary> {
    let marker = "<!-- longclaw:event\n";
    let start = body.rfind(marker)? + marker.len();
    let end = body[start..].find("\n-->")? + start;
    let activity: ActivityHeader = serde_yaml::from_str(&body[start..end]).ok()?;
    Some(ActorSummary {
        actor_type: activity.actor.actor_type,
        name: activity.actor.name.or(activity.actor.id),
    })
}

pub fn parse_ticket(path: &Path, project_root: &Path) -> AppResult<TicketRecord> {
    let bytes = fs::read(path).map_err(|error| AppError::io("Reading ticket", path, error))?;
    let raw = std::str::from_utf8(&bytes)
        .map_err(|error| AppError::parse(path, format!("ticket.md is not UTF-8: {error}")))?;
    let (frontmatter_raw, body) = split_frontmatter(raw, path)?;
    let frontmatter: TicketFrontmatter =
        serde_yaml::from_str(frontmatter_raw).map_err(|error| {
            AppError::parse(
                path,
                format!("Ticket frontmatter is not valid constrained YAML: {error}"),
            )
        })?;
    validate_ticket_format(&frontmatter, path)?;
    let (checked_count, checklist_count) = checklist_counts(body);
    let relative_path = path
        .strip_prefix(project_root)
        .unwrap_or(path)
        .display()
        .to_string();

    Ok(TicketRecord {
        absolute_path: path.to_path_buf(),
        view: TicketView {
            key: frontmatter.key,
            title: frontmatter.title,
            status: frontmatter.status,
            checked_count,
            checklist_count,
            content_hash: content_hash(&bytes),
            relative_path,
            degraded: false,
            diagnostic: None,
            last_actor: last_actor(body),
        },
    })
}

pub fn degraded_ticket(path: &Path, project_root: &Path, error: &AppError) -> TicketRecord {
    let bytes = fs::read(path).unwrap_or_default();
    let key = path
        .parent()
        .and_then(Path::file_name)
        .and_then(|value| value.to_str())
        .unwrap_or("UNKNOWN")
        .to_owned();
    TicketRecord {
        absolute_path: path.to_path_buf(),
        view: TicketView {
            key,
            title: "Unable to parse ticket.md".to_owned(),
            status: "degraded".to_owned(),
            checked_count: 0,
            checklist_count: 0,
            content_hash: content_hash(&bytes),
            relative_path: path
                .strip_prefix(project_root)
                .unwrap_or(path)
                .display()
                .to_string(),
            degraded: true,
            diagnostic: Some(error.message.clone()),
            last_actor: None,
        },
    }
}

fn valid_ticket_key(key: &str) -> bool {
    let mut parts = key.split('-');
    let Some(prefix) = parts.next() else {
        return false;
    };
    let Some(sequence) = parts.next() else {
        return false;
    };
    parts.next().is_none()
        && !prefix.is_empty()
        && prefix
            .bytes()
            .all(|byte| byte.is_ascii_uppercase() || byte.is_ascii_digit())
        && !sequence.is_empty()
        && sequence.bytes().all(|byte| byte.is_ascii_digit())
        && !sequence.starts_with('0')
}

pub fn resolve_ticket_path(project_root: &Path, key: &str) -> AppResult<PathBuf> {
    if !valid_ticket_key(key) {
        return Err(AppError::new(
            ErrorCode::PermissionDenied,
            "Ticket key is outside the allowed key grammar",
            false,
        )
        .with_context("ticketKey", key.to_owned()));
    }
    let canonical_root = project_root
        .canonicalize()
        .map_err(|error| AppError::io("Canonicalizing project folder", project_root, error))?;
    let tickets_root = canonical_root.join(".longclaw/tickets");
    let canonical_tickets = tickets_root
        .canonicalize()
        .map_err(|error| AppError::io("Canonicalizing tickets folder", &tickets_root, error))?;
    let requested = canonical_tickets.join(key).join("ticket.md");
    let canonical_ticket = requested.canonicalize().map_err(|error| {
        let code = if error.kind() == std::io::ErrorKind::NotFound {
            ErrorCode::TicketNotFound
        } else {
            ErrorCode::Io
        };
        AppError::new(
            code,
            format!("Ticket {key} is not available: {error}"),
            true,
        )
        .with_context("ticketKey", key.to_owned())
    })?;
    if !canonical_ticket.starts_with(&canonical_tickets) || !canonical_ticket.is_file() {
        return Err(AppError::new(
            ErrorCode::PermissionDenied,
            "Resolved ticket path escapes the selected project",
            false,
        )
        .with_context("ticketKey", key.to_owned()));
    }
    Ok(canonical_ticket)
}

fn replace_top_level_scalar(
    frontmatter: &str,
    key: &str,
    encoded_value: &str,
) -> AppResult<String> {
    let prefix = format!("{key}:");
    let mut found = false;
    let mut output = Vec::new();
    for line in frontmatter.lines() {
        if line.starts_with(&prefix) {
            if found {
                return Err(AppError::new(
                    ErrorCode::ParseFailed,
                    format!("Duplicate top-level key: {key}"),
                    true,
                ));
            }
            found = true;
            output.push(format!("{key}: {encoded_value}"));
        } else {
            output.push(line.to_owned());
        }
    }
    if !found {
        return Err(AppError::new(
            ErrorCode::ParseFailed,
            format!("Required top-level key is missing: {key}"),
            true,
        ));
    }
    Ok(output.join("\n"))
}

fn append_activity(body: &str, title: &str) -> String {
    let mut output = body.trim_end_matches('\n').to_owned();
    if !body.lines().any(|line| line == "## Activity") {
        output.push_str("\n\n## Activity");
    }
    let now = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let event_id = format!("evt_{}", Uuid::new_v4().simple());
    output.push_str(&format!(
        "\n\n<!-- longclaw:event\nid: {event_id}\nkind: update\noccurred_at: {now}\nactor:\n  type: human\n  id: longclaw-spike\n  name: LongClaw spike UI\nchanges:\n  - field: title\n    to: {}\n-->\n### LongClaw spike UI updated this ticket\n\nChanged the title through the atomic-write architecture proof.\n<!-- /longclaw:event -->\n",
        serde_json::to_string(title).expect("serializing a string cannot fail")
    ));
    output
}

pub fn patch_ticket_title(
    project_root: &Path,
    key: &str,
    title: &str,
    expected_hash: &str,
) -> AppResult<(PathBuf, Vec<u8>)> {
    if title.trim().is_empty() || title.chars().count() > 300 || title.contains('\n') {
        return Err(AppError::new(
            ErrorCode::ParseFailed,
            "Title must be a single non-empty line of at most 300 characters",
            true,
        ));
    }
    let path = resolve_ticket_path(project_root, key)?;
    let current = fs::read(&path)
        .map_err(|error| AppError::io("Reading ticket before save", &path, error))?;
    let actual_hash = content_hash(&current);
    if actual_hash != expected_hash {
        return Err(AppError::new(
            ErrorCode::Conflict,
            "Changed on disk while you were editing. Reload before saving.",
            true,
        )
        .with_context("expectedHash", expected_hash.to_owned())
        .with_context("actualHash", actual_hash));
    }
    let raw = std::str::from_utf8(&current)
        .map_err(|error| AppError::parse(&path, format!("ticket.md is not UTF-8: {error}")))?;
    let (frontmatter, body) = split_frontmatter(raw, &path)?;
    let encoded_title = serde_json::to_string(title)
        .map_err(|error| AppError::new(ErrorCode::Internal, error.to_string(), false))?;
    let updated = replace_top_level_scalar(frontmatter, "title", &encoded_title)?;
    let encoded_now =
        serde_json::to_string(&Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            .map_err(|error| AppError::new(ErrorCode::Internal, error.to_string(), false))?;
    let updated = replace_top_level_scalar(&updated, "updated_at", &encoded_now)?;
    let updated_body = append_activity(body, title);
    let next = format!("---\n{updated}\n---\n{updated_body}").into_bytes();

    // Refuse to commit any output the current parser cannot ingest.
    let raw_next = std::str::from_utf8(&next)
        .map_err(|error| AppError::parse(&path, format!("Generated invalid UTF-8: {error}")))?;
    let (next_frontmatter, _) = split_frontmatter(raw_next, &path)?;
    let parsed: TicketFrontmatter = serde_yaml::from_str(next_frontmatter).map_err(|error| {
        AppError::parse(&path, format!("Generated invalid frontmatter: {error}"))
    })?;
    validate_ticket_format(&parsed, &path)?;
    Ok((path, next))
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let parent = path.parent().ok_or_else(|| {
        AppError::new(
            ErrorCode::PermissionDenied,
            "Atomic writes require a sibling temporary file",
            false,
        )
    })?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("ticket.md");
    let temporary = parent.join(format!(".{name}.longclaw-{}.tmp", Uuid::new_v4()));
    let result = (|| -> AppResult<()> {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)
            .map_err(|error| AppError::io("Creating sibling temporary file", &temporary, error))?;
        file.write_all(bytes)
            .map_err(|error| AppError::io("Writing sibling temporary file", &temporary, error))?;
        file.sync_all()
            .map_err(|error| AppError::io("Syncing sibling temporary file", &temporary, error))?;
        if let Ok(metadata) = fs::metadata(path) {
            fs::set_permissions(&temporary, metadata.permissions()).map_err(|error| {
                AppError::io("Preserving ticket permissions", &temporary, error)
            })?;
        }
        fs::rename(&temporary, path)
            .map_err(|error| AppError::io("Atomically replacing ticket", path, error))?;
        File::open(parent)
            .and_then(|directory| directory.sync_all())
            .map_err(|error| AppError::io("Syncing ticket directory", parent, error))?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{resolve_ticket_path, valid_ticket_key};
    use crate::core::ErrorCode;

    #[test]
    fn ticket_key_grammar_rejects_path_shaped_inputs() {
        assert!(valid_ticket_key("LC-42"));
        assert!(!valid_ticket_key("../LC-42"));
        assert!(!valid_ticket_key("LC/42"));
        assert!(!valid_ticket_key("lc-42"));
        assert!(!valid_ticket_key("LC-0"));
    }

    #[cfg(unix)]
    #[test]
    fn canonical_scope_rejects_a_ticket_symlink_that_escapes_the_project() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let project = temp.path().join("project");
        let tickets = project.join(".longclaw/tickets");
        let outside = temp.path().join("outside");
        fs::create_dir_all(&tickets).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("ticket.md"), "not in the project").unwrap();
        symlink(&outside, tickets.join("LC-1")).unwrap();

        let error = resolve_ticket_path(&project, "LC-1").unwrap_err();
        assert_eq!(error.code, ErrorCode::PermissionDenied);
        assert!(outside.join("ticket.md").is_file());
    }
}
