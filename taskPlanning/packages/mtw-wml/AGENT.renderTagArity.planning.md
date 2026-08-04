# `<Render>` child arity: retire the fixed-triplet outlier (`mtw-wml`)

**Status:** Scoped through conversation 2026-08-04. Nothing built yet.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../AGENT.md). Predecessor (shipped, plan since deleted): the ephemera-only `<Render>` tag, ISS7495 (`60c317260` plan, `3c01b23db` implementation). Found while debugging [`AGENT.guestCharacterDescription.planning.md`](../../lambda/ephemera/dataSource/actions/AGENT.guestCharacterDescription.planning.md) Phase 2b.

## Purpose

**`mtw-wml` cannot round-trip its own `<Render>` output.** Demonstrated:

```
in:  <Render><DisplayName>TonyLB</DisplayName><Summary /><Description>Coyote prose.</Description></Render>   → parses fine
out: <Render><DisplayName>TonyLB</DisplayName><Description>Coyote prose.</Description></Render>              → 2 children
                                                                                    → reparse THROWS
```

The loop: `finalize` always *returns* three children (normalizing whitespace, filling empties), the emitter `toProseTripletChildren` then *drops* fields that are absent-or-empty, and reparsing that shorter output hits the `children.length !== 3` gate. Any producer whose prose payload lacks a field emits WML the library itself rejects.

This shipped as a **client show-stopper**: guest characters carried `description`-only prose, so every character perception threw `Render tag must contain exactly three children` in `charcoal-client`.

## Why this is the outlier, not the standard (provenance, confirmed 2026-08-04)

The fixed-arity rule was **never a decided design**. Evidence:

1. **It was an open question, closed unilaterally during implementation.** The original ISS7495 plan (`60c317260`) carried a *"Decisions to resolve"* table containing verbatim: `| **Child optionality** | All three required vs **Summary** / **Description** optional empty. |`. That row was never resolved in conversation. The "strict order / all three required" rule first appears in the **Key facts** table of `3c01b23db` --- *the same commit that wrote the code* --- recorded as though it were settled spec.
2. **The plan's stated intent was the opposite.** Line 25 of the original: children should be *"in line with existing schema literal / render-tree patterns used elsewhere under Situation facets (reuse print / parse conventions where possible)."* Those conventions are tag-matched and presence-optional.
3. **It is the only arity check in the library.** Across all of `packages/mtw-wml/ts/schema/converters/`, `components.ts:438` is the sole `children.length !== N` constraint; the other `finalize` implementations resolve children by tag.

**The decisive implementation detail:** [`parseProseTripletChildren`](../../../packages/mtw-wml/ts/standardize/keys/facets/situationRoom.ts) --- the reader sitting *behind* every one of these gates --- **already** consumes by tag, optionally, via `processWithConsumers` with `if (literal)` / `if (render)` guards. The arity checks are pure gatekeeping in front of code that already handles partial input correctly. Removing them requires almost no new parsing logic.

## Design decision (confirmed through conversation, 2026-08-04)

**Relax the reader to WML's normal tag-matching; leave the emitter alone.**

The alternative --- making the emitter always write all three (empty tags for absent fields) --- was considered and rejected: it would entrench a structure the rest of WML explicitly avoids, and it makes "absent" and "empty" different things on the wire for no consumer's benefit. Once the reader is tag-matched, `toProseTripletChildren`'s existing omit-absent behavior becomes correct and round-trip works because that distinction disappears.

## Explicit non-goals

- **`hasNonEmptyDisplayName()`.** A *product* rule ("a render must have a name"), not an arity rule, and load-bearing for the client's `Unknown` fallback. Keep it; see **RA-1** if that turns out to be wrong.
- **Authoring-side `<Situation>` / `<Example>` shapes.** Untouched --- `<Render>` is `ephemeraWire`-only.
- **Changing what any producer emits.** No prose content changes; `guestCoyoteSituations` keeps its full triplet regardless.

## Findings from the current code (2026-08-04)

- **Six enforcement sites**, not the three first assumed --- one schema converter plus **five** standardize consumers that each duplicate the identical check and error string:
  - [`schema/converters/components.ts:438`](../../../packages/mtw-wml/ts/schema/converters/components.ts#L438) --- the only one that also does positional destructuring (`const [first, second, third]`) and whitespace normalization.
  - `standardize/components/` --- [`room.ts:163`](../../../packages/mtw-wml/ts/standardize/components/room.ts#L163), [`character.ts:125`](../../../packages/mtw-wml/ts/standardize/components/character.ts#L125), [`knowledge.ts:81`](../../../packages/mtw-wml/ts/standardize/components/knowledge.ts#L81), [`feature.ts:81`](../../../packages/mtw-wml/ts/standardize/components/feature.ts#L81), [`object.ts:84`](../../../packages/mtw-wml/ts/standardize/components/object.ts#L84).
- **`finalize` does two jobs.** Beyond gatekeeping it compresses whitespace and rebuilds children in canonical order. The normalization is worth keeping; only the arity/position requirement goes.
- **The emitter needs no change.** [`toProseTripletChildren`](../../../packages/mtw-wml/ts/standardize/keys/facets/situationRoom.ts) already emits present fields in canonical order.
- **A test currently enshrines the broken output.** [`characterRenderWmlFromCacheRecord.test.ts`](../../../lambda/ephemera/dataSource/perception/characterRenderWmlFromCacheRecord.test.ts)'s `includes Render-backed prose` asserts a **two-child** `<Render>` (DisplayName + Description, no Summary) as correct --- it compares the emitted *string* and never parses it back, which is exactly why this bug reached production. Assertions of this shape are the root test-gap, not just one stale expectation.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) for durability/content split.
2. Read [`parseProseTripletChildren`](../../../packages/mtw-wml/ts/standardize/keys/facets/situationRoom.ts) **first** --- it is the proof this change is small, and the behavior every gate should defer to.
3. Read `finalize` for `Render` in [`schema/converters/components.ts`](../../../packages/mtw-wml/ts/schema/converters/components.ts), noting the normalization it does beyond gatekeeping.
4. Compare against a sibling `finalize` in the same file (none of which constrain arity) to see the convention being restored.
5. Testing authority: [`AGENT.testing.mtw-wml-typescript.md`](../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md). Jest in all affected packages. **`lambda/ephemera`'s integration tests sit outside `tsconfig`** --- `npx tsc --noEmit` will not catch a broken `*.integration.test.ts`; run the suite.
6. Baseline (should pass before edits):

```bash
cd packages/mtw-wml && npm run test -- --watchAll=false standardize/ schema/converters/
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/perception/ guestCharacter/
```

## Recommended order

Use `[ ]` for pending and `[X]` for complete; mark nested lines as each sub-step lands. Nothing below is built yet.

- [ ] **Phase 1. Add the failing round-trip test first.**
  - [ ] `schemaToWML(parse(x))` then reparse, for every partial-triplet combination (displayName-only, displayName+description, displayName+summary, all three). Assert no throw and payload equality across the round trip. This should fail on current `main` for every case that omits a field --- if it passes, the fix is mis-scoped.
- [ ] **Phase 2. Relax the schema converter.**
  - [ ] `components.ts`'s `Render.finalize`: resolve `DisplayName` / `Summary` / `Description` **by tag** rather than by position; drop `children.length !== 3` and the "must be ... in order" positional error. Keep `compressWhitespace` normalization and keep emitting canonical order. `typeCheckContents` already restricts the child set, so no new validation is needed.
  - [ ] Decide **RA-2** (emit-present-only vs normalize-to-three) and record it here.
- [ ] **Phase 3. Relax the five standardize consumers.**
  - [ ] Delete the duplicated `children.length !== 3` guard in `room.ts`, `character.ts`, `knowledge.ts`, `feature.ts`, `object.ts`. Each then falls straight through to `parseProseTripletChildren`, which already tolerates partial input. Keep each `hasNonEmptyDisplayName()` check (non-goal above).
  - [ ] These five blocks are near-identical; if the diff proves they differ only in the component name, consider extracting a shared helper --- but only as a follow-on, not folded into this behavioral change.
- [ ] **Phase 4. Fix the tests that assert un-reparseable output.**
  - [ ] `characterRenderWmlFromCacheRecord.test.ts`'s `includes Render-backed prose`: keep the emitted-string assertion but **add a reparse** so the case can never again assert output the parser rejects.
  - [ ] Sweep sibling render-WML tests for the same emit-only pattern (`grep -rn "<Render>" --include=*.test.ts`) and give each a round-trip assertion.
- [ ] **Phase 5. Durable docs.**
  - [ ] Update [`standardize/components/AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) and [`standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) wherever they state the triplet is required, to record that `<Render>` children are tag-matched and optional (with `DisplayName` non-empty when present).
  - [ ] Record in the guest-character plan that its Phase 2b show-stopper note is superseded by this change.

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| RA-1 | Does `hasNonEmptyDisplayName()` survive, and should it be *required* rather than merely non-empty-when-present? Today a `<Render>` with no `DisplayName` at all would pass the relaxed reader but leave the client showing `Unknown`. | Phase 3 | **Open.** Leaning keep-as-is (validate only when present) and let the client fallback handle absence, since Object/Character legitimately source their name elsewhere. Revisit if a real producer emits nameless renders. |
| RA-2 | After relaxing, does `finalize` return only the children that were present, or normalize back to all three (empties filled)? | Phase 2 | **Open.** Leaning **present-only**, so the schema tree mirrors the source and round-trip is exact; normalize-to-three re-creates the absent/empty distinction this change is removing, just one layer lower. |

## Verification

```bash
cd packages/mtw-wml && npm run test -- --watchAll=false standardize/ schema/converters/
cd packages/mtw-wml && npx tsc --noEmit
cd lambda/ephemera && npm run test -- --watchAll=false
cd lambda/ephemera && npx tsc --noEmit
cd charcoal-client && npm run test -- --run
```

Plus end-to-end: a guest character trusted-UI click renders coyote prose (the original show-stopper), and a `<Render>` carrying only `DisplayName` + `Description` survives emit → reparse.

## Progress

| Milestone | Status |
| --- | --- |
| Scope + provenance confirmed through conversation | Done (2026-08-04) |
| Phase 1 (failing round-trip test) | Not started |
| Phase 2 (schema converter) | Not started |
| Phase 3 (five standardize consumers) | Not started |
| Phase 4 (emit-only test sweep) | Not started |
| Phase 5 (durable docs) | Not started |
