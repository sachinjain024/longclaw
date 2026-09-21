/**
 * What letting go of a project row means, in whichever of the sidebar's two
 * sections it was let go.
 *
 * The same split the board, the list and the checklist already run on
 * (`ticketMove.ts`, `checklistOrder.ts`): the surface supplies the pointer, and
 * the decision lives here. What is new is that one of the two sections draws
 * only *some* of the list — **Starred** is the same rows pinned to the top
 * rather than a second list (LC-259y) — so a gesture inside it is a statement
 * about the starred rows and the place in **Local** is what has to be worked
 * out from it. Local is the whole registry, so the identical arithmetic serves
 * both: a section that happens to draw every row is not a special case.
 *
 * That place is the number, which is the whole reason this is a module rather
 * than three lines in a handler. `⌘1`–`⌘9` is a row's position in Local, so the
 * answer here is what the badge will say and what the chord will open, and a
 * drop that put a row somewhere the number did not follow is LC-259y's defect
 * arriving by hand.
 *
 * A landing is stated as an index here and as a *neighbour* on the wire — the
 * write says "after `zebra`", never "at 3". An index is a claim about the whole
 * list, and the registry is the one authority over that (`registry.rs`).
 */

/** Where a row comes to rest, and everything the surfaces need to say so. */
export interface ProjectLanding {
  /** Local as it reads once it lands, by id: what the sidebar draws at once. */
  order: string[];
  /** The row it follows there, or `null` at the top. What the write says. */
  after: string | null;
  /** Its place in Local, counting from 1 — the number the row advertises. */
  position: number;
}

/**
 * Where a row ends up, given the place in its own section it was let go at.
 *
 * `landing` is an index into the section **with the moving row taken out**,
 * which is what `landingFor` in `checklistOrder.ts` converts a pointer's gap
 * into and what a keyboard step names directly. `undefined` is "this is not a
 * move": the row was let go on one of the two boundaries it already sits
 * between, the section has no second row to move it past, or the ids name
 * nothing here.
 *
 * The landing is read as its **neighbour among the section's rows**, and the
 * row lands beside that neighbour in Local. In Starred that means a drop can
 * lift a row over unstarred rows — it has to, since the two rows it was let go
 * between may have others between them — but only over rows it was asked to
 * cross. A row let go where it already reads crosses nothing and writes
 * nothing, which is the case a section drawing a subset gets wrong: honouring
 * "immediately after the row above it" would move it over every unstarred row
 * in between and renumber them all.
 *
 * The way back is built here rather than at the call site, because it is the
 * same question asked backwards — which row was above this one — and answering
 * it twice is how the two answers come to disagree. It is also what a refused
 * write puts back, so the two are one thing on purpose: the order the sidebar
 * returns to when the file says no is the order `⌘Z` returns it to.
 */
export function moveOf(
  localIds: readonly string[],
  sectionIds: readonly string[],
  movingId: string,
  landing: number,
): { move: ProjectLanding; inverse: ProjectLanding } | undefined {
  const from = localIds.indexOf(movingId);
  const sectionFrom = sectionIds.indexOf(movingId);
  if (from < 0 || sectionFrom < 0) return undefined;
  const rest = localIds.filter((id) => id !== movingId);
  const section = sectionIds.filter((id) => id !== movingId);
  if (section.length === 0) return undefined;
  if (landing < 0 || landing > section.length) return undefined;
  if (landing === sectionFrom) return undefined;
  const after = landing === 0 ? null : section[landing - 1];
  // Above the section's first row, not above the whole list: in Starred those
  // differ by however many unstarred rows are sitting above it, and none of
  // them is a row this gesture went past.
  const at =
    after === null ? rest.indexOf(section[0]) : rest.indexOf(after) + 1;
  const order = [...rest];
  order.splice(at, 0, movingId);
  return {
    move: { order, after, position: at + 1 },
    inverse: {
      order: [...localIds],
      after: from === 0 ? null : localIds[from - 1],
      position: from + 1,
    },
  };
}
