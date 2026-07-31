// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickCreate } from "./QuickCreate";

afterEach(cleanup);

describe("creating a ticket", () => {
  it("sends the title, description, checklist, and status the human typed", () => {
    const onCreate = vi.fn();
    render(
      <QuickCreate
        projectKey="RT"
        submitting={false}
        onCancel={() => {}}
        onCreate={onCreate}
      />,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "  Prove the agent round trip  " },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Check whether the round trip holds." },
    });
    fireEvent.change(screen.getByLabelText("Checklist — one item per line"), {
      target: { value: "Let an agent read it\n\n- [ ] Review what changed" },
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "in_progress" },
    });
    fireEvent.click(screen.getByText("Create ticket"));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Prove the agent round trip",
      description: "Check whether the round trip holds.",
      status: "in_progress",
      priority: "none",
      labels: [],
      checklist: ["Let an agent read it", "Review what changed"],
    });
  });

  it("sends priority and project label slugs when creating a ticket", () => {
    const onCreate = vi.fn();
    render(
      <QuickCreate
        projectKey="RT"
        submitting={false}
        onCancel={() => {}}
        onCreate={onCreate}
      />,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Prioritized work" },
    });
    fireEvent.change(screen.getByLabelText("Priority"), {
      target: { value: "p1" },
    });
    fireEvent.change(screen.getByLabelText("Labels — comma separated"), {
      target: { value: "backend, reliability" },
    });
    fireEvent.click(screen.getByText("Create ticket"));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: "p1",
        labels: ["backend", "reliability"],
      }),
    );
  });

  it("says where the ticket will land before it is created", () => {
    render(
      <QuickCreate
        projectKey="RT"
        submitting={false}
        onCancel={() => {}}
        onCreate={() => {}}
      />,
    );

    expect(
      screen.getByText("writes .longclaw/tickets/RT-n/ticket.md"),
    ).toBeTruthy();
  });

  it("will not create a ticket with no title", () => {
    const onCreate = vi.fn();
    render(
      <QuickCreate
        projectKey="RT"
        submitting={false}
        onCancel={() => {}}
        onCreate={onCreate}
      />,
    );

    fireEvent.click(screen.getByText("Create ticket"));

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("closes on Escape without creating anything", () => {
    const onCancel = vi.fn();
    const onCreate = vi.fn();
    render(
      <QuickCreate
        projectKey="RT"
        submitting={false}
        onCancel={onCancel}
        onCreate={onCreate}
      />,
    );

    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });
});
