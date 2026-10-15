//! LC-206's core: attaching a file to a ticket, taking it off, putting it back,
//! and pointing a ticket at a doc it does not own.
//!
//! Every case drives the operation a caller uses against a real project folder
//! and asserts what a reader of that folder would see — the bytes under
//! `attachments/`, the text of `ticket.md`, and what the detail read reports.

mod common;

use std::fs;
use std::path::PathBuf;

use common::new_project;
use longclaw_desktop_lib::core::attachments::{self, PreparedAttachment};
use longclaw_desktop_lib::core::storage::{self, NewTicket};
use longclaw_desktop_lib::core::ticket::{Actor, AttachmentRestore, ReferenceRestore, TicketEdit};
use longclaw_desktop_lib::core::{AppError, ErrorCode, TicketDetail, TicketWrite};

const NOW: &str = "2026-10-15T10:00:00Z";
const LATER: &str = "2026-10-15T10:05:00Z";

/// The eight bytes every PNG opens with, then enough of a header to be one.
const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\0\x01\0\0\0\x01\x08\x06\0\0\0";
/// An ISO media file whose brand says MP4.
const MP4: &[u8] = b"\0\0\0\x18ftypisom\0\0\x02\0isomiso2mp41";
const PDF: &[u8] = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n";

struct Project {
    _temp: tempfile::TempDir,
    root: PathBuf,
    key: String,
}

impl Project {
    fn new() -> Self {
        let (temp, root) = new_project("attachments", "AT");
        let write = storage::prepare_new_ticket(
            &root,
            "AT",
            &NewTicket {
                title: "Something to attach to".to_owned(),
                description: "Plain words.".to_owned(),
                ..NewTicket::default()
            },
            NOW,
        )
        .expect("the ticket should be prepared");
        storage::atomic_write("Creating a ticket", &write.path, &write.bytes)
            .expect("the ticket should be written");
        Self {
            _temp: temp,
            root,
            key: write.key,
        }
    }

    fn detail(&self) -> TicketDetail {
        storage::read_ticket_detail(&self.root, "AT", &self.key).expect("the ticket reads")
    }

    fn ticket_dir(&self) -> PathBuf {
        self.root.join(".longclaw/tickets").join(&self.key)
    }

    fn raw(&self) -> String {
        fs::read_to_string(self.ticket_dir().join("ticket.md")).expect("ticket.md")
    }

    /// What is under `attachments/`, by name.
    fn files(&self) -> Vec<String> {
        let mut names: Vec<String> = match fs::read_dir(self.ticket_dir().join("attachments")) {
            Ok(entries) => entries
                .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
                .collect(),
            Err(_) => Vec::new(),
        };
        names.sort();
        names
    }

    fn attach(&self, bytes: &[u8], name: &str) -> Result<PreparedAttachment, AppError> {
        attachments::prepare_attachment(
            &self.root,
            "AT",
            &self.key,
            bytes,
            name,
            &self.detail().content_hash,
            NOW,
            &Actor::local_human(),
        )
    }

    /// Attaches and registers, the way a caller does: the bytes are placed by
    /// the prepare, and the caller writes `ticket.md`.
    fn attached(&self, bytes: &[u8], name: &str) -> PreparedAttachment {
        let prepared = self
            .attach(bytes, name)
            .expect("the attach should be accepted");
        commit(&prepared.write);
        prepared
    }

    fn edit(&self, edit: TicketEdit) -> Result<TicketWrite, AppError> {
        storage::prepare_ticket_edit_as(
            &self.root,
            "AT",
            &self.key,
            &edit,
            &self.detail().content_hash,
            LATER,
            &Actor::local_human(),
        )
    }

    fn edited(&self, edit: TicketEdit) {
        commit(&self.edit(edit).expect("the edit should be accepted"));
    }

    fn reattach(&self, file: &str) -> Result<PreparedAttachment, AppError> {
        attachments::prepare_reattachment(
            &self.root,
            "AT",
            &self.key,
            file,
            &self.detail().content_hash,
            LATER,
            &Actor::agent("claude-code", Some("Claude Code")),
        )
    }
}

fn commit(write: &TicketWrite) {
    storage::atomic_replace(
        &write.path,
        &write.bytes,
        write
            .expected_hash
            .as_deref()
            .expect("an edit has a predecessor"),
    )
    .expect("ticket.md should be written");
}

fn registered(detail: &TicketDetail) -> Vec<(String, String, String, u64)> {
    detail
        .ticket
        .as_ref()
        .expect("the ticket parses")
        .attachments
        .iter()
        .map(|attachment| {
            (
                attachment.file.clone(),
                attachment.name.clone(),
                attachment.media_type.clone(),
                attachment.size,
            )
        })
        .collect()
}

// ---------------------------------------------------------------- attaching

#[test]
fn an_image_a_text_and_a_video_each_register_with_the_type_their_bytes_have() {
    let project = Project::new();
    let image = project.attached(PNG, "Failure state.png");
    let text = project.attached(b"line one\nline two\n", "debug log.txt");
    let video = project.attached(MP4, "Repro (take 2).mp4");

    for (prepared, media_type, stem) in [
        (&image, "image/png", "failure-state.png"),
        (&text, "text/plain", "debug-log.txt"),
        (&video, "video/mp4", "repro-take-2.mp4"),
    ] {
        let attachment = &prepared.attachment;
        assert!(attachment.id.starts_with("att_"), "{}", attachment.id);
        assert_eq!(attachment.media_type, media_type);
        assert_eq!(
            attachment.file,
            format!("attachments/{}-{stem}", attachment.id)
        );
        assert_eq!(attachment.added_at, NOW);
        assert_eq!(attachment.added_by, Actor::local_human());
    }
    let detail = project.detail();
    assert_eq!(
        registered(&detail),
        vec![
            (
                image.attachment.file.clone(),
                "Failure state.png".to_owned(),
                "image/png".to_owned(),
                PNG.len() as u64
            ),
            (
                text.attachment.file.clone(),
                "debug log.txt".to_owned(),
                "text/plain".to_owned(),
                18
            ),
            (
                video.attachment.file.clone(),
                "Repro (take 2).mp4".to_owned(),
                "video/mp4".to_owned(),
                MP4.len() as u64
            ),
        ]
    );
    // The bytes are the bytes, under the name the record gives them.
    let on_disk = fs::read(project.ticket_dir().join(&image.attachment.file)).unwrap();
    assert_eq!(on_disk, PNG);
    assert!(detail.missing_attachments.is_empty());
    assert!(detail.orphan_attachments.is_empty());
    // The link a person reading the file follows.
    assert!(project
        .raw()
        .contains(&format!("[Failure state.png](./{})", image.attachment.file)));
    // And the link the caller pastes, which is the same one.
    assert_eq!(
        image.markdown_link,
        format!("[Failure state.png](./{})", image.attachment.file)
    );
    assert_eq!(
        text.markdown_link,
        format!("[debug log.txt](./{})", text.attachment.file)
    );
}

#[test]
fn a_mislabelled_file_is_judged_by_its_content() {
    let project = Project::new();
    let picture = project.attached(PNG, "notes.txt");
    assert_eq!(picture.attachment.media_type, "image/png");
    let words = project.attached(b"# Not a picture\n", "photo.png");
    assert_eq!(words.attachment.media_type, "text/plain");
    // The extension still says which kind of text it is when the bytes are text.
    let markdown = project.attached(b"# Heading\n\nProse.\n", "README.md");
    assert_eq!(markdown.attachment.media_type, "text/markdown");
    let svg = project.attached(
        b"<?xml version=\"1.0\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n",
        "diagram.txt",
    );
    assert_eq!(svg.attachment.media_type, "image/svg+xml");
}

#[test]
fn a_file_over_the_limit_is_refused_and_leaves_nothing_behind() {
    let project = Project::new();
    let before = project.raw();
    let mut big = PNG.to_vec();
    big.resize(10_000_001, 0);
    let error = project
        .attach(&big, "huge.png")
        .expect_err("over the limit");
    assert_eq!(error.code, ErrorCode::TooLarge);
    assert!(error.recoverable);
    assert!(error.message.contains("huge.png"), "{}", error.message);
    assert!(error.message.contains("10 MB"), "{}", error.message);
    assert_eq!(project.raw(), before);
    assert!(project.files().is_empty());

    // Exactly at the limit is inside it.
    let mut edge = b"a".repeat(10_000_000);
    edge[0] = b'b';
    project.attached(&edge, "edge.txt");
}

#[test]
fn an_unsupported_type_is_refused_and_leaves_nothing_behind() {
    let project = Project::new();
    let before = project.raw();
    for (bytes, name) in [
        (PDF, "spec.pdf"),
        (&b"PK\x03\x04\x14\0\0\0"[..], "bundle.zip"),
        (&b"\0\x01\x02binary\0"[..], "blob.txt"),
    ] {
        let error = project
            .attach(bytes, name)
            .expect_err("not image, text or video");
        assert_eq!(error.code, ErrorCode::UnsupportedMediaType, "{name}");
        assert!(error.recoverable);
        assert!(error.message.contains(name), "{}", error.message);
    }
    assert_eq!(project.raw(), before);
    assert!(project.files().is_empty());
}

#[test]
fn a_stale_hash_is_refused_and_leaves_nothing_behind() {
    let project = Project::new();
    let stale = project.detail().content_hash;
    project.edited(TicketEdit {
        title: Some("Changed underneath".to_owned()),
        ..TicketEdit::default()
    });
    let before = project.raw();
    let error = attachments::prepare_attachment(
        &project.root,
        "AT",
        &project.key,
        PNG,
        "late.png",
        &stale,
        NOW,
        &Actor::local_human(),
    )
    .expect_err("a stale attach");
    assert_eq!(error.code, ErrorCode::Conflict);
    assert_eq!(project.raw(), before);
    assert!(project.files().is_empty());
}

#[test]
fn an_interrupted_registration_leaves_an_orphan_and_never_a_dangling_record() {
    let project = Project::new();
    // The bytes are placed and `ticket.md` is never written: the crash between
    // the two steps the format orders.
    let prepared = project.attach(PNG, "half.png").expect("prepared");
    let detail = project.detail();
    assert!(registered(&detail).is_empty());
    assert!(detail.missing_attachments.is_empty());
    assert_eq!(detail.orphan_attachments, vec![prepared.attachment.file]);
}

#[test]
fn a_name_is_sanitized_for_the_disk_and_kept_for_the_reader() {
    let project = Project::new();
    for (name, stem) in [
        ("../../escape.txt", "escape.txt"),
        ("/etc/passwd", "passwd"),
        ("Ünïcode name!.TXT", "n-code-name.txt"),
        ("", "file"),
        ("...", "file"),
    ] {
        let prepared = project.attached(b"text\n", name);
        let id = &prepared.attachment.id;
        assert_eq!(
            prepared.attachment.file,
            format!("attachments/{id}-{stem}"),
            "{name:?}"
        );
    }
    let names: Vec<String> = registered(&project.detail())
        .into_iter()
        .map(|(_, name, _, _)| name)
        .collect();
    // What the reader sees is the name they chose, cut to its last segment.
    assert_eq!(
        names,
        ["escape.txt", "passwd", "Ünïcode name!.TXT", "file", "..."]
    );
    assert_eq!(project.files().len(), 5);
}

// ------------------------------------------------- removal, restore, re-attach

#[test]
fn removal_unregisters_and_leaves_the_bytes_as_an_orphan() {
    let project = Project::new();
    let first = project.attached(PNG, "first.png");
    let second = project.attached(b"second\n", "second.txt");
    project.edited(TicketEdit {
        remove_attachment: Some(first.attachment.id.clone()),
        ..TicketEdit::default()
    });
    let detail = project.detail();
    assert_eq!(registered(&detail).len(), 1);
    assert_eq!(registered(&detail)[0].0, second.attachment.file);
    assert_eq!(
        detail.orphan_attachments,
        vec![first.attachment.file.clone()]
    );
    assert_eq!(
        fs::read(project.ticket_dir().join(&first.attachment.file)).unwrap(),
        PNG
    );
}

#[test]
fn a_restore_puts_the_record_back_where_it_was() {
    let project = Project::new();
    let first = project.attached(PNG, "first.png");
    project.attached(b"second\n", "second.txt");
    project.edited(TicketEdit {
        remove_attachment: Some(first.attachment.id.clone()),
        ..TicketEdit::default()
    });
    project.edited(TicketEdit {
        restore_attachment: Some(AttachmentRestore {
            id: first.attachment.id.clone(),
            file: first.attachment.file.clone(),
            name: first.attachment.name.clone(),
            added_at: first.attachment.added_at.clone(),
            added_by: first.attachment.added_by.clone(),
            after: None,
        }),
        ..TicketEdit::default()
    });
    let detail = project.detail();
    let ticket = detail.ticket.as_ref().unwrap();
    assert_eq!(ticket.attachments[0], first.attachment);
    assert_eq!(ticket.attachments.len(), 2);
    assert!(detail.orphan_attachments.is_empty());
}

#[test]
fn a_restore_reads_the_file_again_rather_than_trusting_the_request() {
    let project = Project::new();
    let first = project.attached(PNG, "first.png");
    project.edited(TicketEdit {
        remove_attachment: Some(first.attachment.id.clone()),
        ..TicketEdit::default()
    });
    // Somebody replaced the orphan with something the app does not attach.
    fs::write(project.ticket_dir().join(&first.attachment.file), PDF).unwrap();
    let error = project
        .edit(TicketEdit {
            restore_attachment: Some(AttachmentRestore {
                id: first.attachment.id.clone(),
                file: first.attachment.file.clone(),
                name: first.attachment.name.clone(),
                added_at: first.attachment.added_at.clone(),
                added_by: first.attachment.added_by.clone(),
                after: None,
            }),
            ..TicketEdit::default()
        })
        .expect_err("the file is no longer what was attached");
    assert_eq!(error.code, ErrorCode::UnsupportedMediaType);
    // And one that is gone cannot be restored at all.
    fs::remove_file(project.ticket_dir().join(&first.attachment.file)).unwrap();
    let error = project
        .edit(TicketEdit {
            restore_attachment: Some(AttachmentRestore {
                id: first.attachment.id.clone(),
                file: first.attachment.file.clone(),
                name: first.attachment.name.clone(),
                added_at: first.attachment.added_at.clone(),
                added_by: first.attachment.added_by.clone(),
                after: None,
            }),
            ..TicketEdit::default()
        })
        .expect_err("nothing to restore");
    assert_eq!(error.code, ErrorCode::NotFound);
}

#[test]
fn an_orphan_is_reattached_in_place_without_a_copy() {
    let project = Project::new();
    let first = project.attached(PNG, "first.png");
    project.edited(TicketEdit {
        remove_attachment: Some(first.attachment.id.clone()),
        ..TicketEdit::default()
    });
    let again = project
        .reattach(&first.attachment.file)
        .expect("an orphan can be reattached");
    commit(&again.write);
    // Its own id and name come back off the file name; who and when are now.
    assert_eq!(again.attachment.id, first.attachment.id);
    assert_eq!(again.attachment.name, "first.png");
    assert_eq!(again.attachment.file, first.attachment.file);
    assert_eq!(again.attachment.media_type, "image/png");
    assert_eq!(again.attachment.added_at, LATER);
    assert_eq!(
        again.attachment.added_by,
        Actor::agent("claude-code", Some("Claude Code"))
    );
    assert_eq!(project.files().len(), 1, "nothing was copied");
    // The activity says which it was, so the timeline can say _re-attached_.
    assert!(again
        .write
        .changes
        .iter()
        .any(|change| change.field == format!("attachments.{}.reattached", first.attachment.id)));

    // A stray file somebody dropped in by hand takes a fresh id and keeps its
    // name, because there is no id in it to recover.
    fs::write(
        project.ticket_dir().join("attachments/stray notes.md"),
        "# hi\n",
    )
    .unwrap();
    let stray = project
        .reattach("attachments/stray notes.md")
        .expect("a stray can be attached");
    commit(&stray.write);
    assert!(stray.attachment.id.starts_with("att_"));
    assert_eq!(stray.attachment.name, "stray notes.md");
    assert_eq!(stray.attachment.file, "attachments/stray notes.md");
    assert_eq!(stray.attachment.media_type, "text/markdown");
    assert!(project.detail().orphan_attachments.is_empty());
}

#[test]
fn reattaching_a_registered_file_is_refused() {
    let project = Project::new();
    let first = project.attached(PNG, "first.png");
    let error = project
        .reattach(&first.attachment.file)
        .expect_err("already registered");
    assert_eq!(error.code, ErrorCode::ParseFailed);
}

#[test]
fn containment_refuses_every_way_out_of_the_attachments_folder() {
    let project = Project::new();
    project.attached(PNG, "inside.png");
    let outside = project.root.join("outside.txt");
    fs::write(&outside, "secret\n").unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(&outside, project.ticket_dir().join("attachments/link.txt"))
        .unwrap();

    for file in [
        "../ticket.md",
        "attachments/../ticket.md",
        "attachments/../../../outside.txt",
        "/etc/hosts",
        "ticket.md",
        "attachments/",
        "attachments/sub/inner.txt",
        "attachments/link.txt",
    ] {
        // Every one of these is a way out, so every one is refused as one —
        // never as a file that merely is not there.
        let error = project.reattach(file).expect_err(file);
        assert_eq!(
            error.code,
            ErrorCode::PermissionDenied,
            "{file}: {}",
            error.message
        );
        let error = project
            .edit(TicketEdit {
                restore_attachment: Some(AttachmentRestore {
                    id: "att_feedface".to_owned(),
                    file: file.to_owned(),
                    name: "x".to_owned(),
                    added_at: NOW.to_owned(),
                    added_by: Actor::local_human(),
                    after: None,
                }),
                ..TicketEdit::default()
            })
            .expect_err(file);
        assert_eq!(error.code, ErrorCode::PermissionDenied, "{file}");
    }
    assert_eq!(fs::read_to_string(&outside).unwrap(), "secret\n");
}

#[cfg(unix)]
#[test]
fn an_attachments_folder_that_leaves_the_ticket_is_never_written_into() {
    let project = Project::new();
    let elsewhere = project.root.join("elsewhere");
    fs::create_dir_all(&elsewhere).unwrap();
    std::os::unix::fs::symlink(&elsewhere, project.ticket_dir().join("attachments")).unwrap();
    let error = project
        .attach(PNG, "x.png")
        .expect_err("the folder escapes");
    assert_eq!(error.code, ErrorCode::PermissionDenied);
    assert_eq!(fs::read_dir(&elsewhere).unwrap().count(), 0);
}

#[test]
fn records_the_app_does_not_understand_survive_an_attach() {
    let project = Project::new();
    let opaque = concat!(
        "\n## Attachments\n",
        "\n",
        "<!-- longclaw:attachment\n",
        "id: att_1002\n",
        "file: attachments/att_1002-trace.lcarchive\n",
        "name: trace.lcarchive\n",
        "media_type: application/x-longclaw-archive\n",
        "size: 8\n",
        "added_at: 2026-07-30T08:02:00Z\n",
        "added_by:\n",
        "  type: agent\n",
        "  id: claude-code\n",
        "checksum: sha256:0f4a\n",
        "-->\n",
        "[trace.lcarchive](./attachments/att_1002-trace.lcarchive)\n",
        "\n",
        "Captured by a tool this build has never heard of.\n",
        "<!-- /longclaw:attachment -->\n",
    );
    let raw = project
        .raw()
        .replacen("\n## Activity\n", &format!("{opaque}\n## Activity\n"), 1);
    fs::write(project.ticket_dir().join("ticket.md"), raw).unwrap();
    project.attached(PNG, "new.png");
    assert!(project.raw().contains(opaque.trim_start()));
}

// --------------------------------------------------------------- references

fn add_reference(project: &Project, path: &str) -> Result<TicketWrite, AppError> {
    project.edit(TicketEdit {
        add_reference: Some(path.to_owned()),
        ..TicketEdit::default()
    })
}

fn references(detail: &TicketDetail) -> Vec<String> {
    detail
        .ticket
        .as_ref()
        .unwrap()
        .references
        .iter()
        .map(|reference| reference.path.clone())
        .collect()
}

#[test]
fn a_path_inside_the_project_is_stored_relative_and_one_outside_absolute() {
    let project = Project::new();
    let spec = project.root.join("docs/specs/AT-1-spec.md");
    fs::create_dir_all(spec.parent().unwrap()).unwrap();
    fs::write(&spec, "# Spec\n").unwrap();
    let outside_dir = tempfile::tempdir().unwrap();
    let outside = outside_dir.path().join("flows v2.txt");
    fs::write(&outside, "flows\n").unwrap();
    let outside = outside.canonicalize().unwrap();

    // Absolute, relative to the project, and relative with a detour: all three
    // name the same file and are stored the same way.
    commit(&add_reference(&project, spec.to_str().unwrap()).unwrap());
    commit(&add_reference(&project, outside.to_str().unwrap()).unwrap());
    let detail = project.detail();
    assert_eq!(
        references(&detail),
        vec![
            "docs/specs/AT-1-spec.md".to_owned(),
            outside.to_str().unwrap().to_owned()
        ]
    );
    assert!(detail.missing_references.is_empty());
    let error = add_reference(&project, "docs/./specs/AT-1-spec.md").expect_err("already there");
    assert!(
        error.message.contains("docs/specs/AT-1-spec.md"),
        "{}",
        error.message
    );
}

#[test]
fn a_path_that_does_not_resolve_is_refused_on_add_and_missing_on_read() {
    let project = Project::new();
    let error = add_reference(&project, "docs/nowhere.md").expect_err("no such file");
    assert_eq!(error.code, ErrorCode::NotFound);
    assert!(error.recoverable);
    let error = add_reference(&project, "docs").expect_err("a folder");
    assert_ne!(error.code, ErrorCode::Conflict);

    let doc = project.root.join("plan.md");
    fs::write(&doc, "# Plan\n").unwrap();
    commit(&add_reference(&project, "plan.md").unwrap());
    fs::remove_file(&doc).unwrap();
    let detail = project.detail();
    let reference = &detail.ticket.as_ref().unwrap().references[0];
    assert_eq!(detail.missing_references, vec![reference.id.clone()]);
}

#[test]
fn removing_a_reference_never_touches_the_file_and_restore_round_trips() {
    let project = Project::new();
    let doc = project.root.join("plan.md");
    fs::write(&doc, "# Plan\n").unwrap();
    commit(&add_reference(&project, "plan.md").unwrap());
    let reference = project.detail().ticket.unwrap().references[0].clone();
    project.edited(TicketEdit {
        remove_reference: Some(reference.id.clone()),
        ..TicketEdit::default()
    });
    assert!(references(&project.detail()).is_empty());
    assert_eq!(fs::read_to_string(&doc).unwrap(), "# Plan\n");
    project.edited(TicketEdit {
        restore_reference: Some(ReferenceRestore {
            id: reference.id.clone(),
            path: reference.path.clone(),
            added_at: reference.added_at.clone(),
            added_by: reference.added_by.clone(),
            after: None,
        }),
        ..TicketEdit::default()
    });
    assert_eq!(project.detail().ticket.unwrap().references, vec![reference]);
}

// ------------------------------------------------------------ serving (slice 3)

use longclaw_desktop_lib::core::attachment_scheme::{self, AttachmentRequest, Served};

fn serve(project: &Project, file: &str, range: Option<&str>) -> Served {
    attachment_scheme::serve(
        &project.root,
        "AT",
        &AttachmentRequest {
            project_id: "ignored-here".to_owned(),
            ticket_key: project.key.clone(),
            file: file.to_owned(),
        },
        range,
    )
}

#[test]
fn a_registered_image_is_served_with_the_type_its_record_states() {
    let project = Project::new();
    // Named .txt, registered as a PNG: the record's word is the one served.
    let image = project.attached(PNG, "looks-like-text.txt");
    let served = serve(&project, &image.attachment.file, None);
    assert_eq!(served.status, 200);
    assert_eq!(served.body, PNG);
    assert_eq!(served.header("Content-Type"), Some("image/png"));
    assert_eq!(
        served.header("Content-Length"),
        Some(PNG.len().to_string().as_str())
    );
    assert_eq!(served.header("Accept-Ranges"), Some("bytes"));
    assert_eq!(served.header("X-Content-Type-Options"), Some("nosniff"));
    assert!(served
        .header("Content-Security-Policy")
        .is_some_and(|policy| policy.contains("sandbox")));
}

#[test]
fn a_video_seeks_by_byte_range() {
    let project = Project::new();
    let video = project.attached(MP4, "clip.mp4");
    let file = &video.attachment.file;

    let part = serve(&project, file, Some("bytes=4-11"));
    assert_eq!(part.status, 206);
    assert_eq!(part.body, &MP4[4..12]);
    assert_eq!(
        part.header("Content-Range"),
        Some(format!("bytes 4-11/{}", MP4.len()).as_str())
    );
    assert_eq!(part.header("Content-Type"), Some("video/mp4"));

    let tail = serve(&project, file, Some("bytes=-4"));
    assert_eq!(tail.body, &MP4[MP4.len() - 4..]);

    let past = serve(&project, file, Some(&format!("bytes={}-", MP4.len())));
    assert_eq!(past.status, 416);
    assert_eq!(
        past.header("Content-Range"),
        Some(format!("bytes */{}", MP4.len()).as_str())
    );
    assert!(past.body.is_empty());
}

#[test]
fn only_a_registered_image_or_video_is_ever_served() {
    let project = Project::new();
    let text = project.attached(b"secret notes\n", "notes.txt");
    let image = project.attached(PNG, "shot.png");

    // Text is never inlined, so it is never served.
    assert_eq!(serve(&project, &text.attachment.file, None).status, 415);
    // An orphan is not registered.
    project.edited(TicketEdit {
        remove_attachment: Some(image.attachment.id.clone()),
        ..TicketEdit::default()
    });
    assert_eq!(serve(&project, &image.attachment.file, None).status, 404);
    // Nor is a file nobody attached, or a ticket that does not exist.
    fs::write(project.ticket_dir().join("attachments/dropped.png"), PNG).unwrap();
    assert_eq!(serve(&project, "attachments/dropped.png", None).status, 404);
    let mut elsewhere = AttachmentRequest {
        project_id: String::new(),
        ticket_key: "AT-999z".to_owned(),
        file: image.attachment.file.clone(),
    };
    assert_eq!(
        attachment_scheme::serve(&project.root, "AT", &elsewhere, None).status,
        404
    );
    elsewhere.ticket_key = "../AT".to_owned();
    assert_ne!(
        attachment_scheme::serve(&project.root, "AT", &elsewhere, None).status,
        200
    );
}

#[test]
fn a_path_out_of_the_folder_is_forbidden_before_anything_is_read() {
    let project = Project::new();
    project.attached(PNG, "inside.png");
    let outside = project.root.join("outside.png");
    fs::write(&outside, PNG).unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(&outside, project.ticket_dir().join("attachments/link.png"))
        .unwrap();
    for file in [
        "attachments/../ticket.md",
        "attachments/../../../outside.png",
        "attachments/link.png",
        "attachments/",
    ] {
        let served = serve(&project, file, None);
        assert_eq!(
            served.status,
            403,
            "{file}: {}",
            String::from_utf8_lossy(&served.body)
        );
        assert_ne!(served.body, PNG);
    }
}

// ------------------------------------------------------------- opening one

#[test]
fn a_registered_file_opens_only_when_macos_would_show_it_rather_than_run_it() {
    let project = Project::new();
    let log = project.attached(b"line one\n", "console.log");
    let image = project.attached(PNG, "shot.png");
    for prepared in [&log, &image] {
        let path = attachments::attachment_to_open(
            &project.root,
            "AT",
            &project.key,
            &prepared.attachment.file,
        )
        .expect("a log and a picture open in their default app");
        assert_eq!(
            path,
            project
                .ticket_dir()
                .join(&prepared.attachment.file)
                .canonicalize()
                .unwrap()
        );
    }

    // Text by content, and still a script by name: LaunchServices would hand
    // it to Terminal, which runs it.
    let script = project.attached(b"echo hello\n", "fix.command");
    let refused =
        attachments::attachment_to_open(&project.root, "AT", &project.key, &script.attachment.file)
            .expect_err("a file macOS would run is not opened");
    assert_eq!(refused.code, ErrorCode::UnsupportedMediaType);
    assert!(refused.recoverable);
    assert!(
        refused.message.contains("fix.command"),
        "{}",
        refused.message
    );

    // An image by content, and Safari's by name, where a script inside it runs.
    let drawing = project.attached(
        b"<svg xmlns=\"http://www.w3.org/2000/svg\"><script>1</script></svg>\n",
        "drawing.svg",
    );
    assert_eq!(drawing.attachment.media_type, "image/svg+xml");
    let refused = attachments::attachment_to_open(
        &project.root,
        "AT",
        &project.key,
        &drawing.attachment.file,
    )
    .expect_err("an SVG is not opened");
    assert_eq!(refused.code, ErrorCode::UnsupportedMediaType);

    // An orphan is not registered, so it is not opened either.
    project.edited(TicketEdit {
        remove_attachment: Some(log.attachment.id.clone()),
        ..TicketEdit::default()
    });
    let orphan =
        attachments::attachment_to_open(&project.root, "AT", &project.key, &log.attachment.file)
            .expect_err("an orphan is not opened");
    assert_eq!(orphan.code, ErrorCode::NotFound);
    let escape = attachments::attachment_to_open(
        &project.root,
        "AT",
        &project.key,
        "attachments/../ticket.md",
    )
    .expect_err("a way out is not opened");
    assert_eq!(escape.code, ErrorCode::PermissionDenied);
}
