# LongClaw fixture editing contract

This is a representative fixture for the Tauri v2 architecture spike.

- Treat each `.longclaw/tickets/<KEY>/ticket.md` as the canonical record.
- Preserve unknown frontmatter keys and bounded records.
- Write through a sibling temporary file followed by rename when possible.
- Never edit the disposable application index; it is rebuilt from these files.
- Actor attribution must remain explicit. Do not infer it from a tool name.
