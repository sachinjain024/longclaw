# Errors cross IPC as a closed tagged shape

**Status:** accepted at the M2 human-review gate on 2026-07-29.

Represent expected failures as:

```text
{ code, message, recoverable, context? }
```

`code` is a closed snake-case enum used for behavior; `message` is safe, actionable presentation text; `recoverable` selects retry/reload affordances; `context` contains small string values such as ticket key, path, or expected/actual content hashes. Rust internal errors are translated once at the module seam.

Parsing failures do not fail the whole project load. They produce degraded ticket records and leave bytes untouched. Unsupported future versions are read-only degraded records. A content-hash mismatch is a `conflict`, never an overwrite. Invalid project metadata and registry corruption are project-level failures and are never silently replaced.

## Consequences

- The frontend switches on stable codes and does not parse error prose.
- Diagnostics can be logged locally without telemetry and without exposing Rust backtraces to the webview.
- Panics remain programmer failures, not recoverable application errors.
- String-only command rejections were rejected because callers cannot choose recovery safely. Automatically repairing malformed YAML was rejected because it risks data loss. A single “I/O error” code was rejected because permission, missing-folder, and conflict states require different actions.
