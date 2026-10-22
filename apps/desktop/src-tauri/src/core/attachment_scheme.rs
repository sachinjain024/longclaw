//! Serving a ticket's attachments to the webview (LC-206).
//!
//! The webview cannot read the project folder, and the broad `asset:` protocol
//! that could is not widened for this (ADR 0009: Rust owns filesystem
//! authority). Instead one URI scheme that Rust owns answers for exactly one
//! kind of file: a **registered** image or video, inside its own ticket's
//! `attachments/` folder, with the media type its record states. Everything
//! about the answer is decided here, without Tauri, so it can be tested
//! against a real folder; `lib.rs` only moves the request in and the answer
//! out.
//!
//! A URL names a project by id, a ticket by key and the record's `file`:
//!
//! ```text
//! longclaw-attachment://localhost/<project-id>/<KEY>/attachments/<name>
//! ```
//!
//! Text attachments are not served: the spec never inlines one, and a chip
//! opens it in its default app, which reads the disk itself.

use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

use super::attachments;
use super::error::{AppError, ErrorCode};

/// The scheme's name, and so the word the CSP names in `img-src` and
/// `media-src`. `tauri.conf.json` and `src/attachmentSrc.ts` spell it too;
/// `the_csp_names_the_scheme` holds the first to it.
pub const ATTACHMENT_SCHEME: &str = "longclaw-attachment";

/// What a URL asks for, decoded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttachmentRequest {
    pub project_id: String,
    pub ticket_key: String,
    /// The record's `file`: `attachments/<name>`.
    pub file: String,
}

/// An answer, in the terms an HTTP response is built from.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Served {
    pub status: u16,
    pub headers: Vec<(&'static str, String)>,
    pub body: Vec<u8>,
}

impl Served {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.as_str())
    }
}

/// Reads a request path — `/<project-id>/<KEY>/attachments/<name>` — into its
/// three parts. Each segment is percent-decoded on its own, so an encoded `/`
/// inside a name stays inside that name and is then refused by containment
/// rather than read as a separator. `None` is any other shape.
pub fn parse_request(path: &str) -> Option<AttachmentRequest> {
    let path = path.split(['?', '#']).next().unwrap_or(path);
    let segments: Vec<&str> = path.strip_prefix('/')?.split('/').collect();
    let [project_id, ticket_key, folder, name] = segments.as_slice() else {
        return None;
    };
    if *folder != "attachments" {
        return None;
    }
    let decoded = |segment: &str| percent_decoded(segment).filter(|value| !value.is_empty());
    Some(AttachmentRequest {
        project_id: decoded(project_id)?,
        ticket_key: decoded(ticket_key)?,
        file: format!("attachments/{}", decoded(name)?),
    })
}

/// The answer to one request for one project.
///
/// A file the request may not have is a 403 when the path tried to leave the
/// folder and a 404 when it is simply not a registered attachment — an
/// orphan, a missing file, an unknown ticket. A registered record whose type
/// is not an image or a video is a 415: it is never rendered, so it is never
/// served. `range` is the request's `Range` header, honoured for one range.
pub fn serve(
    project_root: &Path,
    project_key: &str,
    request: &AttachmentRequest,
    range: Option<&str>,
) -> Served {
    let (path, attachment) = match attachments::registered_attachment(
        project_root,
        project_key,
        &request.ticket_key,
        &request.file,
    ) {
        Ok(found) => found,
        Err(error) => return refused(&error),
    };
    let media_type = attachment.media_type;
    if !(media_type.starts_with("image/") || media_type.starts_with("video/")) {
        return plain(415, format!("{} is not an image or a video", request.file));
    }
    match read(&path, range) {
        Ok(Body::Whole { bytes }) => {
            let length = bytes.len();
            let mut headers = common_headers(&media_type);
            headers.push(("Content-Length", length.to_string()));
            Served {
                status: 200,
                headers,
                body: bytes,
            }
        }
        Ok(Body::Part {
            bytes,
            start,
            end,
            total,
        }) => {
            let mut headers = common_headers(&media_type);
            headers.push(("Content-Length", bytes.len().to_string()));
            headers.push(("Content-Range", format!("bytes {start}-{end}/{total}")));
            Served {
                status: 206,
                headers,
                body: bytes,
            }
        }
        Ok(Body::Unsatisfiable { total }) => Served {
            status: 416,
            headers: vec![
                ("Content-Range", format!("bytes */{total}")),
                ("Accept-Ranges", "bytes".to_owned()),
            ],
            body: Vec::new(),
        },
        Err(error) => plain(500, format!("{} could not be read: {error}", request.file)),
    }
}

/// The answer for a project id the registry does not hold.
pub fn unknown_project() -> Served {
    plain(404, "That project is not open in LongClaw".to_owned())
}

/// The answer for a URL that is not the shape above.
pub fn malformed() -> Served {
    plain(400, "Not an attachment URL".to_owned())
}

/// The answer for anything but a `GET`: the scheme only ever reads.
pub fn method_not_allowed() -> Served {
    let mut served = plain(405, "Attachments are only read".to_owned());
    served.headers.push(("Allow", "GET".to_owned()));
    served
}

/// The most an open-ended range — `bytes=0-`, which is how a player starts —
/// is answered with at once. A 206 may carry less than was asked, and the
/// player asks again from where it stopped, so a video is read in pieces
/// rather than whole (`file_format.md`: seeking must not require loading the
/// complete file).
const OPEN_RANGE_CHUNK: u64 = 2 * 1024 * 1024;

// ------------------------------------------------------------------ internals

enum Body {
    Whole {
        bytes: Vec<u8>,
    },
    Part {
        bytes: Vec<u8>,
        start: u64,
        end: u64,
        total: u64,
    },
    Unsatisfiable {
        total: u64,
    },
}

fn read(path: &Path, range: Option<&str>) -> std::io::Result<Body> {
    let mut file = attachments::open_without_following(path)?;
    let metadata = file.metadata()?;
    // Asked of the handle, not the path: what was opened is what is read.
    if !metadata.is_file() {
        return Err(std::io::Error::other("not a regular file"));
    }
    let total = metadata.len();
    match range.map(|header| byte_range(header, total)) {
        None | Some(Ok(None)) => {
            let mut bytes = Vec::with_capacity(total as usize);
            file.read_to_end(&mut bytes)?;
            Ok(Body::Whole { bytes })
        }
        Some(Ok(Some((start, end)))) => {
            file.seek(SeekFrom::Start(start))?;
            let mut bytes = vec![0; (end - start + 1) as usize];
            file.read_exact(&mut bytes)?;
            Ok(Body::Part {
                bytes,
                start,
                end,
                total,
            })
        }
        Some(Err(Unsatisfiable)) => Ok(Body::Unsatisfiable { total }),
    }
}

#[derive(Debug, PartialEq, Eq)]
struct Unsatisfiable;

/// One inclusive byte range out of a `Range` header, for a file of `total`
/// bytes (RFC 9110 §14.1.2).
///
/// `Ok(None)` serves the whole file: a header that does not parse, or one
/// asking for several ranges, is ignored rather than refused, which the RFC
/// allows and a player handles. `Err` is a range that starts past the end,
/// which is a 416.
fn byte_range(header: &str, total: u64) -> Result<Option<(u64, u64)>, Unsatisfiable> {
    let Some(spec) = header.trim().strip_prefix("bytes=") else {
        return Ok(None);
    };
    if spec.contains(',') {
        return Ok(None);
    }
    let Some((first, last)) = spec.trim().split_once('-') else {
        return Ok(None);
    };
    let parse = |text: &str| text.trim().parse::<u64>().ok();
    match (first.trim().is_empty(), last.trim().is_empty()) {
        // `bytes=-500`: the last 500.
        (true, false) => {
            let Some(suffix) = parse(last) else {
                return Ok(None);
            };
            if suffix == 0 || total == 0 {
                return Err(Unsatisfiable);
            }
            Ok(Some((total.saturating_sub(suffix), total - 1)))
        }
        // `bytes=500-`: from 500 towards the end, a chunk at a time.
        (false, true) => {
            let Some(start) = parse(first) else {
                return Ok(None);
            };
            if start >= total {
                return Err(Unsatisfiable);
            }
            Ok(Some((start, (start + OPEN_RANGE_CHUNK).min(total) - 1)))
        }
        // `bytes=500-999`.
        (false, false) => {
            let (Some(start), Some(end)) = (parse(first), parse(last)) else {
                return Ok(None);
            };
            if end < start {
                return Ok(None);
            }
            if start >= total {
                return Err(Unsatisfiable);
            }
            Ok(Some((start, end.min(total - 1))))
        }
        (true, true) => Ok(None),
    }
}

/// What every served file carries. The type is the record's, never one guessed
/// from the name, and `nosniff` stops the webview guessing either. The CSP and
/// `sandbox` matter for one case: an SVG opened as a document rather than as an
/// `<img>`, where its scripts would otherwise run.
fn common_headers(media_type: &str) -> Vec<(&'static str, String)> {
    vec![
        ("Content-Type", media_type.to_owned()),
        ("Accept-Ranges", "bytes".to_owned()),
        ("X-Content-Type-Options", "nosniff".to_owned()),
        (
            "Content-Security-Policy",
            "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox".to_owned(),
        ),
        ("Cache-Control", "no-store".to_owned()),
    ]
}

fn refused(error: &AppError) -> Served {
    let status = match error.code {
        ErrorCode::PermissionDenied => 403,
        ErrorCode::NotFound | ErrorCode::TicketNotFound | ErrorCode::ParseFailed => 404,
        _ => 500,
    };
    plain(status, error.message.clone())
}

fn plain(status: u16, message: String) -> Served {
    Served {
        status,
        headers: vec![
            ("Content-Type", "text/plain; charset=utf-8".to_owned()),
            ("X-Content-Type-Options", "nosniff".to_owned()),
        ],
        body: message.into_bytes(),
    }
}

/// `%XX` decoding for one path segment, or `None` for a malformed escape or a
/// result that is not UTF-8.
pub(crate) fn percent_decoded(segment: &str) -> Option<String> {
    let bytes = segment.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = segment.get(index + 1..index + 3)?;
            decoded.push(u8::from_str_radix(hex, 16).ok()?);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

#[cfg(test)]
mod tests {
    use super::{byte_range, parse_request, AttachmentRequest, Unsatisfiable, ATTACHMENT_SCHEME};

    /// The window may load an attachment as an image or a video, and from no
    /// other new place: `img-src` and `media-src` name this scheme, and
    /// `media-src` names nothing else.
    #[test]
    fn the_csp_names_the_scheme() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../../tauri.conf.json")).expect("config parses");
        let csp = config["app"]["security"]["csp"]
            .as_str()
            .expect("a CSP string");
        let directive = |name: &str| {
            csp.split(';')
                .map(str::trim)
                .find_map(|part| part.strip_prefix(name))
                .unwrap_or_else(|| panic!("the CSP has {name}: {csp}"))
                .split_whitespace()
                .map(str::to_owned)
                .collect::<Vec<_>>()
        };
        let scheme = format!("{ATTACHMENT_SCHEME}:");
        assert!(directive("img-src ").contains(&scheme), "{csp}");
        let media = directive("media-src ");
        assert!(media.contains(&scheme), "{csp}");
        assert!(
            media
                .iter()
                .all(|source| source.contains(ATTACHMENT_SCHEME)),
            "media-src names only the attachment scheme: {csp}"
        );
    }

    #[test]
    fn a_request_names_a_project_a_ticket_and_a_file() {
        assert_eq!(
            parse_request("/proj-1/LC-206/attachments/att_7d2a-failure%20state.png"),
            Some(AttachmentRequest {
                project_id: "proj-1".to_owned(),
                ticket_key: "LC-206".to_owned(),
                file: "attachments/att_7d2a-failure state.png".to_owned(),
            })
        );
        // A query or a fragment is not part of the file.
        assert_eq!(
            parse_request("/p/LC-1/attachments/a.png?t=1").map(|request| request.file),
            Some("attachments/a.png".to_owned())
        );
    }

    #[test]
    fn any_other_shape_is_not_a_request() {
        for path in [
            "",
            "/",
            "/p/LC-1/a.png",
            "/p/LC-1/ticket.md/x",
            "/p/LC-1/attachments/",
            "/p/LC-1/attachments/a/b.png",
            "/p/LC-1/attachments/%zz.png",
            "p/LC-1/attachments/a.png",
        ] {
            assert_eq!(parse_request(path), None, "{path}");
        }
        // An encoded separator stays inside its segment, where containment
        // refuses it; it never becomes a way into another folder.
        assert_eq!(
            parse_request("/p/LC-1/attachments/..%2Fticket.md").map(|request| request.file),
            Some("attachments/../ticket.md".to_owned())
        );
    }

    #[test]
    fn a_range_is_one_inclusive_span_of_the_file() {
        assert_eq!(byte_range("bytes=0-99", 1000), Ok(Some((0, 99))));
        assert_eq!(byte_range("bytes=900-", 1000), Ok(Some((900, 999))));
        // An open end is answered a chunk at a time, never the whole file.
        let big = 50 * 1024 * 1024;
        assert_eq!(
            byte_range("bytes=0-", big),
            Ok(Some((0, super::OPEN_RANGE_CHUNK - 1)))
        );
        assert_eq!(byte_range("bytes=-100", 1000), Ok(Some((900, 999))));
        // A suffix longer than the file is the whole file, from the start.
        assert_eq!(byte_range("bytes=-5000", 1000), Ok(Some((0, 999))));
        // An end past the file is cut to it.
        assert_eq!(byte_range("bytes=500-5000", 1000), Ok(Some((500, 999))));
    }

    #[test]
    fn a_range_past_the_end_is_unsatisfiable_and_a_bad_one_is_ignored() {
        assert_eq!(byte_range("bytes=1000-", 1000), Err(Unsatisfiable));
        assert_eq!(byte_range("bytes=1000-1001", 1000), Err(Unsatisfiable));
        assert_eq!(byte_range("bytes=-0", 1000), Err(Unsatisfiable));
        assert_eq!(byte_range("bytes=0-", 0), Err(Unsatisfiable));
        for ignored in [
            "items=0-1",
            "bytes=0-1,5-6",
            "bytes=a-b",
            "bytes=9-2",
            "bytes=-",
        ] {
            assert_eq!(byte_range(ignored, 1000), Ok(None), "{ignored}");
        }
    }
}
