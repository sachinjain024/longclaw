/**
 * What every suite gets before its own hooks run (`vite.config.ts`).
 */

import { beforeEach } from "vitest";

/**
 * A `localStorage` that actually stores.
 *
 * Node 26 defines its own `localStorage` accessor on `globalThis`, and without
 * `--localstorage-file` it answers `undefined` — that is the ExperimentalWarning
 * printed on every run. It takes precedence over the one jsdom would install, so
 * app code reaching for `localStorage` gets a `TypeError`, and the try/catch
 * around every preference write turns that into "this choice does not survive
 * the session". Nothing is reported, so the surface looks like it works.
 *
 * Four suites had each hand-rolled this same stub. The fifth — LC-49's
 * `agrees after a restart` — did not, and asserted a restored view that the
 * environment had quietly made impossible (LC-161). Installing it here once is
 * what keeps the next suite from having to know any of this.
 *
 * Fresh per test, because storage that outlives a test is state one test can
 * hand to another.
 */
function installLocalStorage() {
  const held = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      get length() {
        return held.size;
      },
      key: (index: number) => Array.from(held.keys())[index] ?? null,
      getItem: (key: string) => held.get(key) ?? null,
      setItem: (key: string, value: string) =>
        void held.set(key, String(value)),
      removeItem: (key: string) => void held.delete(key),
      clear: () => held.clear(),
    } satisfies Storage,
  });
}

installLocalStorage();
beforeEach(installLocalStorage);
