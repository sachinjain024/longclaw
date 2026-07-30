import { describe, expect, it } from "vitest";
import {
  PROJECT_KEY_MAX_LENGTH,
  PROJECT_KEY_RULE,
  defaultProjectKey,
  isProjectKey,
  normalizeProjectKey,
} from "./projectKey";

// The same fixture `src-tauri/tests/project_key_grammar.rs` reads. The create
// form used to suggest keys the backend refused; a shared case table is what
// stops the two rules drifting apart again.
import grammar from "../../../fixtures/project-key-grammar.json";

describe("the project key grammar", () => {
  it("accepts and refuses exactly what the shared fixture says", () => {
    expect(grammar.keys.length).toBeGreaterThan(10);

    for (const { key, valid, note } of grammar.keys) {
      expect(isProjectKey(key), `${JSON.stringify(key)}: ${note ?? ""}`).toBe(
        valid,
      );
    }
  });

  it("caps a new key at the length the fixture states", () => {
    expect(PROJECT_KEY_MAX_LENGTH).toBe(grammar.creationMaxLength);
  });

  it("states the rule in words a person in a create form can act on", () => {
    expect(PROJECT_KEY_RULE).toMatch(/letter/i);
    expect(PROJECT_KEY_RULE).not.toMatch(/immutable prefix/i);
  });
});

describe("deriving a key from a project name", () => {
  it("derives what the shared fixture says", () => {
    for (const { name, key, note } of grammar.derivations) {
      expect(
        defaultProjectKey(name),
        `${JSON.stringify(name)}: ${note ?? ""}`,
      ).toBe(key);
    }
  });

  it("only ever derives a key the backend accepts", () => {
    const names = [
      ...grammar.derivations.map((entry) => entry.name),
      "30 July 4PM",
      "2026",
      "9 lives",
      "###",
      "0",
      "1 2 3 4 5",
      "-",
    ];

    for (const name of names) {
      const derived = defaultProjectKey(name);
      expect(isProjectKey(derived), `derived ${derived} from ${name}`).toBe(
        true,
      );
      expect(derived.length).toBeLessThanOrEqual(grammar.derivationMaxLength);
      expect(grammar.derivationMaxLength).toBeLessThanOrEqual(
        PROJECT_KEY_MAX_LENGTH,
      );
    }
  });

  it("falls back rather than returning nothing", () => {
    expect(defaultProjectKey("")).toBe(grammar.fallbackKey);
  });
});

describe("normalizing what someone types into the key field", () => {
  it("uppercases without silently dropping what they typed", () => {
    expect(normalizeProjectKey("lc")).toBe("LC");
    expect(normalizeProjectKey("lc-1")).toBe("LC-1");
  });

  it("stops at the creation cap", () => {
    expect(normalizeProjectKey("abcdefgh")).toHaveLength(
      PROJECT_KEY_MAX_LENGTH,
    );
  });
});
