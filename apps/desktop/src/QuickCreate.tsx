/**
 * Creating a ticket: the smallest path that defines a title, description,
 * checklist, and status, and writes one `ticket.md` for it.
 *
 * The key is not asked for. Rust allocates it from the project's own directory
 * names, so two creations cannot claim the same one.
 */

import { useState } from "react";
import { STATUSES, checklistFromLines } from "./tickets";
import type { CreateTicketRequest, TicketStatus } from "./types";

interface QuickCreateProps {
  projectKey: string;
  submitting: boolean;
  onCancel: () => void;
  onCreate: (request: Omit<CreateTicketRequest, "projectId">) => void;
}

export function QuickCreate(props: QuickCreateProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [checklistText, setChecklistText] = useState("");
  const [status, setStatus] = useState<TicketStatus>("todo");

  return (
    <div className="modal-scrim" role="presentation">
      <form
        className="quick-create-modal"
        aria-label="Create a ticket"
        onKeyDown={(event) => {
          if (event.key === "Escape") props.onCancel();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          props.onCreate({
            title: title.trim(),
            description: description.trim(),
            status,
            checklist: checklistFromLines(checklistText),
          });
        }}
      >
        <p className="eyebrow">NEW TICKET IN {props.projectKey}</p>
        <label>
          <span>Title</span>
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          <span>Description</span>
          <textarea
            value={description}
            rows={5}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label>
          <span>Checklist — one item per line</span>
          <textarea
            value={checklistText}
            rows={3}
            onChange={(event) => setChecklistText(event.target.value)}
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as TicketStatus)}
          >
            {STATUSES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="editor-footer">
          <code>writes .longclaw/tickets/{props.projectKey}-n/ticket.md</code>
          <button className="ghost" type="button" onClick={props.onCancel}>
            Cancel
          </button>
          <button
            className="primary"
            type="submit"
            disabled={props.submitting || !title.trim()}
          >
            Create ticket
          </button>
        </div>
      </form>
    </div>
  );
}
