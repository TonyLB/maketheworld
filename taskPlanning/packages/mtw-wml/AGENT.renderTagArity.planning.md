# `<Render>` child arity: retire the fixed-triplet outlier (`mtw-wml`)

**Status:** Scoped through conversation 2026-08-04. Nothing built yet.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../AGENT.md). Predecessor (shipped, plan since deleted): the ephemera-only `<Render>` tag, ISS7495 (`60c317260` plan, `3c01b23db` implementation). Found while debugging the guest-character-description iteration's Phase 2b (shipped, plan since retired; see [`lambda/ephemera/guestCharacter/AGENT.md`](../../lambda/ephemera/guestCharacter/AGENT.md)).

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

**Absent beats empty (RA-2, decided 2026-08-04).** The reader does not merely *tolerate* a missing field --- it *collapses* a present-but-empty one into a missing one. `<Summary />` and no `<Summary>` at all parse to the same schema tree, so there is exactly one canonical spelling of "this field has no content" and emit -> reparse -> emit is idempotent on the first pass rather than the second.

## Explicit non-goals

- **`hasNonEmptyDisplayName()`.** A *product* rule ("a render must have a name"), not an arity rule, and load-bearing for the client's `Unknown` fallback. Keep it; see **RA-1** if that turns out to be wrong.
- **Authoring-side `<Situation>` / `<Example>` shapes.** Untouched --- `<Render>` is `ephemeraWire`-only.
- **Changing what any producer emits --- for real prose.** No prose *content* changes; `guestCoyoteSituations` keeps its full triplet regardless. **Amended 2026-08-04 (RA-3):** this never covered the placeholder hacks that exist solely to satisfy the arity gate --- those come out in Phase 4. What stays untouched is prose a producer means to say.
- **`<Object>`'s required `<ShortName>`.** A separate structural rule with its own placeholder (`PLACEHOLDER_SHORT_NAME`, same U+2060 character, different cause). Out of scope; see **RA-3**.

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
  - [ ] Add the **RA-2 collapse** cases: an input spelling a field as an empty tag (`<Summary />`, `<Description />`) must parse to the *same* schema tree as an input omitting it, and must emit WML without that tag. Include `<DisplayName />` --- which throws on current `main` --- to pin the removal of the non-empty-after-trim error.
- [ ] **Phase 2. Relax the schema converter.**
  - [ ] `components.ts`'s `Render.finalize`: resolve `DisplayName` / `Summary` / `Description` **by tag** rather than by position (the `splitTaggedChildren` pattern `Object.finalize` already uses at [`components.ts:362`](../../../packages/mtw-wml/ts/schema/converters/components.ts#L362)); drop `children.length !== 3` and the "must be ... in order" positional error. Keep `compressWhitespace` normalization and keep emitting canonical order. `typeCheckContents` already restricts the child set, so no new validation is needed.
  - [ ] Per **RA-2**, drop each field whose `compressWhitespace`d children are empty, so `finalize` returns only non-empty fields in canonical order. Remove the `Render DisplayName must contain non-empty text after trim` throw --- an empty `<DisplayName />` now normalizes to absent rather than erroring (**RA-1** keeps the product-level check in `hasNonEmptyDisplayName()`).
  - [ ] Update the `PROVISIONAL` block comment at [`components.ts:401-419`](../../../packages/mtw-wml/ts/schema/converters/components.ts#L401-L419), which documents the strict contract being removed here and points at the ephemera placeholders it forced.
- [ ] **Phase 3. Relax the five standardize consumers.**
  - [ ] Delete the duplicated `children.length !== 3` guard in `room.ts`, `character.ts`, `knowledge.ts`, `feature.ts`, `object.ts`. Each then falls straight through to `parseProseTripletChildren`, which already tolerates partial input. Keep each `hasNonEmptyDisplayName()` check (non-goal above).
  - [ ] These five blocks are near-identical; if the diff proves they differ only in the component name, consider extracting a shared helper --- but only as a follow-on, not folded into this behavioral change.
- [ ] **Phase 4. Retire the arity-driven placeholder hacks (RA-3).**
  - [ ] Delete `PLACEHOLDER_RENDER_INVISIBLE_TITLE` from [`orchestrate.ts:58`](../../../lambda/ephemera/dataSource/perception/orchestrate.ts#L58) and [`roomFullPlaceholderWml.ts:15`](../../../lambda/ephemera/dataSource/perception/roomFullPlaceholderWml.ts#L15), along with the TEMPORARY docstring above each. `PLACEHOLDER_RENDER_BODY` and `placeholderRoomFullWml` then omit `displayName` entirely rather than faking a word joiner into it.
  - [ ] Drop the `summary: ['']` triplet padding in the same two call sites and the `?? ['']` at [`objectRenderWmlFromCacheRecord.ts:51`](../../../lambda/ephemera/dataSource/perception/objectRenderWmlFromCacheRecord.ts#L51). RA-2 collapses these to absent anyway, so they are no-ops that still read as required.
  - [ ] Rewrite the stale strictness comments that survive their subject: [`objectRenderWmlFromCacheRecord.ts:41-46`](../../../lambda/ephemera/dataSource/perception/objectRenderWmlFromCacheRecord.ts#L41-L46) ("pad the triplet the way `orchestrate.ts` does") and the `PROVISIONAL` docstring on `toProseTripletChildren` at [`situationRoom.ts:176-182`](../../../packages/mtw-wml/ts/standardize/keys/facets/situationRoom.ts#L176-L182), which now describes the emitter as provisional against a contract that no longer binds it.
  - [ ] **Keep** `PLACEHOLDER_SHORT_NAME` ([`objectRenderWmlFromCacheRecord.ts:21`](../../../lambda/ephemera/dataSource/perception/objectRenderWmlFromCacheRecord.ts#L21)) --- different constraint, still live. Leave its docstring accurate rather than deleting by character match.
  - [ ] Expect placeholder-WML test expectations to move: a room placeholder now emits `<Render><Description>...</Description></Render>` with no `DisplayName`. Confirm the client's `Unknown` fallback is what renders there (per **RA-1**), since the invisible title was previously suppressing it.
- [ ] **Phase 5. Fix the tests that assert un-reparseable output.**
  - [ ] `characterRenderWmlFromCacheRecord.test.ts`'s `includes Render-backed prose`: keep the emitted-string assertion but **add a reparse** so the case can never again assert output the parser rejects.
  - [ ] Sweep sibling render-WML tests for the same emit-only pattern (`grep -rn "<Render>" --include=*.test.ts`) and give each a round-trip assertion.
- [ ] **Phase 6. Durable docs.**
  - [ ] Update [`standardize/components/AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) and [`standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) wherever they state the triplet is required, to record that `<Render>` children are tag-matched and optional (with `DisplayName` non-empty when present).
  - [ ] Record in the guest-character plan that its Phase 2b show-stopper note is superseded by this change.

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| RA-1 | Does `hasNonEmptyDisplayName()` survive, and should it be *required* rather than merely non-empty-when-present? Today a `<Render>` with no `DisplayName` at all would pass the relaxed reader but leave the client showing `Unknown`. | Phase 3 | **Decided (2026-08-04): keep as is.** Validate only when present; let the client `Unknown` fallback handle absence, since Object/Character legitimately source their name elsewhere. Revisit only if a real producer emits nameless renders. |
| RA-2 | After relaxing, does `finalize` return only the children that were present, or normalize back to all three (empties filled)? | Phase 2 | **Decided (2026-08-04): normalize to absent-over-empty.** `finalize` emits only fields with non-empty content after `compressWhitespace`; a present-but-empty child (`<Summary />`) collapses to **absent** rather than being preserved as an empty node. This makes "absent" the single canonical spelling, so emit -> reparse -> emit is idempotent from the first pass. Consequence: the existing `Render DisplayName must contain non-empty text after trim` throw in `finalize` goes away --- an empty `<DisplayName />` normalizes to absent like any other field, and the product rule lives solely in `hasNonEmptyDisplayName()` per **RA-1**. |
| RA-3 | Do the U+2060 word-joiner placeholder hacks come out in this change set? | Phase 4 | **Decided (2026-08-04): yes, remove the arity-driven ones.** They exist *only* to satisfy the gate being removed --- both docstrings say so verbatim ("Remove this constant once `Render.finalize` ... loosened; then use a normal empty or omitted display name"), and the `PROVISIONAL` comment at [`components.ts:401-419`](../../../packages/mtw-wml/ts/schema/converters/components.ts#L401-L419) instructs removing them in the same change set. Leaving a hack whose stated trigger no longer exists is how the next reader concludes the constraint is still real. **Boundary:** `PLACEHOLDER_SHORT_NAME` at [`objectRenderWmlFromCacheRecord.ts:21`](../../../lambda/ephemera/dataSource/perception/objectRenderWmlFromCacheRecord.ts#L21) is the *same character for a different reason* --- `<Object>`'s content model structurally requires one non-empty `<ShortName>`, which this change does not touch. It stays. |

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
| Phase 4 (retire arity-driven placeholders) | Not started |
| Phase 5 (emit-only test sweep) | Not started |
| Phase 6 (durable docs) | Not started |
