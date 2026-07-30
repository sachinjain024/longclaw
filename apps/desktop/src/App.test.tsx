// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import * as api from "./api";
import { useLongClawStore } from "./state";

vi.mock("./api", () => ({
  chooseAndCreateProject: vi.fn(),
  chooseAndRegisterProject: vi.fn(),
  chooseAndRelocateProject: vi.fn(),
  createTicket: vi.fn(),
  listProjects: vi.fn(),
  listenForProjectEvents: vi.fn(),
  openProject: vi.fn(),
  rebuildIndex: vi.fn(),
  reconcileProject: vi.fn(),
  removeProject: vi.fn(),
  reportVisibleUi: vi.fn(),
  setProjectStarred: vi.fn(),
  updateProjectName: vi.fn(),
  updateProjectTheme: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false })),
  });
  vi.mocked(api.listProjects).mockResolvedValue([]);
  vi.mocked(api.listenForProjectEvents).mockResolvedValue(() => {});
  useLongClawStore.setState({
    projects: [],
    activeProjectId: undefined,
    tickets: [],
    generation: 0,
    lastSequence: 0,
    lastEvent: undefined,
    externalMarks: {},
    streamFrames: [],
    loading: false,
    error: undefined,
  });
});

describe("project creation", () => {
  it("derives a backend-valid key for digit-leading project names", async () => {
    render(<App />);

    fireEvent.change(await screen.findByLabelText("Project name"), {
      target: { value: "30 July 4PM" },
    });

    expect(screen.getByLabelText<HTMLInputElement>("Ticket key").value).toBe(
      "J4",
    );
  });

  it("does not overwrite a key the user has edited", async () => {
    render(<App />);

    fireEvent.change(await screen.findByLabelText("Ticket key"), {
      target: { value: "AB" },
    });
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "30 July 4PM" },
    });

    expect(screen.getByLabelText<HTMLInputElement>("Ticket key").value).toBe(
      "AB",
    );
  });

  it("blocks invalid keys before the folder picker is opened", async () => {
    render(<App />);

    fireEvent.change(await screen.findByLabelText("Ticket key"), {
      target: { value: "3J4" },
    });
    fireEvent.click(screen.getByText("Create project in folder"));

    expect(
      screen.getByText(/Project key must start with a letter/),
    ).toBeTruthy();
    expect(api.chooseAndCreateProject).not.toHaveBeenCalled();
  });
});
