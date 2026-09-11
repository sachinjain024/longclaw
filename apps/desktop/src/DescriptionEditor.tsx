/**
 * The description editor: Write/Preview tabs, six formatting buttons, a mono
 * textarea, and a footer that says where the bytes go
 * (`screen-specs.md:231-240`).
 *
 * The rule the whole component is built around: **the textarea holds the raw
 * string and nothing here ever normalizes it.** The preview is a read-only
 * projection built from that string, and the value handed back on save is the
 * value the human typed — never a re-render of the parsed tree. That is V0-12's
 * second must-pass, and it is a structural property rather than a promise: there
 * is no code path from `parseMarkdown` back to `onChange`.
 *
 * The draft itself lives in the panel, in a ref, because the file can change
 * under the editor. This component owns which tab is showing and nothing else.
 */

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { MarkdownView } from "./MarkdownView";
import { FormattingToolbar } from "./FormattingToolbar";
import type { ToolbarAction } from "./markdownToolbar";
import { applyToolbarAction } from "./markdownToolbar";

const TABS = [
  { id: "write", label: "Write" },
  { id: "preview", label: "Preview" },
] as const;

type Tab = (typeof TABS)[number]["id"];

/**
 * Create mode is "write mode only until first save" (`screen-specs.md:266`), so
 * it takes neither tab, neither footer button, nor the keys that drive them: the
 * create panel owns `⌘↵` and `Esc`, and there is no file to preview against or
 * save to. Modelled as a union rather than four optional props so the edit path
 * cannot lose its `onSave` by accident.
 */
type DescriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
} & (
  | {
      writeOnly: true;
      /**
       * Shown while the draft is empty: the one line saying what the field is
       * for and who reads it (D-4B). On this arm rather than beside `value`,
       * and required rather than optional, for the reason the union exists —
       * an edit is opened against a description that already exists and has
       * nothing to explain, so the type says only create mode may carry one,
       * and that create mode may not forget it.
       */
      placeholder: string;
    }
  | {
      writeOnly?: false;
      onCancel: () => void;
      onSave: () => void;
      /** False while the draft matches the file: `apply` refuses a no-op edit. */
      canSave: boolean;
    }
);

export function DescriptionEditor(props: DescriptionEditorProps) {
  const ids = useId();
  /** The save/cancel half, absent in create mode. Narrowing the union once. */
  const editing = props.writeOnly === true ? undefined : props;
  /** The other arm, for the one prop only create mode has. */
  const creating = props.writeOnly === true ? props : undefined;
  const [tab, setTab] = useState<Tab>("write");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Entering edit puts the caret at the end (`keyboard-focus-map.md:92`). In
  // create mode there is nothing to enter — the editor is simply on screen, and
  // the title is where a new ticket starts.
  useEffect(() => {
    const field = textarea.current;
    if (!field || !editing) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, []);

  // Where the caret goes once the parent's new value has rendered. The value is
  // the panel's, so the selection cannot be set until it comes back down.
  const pendingSelection = useRef<[number, number]>(undefined);
  useEffect(() => {
    const range = pendingSelection.current;
    const field = textarea.current;
    if (!range || !field) return;
    pendingSelection.current = undefined;
    field.focus();
    field.setSelectionRange(range[0], range[1]);
  }, [props.value]);

  function format(action: ToolbarAction) {
    const field = textarea.current;
    if (!field) return;
    const next = applyToolbarAction(action, {
      value: field.value,
      start: field.selectionStart,
      end: field.selectionEnd,
    });
    pendingSelection.current = [next.start, next.end];
    props.onChange(next.value);
  }

  function moveTab(step: number) {
    const index = TABS.findIndex((entry) => entry.id === tab);
    const next = (index + step + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveTab(1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveTab(-1);
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : TABS.length - 1;
      setTab(TABS[next].id);
      tabRefs.current[next]?.focus();
    }
  }

  /**
   * Esc cancels the edit and stops there. Without this it reaches the panel's
   * document listener and closes the whole panel, which is not what
   * `keyboard-focus-map.md:88` asks for. Create mode takes neither key: both
   * belong to the create panel's footer, so they are left to bubble.
   */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!editing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      editing.onCancel();
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (editing.canSave) editing.onSave();
    }
  }

  return (
    <div className="description-editor" onKeyDown={onKeyDown}>
      <div className="editor-tabstrip">
        {/* No Preview until the ticket exists (`screen-specs.md:266`). */}
        {editing && (
          <div
            role="tablist"
            aria-label="Description view"
            onKeyDown={onTabKeyDown}
          >
            {TABS.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`${ids}-tab-${entry.id}`}
                aria-selected={tab === entry.id}
                aria-controls={`${ids}-panel-${entry.id}`}
                tabIndex={tab === entry.id ? 0 : -1}
                className={
                  tab === entry.id ? "editor-tab active" : "editor-tab"
                }
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}
        {/* A formatting button over a read-only projection has nothing to act
            on, so Preview disables the group rather than hiding it. */}
        <FormattingToolbar onFormat={format} disabled={tab !== "write"} />
      </div>

      {/* With no tabstrip there is no tab for a panel to be labelled by, so in
          create mode this is a plain wrapper rather than a lying `tabpanel`. */}
      <div
        role={editing ? "tabpanel" : undefined}
        id={editing ? `${ids}-panel-write` : undefined}
        aria-labelledby={editing ? `${ids}-tab-write` : undefined}
        hidden={tab !== "write"}
      >
        <textarea
          ref={textarea}
          value={props.value}
          rows={8}
          aria-label="Description"
          placeholder={creating?.placeholder}
          onChange={(event) => props.onChange(event.target.value)}
        />
      </div>
      {editing && (
        <div
          role="tabpanel"
          id={`${ids}-panel-preview`}
          aria-labelledby={`${ids}-tab-preview`}
          hidden={tab !== "preview"}
          tabIndex={0}
        >
          {props.value.trim() === "" ? (
            <p className="editor-empty">Nothing to preview yet.</p>
          ) : (
            <MarkdownView
              source={props.value}
              headingOffset={3}
              className="markdown description-preview"
            />
          )}
        </div>
      )}

      {/* Create mode has no footer of its own: nothing here can be saved on its
          own, so the panel's Create ticket is the only commit. */}
      {editing && (
        <div className="editor-footer">
          <code>writes to ticket.md on save</code>
          <button
            tabIndex={0}
            className="ghost"
            type="button"
            onClick={editing.onCancel}
          >
            Cancel <kbd aria-hidden="true">Esc</kbd>
          </button>
          <button
            tabIndex={0}
            className="primary"
            type="button"
            disabled={!editing.canSave}
            onClick={editing.onSave}
          >
            Save <kbd aria-hidden="true">⌘↵</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
