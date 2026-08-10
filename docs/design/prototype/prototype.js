/* ====================================================================
   LongClaw v0 prototype — Phase 0, Step 2.
   A state-driven mini-app: every MVP surface, flow and trust state,
   driven by the harness bar on top. No hex values anywhere — all
   color routes through --lc-* tokens (see prototype.css).
   ==================================================================== */
(() => {
"use strict";

/* ================= utilities ================= */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let _uid = 0;
const uid = (p) => `${p}_${(++_uid).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const now = () => Date.now();
const MIN = 60000, HOUR = 3600000, DAY = 86400000;

function relTime(ts) {
  const d = now() - ts;
  if (d < 8000) return "just now";
  if (d < MIN) return `${Math.round(d / 1000)}s`;
  if (d < HOUR) return `${Math.round(d / MIN)}m`;
  if (d < DAY) return `${Math.round(d / HOUR)}h`;
  if (d < 2 * DAY) return "1d";
  return `${Math.round(d / DAY)}d`;
}

/* Minimal CommonMark-ish renderer for the description preview.
   Escapes first; supports headings, bold, italic, inline/fenced code,
   links, plain + task lists, paragraphs. */
function md(src) {
  if (!src || !src.trim()) return "";
  const blocks = [];
  const fenced = String(src).split(/```/);
  fenced.forEach((part, i) => {
    if (i % 2 === 1) { blocks.push(`<pre><code>${esc(part.replace(/^\w*\n/, ""))}</code></pre>`); return; }
    const lines = part.split("\n");
    let para = [], list = null;
    const flushP = () => { if (para.length) { blocks.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
    const flushL = () => { if (list) { blocks.push(`<ul>${list.join("")}</ul>`); list = null; } };
    for (const raw of lines) {
      const line = raw.trimEnd();
      const hm = line.match(/^(#{1,3})\s+(.*)/);
      const tm = line.match(/^[-*]\s+\[([ x])\]\s+(.*)/);
      const lm = line.match(/^[-*]\s+(.*)/);
      if (!line.trim()) { flushP(); flushL(); }
      else if (hm) { flushP(); flushL(); blocks.push(`<h3>${inline(hm[2])}</h3>`); }
      else if (tm) { flushP(); list = list || []; list.push(`<li>${tm[1] === "x" ? "☑" : "☐"} ${inline(tm[2])}</li>`); }
      else if (lm) { flushP(); list = list || []; list.push(`<li>${inline(lm[1])}</li>`); }
      else para.push(line);
    }
    flushP(); flushL();
  });
  return `<div class="md">${blocks.join("")}</div>`;
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, `<a href="#" onclick="return false">$1</a>`);
  }
}

/* ================= glyphs (all currentColor / tokens) ================= */

const OWL = `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M9 7 L32 16 L55 7 L55 40 L32 59 L9 40 Z M22.5 22 a7.5 7.5 0 1 0 0 15 a7.5 7.5 0 1 0 0 -15 Z M41.5 22 a7.5 7.5 0 1 0 0 15 a7.5 7.5 0 1 0 0 -15 Z M32 39.5 L36 45 L32 51.5 L28 45 Z"/><circle cx="22.5" cy="29.5" r="3" fill="currentColor"/><circle cx="41.5" cy="29.5" r="3" fill="currentColor"/></svg>`;

const STATUSES = [
  { id: "backlog",     name: "Backlog" },
  { id: "todo",        name: "Todo" },
  { id: "in_progress", name: "In Progress" },
  { id: "in_review",   name: "In Review" },
  { id: "done",        name: "Done" },
  { id: "canceled",    name: "Canceled" },
];
const statusName = (id) => (STATUSES.find((s) => s.id === id) || {}).name || id;

function statusDot(id, size = 14) {
  const tok = `var(--lc-status-${id.replace("_", "-")}${id === "done" ? "" : ""})`;
  const c = { backlog: "var(--lc-status-backlog)", todo: "var(--lc-status-todo)",
    in_progress: "var(--lc-status-in-progress)", in_review: "var(--lc-status-in-review)",
    done: "var(--lc-status-done)", canceled: "var(--lc-status-canceled)" }[id] || tok;
  if (id === "backlog")
    return `<svg class="glyph" width="${size}" height="${size}" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="${c}" stroke-width="1.6" stroke-dasharray="2.1 2.5"/></svg>`;
  if (id === "todo")
    return `<svg class="glyph" width="${size}" height="${size}" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="${c}" stroke-width="1.6"/></svg>`;
  return `<svg class="glyph" width="${size}" height="${size}" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="${c}" stroke="${c}" stroke-width="1.6"/></svg>`;
}

const PRIORITIES = [
  { id: "urgent", name: "Urgent" }, { id: "p1", name: "P1" }, { id: "p2", name: "P2" },
  { id: "p3", name: "P3" }, { id: "p4", name: "P4" }, { id: "none", name: "No priority" },
];
function priGlyph(p, small = false) {
  const s = small ? 13 : 14;
  if (p === "urgent")
    return `<svg class="glyph" width="${s}" height="${s}" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="3" fill="var(--lc-priority-urgent)"/><rect x="6.25" y="3.4" width="1.5" height="4.6" rx="0.75" fill="var(--lc-priority-urgent-mark)"/><rect x="6.25" y="9.2" width="1.5" height="1.5" rx="0.75" fill="var(--lc-priority-urgent-mark)"/></svg>`;
  if (p === "none" || !p)
    return `<svg class="glyph" width="${s}" height="${s}" viewBox="0 0 14 14"><rect x="2.5" y="6.2" width="9" height="1.6" rx="0.8" fill="var(--lc-priority-none)"/></svg>`;
  return `<span class="p-chip${small ? " sm" : ""}">${esc(p)}</span>`;
}

const GL = {
  folder: `<svg class="glyph" width="13" height="13" viewBox="0 0 14 14"><path d="M1.5 3.5 Q1.5 2.5 2.5 2.5 L5 2.5 L6.2 4 L11.5 4 Q12.5 4 12.5 5 L12.5 10.5 Q12.5 11.5 11.5 11.5 L2.5 11.5 Q1.5 11.5 1.5 10.5 Z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`,
  warn: (s = 13) => `<svg class="glyph" width="${s}" height="${s}" viewBox="0 0 14 14"><path d="M7 1.5 L13 12 L1 12 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><rect x="6.35" y="5.2" width="1.3" height="3.4" rx="0.65" fill="currentColor"/><rect x="6.35" y="9.6" width="1.3" height="1.3" rx="0.65" fill="currentColor"/></svg>`,
  x: `<svg class="glyph" width="14" height="14" viewBox="0 0 14 14"><path d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  gear: `<svg class="glyph" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="2.1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 1.6 V3.4 M7 10.6 V12.4 M1.6 7 H3.4 M10.6 7 H12.4 M3.2 3.2 L4.5 4.5 M9.5 9.5 L10.8 10.8 M10.8 3.2 L9.5 4.5 M4.5 9.5 L3.2 10.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  search: `<svg class="glyph" width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9.2 9.2 L12.4 12.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  star: (on) => `<svg class="glyph" width="12" height="12" viewBox="0 0 14 14"><path d="M7 1.6 L8.6 5 L12.4 5.4 L9.6 7.9 L10.4 11.6 L7 9.7 L3.6 11.6 L4.4 7.9 L1.6 5.4 L5.4 5 Z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
  check: `<svg class="glyph" width="12" height="12" viewBox="0 0 14 14"><path d="M2.8 7.4 L5.8 10.2 L11.2 3.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  plus: `<svg class="glyph" width="13" height="13" viewBox="0 0 14 14"><path d="M7 2.5 V11.5 M2.5 7 H11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  boardIcon: `<svg class="glyph" width="12" height="12" viewBox="0 0 14 14"><rect x="1.5" y="2" width="3.2" height="10" rx="1" fill="currentColor"/><rect x="5.9" y="2" width="3.2" height="7" rx="1" fill="currentColor"/><rect x="10.3" y="2" width="3.2" height="4.5" rx="1" fill="currentColor"/></svg>`,
  listIcon: `<svg class="glyph" width="12" height="12" viewBox="0 0 14 14"><rect x="1.5" y="2.5" width="11" height="1.7" rx="0.85" fill="currentColor"/><rect x="1.5" y="6.15" width="11" height="1.7" rx="0.85" fill="currentColor"/><rect x="1.5" y="9.8" width="11" height="1.7" rx="0.85" fill="currentColor"/></svg>`,
  person: `<svg class="glyph" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="4.6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2.3 12 Q2.3 8.6 7 8.6 Q11.7 8.6 11.7 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  tag: `<svg class="glyph" width="13" height="13" viewBox="0 0 14 14"><path d="M1.8 6.4 L1.8 2.6 Q1.8 1.8 2.6 1.8 L6.4 1.8 L12.2 7.6 Q12.8 8.2 12.2 8.8 L8.8 12.2 Q8.2 12.8 7.6 12.2 Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="4.6" cy="4.6" r="1" fill="currentColor"/></svg>`,
  pencil: `<svg class="glyph" width="12" height="12" viewBox="0 0 14 14"><path d="M2.2 11.8 L2.8 9.2 L9.8 2.2 Q10.4 1.6 11 2.2 L11.8 3 Q12.4 3.6 11.8 4.2 L4.8 11.2 Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  chev: `<svg class="glyph" width="11" height="11" viewBox="0 0 14 14"><path d="M4.5 2.5 L9.5 7 L4.5 11.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  boxTicked: `<svg class="glyph" width="12" height="12" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="3.5" fill="currentColor"/><path d="M4 7.2 L6.2 9.3 L10 4.9" fill="none" stroke="var(--lc-surface)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  term: `<svg class="glyph" width="13" height="13" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 5.2 L5.7 7 L3.5 8.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 9 H10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  moon: `<svg class="glyph" width="13" height="13" viewBox="0 0 14 14"><path d="M11.8 8.6 A5.2 5.2 0 1 1 5.4 2.2 A4.2 4.2 0 0 0 11.8 8.6 Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  swatchG: `<svg class="glyph" width="13" height="13" viewBox="0 0 14 14"><rect x="1.5" y="1.5" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1.5 9 L12.5 5" stroke="currentColor" stroke-width="1.3"/></svg>`,
  arrowGo: `<svg class="glyph" width="13" height="13" viewBox="0 0 14 14"><path d="M2 7 H11 M7.5 3 L11.5 7 L7.5 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function checkbox(checked, agentAcknowledged = false) {
  if (!checked)
    return `<svg class="glyph" width="15" height="15" viewBox="0 0 15 15"><rect x="2" y="2" width="11" height="11" rx="3" fill="none" stroke="var(--lc-line-strong)" stroke-width="1.5"/></svg>`;
  const fill = agentAcknowledged ? "var(--lc-accent-agent)" : "var(--lc-ink-3)";
  const mark = agentAcknowledged ? "var(--lc-on-accent-agent)" : "var(--lc-surface)";
  return `<svg class="glyph" width="15" height="15" viewBox="0 0 15 15"><rect x="1.5" y="1.5" width="12" height="12" rx="3.5" fill="${fill}"/><path d="M4.4 7.8 L6.7 10 L10.7 5.3" fill="none" stroke="${mark}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
const avatar = (p, small = false) =>
  `<span class="avatar${small ? " sm" : ""}" style="--tint: var(--lc-label-${p.tint})" title="${esc(p.name)}">${esc(p.initials)}</span>`;
const agentTile = `<span class="agent-tile" title="claude-code · agent">❯</span>`;

/* ================= seed data ================= */

const PEOPLE = {
  sachin: { id: "sachin", name: "Sachin Jain", initials: "SJ", tint: "blue" },
  mira:   { id: "mira",   name: "Mira Kaul",   initials: "MK", tint: "purple" },
  jun:    { id: "jun",    name: "Jun Tanaka",  initials: "JT", tint: "cyan" },
  ana:    { id: "ana",    name: "Ana Reyes",   initials: "AR", tint: "amber" },
};
const ME = "sachin";
const AGENT = { type: "agent", id: "claude-code", name: "claude-code" };
const humanActor = (id) => ({ type: "human", id, name: PEOPLE[id].name });

function T(o) {
  return Object.assign({
    id: uid("t"), labels: [], checklist: [], activity: [], priority: "none",
    assignee: null, description: "", acknowledged: false, acknowledgedAt: 0, degraded: null, pending: false, archivedAt: null,
  }, o);
}
const ck = (text, checked = false) => ({ id: uid("ck"), text, checked, agentAcknowledged: false, by: null });
const evCreate = (who, at) => ({ id: uid("ev"), kind: "event", actor: humanActor(who), at, ev: { field: "created" } });

function seedLongclaw() {
  const t0 = now();
  const tickets = [
    T({ key: "LC-101", title: "Project settings: relocate folder flow", status: "backlog", priority: "p3",
        labels: ["onboarding"], createdAt: t0 - 21 * DAY, updatedAt: t0 - 9 * DAY,
        description: "When a project folder is missing, the settings dialog needs a **Locate folder…** path that re-points the registry entry without touching ticket files.",
        activity: [evCreate("jun", t0 - 21 * DAY)] }),
    T({ key: "LC-108", title: "Side panel: starred section ordering", status: "backlog", priority: "none",
        labels: ["design"], createdAt: t0 - 18 * DAY, updatedAt: t0 - 6 * DAY,
        description: "Starred projects should keep manual order; drag to reorder within the section.",
        activity: [evCreate("mira", t0 - 18 * DAY)] }),
    T({ key: "LC-114", title: "Empty board illustration for first launch", status: "todo", priority: "p2",
        labels: ["design", "onboarding"], createdAt: t0 - 12 * DAY, updatedAt: t0 - 2 * DAY,
        description: "The guided first-ticket card needs its final copy and the dashed affordance from the foundations spec.\n\n- keep it calm — no mascots on the board\n- `C` kbd hint on the card",
        checklist: [ck("Final copy for the guide card"), ck("Dashed border treatment", true), ck("Keyboard hint placement")],
        activity: [evCreate("mira", t0 - 12 * DAY)] }),
    T({ key: "LC-119", title: "File format: frontmatter schema for checklists", status: "in_review", priority: "p2",
        labels: ["infra"], createdAt: t0 - 10 * DAY, updatedAt: t0 - 5 * HOUR,
        description: "Checklist items are ordinary Markdown tasks plus invisible stable IDs:\n\n```md\n- [x] Add retry policy <!-- longclaw:item=ck_7d2a -->\n```\n\nAgents flip `[ ]` to `[x]`; the app attributes the change to the stable item.",
        checklist: [ck("Draft schema", true), ck("Fixture: valid ticket", true), ck("Fixture: unknown fields", true), ck("Review with founder")],
        activity: [evCreate("jun", t0 - 10 * DAY),
          { id: uid("ev"), kind: "comment", actor: humanActor("sachin"), at: t0 - 26 * HOUR,
            body: "Stable IDs in comments read well in raw files. Ship it for the format review." },
          { id: uid("ev"), kind: "event", actor: humanActor("jun"), at: t0 - 5 * HOUR, ev: { field: "status", from: "in_progress", to: "in_review" } }] }),
    T({ key: "LC-122", title: "Ticket panel: markdown editor write/preview toggle", status: "in_progress", priority: "p3",
        labels: ["design"], createdAt: t0 - 9 * DAY, updatedAt: t0 - 3 * HOUR,
        description: "GitHub/Trello-style editing: **Write** and **Preview** tabs with a small toolbar for common formatting.\n\n- toolbar: bold, italic, code, link, list, task\n- preview renders the constrained CommonMark subset\n- `⌘Enter` saves, `Esc` cancels",
        checklist: [ck("Write tab textarea in mono", true), ck("Preview renderer"), ck("Toolbar buttons"), ck("Save / cancel semantics")],
        activity: [evCreate("mira", t0 - 9 * DAY),
          { id: uid("ev"), kind: "comment", actor: humanActor("mira"), at: t0 - 3 * HOUR,
            body: "Editor chrome should stay quieter than the content — wash tab strip, no borders inside the preview." }] }),
    T({ key: "LC-128", title: "Fix watcher debounce on rename", status: "in_progress", priority: "p1",
        labels: ["watcher"], createdAt: t0 - 6 * DAY, updatedAt: t0 - 40 * MIN,
        description: "Editors that write via rename (VS Code, vim) emit `unlink` + `add` pairs that the watcher currently treats as a delete.\n\n## Approach\n\nCoalesce events per path over a 120ms window and diff content hashes before reporting.",
        checklist: [ck("Reproduce with VS Code atomic save", true), ck("Reproduce with vim backupcopy", true),
          ck("Coalesce unlink+add pairs", true), ck("Suppress self-writes"), ck("Hash-diff before emitting"),
          ck("Integration test: rapid renames"), ck("Update AGENTS.md notes")],
        activity: [evCreate("ana", t0 - 6 * DAY),
          { id: uid("ev"), kind: "comment", actor: humanActor("ana"), at: t0 - 30 * HOUR,
            body: "Repro is stable. The 120ms window catches both editors; longer windows start feeling laggy on the board." },
          { id: uid("ev"), kind: "event", actor: humanActor("ana"), at: t0 - 30 * HOUR, ev: { field: "status", from: "todo", to: "in_progress" } },
          { id: uid("ev"), kind: "comment", actor: AGENT, at: t0 - 40 * MIN, via: "file edit",
            body: "Read the repro notes and `watcher/coalesce.rs`. Starting on the unlink+add coalescing — will check items off as they land." }] }),
    T({ key: "LC-127", title: "Debounce config: expose watch interval in settings file", status: "done", priority: "p1",
        labels: ["watcher"], createdAt: t0 - 8 * DAY, updatedAt: t0 - 2 * DAY,
        description: "Expose `watch.debounce_ms` in `longclaw.yaml` with a safe default.",
        checklist: [ck("Config key", true), ck("Clamp range", true), ck("Docs", true), ck("Tests", true), ck("Changelog", true)],
        activity: [evCreate("ana", t0 - 8 * DAY),
          { id: uid("ev"), kind: "event", actor: humanActor("ana"), at: t0 - 2 * DAY, ev: { field: "status", from: "in_review", to: "done" } }] }),
    T({ key: "LC-131", title: "Watcher drops events when folder is renamed while app is closed", status: "todo", priority: "urgent",
        labels: ["watcher"], createdAt: t0 - 4 * DAY, updatedAt: t0 - 22 * HOUR,
        description: "On next launch the project points at a stale path. Needs the unreachable-folder state plus a rescan on relocate.",
        activity: [evCreate("jun", t0 - 4 * DAY)] }),
    T({ key: "LC-133", title: "Command palette: change project theme command", status: "todo", priority: "p4",
        labels: ["design"], createdAt: t0 - 3 * DAY, updatedAt: t0 - 3 * DAY,
        description: "Palette lists the four presets with pair swatches; selection applies instantly as a soft accent crossfade.",
        activity: [evCreate("mira", t0 - 3 * DAY)] }),
    T({ key: "LC-135", title: "AGENTS.md generator: safe-mutation examples", status: "in_review", priority: "p2",
        labels: ["infra", "docs"], createdAt: t0 - 2 * DAY, updatedAt: t0 - 7 * HOUR,
        description: "Generated `.longclaw/AGENTS.md` needs before/after examples for: checking an item, appending an event, registering an attachment.",
        checklist: [ck("Checklist example", true), ck("Event example", true), ck("Attachment example", true)],
        activity: [evCreate("sachin", t0 - 2 * DAY),
          { id: uid("ev"), kind: "comment", actor: AGENT, at: t0 - 7 * HOUR, via: "file edit",
            body: "Verified all three examples parse and round-trip. The attachment example needed a relative-path fix — updated in place." },
          { id: uid("ev"), kind: "event", actor: AGENT, at: t0 - 7 * HOUR, via: "file edit", ev: { field: "checklist", item: "Attachment example", to: true } }] }),
    T({ key: "LC-104", title: "Spike: compare file-watcher crates", status: "done", priority: "p3",
        labels: ["watcher"], createdAt: t0 - 20 * DAY, updatedAt: t0 - 5 * DAY, archivedAt: t0 - 5 * DAY,
        description: "notify vs fsevent bindings — settled on notify with the debounce layer on top.",
        activity: [evCreate("ana", t0 - 20 * DAY),
          { id: uid("ev"), kind: "event", actor: humanActor("sachin"), at: t0 - 5 * DAY, ev: { field: "archived" } }] }),
    T({ key: "LC-136", title: "Board: keyboard reorder within a column", status: "canceled", priority: "p4",
        labels: ["design"], createdAt: t0 - 5 * DAY, updatedAt: t0 - 1 * DAY,
        description: "Superseded by rank-on-ticket ordering; manual reorder is post-v0.",
        activity: [evCreate("mira", t0 - 5 * DAY),
          { id: uid("ev"), kind: "event", actor: humanActor("sachin"), at: t0 - 1 * DAY, ev: { field: "status", from: "todo", to: "canceled" } }] }),
  ];
  return {
    id: uid("p"), name: "longclaw", key: "LC", path: "~/dev/longclaw/.longclaw",
    theme: "indigo", starred: true, reachable: true, seq: 137, tickets,
    labels: {
      design: { name: "design", color: "pink" }, watcher: { name: "watcher", color: "orange" },
      infra: { name: "infra", color: "blue" }, onboarding: { name: "onboarding", color: "cyan" },
      docs: { name: "docs", color: "gray" },
    },
  };
}

function seedSmall(name, key, path, theme, titles) {
  const t0 = now();
  return {
    id: uid("p"), name, key, path, theme, starred: false, reachable: true, seq: titles.length + 1,
    labels: { misc: { name: "misc", color: "gray" } },
    tickets: titles.map((tt, i) => T({
      key: `${key}-${i + 1}`, title: tt[0], status: tt[1], priority: tt[2] || "none",
      createdAt: t0 - (i + 2) * DAY, updatedAt: t0 - (i + 1) * DAY,
      description: "", activity: [evCreate("sachin", t0 - (i + 2) * DAY)],
    })),
  };
}

/* ================= app state ================= */

let app;
function blankApp() {
  return {
    appearancePref: "light", projects: [], currentId: null, view: "board",
    filter: "", panel: null, focusKey: null, lastCardFocus: null,
    overlay: null, menu: null, toast: null, undoStack: [],
    waitlistJoined: false, termOpen: false, termH: 280,
    loading: false, pendingCreate: null, orderingByProject: {}, showArchived: false,
    firstLaunch: { t0: now(), clicks: 0, done: false },
    diskState: null, // {label, settled}
  };
}
function loadDemo() {
  const lc = seedLongclaw();
  const ps = seedSmall("personal-site", "PS", "~/dev/personal-site/.longclaw", "clay",
    [["Rewrite the now page", "todo", "p3"], ["Fix RSS pubDate timezone", "in_progress", "p2"], ["Dark mode images", "done"]]);
  const dot = seedSmall("dotfiles", "DOT", "~/dev/dotfiles/.longclaw", "slate",
    [["Migrate to lazy.nvim", "todo"], ["Split zshrc", "backlog"]]);
  app.projects = [lc, ps, dot];
  app.currentId = lc.id;
  app.view = "board"; app.panel = null; app.filter = ""; app.focusKey = null;
  app.firstLaunch.done = true;
}

const proj = () => app.projects.find((p) => p.id === app.currentId) || null;
const findTicket = (key, p = proj()) => p ? p.tickets.find((t) => t.key === key) : null;
const label = (slug, p = proj()) => (p && p.labels[slug]) || { name: slug, color: "gray" };

/* ================= disk / toast / undo ================= */

let tickerTimer = null;
function ticker(html, sticky = false) {
  const el = $("#ticker");
  el.innerHTML = html;
  clearTimeout(tickerTimer);
  if (!sticky) tickerTimer = setTimeout(() => { el.innerHTML = ""; }, 6000);
}

let diskTimer = null;
function disk(file) {
  app.diskState = { label: file, settled: false };
  clearTimeout(diskTimer);
  diskTimer = setTimeout(() => { app.diskState.settled = true; renderDiskState(); }, 600);
  renderDiskState();
}
function renderDiskState() {
  const el = $("#disk-state");
  if (!el) return;
  const d = app.diskState;
  el.innerHTML = !d ? "" : d.settled
    ? `<span class="disk-state settled">✓ ${esc(d.label)}</span>`
    : `<span class="disk-state"><span class="spin"></span> writing ${esc(d.label)}…</span>`;
}

let toastTimer = null;
function toast(msg, opts = {}) {
  app.toast = { msg, sub: opts.sub, undo: !!opts.undo };
  renderToast();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { app.toast = null; renderToast(); }, 5000);
}
function renderToast() {
  const root = $("#toast-root");
  const t = app.toast;
  root.innerHTML = !t ? "" : `
    <div class="toast">
      <span>${esc(t.msg)}</span>
      ${t.sub ? `<span class="t2">${esc(t.sub)}</span>` : ""}
      ${t.undo ? `<button class="undo" data-action="undo">Undo <span class="kbd">⌘Z</span></button>` : ""}
    </div>`;
}
function pushUndo(fn) { app.undoStack.push(fn); if (app.undoStack.length > 20) app.undoStack.shift(); }
function undo() {
  const fn = app.undoStack.pop();
  if (!fn) { toast("Nothing to undo"); return; }
  fn(); toast("Undone"); render();
}

/* Central mutation: optimistic apply + honest disk write line. */
function mutate(t, apply, opts = {}) {
  apply();
  t.updatedAt = now();
  const p = proj();
  disk(`tickets/${t.key}/ticket.md`);
  ticker(`<b>❯</b> wrote .longclaw/tickets/${t.key}/ticket.md`);
  if (opts.undo) pushUndo(opts.undo);
  if (opts.toast) toast(opts.toast, { undo: !!opts.undo });
  render();
}
function addEvent(t, actor, ev, via) {
  t.activity.push({ id: uid("ev"), kind: "event", actor, at: now(), ev, via });
}

/* ================= rendering ================= */

const appEl = $("#app"), overlayEl = $("#overlay");

function render() {
  syncRoot();
  appEl.innerHTML = app.projects.length === 0 ? welcomeHTML() : shellHTML();
  overlayEl.innerHTML = overlayHTML();
  renderToast();
  bindAfterRender();
  restoreFocus();
}

function syncRoot() {
  const p = proj();
  const theme = p ? p.theme : "indigo";
  const appearance = app.appearancePref === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : app.appearancePref;
  const root = document.documentElement;
  root.dataset.lcTheme = theme;
  root.dataset.theme = appearance;
  $$("#driver .swatch").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === theme)));
  $$("#driver .driver-seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === appearance)));
  $$("#driver .swatch i").forEach((i) => i.setAttribute("data-theme", appearance));
}

/* ---------- welcome / first launch ---------- */

function welcomeHTML() {
  if (app.pendingCreate) return createProjectHTML();
  return `
  <div class="welcome">
    <span class="owl">${OWL}</span>
    <h1>Plan with your agents.</h1>
    <p class="sub">Tickets live as plain files in a folder you choose — ideally inside your repo. Humans plan, agents execute, and both write to the same record.</p>
    <div class="actions">
      <button class="btn btn-primary" data-action="fl-create">Create a project</button>
      <button class="btn btn-secondary" data-action="fl-open">Open a folder</button>
    </div>
    <p class="trust">no account · no cloud · <b>your files, on your disk</b></p>
  </div>`;
}

function createProjectHTML() {
  const pc = app.pendingCreate;
  return `
  <div class="welcome">
    <div class="create-form">
      <h1 style="font-size:20px">New project</h1>
      <div class="row">
        <label>Folder</label>
        <div class="picked-path"><span style="color:var(--lc-ink-3);display:inline-flex">${GL.folder}</span>${esc(pc.path)}<span style="color:var(--lc-ink-3)">/.longclaw</span></div>
        <p class="form-hint">Everything lives here as plain files — readable without LongClaw, forever.</p>
      </div>
      <div class="row keyrow">
        <div class="grow">
          <label for="np-name">Name</label>
          <input id="np-name" class="field" value="${esc(pc.name)}" autocomplete="off" spellcheck="false">
        </div>
        <div>
          <label for="np-key">Key</label>
          <input id="np-key" class="field field-mono keyfield" value="${esc(pc.key)}" maxlength="5" autocomplete="off" spellcheck="false">
        </div>
      </div>
      <p class="form-hint">Tickets get mono IDs like <span class="mono">${esc(pc.key || "LC")}-1</span>. The key locks after the first ticket.</p>
      <div class="row">
        <label>Theme</label>
        ${themePickerHTML(pc.theme, "np-theme")}
        <p class="form-hint">A theme is an accent pair — yours plus the agent's green. Change it anytime in settings.</p>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" data-action="fl-confirm">Create project</button>
        <button class="btn btn-ghost" data-action="fl-cancel">Back</button>
      </div>
    </div>
  </div>`;
}

function themePickerHTML(selected, action) {
  const appearance = document.documentElement.dataset.theme || "light";
  return `<div class="theme-picker" role="radiogroup" aria-label="Project theme">
    ${["indigo", "clay", "slate", "plum", "graphite"].map((th) => `
      <button class="theme-opt" role="radio" aria-pressed="${th === selected}" aria-checked="${th === selected}" data-action="${action}" data-value="${th}">
        <span class="pair"><i data-theme="${appearance}" data-lc-theme="${th}"></i><i data-theme="${appearance}" data-lc-theme="${th}"></i></span>
        <span class="name">${th[0].toUpperCase() + th.slice(1)}${th === "indigo" ? " · default" : ""}</span>
      </button>`).join("")}
  </div>`;
}

/* ---------- shell ---------- */

function shellHTML() {
  return `
  <div class="shell">
    ${sidebarHTML()}
    <div class="main">
      ${mainHTML()}
      ${app.panel ? panelHTML() : ""}
    </div>
  </div>`;
}

function sidebarHTML() {
  const starred = app.projects.filter((p) => p.starred);
  const rows = (list) => list.map((p) => `
    <button class="proj ${p.id === app.currentId ? "active" : ""} ${p.reachable ? "" : "unreachable"}" data-action="open-project" data-id="${p.id}" data-fkey="proj:${p.id}">
      ${p.reachable
        ? `<span class="dot" data-theme="${document.documentElement.dataset.theme}" data-lc-theme="${p.theme}"></span>`
        : `<span class="warn-glyph" title="Folder not found">${GL.warn(12)}</span>`}
      <span class="name">${esc(p.name)}</span>
      <span class="star ${p.starred ? "on" : ""}" data-action="star-project" data-id="${p.id}" role="button" tabindex="-1" title="${p.starred ? "Unstar" : "Star"}">${GL.star(p.starred)}</span>
    </button>`).join("");
  return `
  <aside class="side">
    <div class="logo">${OWL}<b>LongClaw</b></div>
    ${starred.length ? `<div class="section">Starred</div>${rows(starred)}` : ""}
    <div class="section">Local</div>
    ${rows(app.projects)}
    <div class="side-footer">
      <div class="side-meta">v0 · local · no account</div>
      ${app.waitlistJoined
        ? `<span class="waitlist-done">${GL.check} you're on the list</span>`
        : `<button class="waitlist-btn" data-action="waitlist-open">Get early access</button>`}
    </div>
  </aside>`;
}

function mainHTML() {
  const p = proj();
  if (!p) return `<div class="state-panel"><h2>No project selected</h2></div>`;
  if (!p.reachable) return unreachableHTML(p);
  if (app.loading) return skeletonHTML();
  return `
    <div class="content-header">
      <h1>${esc(p.name)}</h1>
      <button class="settings-btn" data-action="settings-open" title="Project settings" aria-label="Project settings">${GL.gear}</button>
      <button class="path-chip" data-action="copy-path" title="Copy path">${GL.folder}<span class="txt">${esc(p.path)}</span></button>
      <span id="disk-state"></span>
      <span class="spacer"></span>
      <div class="filter-wrap">
        <input id="filter" class="field" placeholder="Filter…" value="${esc(app.filter)}" autocomplete="off" spellcheck="false">
        <span class="kbd kbd-quiet">⌘F</span>
      </div>
      <button class="btn btn-ghost btn-sm" data-action="menu" data-menu="ordering" title="Board ordering — Priority (default) or Manual">
        Order: ${orderingOf(p) === "manual" ? "Manual" : "Priority"} <span style="color:var(--lc-ink-3);display:inline-flex">${GL.chev}</span>
      </button>
      <div class="view-seg" role="group" aria-label="View">
        <button data-action="set-view" data-value="board" aria-pressed="${app.view === "board"}">${GL.boardIcon} Board</button>
        <button data-action="set-view" data-value="list" aria-pressed="${app.view === "list"}">${GL.listIcon} List</button>
      </div>
      <button class="btn btn-primary" data-action="quick-create">New ticket <span class="kbd">C</span></button>
    </div>
    ${app.view === "board" ? boardHTML(p) : listHTML(p)}
    ${termRegionHTML()}`;
}

function unreachableHTML(p) {
  return `
  <div class="state-panel">
    <span class="sicon">${GL.warn(30)}</span>
    <h2>Folder not found</h2>
    <div class="path-line">${esc(p.path)}</div>
    <p class="sub">The project folder moved, or its disk isn't mounted. Your tickets are safe in their files — LongClaw never deletes or rewrites them, and this project stays listed until you decide.</p>
    <div class="actions">
      <button class="btn btn-secondary" data-action="locate-folder">Locate folder…</button>
      <button class="btn btn-ghost" data-action="remove-project-ask">Remove from app</button>
    </div>
  </div>
  ${termRegionHTML()}`;
}

function skeletonHTML() {
  const col = `<div class="col"><div class="sk sk-head"></div><div class="sk sk-card"></div><div class="sk sk-card" style="height:56px"></div></div>`;
  return `<div class="skeleton" aria-label="Loading project">${col}${col}${col}</div>${termRegionHTML()}`;
}

function termRegionHTML() {
  return `
  <div class="term-region">
    ${app.termOpen ? `<div class="term-body" style="height:${app.termH}px">terminal · phase 2 · reserved geometry (240–420px)</div>` : ""}
    <button class="term-handle" data-action="term-toggle" aria-expanded="${app.termOpen}" title="Phase 2 terminal region — geometry reserved, interior out of scope">terminal · reserved · phase 2</button>
  </div>`;
}

/* ---------- filtering & ordering ---------- */

function matchesFilter(t, p) {
  const q = app.filter.trim().toLowerCase();
  if (!q) return true;
  return t.key.toLowerCase().includes(q) || t.title.toLowerCase().includes(q) ||
    t.labels.some((l) => label(l, p).name.toLowerCase().includes(q)) ||
    statusName(t.status).toLowerCase().includes(q);
}
function visibleTickets(p) {
  return p.tickets.filter((t) => !t.archivedAt && matchesFilter(t, p));
}
function archivedTickets(p) {
  return p.tickets.filter((t) => t.archivedAt && matchesFilter(t, p));
}

/* ADR 0003 — priority order by default; Manual keeps array order (the rank stand-in). */
const PRI_ORDER = { urgent: 0, p1: 1, p2: 2, p3: 3, p4: 4, none: 5 };
const orderingOf = (p) => (p && app.orderingByProject[p.id]) || "priority";
function orderTickets(list, p) {
  if (orderingOf(p) === "manual") return list;
  return [...list].sort((a, b) => PRI_ORDER[a.priority] - PRI_ORDER[b.priority]);
}

/* ---------- board ---------- */

function boardHTML(p) {
  const tickets = visibleTickets(p);
  const cols = STATUSES.filter((s) => s.id !== "canceled" || tickets.some((t) => t.status === "canceled"));
  const empty = p.tickets.length === 0;
  if (app.filter && tickets.length === 0) {
    return `<div class="state-panel"><h2>No matches</h2><p class="sub">Nothing matches “${esc(app.filter)}”.</p>
      <div class="actions"><button class="btn btn-secondary" data-action="clear-filter">Clear filter</button></div></div>`;
  }
  return `<div class="board" role="list" aria-label="Board">
    ${cols.map((s) => {
      const cards = orderTickets(tickets.filter((t) => t.status === s.id), p);
      return `<div class="col" data-status="${s.id}">
        <div class="col-head">${statusDot(s.id)} ${esc(s.name)} <span class="count">${cards.length}</span>
          <button class="col-add" data-action="quick-create" data-status="${s.id}" title="New ticket in ${esc(s.name)}" aria-label="New ticket in ${esc(s.name)}">${GL.plus}</button>
        </div>
        <div class="cards">
          ${empty && s.id === "todo" ? guideCardHTML() : ""}
          ${cards.map(cardHTML).join("")}
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

function guideCardHTML() {
  return `<button class="card guide" data-action="quick-create" data-fkey="guide">
    <span class="big">Create your first ticket</span>
    <span>Title it, give it a checklist, point an agent at the folder.</span>
    <span class="kbd kbd-quiet">C</span>
  </button>`;
}

function cardHTML(t) {
  if (t.degraded) return degradedCardHTML(t);
  const p = proj();
  const done = t.checklist.filter((c) => c.checked).length, total = t.checklist.length;
  const acknowledgedNow = isAcknowledged(t);
  return `
  <button class="card ${acknowledgedNow ? "acknowledged" : ""} ${app.panel && app.panel.key === t.key ? "selected" : ""}"
      data-action="open-ticket" data-key="${t.key}" data-fkey="card:${t.key}" role="listitem">
    <span class="top">
      <span class="id">${esc(t.key)}</span><span class="spacer"></span>
      ${acknowledgedNow ? `<span class="pulse-dot pulsing"></span>` : ""}
      ${priGlyph(t.priority, true)}
    </span>
    <span class="title">${esc(t.title)}</span>
    <span class="foot">
      ${total ? `<span class="fraction">${done}/${total}</span><span class="progress"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></span>` : ""}
      ${t.labels.slice(0, total ? 1 : 2).map((l) => `<span class="label-chip" style="--label: var(--lc-label-${label(l, p).color})"><i></i>${esc(label(l, p).name)}</span>`).join("")}
      <span class="spacer"></span>
    </span>
    ${acknowledgedNow ? `<span class="agent-foot"><b>❯</b> updated by agent · ${relTime(t.acknowledgedAt)}</span>` : ""}
  </button>`;
}

function degradedCardHTML(t) {
  return `
  <button class="card degraded" data-action="open-raw" data-key="${t.key}" data-fkey="card:${t.key}" role="listitem">
    <span class="top"><span class="id">${GL.warn(12)} can't parse</span><span class="spacer"></span></span>
    <span class="title">${esc(t.degraded.path.replace(/^.*\.longclaw\//, ".longclaw/"))}</span>
    <span class="foot"><span class="raw-link">View raw file</span></span>
  </button>`;
}

const isAcknowledged = (t) => t.acknowledged && now() - t.acknowledgedAt < 2 * MIN;

/* ---------- issue list ---------- */

function listHTML(p) {
  const tickets = visibleTickets(p);
  if (app.filter && tickets.length === 0) {
    return `<div class="state-panel"><h2>No matches</h2><p class="sub">Nothing matches “${esc(app.filter)}”.</p>
      <div class="actions"><button class="btn btn-secondary" data-action="clear-filter">Clear filter</button></div></div>`;
  }
  if (p.tickets.length === 0) {
    return `<div class="state-panel"><h2>No tickets yet</h2><p class="sub">Create the first ticket — it becomes a file in ${esc(p.path)}/tickets.</p>
      <div class="actions"><button class="btn btn-primary" data-action="quick-create">New ticket <span class="kbd">C</span></button></div></div>`;
  }
  const groups = STATUSES.filter((s) => tickets.some((t) => t.status === s.id));
  const archived = archivedTickets(p);
  return `<div class="list">
    ${groups.map((s) => `
      <div class="group-head">${statusDot(s.id)} ${esc(s.name)} <span class="count">${tickets.filter((t) => t.status === s.id).length}</span></div>
      <div class="rows">
        ${orderTickets(tickets.filter((t) => t.status === s.id), p).map((t) => rowHTML(t, p)).join("")}
      </div>`).join("")}
    ${archived.length ? `
      <button class="group-head archived-head" data-action="toggle-archived" aria-expanded="${app.showArchived}">
        <span style="display:inline-flex;color:var(--lc-ink-3)">${GL.folder}</span> Archived <span class="count">${archived.length}</span>
        <span style="color:var(--lc-ink-3);font-size:11px">${app.showArchived ? "hide" : "show"}</span>
      </button>
      ${app.showArchived ? `<div class="rows archived-rows">${archived.map((t) => rowHTML(t, p)).join("")}</div>` : ""}` : ""}
  </div>`;
}

function rowHTML(t, p) {
  if (t.degraded) return `
    <button class="row degraded" data-action="open-raw" data-key="${t.key}" data-fkey="row:${t.key}">
      <span class="warn-glyph">${GL.warn(12)}</span>
      <span class="id">${esc(t.key)}</span>
      <span class="title">${esc(t.degraded.path.replace(/^.*\.longclaw\//, ".longclaw/"))} — can't parse</span>
      <span class="raw-link">View raw file</span>
    </button>`;
  const done = t.checklist.filter((c) => c.checked).length, total = t.checklist.length;
  return `
  <button class="row ${app.panel && app.panel.key === t.key ? "selected" : ""}" data-action="open-ticket" data-key="${t.key}" data-fkey="row:${t.key}">
    ${statusDot(t.status, 13)}
    <span class="id">${esc(t.key)}</span>
    ${priGlyph(t.priority, true)}
    <span class="title">${esc(t.title)}</span>
    ${isAcknowledged(t) ? `<span class="acknowledged-dot pulsing" title="Updated by agent"></span>` : ""}
    ${total ? `<span class="fraction">${done}/${total}</span>` : ""}
    ${t.labels.slice(0, 2).map((l) => `<span class="label-chip" style="--label: var(--lc-label-${label(l, p).color})"><i></i>${esc(label(l, p).name)}</span>`).join("")}
    <span class="updated">${relTime(t.updatedAt)}</span>
  </button>`;
}

/* ---------- ticket panel ---------- */

function panelHTML() {
  const pn = app.panel;
  if (pn.mode === "create") return createPanelHTML();
  const t = findTicket(pn.key);
  if (!t) return "";
  const p = proj();
  const done = t.checklist.filter((c) => c.checked).length, total = t.checklist.length;
  return `
  <div class="panel-wrap"><div class="panel" role="dialog" aria-label="${esc(t.key)}">
    <div class="panel-head">
      <button class="id-chip" data-action="copy-id" data-key="${t.key}" title="Copy ${esc(t.key)}">${esc(t.key)}</button>
      <span class="path-chip" style="cursor:default">${GL.folder}<span class="txt">tickets/${esc(t.key)}/ticket.md</span></span>
      ${t.archivedAt ? `<span class="kbd kbd-quiet" title="Hidden from board and default views">archived</span>` : ""}
      <span class="spacer"></span>
      <button class="btn btn-ghost btn-sm" data-action="archive-ticket" data-key="${t.key}">${t.archivedAt ? "Unarchive" : "Archive"}</button>
      <button class="panel-close" data-action="close-panel" aria-label="Close ticket" title="Close · Esc">${GL.x}</button>
    </div>
    <div class="panel-body">
      ${pn.conflict ? conflictBannerHTML(pn) : ""}
      <textarea id="panel-title" class="panel-title" rows="1" spellcheck="false">${esc(t.title)}</textarea>
      <div class="meta-grid">
        <span class="mlabel">Status</span>
        <span><button class="meta-trigger" data-action="menu" data-menu="status" data-key="${t.key}">${statusDot(t.status, 13)} ${esc(statusName(t.status))} <span style="color:var(--lc-ink-3);display:inline-flex">${GL.chev}</span></button></span>
        <span class="mlabel">Priority</span>
        <span><button class="meta-trigger" data-action="menu" data-menu="priority" data-key="${t.key}">${priGlyph(t.priority, true)} ${esc(PRIORITIES.find((x) => x.id === t.priority).name)} <span style="color:var(--lc-ink-3);display:inline-flex">${GL.chev}</span></button></span>
        <span class="mlabel">Labels</span>
        <span class="meta-labels">
          ${t.labels.map((l) => `<span class="label-chip lg" style="--label: var(--lc-label-${label(l, p).color})"><i></i>${esc(label(l, p).name)}</span>`).join("")}
          <button class="label-chip lg addable" data-action="menu" data-menu="label" data-key="${t.key}">${GL.plus} add</button>
        </span>
      </div>

      <div class="panel-section">
        <div class="shead">Description
          <span class="spacer"></span>
          ${!pn.editingDesc ? `<button class="btn btn-ghost btn-sm" data-action="edit-desc" data-key="${t.key}">${GL.pencil} Edit</button>` : ""}
        </div>
        ${pn.editingDesc ? editorHTML(pn) : `
          <div class="desc-rendered ${t.description.trim() ? "" : "empty"}" data-action="edit-desc" data-key="${t.key}" title="Click to edit">
            ${t.description.trim() ? md(t.description) : "Add a description — agents read this before they start."}
          </div>`}
      </div>

      <div class="panel-section">
        <div class="shead">Checklist <span class="mono-meta">${total ? `${done}/${total}` : ""}</span>
          ${total ? `<span class="progress" style="width:56px"><i style="width:${Math.round(done / total * 100)}%; ${t.checklist.some((c) => c.agentAcknowledged) ? "background: var(--lc-accent-agent)" : ""}"></i></span>` : ""}
        </div>
        <div class="checklist">
          ${t.checklist.map((c) => `
            <button class="check-row ${c.checked ? "checked" : ""} ${c.agentAcknowledged ? "acknowledged-agent" : ""}" data-action="toggle-check" data-key="${t.key}" data-item="${c.id}" data-fkey="check:${c.id}">
              <span class="box">${checkbox(c.checked, c.agentAcknowledged)}</span>
              <span class="txt">${esc(c.text)}</span>
              ${c.agentAcknowledged ? `<span class="agent-when">❯ just now</span>` : ""}
            </button>`).join("")}
          <div class="check-add">
            <span class="box" style="width:15px;flex:none;display:inline-flex;margin-left:6px;opacity:.5">${checkbox(false)}</span>
            <input id="check-add" class="field" placeholder="Add an item — the human→agent work interface" autocomplete="off" spellcheck="false">
          </div>
        </div>
      </div>

      <div class="panel-section">
        <div class="shead">Activity <span class="mono-meta">${t.activity.length}</span></div>
        ${timelineHTML(t)}
        <div class="composer">
          ${avatar(PEOPLE[ME])}
          <div style="flex:1">
            <textarea id="composer" class="field" rows="1" placeholder="Leave a comment… ⌘Enter to post"></textarea>
            <div class="composer-foot"><button class="btn btn-secondary btn-sm" data-action="post-comment" data-key="${t.key}">Comment</button></div>
          </div>
        </div>
      </div>
    </div>
  </div></div>`;
}

function editorHTML(pn) {
  return `
  <div class="editor editing">
    <div class="editor-tabs" role="tablist">
      <button class="tab" role="tab" aria-selected="${pn.descTab === "write"}" data-action="desc-tab" data-value="write">Write</button>
      <button class="tab" role="tab" aria-selected="${pn.descTab === "preview"}" data-action="desc-tab" data-value="preview">Preview</button>
      <div class="editor-tools" aria-label="Formatting">
        <button data-action="fmt" data-value="**" title="Bold"><b>B</b></button>
        <button data-action="fmt" data-value="*" title="Italic"><i>I</i></button>
        <button data-action="fmt" data-value="\`" title="Code"><span class="mono">&lt;&gt;</span></button>
        <button data-action="fmt-line" data-value="- " title="List">•–</button>
        <button data-action="fmt-line" data-value="- [ ] " title="Task">☐</button>
        <button data-action="fmt-link" title="Link">🔗</button>
      </div>
    </div>
    ${pn.descTab === "write"
      ? `<textarea id="desc-edit" class="editor-write" spellcheck="false">${esc(pn.draftDesc)}</textarea>`
      : `<div class="editor-preview">${md(pn.draftDesc) || `<span style="color:var(--lc-ink-3)">Nothing to preview.</span>`}</div>`}
    <div class="editor-foot">
      <span class="path-chip" style="cursor:default">${GL.folder}<span class="txt">writes to ticket.md on save</span></span>
      <span class="spacer"></span>
      <button class="btn btn-ghost btn-sm" data-action="cancel-desc">Cancel <span class="kbd kbd-quiet">Esc</span></button>
      <button class="btn btn-primary btn-sm" data-action="save-desc">Save <span class="kbd">⌘↵</span></button>
    </div>
  </div>`;
}

function conflictBannerHTML(pn) {
  return `
  <div class="banner banner-warn" role="alert">
    <span class="bicon">${GL.warn(15)}</span>
    <span class="btext"><b>Changed on disk while you were editing.</b>
      <span class="sub">${esc(pn.conflict.by)} edited this ticket's file ${relTime(pn.conflict.at)} ago. Your unsaved edit is preserved either way.</span>
    </span>
    <span class="bactions">
      <button class="btn btn-secondary btn-sm" data-action="conflict-reload">Reload file</button>
      <button class="btn btn-ghost btn-sm" data-action="conflict-keep">Keep mine</button>
    </span>
  </div>`;
}

function timelineHTML(t) {
  const items = [...t.activity].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  return `<div class="timeline">
    ${items.map((a) => {
      const isAgent = a.actor.type === "agent";
      if (a.kind === "comment") {
        return `<div class="t-entry ${isAgent ? "agent" : ""}">
          ${isAgent ? agentTile : avatar(PEOPLE[a.actor.id] || { name: a.actor.name, initials: "?", tint: "gray" })}
          <div class="t-body">
            <div class="t-head">
              <span class="t-name">${esc(a.actor.name)}</span>
              ${isAgent ? `<span class="t-badge">agent</span>` : ""}
              <span class="t-when">${relTime(a.at)}${a.via ? ` · via ${esc(a.via)}` : ""}</span>
            </div>
            <div class="t-text">${md(a.body)}</div>
          </div>
        </div>`;
      }
      return `<div class="t-event">
        <span class="glyph-wrap">${eventGlyph(a.ev)}</span>
        <span>${eventText(a)}</span>
        <span class="t-when">${relTime(a.at)}${a.via ? ` · via ${esc(a.via)}` : ""}</span>
      </div>`;
    }).join("")}
  </div>`;
}

function eventGlyph(ev) {
  if (ev.field === "status") return statusDot(ev.to, 12);
  if (ev.field === "checklist") return GL.boxTicked;
  if (ev.field === "description") return GL.pencil;
  if (ev.field === "created") return GL.plus;
  if (ev.field === "priority") return GL.chev;
  if (ev.field === "archived" || ev.field === "unarchived") return GL.folder;
  if (ev.field === "external") return GL.warn(12);
  return GL.chev;
}
function actorSpan(a) {
  return a.actor.type === "agent"
    ? `<span class="actor-a">❯ ${esc(a.actor.name)}</span>`
    : `<span class="actor-h">${esc(a.actor.name)}</span>`;
}
function eventText(a) {
  const e = a.ev;
  if (e.field === "created") return `${actorSpan(a)} created this ticket`;
  if (e.field === "status") return `${actorSpan(a)} changed status ${esc(statusName(e.from))} → ${esc(statusName(e.to))}`;
  if (e.field === "checklist") return `${actorSpan(a)} ${e.to ? "checked" : "unchecked"} “${esc(e.item)}”`;
  if (e.field === "description") return `${actorSpan(a)} edited the description${e.note ? ` — ${esc(e.note)}` : ""}`;
  if (e.field === "priority") return `${actorSpan(a)} set priority to ${esc(e.to)}`;
  if (e.field === "archived") return `${actorSpan(a)} archived this ticket`;
  if (e.field === "unarchived") return `${actorSpan(a)} unarchived this ticket`;
  if (e.field === "renamed") return `${actorSpan(a)} renamed this ticket`;
  if (e.field === "external") return `file changed on disk — actor unknown`;
  return `${actorSpan(a)} updated this ticket`;
}

/* ---------- full create panel ---------- */

function createPanelHTML() {
  const d = app.panel.draft;
  const p = proj();
  return `
  <div class="panel-wrap"><div class="panel" role="dialog" aria-label="New ticket">
    <div class="panel-head">
      <span class="id-chip" style="cursor:default">${esc(p.key)}-${p.seq} · new</span>
      <span class="spacer"></span>
      <button class="panel-close" data-action="close-panel" aria-label="Cancel" title="Cancel · Esc">${GL.x}</button>
    </div>
    <div class="panel-body">
      <textarea id="create-title" class="panel-title" rows="1" placeholder="Ticket title" spellcheck="false">${esc(d.title)}</textarea>
      <div class="meta-grid">
        <span class="mlabel">Status</span>
        <span><button class="meta-trigger" data-action="menu" data-menu="create-status">${statusDot(d.status, 13)} ${esc(statusName(d.status))} <span style="color:var(--lc-ink-3);display:inline-flex">${GL.chev}</span></button></span>
        <span class="mlabel">Priority</span>
        <span><button class="meta-trigger" data-action="menu" data-menu="create-priority">${priGlyph(d.priority, true)} ${esc(PRIORITIES.find((x) => x.id === d.priority).name)} <span style="color:var(--lc-ink-3);display:inline-flex">${GL.chev}</span></button></span>
        <span class="mlabel">Labels</span>
        <span class="meta-labels">
          ${d.labels.map((l) => `<span class="label-chip lg" style="--label: var(--lc-label-${label(l, p).color})"><i></i>${esc(label(l, p).name)}</span>`).join("")}
          <button class="label-chip lg addable" data-action="menu" data-menu="create-label">${GL.plus} add</button>
        </span>
      </div>
      <div class="panel-section">
        <div class="shead">Description</div>
        <div class="editor editing">
          <textarea id="create-desc" class="editor-write" placeholder="What should happen? Agents read this before they start." spellcheck="false">${esc(d.description)}</textarea>
        </div>
      </div>
      <div class="panel-section">
        <div class="shead">Checklist</div>
        <div class="checklist">
          ${d.checklist.map((c, i) => `
            <div class="check-row"><span class="box">${checkbox(false)}</span><span class="txt">${esc(c)}</span>
              <button class="panel-close" style="margin-left:auto" data-action="create-check-rm" data-i="${i}" aria-label="Remove item">${GL.x}</button></div>`).join("")}
          <div class="check-add">
            <span class="box" style="width:15px;flex:none;display:inline-flex;margin-left:6px;opacity:.5">${checkbox(false)}</span>
            <input id="create-check-add" class="field" placeholder="Add an item" autocomplete="off" spellcheck="false">
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" data-action="create-confirm">Create ticket <span class="kbd">⌘↵</span></button>
        <button class="btn btn-ghost" data-action="close-panel">Cancel</button>
      </div>
    </div>
  </div></div>`;
}

/* ---------- overlays ---------- */

function overlayHTML() {
  let html = "";
  const o = app.overlay;
  if (o) {
    if (o.type === "palette") html = paletteHTML(o);
    else if (o.type === "quick") html = quickCreateHTML(o);
    else if (o.type === "settings") html = settingsHTML();
    else if (o.type === "waitlist") html = waitlistHTML(o);
    else if (o.type === "raw") html = rawHTML(o);
    else if (o.type === "folder") html = folderHTML(o);
    else if (o.type === "confirm") html = confirmHTML(o);
  }
  if (app.menu) html += menuHTML(app.menu);
  return html;
}

/* command palette */
function paletteCommands() {
  const p = proj();
  const target = paletteTarget();
  const needTicket = target ? "" : "Focus a ticket first";
  return [
    { id: "create", name: "Create ticket…", glyph: GL.plus, kbd: "C" },
    { id: "go-project", name: "Go to project…", glyph: GL.arrowGo, sub: "" },
    { id: "status", name: "Change status…", glyph: statusDot("in_progress", 13), kbd: "S", disabled: needTicket },
    { id: "priority", name: "Set priority…", glyph: priGlyph("p2", true), kbd: "P", disabled: needTicket },
    { id: "search", name: "Search tickets…", glyph: GL.search },
    { id: "star", name: p && p.starred ? "Unstar project" : "Star project", glyph: GL.star(false) },
    { id: "appearance", name: "Toggle appearance", glyph: GL.moon },
    { id: "theme", name: "Change project theme…", glyph: GL.swatchG },
    { id: "archive", name: target && target.archivedAt ? "Unarchive ticket" : "Archive ticket", glyph: GL.folder, disabled: needTicket, sub: "adr 0004" },
    { id: "ordering", name: "Change board ordering…", glyph: GL.listIcon, sub: "adr 0003" },
    { id: "view", name: app.view === "board" ? "Switch to list view" : "Switch to board view", glyph: app.view === "board" ? GL.listIcon : GL.boardIcon, sub: "step 2 proposal" },
    { id: "terminal", name: "New terminal", glyph: GL.term, disabled: "arrives with Phase 2", phase2: true },
  ];
}
function paletteTarget() {
  if (app.panel && app.panel.mode !== "create") return findTicket(app.panel.key);
  if (app.focusKey) return findTicket(app.focusKey);
  return null;
}
function paletteHTML(o) {
  const q = (o.query || "").toLowerCase();
  let rows = "", crumb = "", placeholder = "Type a command…";
  const mk = (r, i) =>
    `<button class="palette-row ${i === o.sel ? "active" : ""}" data-action="palette-pick" data-i="${i}" ${r.disabled ? `aria-disabled="true"` : ""}>
      <span class="pglyph">${r.glyph || ""}</span><span>${r.html || esc(r.name)}</span>
      ${r.sub ? `<span class="sub">· ${esc(r.sub)}</span>` : ""}
      ${r.disabled && !r.phase2 ? `<span class="sub">· ${esc(r.disabled)}</span>` : ""}
      <span class="hint">${r.phase2 ? `<span class="phase-tag">phase 2</span>` : r.kbd ? `<span class="kbd kbd-quiet">${r.kbd}</span>` : ""}</span>
    </button>`;
  if (o.mode === "root") {
    o.items = paletteCommands().filter((c) => c.name.toLowerCase().includes(q));
    rows = o.items.map(mk).join("");
  } else if (o.mode === "search") {
    crumb = "search";
    placeholder = "Search tickets…";
    const p = proj();
    o.items = !p ? [] : p.tickets.filter((t) => !t.degraded &&
      (t.key.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))).slice(0, 9)
      .map((t) => ({ id: "open", key: t.key, glyph: statusDot(t.status, 13),
        html: `<span class="mono" style="font-size:11px;color:var(--lc-ink-3);margin-right:6px">${esc(t.key)}</span>${esc(t.title)}${t.archivedAt ? ` <span class="sub">· archived</span>` : ""}` }));
    rows = o.items.map(mk).join("");
  } else if (o.mode === "project") {
    crumb = "go to project";
    o.items = app.projects.filter((pp) => pp.name.toLowerCase().includes(q))
      .map((pp) => ({ id: "project", pid: pp.id, glyph: pp.reachable
        ? `<span class="dot" style="width:6px;height:6px;border-radius:50%;background:var(--lc-accent-human);display:inline-block" data-theme="${document.documentElement.dataset.theme}" data-lc-theme="${pp.theme}"></span>`
        : GL.warn(11),
        html: `${esc(pp.name)}${pp.reachable ? "" : ` <span class="sub">· unreachable</span>`}` }));
    rows = o.items.map(mk).join("");
  } else if (o.mode === "status" || o.mode === "priority" || o.mode === "ordering" || o.mode === "theme") {
    const t = paletteTarget();
    crumb = o.mode === "theme" ? "theme" : o.mode === "ordering" ? "board ordering" : `${o.mode} · ${t ? t.key : ""}`;
    if (o.mode === "status") o.items = STATUSES.filter((s) => s.name.toLowerCase().includes(q))
      .map((s) => ({ id: "set-status", val: s.id, glyph: statusDot(s.id, 13), name: s.name }));
    if (o.mode === "priority") o.items = PRIORITIES.filter((s) => s.name.toLowerCase().includes(q))
      .map((s) => ({ id: "set-priority", val: s.id, glyph: priGlyph(s.id, true), name: s.name }));
    if (o.mode === "ordering") o.items = [["priority", "Priority — Urgent first (default)"], ["manual", "Manual — your order, kept in each ticket's rank"]]
      .filter(([, n]) => n.toLowerCase().includes(q))
      .map(([v, n]) => ({ id: "set-ordering", val: v, glyph: GL.listIcon, name: n }));
    if (o.mode === "theme") o.items = ["indigo", "clay", "slate", "plum", "graphite"].filter((th) => th.includes(q))
      .map((th) => ({ id: "set-theme", val: th, name: th[0].toUpperCase() + th.slice(1),
        glyph: `<span style="display:inline-flex;width:16px;height:11px;border-radius:2px;overflow:hidden" data-theme="${document.documentElement.dataset.theme}" data-lc-theme="${th}"><i style="flex:2;background:var(--lc-accent-human)"></i><i style="flex:1;background:var(--lc-accent-agent)"></i></span>` }));
    rows = o.items.map(mk).join("");
  }
  return `
  <div class="scrim" data-action="overlay-dismiss">
    <div class="modal" role="dialog" aria-label="Command palette">
      <div class="palette-input-row">
        <span class="pglyph">${GL.search}</span>
        ${crumb ? `<span class="palette-crumb">${esc(crumb)}</span>` : ""}
        <input id="palette-input" class="palette-input" placeholder="${placeholder}" value="${esc(o.query || "")}" autocomplete="off" spellcheck="false">
        <span class="kbd kbd-quiet">esc</span>
      </div>
      <div class="palette-list">${rows || `<div class="palette-empty">No results for “${esc(o.query)}”.</div>`}</div>
      <div class="palette-foot"><span>↑↓ navigate</span><span>↵ run</span><span>esc ${o.mode === "root" ? "close" : "back"}</span></div>
    </div>
  </div>`;
}

/* quick create */
function quickCreateHTML(o) {
  const p = proj();
  return `
  <div class="scrim" data-action="overlay-dismiss">
    <div class="modal qc" role="dialog" aria-label="New ticket">
      <div class="qc-row">
        <span class="qc-project"><span class="dot" style="width:6px;height:6px;border-radius:50%;background:var(--lc-accent-human);display:inline-block"></span>${esc(p.name)} · ${esc(p.key)}-${p.seq}</span>
      </div>
      <div class="qc-row" style="padding-top:0">
        <input id="qc-title" class="qc-title" placeholder="Ticket title — that's all it needs" value="${esc(o.title || "")}" autocomplete="off" spellcheck="false">
      </div>
      <div class="qc-meta">
        <button class="meta-trigger" data-action="menu" data-menu="qc-status">${statusDot(o.status, 13)} ${esc(statusName(o.status))} <span style="color:var(--lc-ink-3);display:inline-flex">${GL.chev}</span></button>
      </div>
      <div class="qc-foot">
        <button class="btn btn-ghost btn-sm" data-action="qc-full">Open full editor ${GL.arrowGo}</button>
        <span class="spacer"></span>
        <span class="hint"><span>↵ create</span><span>esc cancel</span></span>
        <button class="btn btn-primary btn-sm" data-action="qc-confirm">Create</button>
      </div>
    </div>
  </div>`;
}

/* settings */
function settingsHTML() {
  const p = proj();
  const locked = p.tickets.length > 0;
  return `
  <div class="scrim center" data-action="overlay-dismiss">
    <div class="modal" role="dialog" aria-label="Project settings">
      <div class="dialog">
        <h2>Project settings</h2>
        <p class="dsub">Everything here is stored in <span class="mono" style="font-size:11.5px">longclaw.yaml</span> inside the project folder — portable with the files.</p>
        <div class="row keyrow" style="display:flex;gap:10px">
          <div style="flex:1"><label for="set-name">Name</label><input id="set-name" class="field" value="${esc(p.name)}" spellcheck="false"></div>
          <div><label for="set-key">Key</label>
            <div class="lockrow"><input id="set-key" class="field field-mono" style="width:82px;text-transform:uppercase" value="${esc(p.key)}" ${locked ? "disabled" : ""}>
            ${locked ? `<span class="lock-note">locked after first ticket</span>` : ""}</div></div>
        </div>
        <div class="row">
          <label>Folder</label>
          <div class="pathrow">
            <span class="picked-path"><span style="display:inline-flex;color:var(--lc-ink-3)">${GL.folder}</span>${esc(p.path)}</span>
            <button class="btn btn-secondary" data-action="locate-folder">Locate…</button>
          </div>
        </div>
        <div class="row"><label>Theme</label>${themePickerHTML(p.theme, "set-theme")}</div>
        <div class="row"><label>Appearance <span style="text-transform:none;font-weight:400">— app preference, not stored in the project</span></label>
          <div class="seg-appearance" role="group">
            ${["system", "light", "dark"].map((m) => `<button data-action="set-appearance" data-value="${m}" aria-pressed="${app.appearancePref === m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join("")}
          </div>
        </div>
        <div class="danger-zone">
          <div class="pathrow">
            <span class="micro" style="flex:1">Removing only forgets the project in LongClaw.<br>Files on disk are never touched.</span>
            <button class="btn btn-danger" data-action="remove-project-ask">Remove from app</button>
          </div>
        </div>
        <div class="dfoot"><span class="spacer"></span><button class="btn btn-secondary" data-action="overlay-close">Done</button></div>
      </div>
    </div>
  </div>`;
}

/* waitlist */
function waitlistHTML(o) {
  if (o.stage === "done") return `
  <div class="scrim center" data-action="overlay-dismiss">
    <div class="modal confirm" role="dialog" aria-label="Waitlist joined">
      <div class="dialog"><div class="waitlist-ok">
        <span class="ok-glyph"><svg width="30" height="30" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4.2 7.3 L6.2 9.2 L9.8 4.9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <h2>You're on the list</h2>
        <p class="dsub">We'll email <b>${esc(o.email)}</b> when sync opens. Nothing changes until then — local projects never need an account.</p>
        <div class="dfoot"><button class="btn btn-secondary" data-action="overlay-close">Done</button></div>
      </div></div>
    </div>
  </div>`;
  return `
  <div class="scrim center" data-action="overlay-dismiss">
    <div class="modal confirm" role="dialog" aria-label="Get early access">
      <div class="dialog">
        <h2>Early access to sync &amp; teams</h2>
        <p class="dsub">Cloud sync keeps a team's project folders in real-time sync — your files stay local, and stay yours. Leave an email to try it first.</p>
        <div class="row">
          <label for="wl-email">Email</label>
          <input id="wl-email" class="field ${o.error ? "invalid" : ""}" type="email" placeholder="you@example.com" value="${esc(o.email || "")}" autocomplete="off" spellcheck="false">
          ${o.error ? `<div class="field-msg">${GL.warn(12)} ${esc(o.error)}</div>` : ""}
        </div>
        <p class="micro" style="margin-top:12px">One email when sync opens. No product updates, no telemetry, and this never gates a local feature.</p>
        <div class="dfoot">
          <button class="btn btn-primary" data-action="waitlist-join">Join the waitlist</button>
          <button class="btn btn-ghost" data-action="overlay-close">Not now</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* raw file view */
function rawHTML(o) {
  const t = findTicket(o.key);
  if (!t || !t.degraded) return "";
  const d = t.degraded;
  const lines = d.raw.split("\n");
  return `
  <div class="scrim" data-action="overlay-dismiss">
    <div class="modal raw-modal" role="dialog" aria-label="Raw ticket file">
      <div class="raw-head">
        <span style="color:var(--lc-danger);display:inline-flex">${GL.warn(15)}</span>
        <span class="fpath">${esc(d.path)}</span>
        <span class="spacer"></span>
        <button class="panel-close" data-action="overlay-close" aria-label="Close">${GL.x}</button>
      </div>
      <div class="raw-error">${GL.warn(13)}<span>${esc(d.error)}</span></div>
      <div class="raw-body"><pre>${lines.map((l, i) =>
        `<span class="ln ${i + 1 === d.badLine ? "bad" : ""}"><span class="n">${i + 1}</span><span>${esc(l) || " "}</span></span>`).join("")}</pre></div>
      <div class="raw-foot">
        <span class="micro">The file is shown exactly as it is on disk. LongClaw never rewrites or discards content it can't parse.</span>
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" data-action="raw-editor">Open in editor</button>
        <button class="btn btn-secondary btn-sm" data-action="raw-retry" data-key="${t.key}">Retry parse</button>
      </div>
    </div>
  </div>`;
}

/* simulated native folder picker */
function folderHTML(o) {
  const rows = o.mode === "locate"
    ? [{ path: proj().path.replace("~/dev/", "~/moved/").replace(/\/\.longclaw$/, ""), note: "contains .longclaw" },
       { path: "~/dev/scratch", note: "" }]
    : [{ path: "~/dev/acme-app", note: "" },
       { path: "~/dev/orbit", note: "contains .longclaw" },
       { path: "~/notes", note: "" }];
  return `
  <div class="scrim center" data-action="overlay-dismiss">
    <div class="modal fp" role="dialog" aria-label="Choose a folder">
      <div class="fp-head">
        <span class="sim-tag">native folder picker · simulated in prototype</span>
        <h2>${o.mode === "locate" ? "Locate the project folder" : "Choose a folder for this project"}</h2>
      </div>
      <div class="fp-list">
        ${rows.map((r, i) => `<button class="fp-row" data-action="folder-pick" data-path="${esc(r.path)}" data-note="${esc(r.note)}">
          <span style="display:inline-flex;color:var(--lc-ink-3)">${GL.folder}</span>${esc(r.path)}
          ${r.note ? `<span class="note">${esc(r.note)}</span>` : ""}</button>`).join("")}
      </div>
      <div class="fp-foot"><span class="spacer"></span><button class="btn btn-ghost" data-action="overlay-close">Cancel</button></div>
    </div>
  </div>`;
}

/* confirm (remove project) */
function confirmHTML(o) {
  return `
  <div class="scrim center" data-action="overlay-dismiss">
    <div class="modal confirm" role="dialog" aria-label="${esc(o.title)}">
      <div class="dialog">
        <h2 style="font-size:16px">${esc(o.title)}</h2>
        <p class="dsub">${o.bodyHtml}</p>
        <div class="dfoot">
          <span class="spacer"></span>
          <button class="btn btn-ghost" data-action="overlay-close">Cancel</button>
          <button class="btn btn-danger" data-action="${esc(o.confirmAction)}">${esc(o.confirmLabel)}</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* anchored menus (status / priority / ordering / label pickers) */
function menuHTML(m) {
  const p = proj();
  let rows = "", note = "";
  const t = m.key ? findTicket(m.key) : null;
  const cur = (v) => `<span class="check">${GL.check}</span>`;
  if (m.type.endsWith("status")) {
    const sel = m.type === "status" ? (t && t.status) : (m.type === "qc-status" ? app.overlay.status : app.panel.draft.status);
    rows = STATUSES.map((s) => `<button class="menu-row" data-action="menu-pick" data-value="${s.id}">${statusDot(s.id, 13)} ${esc(s.name)} ${s.id === sel ? cur() : ""}</button>`).join("");
  } else if (m.type.endsWith("priority")) {
    const sel = m.type === "priority" ? (t && t.priority) : app.panel.draft.priority;
    rows = PRIORITIES.map((s) => `<button class="menu-row" data-action="menu-pick" data-value="${s.id}">${priGlyph(s.id, true)} ${esc(s.name)} ${s.id === sel ? cur() : ""}</button>`).join("");
  } else if (m.type === "ordering") {
    const sel = orderingOf(p);
    rows = [["priority", "Priority", "Urgent first — the default"], ["manual", "Manual", "your order, kept in rank"]]
      .map(([v, n, sub]) => `<button class="menu-row" data-action="menu-pick" data-value="${v}">${GL.listIcon} ${n} <span style="color:var(--lc-ink-3);font-size:11px">· ${sub}</span> ${v === sel ? cur() : ""}</button>`).join("");
    note = `<div class="menu-note">Ordering is a view preference on this board — it never rewrites files.</div>`;
  } else if (m.type.endsWith("label")) {
    const sel = m.type === "label" ? (t ? t.labels : []) : app.panel.draft.labels;
    rows = Object.entries(p.labels).map(([slug, l]) =>
      `<button class="menu-row" data-action="menu-pick" data-value="${slug}"><span class="label-chip" style="--label: var(--lc-label-${l.color})"><i></i>${esc(l.name)}</span> ${sel.includes(slug) ? cur() : ""}</button>`).join("");
  }
  return `<div class="menu" style="left:${m.x}px; top:${m.y}px" role="menu">${rows}${note}</div>`;
}

/* ================= focus management ================= */

function restoreFocus() {
  if (app.overlay) {
    const inp = $("#palette-input") || $("#qc-title") || $("#wl-email") || $(".modal .fp-row") || $(".modal .btn-primary") || $(".modal button");
    if (inp) { inp.focus(); if (inp.select && inp.id === "qc-title" && inp.value) inp.select(); }
    return;
  }
  if (app.menu) { const r = $(".menu .menu-row"); if (r) r.focus(); return; }
  if (app.pendingFocusId) { const el = document.getElementById(app.pendingFocusId); app.pendingFocusId = null; if (el) { el.focus(); return; } }
  if (app.focusKey) {
    const el = $(`[data-fkey="card:${app.focusKey}"]`) || $(`[data-fkey="row:${app.focusKey}"]`);
    if (el) el.focus({ preventScroll: false });
  }
}

/* keyboard-order list of visible ticket keys (board: column-major; list: flat) */
function navKeys() {
  const p = proj();
  if (!p || !p.reachable) return [];
  const tk = visibleTickets(p);
  const order = [];
  STATUSES.forEach((s) => orderTickets(tk.filter((t) => t.status === s.id), p).forEach((t) => order.push(t.key)));
  return order;
}
function boardColumns() {
  const p = proj();
  const tk = visibleTickets(p);
  return STATUSES.map((s) => orderTickets(tk.filter((t) => t.status === s.id), p).map((t) => t.key)).filter((c) => c.length);
}
function moveFocus(dir) {
  const keys = navKeys();
  if (!keys.length) return;
  if (app.view === "list" || dir === "next" || dir === "prev") {
    const i = keys.indexOf(app.focusKey);
    const ni = dir === "prev" ? (i <= 0 ? keys.length - 1 : i - 1) : (i < 0 || i === keys.length - 1 ? 0 : i + 1);
    app.focusKey = keys[ni];
  }
  render();
}
function moveFocusBoard(dx, dy) {
  const cols = boardColumns();
  if (!cols.length) return;
  let ci = cols.findIndex((c) => c.includes(app.focusKey)), ri = ci >= 0 ? cols[ci].indexOf(app.focusKey) : 0;
  if (ci < 0) { ci = 0; ri = 0; }
  else if (dy) ri = Math.min(Math.max(ri + dy, 0), cols[ci].length - 1);
  else if (dx) { ci = Math.min(Math.max(ci + dx, 0), cols.length - 1); ri = Math.min(ri, cols[ci].length - 1); }
  app.focusKey = cols[ci][ri];
  render();
}

/* ================= ticket mutations ================= */

function setStatus(t, to, actor = humanActor(ME), via) {
  const from = t.status;
  if (from === to) return;
  mutate(t, () => { t.status = to; addEvent(t, actor, { field: "status", from, to }, via); },
    { toast: `${t.key} → ${statusName(to)}`, undo: () => { t.status = from; t.activity.pop(); } });
}
function setPriority(t, to) {
  const from = t.priority;
  if (from === to) return;
  mutate(t, () => { t.priority = to; addEvent(t, humanActor(ME), { field: "priority", from, to: PRIORITIES.find((p) => p.id === to).name }); },
    { toast: `${t.key} priority: ${PRIORITIES.find((p) => p.id === to).name}`, undo: () => { t.priority = from; t.activity.pop(); } });
}
function toggleLabel(t, slug) {
  const had = t.labels.includes(slug);
  mutate(t, () => { t.labels = had ? t.labels.filter((l) => l !== slug) : [...t.labels, slug]; },
    { undo: () => { t.labels = had ? [...t.labels, slug] : t.labels.filter((l) => l !== slug); } });
}
function toggleCheck(t, itemId, actor = humanActor(ME), via) {
  const c = t.checklist.find((x) => x.id === itemId);
  if (!c) return;
  const was = c.checked;
  mutate(t, () => {
    c.checked = !was; c.agentAcknowledged = actor.type === "agent" && c.checked;
    addEvent(t, actor, { field: "checklist", item: c.text, to: c.checked }, via);
  }, { undo: () => { c.checked = was; c.agentAcknowledged = false; t.activity.pop(); } });
}
function createTicket({ title, status = "todo", priority = "none", assignee = null, labels = [], description = "", checklist = [] }) {
  const p = proj();
  const t = T({
    key: `${p.key}-${p.seq++}`, title: title.trim(), status, priority, assignee, labels,
    description, checklist: checklist.map((x) => ck(x)),
    createdAt: now(), updatedAt: now(),
    activity: [{ id: uid("ev"), kind: "event", actor: humanActor(ME), at: now(), ev: { field: "created" } }],
  });
  p.tickets.unshift(t);
  disk(`tickets/${t.key}/ticket.md`);
  ticker(`<b>❯</b> created .longclaw/tickets/${t.key}/ticket.md`);
  pushUndo(() => { p.tickets = p.tickets.filter((x) => x.key !== t.key); p.seq--; if (app.panel && app.panel.key === t.key) app.panel = null; });
  toast(`${t.key} created`, { undo: true });
  return t;
}
/* ADR 0004 — archive sets archived_at; never moves or deletes the directory. */
function toggleArchive(t) {
  const was = t.archivedAt;
  mutate(t, () => {
    t.archivedAt = was ? null : now();
    addEvent(t, humanActor(ME), { field: was ? "unarchived" : "archived" });
  }, { toast: was ? `${t.key} unarchived` : `${t.key} archived`, undo: () => { t.archivedAt = was; t.activity.pop(); } });
  if (!was && app.panel && app.panel.key === t.key) closePanel();
}
function markSeen(t) {
  let changed = false;
  if (t.acknowledged) { t.acknowledged = false; changed = true; }
  t.checklist.forEach((c) => { if (c.agentAcknowledged) { c.agentAcknowledged = false; changed = true; } });
  return changed;
}

/* ================= actions (click dispatch) ================= */

document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]");
  // outside-click closes menus
  if (app.menu && !e.target.closest(".menu")) { app.menu = null; if (!target) { render(); return; } }
  if (!target) return;
  const a = target.dataset.action;
  const p = proj();
  if (app.firstLaunch && !app.firstLaunch.done) app.firstLaunch.clicks++;

  const act = {
    /* ---- driver ---- */
    "drv-reset": () => { app = blankApp(); ticker("state wiped · first-launch flow"); render(); },
    "drv-populated": () => { loadDemo(); ticker("demo project loaded · 3 local projects"); render(); },
    "drv-agent": () => runAgentSession(),
    "drv-conflict": () => stageConflict(),
    "drv-corrupt": () => stageCorrupt(),
    "drv-unplug": () => stageUnplug(),
    "drv-theme": () => {
      if (p) { p.theme = target.dataset.value; ticker(`theme → ${target.dataset.value} · wrote longclaw.yaml`); }
      document.documentElement.dataset.lcTheme = target.dataset.value;
      render();
    },
    "drv-appearance": () => { app.appearancePref = target.dataset.value; render(); },

    /* ---- first launch ---- */
    "fl-create": () => { app.overlay = { type: "folder", mode: "create" }; render(); },
    "fl-open": () => { app.overlay = { type: "folder", mode: "open" }; render(); },
    "fl-cancel": () => { app.pendingCreate = null; render(); },
    "np-theme": () => { app.pendingCreate.theme = target.dataset.value; document.documentElement.dataset.lcTheme = target.dataset.value; render(); },
    "fl-confirm": () => {
      const pc = app.pendingCreate;
      const project = {
        id: uid("p"), name: pc.name || "untitled", key: (pc.key || "T").toUpperCase(), path: `${pc.path}/.longclaw`,
        theme: pc.theme, starred: false, reachable: true, seq: 1, tickets: [],
        labels: { design: { name: "design", color: "pink" }, infra: { name: "infra", color: "blue" } },
      };
      app.projects.push(project);
      app.currentId = project.id; app.pendingCreate = null; app.view = "board";
      disk("longclaw.yaml");
      ticker(`<b>❯</b> created ${project.path}/longclaw.yaml + AGENTS.md`);
      finishFirstLaunch();
      render();
    },
    "folder-pick": () => {
      const path = target.dataset.path, hasLc = target.dataset.note.includes(".longclaw");
      const o = app.overlay;
      app.overlay = null;
      if (o.mode === "locate") {
        p.reachable = true; p.path = `${path}/.longclaw`;
        toast("Folder relocated", { sub: p.path });
        ticker(`<b>❯</b> rescanned ${p.path} · ${p.tickets.length} tickets`);
      } else if (hasLc) {
        // opening an existing project folder
        const existing = seedSmall("orbit", "ORB", `${path}/.longclaw`, "slate",
          [["Ship onboarding email", "in_progress", "p2"], ["Fix retry backoff", "todo", "p1"], ["Upgrade CI runners", "done"]]);
        app.projects.push(existing); app.currentId = existing.id; app.view = "board";
        ticker(`<b>❯</b> opened existing project · read longclaw.yaml · ${existing.tickets.length} tickets`);
        finishFirstLaunch();
      } else {
        const name = path.split("/").pop();
        app.pendingCreate = { path, name, key: name.replace(/[^a-z]/gi, "").slice(0, 4).toUpperCase() || "PROJ", theme: "indigo" };
      }
      render();
    },

    /* ---- shell ---- */
    "open-project": () => {
      if (e.target.closest("[data-action='star-project']")) return; // star handled below
      const id = target.dataset.id;
      if (id === app.currentId) return;
      app.currentId = id; app.panel = null; app.filter = ""; app.focusKey = null;
      const np = proj();
      if (np.reachable) {
        app.loading = true; render();
        setTimeout(() => { app.loading = false; ticker(`<b>❯</b> read ${np.path} · index rebuilt · ${np.tickets.length} tickets`); render(); }, 350);
      } else render();
    },
    "star-project": () => {
      e.stopPropagation();
      const pp = app.projects.find((x) => x.id === target.dataset.id);
      pp.starred = !pp.starred;
      toast(pp.starred ? `Starred ${pp.name}` : `Unstarred ${pp.name}`);
      render();
    },
    "set-view": () => { app.view = target.dataset.value; render(); },
    "copy-path": () => { try { navigator.clipboard.writeText(p.path); } catch {} toast("Path copied", { sub: p.path }); },
    "clear-filter": () => { app.filter = ""; render(); },
    "toggle-archived": () => { app.showArchived = !app.showArchived; render(); },
    "archive-ticket": () => toggleArchive(findTicket(target.dataset.key)),
    "term-toggle": () => { app.termOpen = !app.termOpen; render(); },
    "settings-open": () => { app.overlay = { type: "settings" }; render(); },
    "set-theme": () => { p.theme = target.dataset.value; disk("longclaw.yaml"); ticker(`<b>❯</b> theme → ${p.theme} · wrote longclaw.yaml`); render(); },
    "set-appearance": () => { app.appearancePref = target.dataset.value; render(); },
    "locate-folder": () => { app.overlay = { type: "folder", mode: "locate" }; render(); },
    "remove-project-ask": () => {
      app.overlay = { type: "confirm", title: `Remove “${p.name}” from LongClaw?`,
        bodyHtml: `The folder <span class="mono" style="font-size:11.5px">${esc(p.path)}</span> and every ticket file in it <b>stay on disk, untouched</b>. You can open it again anytime.`,
        confirmLabel: "Remove from app", confirmAction: "remove-project" };
      render();
    },
    "remove-project": () => {
      const name = p.name;
      app.projects = app.projects.filter((x) => x.id !== p.id);
      app.currentId = app.projects.length ? app.projects[0].id : null;
      app.overlay = null; app.panel = null;
      toast(`Removed ${name} from app`, { sub: "files untouched" });
      render();
    },
    "waitlist-open": () => { app.overlay = { type: "waitlist", stage: "form" }; render(); },
    "waitlist-join": () => {
      const v = ($("#wl-email") || {}).value || "";
      const o = app.overlay;
      if (!/^\S+@\S+\.\S+$/.test(v)) { o.error = "That doesn't look like an email."; o.email = v; render(); return; }
      if (/offline/.test(v)) { o.error = "Couldn't reach the waitlist — you look offline. Local projects are unaffected; try again later."; o.email = v; render(); return; }
      o.stage = "done"; o.email = v; o.error = null; app.waitlistJoined = true; render();
    },

    /* ---- tickets ---- */
    "open-ticket": () => openTicket(target.dataset.key),
    "close-panel": () => closePanel(),
    "copy-id": () => { try { navigator.clipboard.writeText(target.dataset.key); } catch {} toast(`${target.dataset.key} copied`); },
    "quick-create": () => { app.overlay = { type: "quick", status: target.dataset.status || "todo", title: "" }; render(); },
    "qc-confirm": () => qcConfirm(),
    "qc-full": () => {
      const o = app.overlay; app.overlay = null;
      app.panel = { mode: "create", draft: { title: o.title || ($("#qc-title") || {}).value || "", status: o.status, priority: "none", labels: [], description: "", checklist: [] } };
      render();
    },
    "create-confirm": () => createConfirm(),
    "create-check-rm": () => { app.panel.draft.checklist.splice(+target.dataset.i, 1); render(); },
    "toggle-check": () => { const t = findTicket(target.dataset.key); app.pendingFocusId = null; toggleCheck(t, target.dataset.item); },
    "edit-desc": () => {
      const t = findTicket(target.dataset.key);
      app.panel.editingDesc = true; app.panel.descTab = "write"; app.panel.draftDesc = t.description;
      render(); const ta = $("#desc-edit"); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    },
    "desc-tab": () => { app.panel.descTab = target.dataset.value; render(); },
    "cancel-desc": () => { app.panel.editingDesc = false; app.panel.conflict = null; render(); },
    "save-desc": () => saveDesc(),
    "fmt": () => wrapSel(target.dataset.value),
    "fmt-line": () => prefixSel(target.dataset.value),
    "fmt-link": () => wrapSel("[", "](url)"),
    "post-comment": () => postComment(target.dataset.key),
    "conflict-reload": () => {
      const t = findTicket(app.panel.key);
      app.panel.draftDesc = t.description; app.panel.conflict = null;
      toast("Reloaded from disk", { sub: "your draft was replaced" });
      render();
    },
    "conflict-keep": () => { app.panel.conflict = { ...app.panel.conflict, kept: true, dismissed: true }; app.panel.conflict = null; app.panel.keptMine = true; toast("Keeping your draft", { sub: "the external version stays in history" }); render(); },

    /* ---- degraded / raw ---- */
    "open-raw": () => { app.overlay = { type: "raw", key: target.dataset.key }; render(); },
    "raw-retry": () => {
      const t = findTicket(target.dataset.key);
      t.degraded = null; app.overlay = null;
      ticker(`<b>❯</b> re-parsed tickets/${t.key}/ticket.md · ok`);
      toast(`${t.key} parsed cleanly`);
      render();
    },
    "raw-editor": () => toast("Would open in $EDITOR", { sub: "simulated in prototype" }),

    /* ---- menus / palette / overlays ---- */
    "menu": () => {
      const r = target.getBoundingClientRect();
      app.menu = { type: target.dataset.menu, key: target.dataset.key || null,
        x: Math.min(r.left, innerWidth - 260), y: Math.min(r.bottom + 4, innerHeight - 260) };
      render();
    },
    "menu-pick": () => menuPick(target.dataset.value),
    "palette-pick": () => paletteRun(+target.dataset.i),
    "overlay-dismiss": () => { if (e.target === target) { app.overlay = null; app.menu = null; render(); } },
    "overlay-close": () => { app.overlay = null; render(); },
    "undo": () => undo(),
  }[a];
  if (act) act();
});

function finishFirstLaunch() {
  const fl = app.firstLaunch;
  if (fl && !fl.done) {
    fl.done = true;
    const secs = Math.round((now() - fl.t0) / 1000);
    ticker(`first launch → board · ${fl.clicks} clicks · ${secs}s <b>· gate: &lt;60s</b>`, true);
  }
}

function openTicket(key) {
  const t = findTicket(key);
  if (!t) return;
  if (t.degraded) { app.overlay = { type: "raw", key }; render(); return; }
  app.lastCardFocus = key;
  app.focusKey = key;
  app.panel = { key, mode: "view", editingDesc: false, descTab: "write", draftDesc: "", conflict: null };
  markSeen(t);
  render();
}
function closePanel() {
  app.panel = null;
  if (app.lastCardFocus) app.focusKey = app.lastCardFocus;
  render();
}
function qcConfirm() {
  const o = app.overlay;
  const title = ($("#qc-title") || {}).value || o.title;
  if (!title.trim()) { toast("Give it a title"); return; }
  app.overlay = null;
  const t = createTicket({ title, status: o.status });
  app.focusKey = t.key;
  render();
}
function createConfirm() {
  const d = app.panel.draft;
  d.title = ($("#create-title") || {}).value ?? d.title;
  d.description = ($("#create-desc") || {}).value ?? d.description;
  if (!d.title.trim()) { toast("Give it a title"); return; }
  const t = createTicket(d);
  app.panel = { key: t.key, mode: "view", editingDesc: false, descTab: "write", draftDesc: "", conflict: null };
  app.focusKey = t.key;
  render();
}
function saveDesc() {
  const pn = app.panel;
  const t = findTicket(pn.key);
  pn.draftDesc = ($("#desc-edit") || {}).value ?? pn.draftDesc;
  const overrode = pn.keptMine;
  mutate(t, () => {
    t.description = pn.draftDesc;
    addEvent(t, humanActor(ME), { field: "description", note: overrode ? "overrode an external edit; previous version kept in history" : undefined });
  }, { toast: "Description saved" });
  pn.editingDesc = false; pn.conflict = null; pn.keptMine = false;
  render();
}
function postComment(key) {
  const t = findTicket(key);
  const ta = $("#composer");
  const body = (ta && ta.value || "").trim();
  if (!body) return;
  mutate(t, () => { t.activity.push({ id: uid("ev"), kind: "comment", actor: humanActor(ME), at: now(), body }); },
    { toast: "Comment posted" });
}
function menuPick(value) {
  const m = app.menu;
  app.menu = null;
  const t = m.key ? findTicket(m.key) : null;
  if (m.type === "status") setStatus(t, value);
  else if (m.type === "priority") setPriority(t, value);
  else if (m.type === "label") toggleLabel(t, value);
  else if (m.type === "ordering") { app.orderingByProject[proj().id] = value; render(); }
  else if (m.type === "qc-status") { app.overlay.status = value; app.overlay.title = ($("#qc-title") || {}).value || ""; render(); }
  else if (m.type === "create-status") { app.panel.draft.status = value; syncCreateDraft(); render(); }
  else if (m.type === "create-priority") { app.panel.draft.priority = value; syncCreateDraft(); render(); }
  else if (m.type === "create-label") {
    const d = app.panel.draft;
    d.labels = d.labels.includes(value) ? d.labels.filter((l) => l !== value) : [...d.labels, value];
    syncCreateDraft(); render();
  }
}
function syncCreateDraft() {
  const d = app.panel.draft;
  d.title = ($("#create-title") || {}).value ?? d.title;
  d.description = ($("#create-desc") || {}).value ?? d.description;
}

/* palette execution */
function openPalette(mode = "root", query = "") {
  app.overlay = { type: "palette", mode, query, sel: 0, items: [] };
  render();
}
function paletteRun(i) {
  const o = app.overlay;
  const r = o.items[i];
  if (!r || r.disabled) return;
  if (o.mode === "root") {
    const t = paletteTarget();
    const go = { create: () => { app.overlay = { type: "quick", status: "todo", title: "" }; },
      "go-project": () => { o.mode = "project"; o.query = ""; o.sel = 0; },
      status: () => { o.mode = "status"; o.query = ""; o.sel = 0; },
      priority: () => { o.mode = "priority"; o.query = ""; o.sel = 0; },
      ordering: () => { o.mode = "ordering"; o.query = ""; o.sel = 0; },
      archive: () => { const t2 = paletteTarget(); app.overlay = null; if (t2) { toggleArchive(t2); return; } },
      search: () => { o.mode = "search"; o.query = ""; o.sel = 0; },
      star: () => { const p = proj(); p.starred = !p.starred; app.overlay = null; toast(p.starred ? `Starred ${p.name}` : `Unstarred ${p.name}`); },
      appearance: () => { app.appearancePref = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; app.overlay = null; },
      theme: () => { o.mode = "theme"; o.query = ""; o.sel = 0; },
      view: () => { app.view = app.view === "board" ? "list" : "board"; app.overlay = null; },
    }[r.id];
    if (go) go();
    render();
    return;
  }
  const t = paletteTarget();
  app.overlay = null;
  if (r.id === "open") openTicket(r.key);
  else if (r.id === "project") {
    app.currentId = r.pid; app.panel = null; app.filter = ""; app.focusKey = null;
    const np = proj();
    if (np.reachable) { app.loading = true; render(); setTimeout(() => { app.loading = false; render(); }, 350); return; }
  }
  else if (r.id === "set-status" && t) { setStatus(t, r.val); return; }
  else if (r.id === "set-priority" && t) { setPriority(t, r.val); return; }
  else if (r.id === "set-ordering") { app.orderingByProject[proj().id] = r.val; }
  else if (r.id === "set-theme") { const p = proj(); p.theme = r.val; disk("longclaw.yaml"); ticker(`<b>❯</b> theme → ${r.val} · wrote longclaw.yaml`); }
  render();
}

/* ================= editor helpers ================= */

function wrapSel(mark, close) {
  const ta = $("#desc-edit") || $("#create-desc");
  if (!ta) return;
  const [s, e] = [ta.selectionStart, ta.selectionEnd];
  const sel = ta.value.slice(s, e) || "text";
  ta.setRangeText(`${mark}${sel}${close ?? mark}`, s, e, "select");
  ta.focus();
  if (app.panel && app.panel.editingDesc) app.panel.draftDesc = ta.value;
}
function prefixSel(prefix) {
  const ta = $("#desc-edit") || $("#create-desc");
  if (!ta) return;
  const s = ta.value.lastIndexOf("\n", ta.selectionStart - 1) + 1;
  ta.setRangeText(prefix, s, s, "end");
  ta.focus();
  if (app.panel && app.panel.editingDesc) app.panel.draftDesc = ta.value;
}

/* ================= input bindings (post-render) ================= */

function bindAfterRender() {
  const filter = $("#filter");
  if (filter) filter.addEventListener("input", () => {
    app.filter = filter.value;
    // re-render list/board only; keep the input's focus & caret
    const pos = filter.selectionStart;
    render();
    const f2 = $("#filter"); if (f2) { f2.focus(); f2.setSelectionRange(pos, pos); }
  });

  const pin = $("#palette-input");
  if (pin) pin.addEventListener("input", () => {
    app.overlay.query = pin.value; app.overlay.sel = 0;
    const pos = pin.selectionStart;
    render();
    const p2 = $("#palette-input"); if (p2) { p2.focus(); p2.setSelectionRange(pos, pos); }
  });

  const de = $("#desc-edit");
  if (de) de.addEventListener("input", () => { app.panel.draftDesc = de.value; });

  const title = $("#panel-title");
  if (title) {
    autoGrow(title);
    title.addEventListener("blur", () => commitTitle(title));
    title.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); title.blur(); }
      if (e.key === "Escape") { const t = findTicket(app.panel.key); title.value = t.title; title.blur(); e.stopPropagation(); }
    });
  }
  const ct = $("#create-title");
  if (ct) { autoGrow(ct); ct.addEventListener("input", () => { app.panel.draft.title = ct.value; }); }
  const cd = $("#create-desc");
  if (cd) cd.addEventListener("input", () => { app.panel.draft.description = cd.value; });

  const ca = $("#check-add");
  if (ca) ca.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && ca.value.trim()) {
      const t = findTicket(app.panel.key);
      const text = ca.value.trim();
      mutate(t, () => { t.checklist.push(ck(text)); }, {});
      app.pendingFocusId = "check-add";
      render();
    }
  });
  const cca = $("#create-check-add");
  if (cca) cca.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && cca.value.trim()) {
      syncCreateDraft();
      app.panel.draft.checklist.push(cca.value.trim());
      app.pendingFocusId = "create-check-add";
      render();
    }
  });
  const composer = $("#composer");
  if (composer) autoGrow(composer);

  const npName = $("#np-name");
  if (npName) npName.addEventListener("input", () => { app.pendingCreate.name = npName.value; });
  const npKey = $("#np-key");
  if (npKey) npKey.addEventListener("input", () => { app.pendingCreate.key = npKey.value.toUpperCase(); });
  const setName = $("#set-name");
  if (setName) setName.addEventListener("change", () => { proj().name = setName.value; disk("longclaw.yaml"); render(); });

  renderDiskState();
}
function autoGrow(ta) {
  const fit = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
  ta.addEventListener("input", fit); fit();
}
function commitTitle(el) {
  const t = findTicket(app.panel.key);
  const v = el.value.trim();
  if (v && v !== t.title) {
    mutate(t, () => { t.title = v; addEvent(t, humanActor(ME), { field: "renamed" }); }, { toast: "Title saved" });
  }
}

/* ================= keyboard ================= */

document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  const inInput = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

  /* global chords */
  if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); app.menu = null; openPalette(); return; }
  if (mod && e.key.toLowerCase() === "z" && !inInput) { e.preventDefault(); undo(); return; }
  if (mod && e.key.toLowerCase() === "f" && proj() && proj().reachable) {
    e.preventDefault();
    const f = $("#filter"); if (f) { f.focus(); f.select(); }
    return;
  }
  if (mod && e.key === "Enter") {
    if (app.panel && app.panel.mode === "create") { e.preventDefault(); createConfirm(); return; }
    if (app.panel && app.panel.editingDesc) { e.preventDefault(); saveDesc(); return; }
    if (document.activeElement.id === "composer") { e.preventDefault(); postComment(app.panel.key); return; }
  }

  /* menus */
  if (app.menu) {
    const rows = $$(".menu .menu-row");
    const i = rows.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      rows[(i + (e.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length]?.focus();
    } else if (e.key === "Escape") { e.preventDefault(); app.menu = null; render(); }
    return;
  }

  /* overlays */
  if (app.overlay) {
    const o = app.overlay;
    if (e.key === "Escape") {
      e.preventDefault();
      if (o.type === "palette" && o.mode !== "root") { o.mode = "root"; o.query = ""; o.sel = 0; render(); }
      else { app.overlay = null; render(); }
      return;
    }
    if (o.type === "palette") {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = o.items.length;
        if (n) { o.sel = (o.sel + (e.key === "ArrowDown" ? 1 : n - 1)) % n; render(); }
      } else if (e.key === "Enter") { e.preventDefault(); paletteRun(o.sel); }
      return;
    }
    if (o.type === "quick" && e.key === "Enter" && !e.isComposing) { e.preventDefault(); o.title = ($("#qc-title") || {}).value || ""; qcConfirm(); return; }
    if (o.type === "waitlist" && e.key === "Enter" && o.stage === "form") { e.preventDefault(); $("[data-action='waitlist-join']")?.click(); return; }
    return;
  }

  /* escape ladder without overlay */
  if (e.key === "Escape") {
    if (inInput) { document.activeElement.blur(); return; }
    if (app.panel && app.panel.editingDesc) { app.panel.editingDesc = false; app.panel.conflict = null; render(); return; }
    if (app.panel) { closePanel(); return; }
    if (app.filter) { app.filter = ""; render(); return; }
    return;
  }
  if (inInput) return;
  const p = proj();
  if (!p || !p.reachable || app.loading) return;

  /* single-key actions */
  const k = e.key.toLowerCase();
  if (k === "c" && !mod) { e.preventDefault(); app.overlay = { type: "quick", status: "todo", title: "" }; render(); return; }
  const focused = app.focusKey && findTicket(app.focusKey);
  if (focused && !focused.degraded && !mod) {
    if (k === "s") { e.preventDefault(); anchorMenuOnFocused("status"); return; }
    if (k === "p") { e.preventDefault(); anchorMenuOnFocused("priority"); return; }
  }
  if (e.key === "Enter" && app.focusKey) { e.preventDefault(); openTicket(app.focusKey); return; }

  /* navigation */
  if (["arrowdown", "j"].includes(k)) { e.preventDefault(); app.view === "board" ? moveFocusBoard(0, 1) : moveFocus("next"); }
  else if (["arrowup", "k"].includes(k)) { e.preventDefault(); app.view === "board" ? moveFocusBoard(0, -1) : moveFocus("prev"); }
  else if (["arrowright", "l"].includes(k) && app.view === "board") { e.preventDefault(); moveFocusBoard(1, 0); }
  else if (["arrowleft", "h"].includes(k) && app.view === "board") { e.preventDefault(); moveFocusBoard(-1, 0); }
});

function anchorMenuOnFocused(type) {
  const el = $(`[data-fkey="card:${app.focusKey}"]`) || $(`[data-fkey="row:${app.focusKey}"]`);
  const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, bottom: innerHeight / 3 };
  app.menu = { type, key: app.focusKey, x: Math.min(r.left + 20, innerWidth - 260), y: Math.min(r.bottom - 6, innerHeight - 280) };
  render();
}

/* ================= driver scenarios ================= */

function requireDemo() {
  if (!proj()) { loadDemo(); render(); }
  return proj();
}

/* — the magic moment: an external agent works the ticket on disk — */
let agentRunning = false;
function runAgentSession() {
  if (agentRunning) return;
  const p = requireDemo();
  if (!p.reachable) { ticker("folder unreachable — relocate it first"); return; }
  const t = p.tickets.find((x) => x.key === "LC-128" && !x.degraded && !x.archivedAt && x.checklist.some((c) => !c.checked))
    || p.tickets.find((x) => !x.degraded && !x.archivedAt && x.checklist.some((c) => !c.checked))
    || p.tickets.find((x) => !x.degraded && !x.archivedAt);
  if (!t) { ticker("no workable ticket"); return; }
  agentRunning = true;
  const btn = $("[data-action='drv-agent']"); if (btn) btn.disabled = true;
  let writes = 0;
  const acknowledge = () => { t.acknowledged = true; t.acknowledgedAt = now(); };
  const agentWrite = (fn, line) => {
    fn(); acknowledge(); writes++;
    t.updatedAt = now();
    ticker(`<b>❯ claude-code</b> wrote tickets/${t.key}/ticket.md — ${line}`);
    render();
  };
  const steps = [
    [700, () => ticker(`<b>❯ claude-code</b> read .longclaw/AGENTS.md + tickets/${t.key}/ticket.md`)],
    [1900, () => { const c = t.checklist.find((x) => !x.checked); if (!c) return;
      agentWrite(() => { c.checked = true; c.agentAcknowledged = true; addEvent(t, AGENT, { field: "checklist", item: c.text, to: true }, "file edit"); }, `checked “${c.text}”`); }],
    [3300, () => { const c = t.checklist.find((x) => !x.checked); if (!c) return;
      agentWrite(() => { c.checked = true; c.agentAcknowledged = true; addEvent(t, AGENT, { field: "checklist", item: c.text, to: true }, "file edit"); }, `checked “${c.text}”`); }],
    [4700, () => agentWrite(() => {
        t.description += `\n\n## Discoveries\n\nEditors differ: VS Code renames \`file.tmp → file\`, vim rewrites in place with \`backupcopy=yes\`. The coalescing window handles both; hash-diffing suppresses the false delete.`;
        addEvent(t, AGENT, { field: "description" }, "file edit");
      }, "edited the description")],
    [6200, () => agentWrite(() => {
        const from = t.status;
        t.status = "in_review";
        addEvent(t, AGENT, { field: "status", from, to: "in_review" }, "file edit");
        t.activity.push({ id: uid("ev"), kind: "comment", actor: AGENT, at: now(), via: "file edit",
          body: "Coalescing landed in `watcher/coalesce.rs` with hash-diff suppression. Two items remain unchecked: the integration test needs a CI-only harness, and the AGENTS.md notes should wait for the format freeze. Moving to review." });
      }, `status → In Review + comment`)],
    [7400, () => {
      ticker(`<b>❯ claude-code</b> session complete · ${writes} writes · review the ticket`, true);
      agentRunning = false; if (btn) btn.disabled = false;
      render();
    }],
  ];
  steps.forEach(([ms, fn]) => setTimeout(fn, ms));
}

/* — external edit while the same ticket is being edited in-app — */
function stageConflict() {
  const p = requireDemo();
  if (!p.reachable) { ticker("folder unreachable — relocate it first"); return; }
  const t = p.tickets.find((x) => x.key === "LC-122" && !x.degraded && !x.archivedAt) || p.tickets.find((x) => !x.degraded && !x.archivedAt);
  if (!t) return;
  openTicket(t.key);
  app.panel.editingDesc = true; app.panel.descTab = "write";
  app.panel.draftDesc = t.description + "\n\nAlso cover paste-from-clipboard formatting …";
  render();
  const ta = $("#desc-edit"); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  ticker("you are editing the description — an external edit is about to land");
  setTimeout(() => {
    if (!app.panel || app.panel.key !== t.key) return;
    t.description += "\n\n> claude-code: preview renderer now escapes raw HTML before markdown transforms.";
    addEvent(t, AGENT, { field: "description" }, "file edit");
    t.updatedAt = now(); t.acknowledged = true; t.acknowledgedAt = now();
    app.panel.conflict = { by: "claude-code", at: now() };
    ticker(`<b>❯ claude-code</b> wrote tickets/${t.key}/ticket.md while you were editing`);
    render();
    const ta2 = $("#desc-edit"); if (ta2) ta2.focus();
  }, 1600);
}

/* — unparseable ticket file — */
function stageCorrupt() {
  const p = requireDemo();
  if (!p.reachable) { ticker("folder unreachable — relocate it first"); return; }
  const t = p.tickets.find((x) => !x.degraded && !x.archivedAt && x.status === "todo") || p.tickets.find((x) => !x.degraded && !x.archivedAt);
  if (!t) return;
  if (app.panel && app.panel.key === t.key) app.panel = null;
  const raw = [
    "---",
    "format: longclaw.ticket/v1",
    `id: 019c8c7e-5f42-7b09-a07c-${t.id.slice(-12).padEnd(12, "0")}`,
    `key: ${t.key}`,
    `title: ${t.title}`,
    "status: todo",
    "priority: p2: high",
    "labels:",
    ...t.labels.map((l) => `  - ${l}`),
    `created_at: 2026-07-16T08:20:00Z`,
    "---",
    "",
    t.description.split("\n")[0] || "…",
  ].join("\n");
  t.degraded = {
    path: `${p.path}/tickets/${t.key}/ticket.md`,
    error: `ticket.md:7 — mapping values are not allowed here: "priority: p2: high". The record is shown read-only; nothing was rewritten.`,
    badLine: 7, raw,
  };
  ticker(`hand-edited tickets/${t.key}/ticket.md into an invalid state — watcher picked it up`);
  render();
}

/* — folder disappears — */
function stageUnplug() {
  const p = requireDemo();
  if (!p.reachable) { ticker("already unplugged — use Locate folder…"); return; }
  p.reachable = false;
  app.panel = null; app.overlay = null; app.menu = null;
  ticker(`${p.path} is gone — moved or unmounted. Nothing is deleted.`);
  render();
}

/* ================= periodic refresh (relative times, acknowledgement decay) ================= */

setInterval(() => {
  if (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
  if (app.overlay || app.menu) return;
  if (app.projects.length) render();
}, 15000);

/* ================= boot ================= */

app = blankApp();
loadDemo();               // reviewers land in the populated app; driver "reset" shows first launch
render();
ticker("prototype ready — try <b>❯ agent session</b>, or reset for the first-launch flow", true);

})();
