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

- [X] **Phase 1. Add the failing round-trip test first.** (Done 2026-08-04)
  - [X] `schemaToWML(parse(x))` then reparse, for every partial-triplet combination (displayName-only, displayName+description, displayName+summary). Asserted no throw and render-payload equality across the round trip via the full `WML -> StandardForm/StandardCharacter -> emit -> reparse` pipeline (the schema-converter layer alone can't reproduce the bug --- it requires exactly 3 children on the way *in*; the asymmetry is standardize-layer emit-fewer, schema-converter reparse-throws). All-three coverage already existed. Landed as 15 new tests (3 combos x 5 components) in [`room.ephemeraWire.integration.test.ts`](../../../packages/mtw-wml/ts/standardize/components/room.ephemeraWire.integration.test.ts), [`feature.ephemeraWire.integration.test.ts`](../../../packages/mtw-wml/ts/standardize/components/feature.ephemeraWire.integration.test.ts), [`knowledge.ephemeraWire.integration.test.ts`](../../../packages/mtw-wml/ts/standardize/components/knowledge.ephemeraWire.integration.test.ts), [`object.ephemeraWire.integration.test.ts`](../../../packages/mtw-wml/ts/standardize/components/object.ephemeraWire.integration.test.ts) (new describe block --- no Render tests existed there before), and [`character.test.ts`](../../../packages/mtw-wml/ts/standardize/components/character.test.ts) (via `new StandardCharacter(wml)` directly --- no `StandardForm`/ephemeraWire wrapper needed there). All 15 fail on current `main` with the `children.length !== 3` throw from the matching consumer, confirming correct scope.
  - [X] Added the **RA-2 collapse** cases in [`components.test.ts`](../../../packages/mtw-wml/ts/schema/converters/components.test.ts) (schema-converter level, where `finalize`'s absent-vs-empty decision lives): an explicit empty `<Summary />` parses to the *same* schema tree as omitting `<Summary>`, and emits WML without the tag; an empty `<DisplayName />` --- which throws on current `main` --- no longer throws and normalizes to absent. Both fail on current `main` as expected (2 new tests).
  - Verified: `npm run test -- --watchAll=false standardize/ schema/converters/` --- 17 new tests fail, each with the expected arity-gate error; all 1666 pre-existing tests still pass. No production code touched.
- [X] **Phase 2. Relax the schema converter.** (Done 2026-08-04)
  - [X] `components.ts`'s `Render.finalize`: now resolves `DisplayName` / `Summary` / `Description` **by tag**, chaining `splitTaggedChildren` once per tag against the shrinking remainder (the same convention `Object.finalize` uses for `ShortName` at [`components.ts:362`](../../../packages/mtw-wml/ts/schema/converters/components.ts#L362)). `children.length !== 3` and the positional "must be ... in order" throw are gone; `typeCheckContents` (unchanged) still rejects any stray tag.
  - [X] Per **RA-2**, each field is dropped from output when its `compressWhitespace`d, trimmed text is empty --- applied uniformly to all three fields (not just `DisplayName` as before), so empty-vs-absent collapses everywhere. The `Render DisplayName must contain non-empty text after trim` throw is gone; an empty or whitespace-only `<DisplayName />` now normalizes to absent (**RA-1**'s `hasNonEmptyDisplayName()` in the standardize layer is untouched and is now the only place a name is required).
  - [X] Rewrote the block comment at [`components.ts:401-419`](../../../packages/mtw-wml/ts/schema/converters/components.ts#L401-L419) (formerly `PROVISIONAL`) to state the tag-matched/optional contract directly rather than describing a still-strict rule, and to point at RA-3/Phase 4 for the placeholder cleanup instead of instructing "when relaxing this contract."
  - [X] Updated the four pre-existing `components.test.ts` tests: `'should reject wrong child order'` → `'should canonicalize out-of-order children to DisplayName, Summary, Description'` (asserts canonical-order round-trip instead of a throw); `'should reject missing child'` → `'should allow a missing child rather than throwing'`; `'should reject empty DisplayName text'` deleted (fully superseded by Phase 1's RA-1/RA-2 collapse test); `'should allow empty Summary and Description'` → `'should collapse empty Summary and Description to absent'` (expected WML now omits the empty tags instead of preserving them). Also found and fixed a fifth pre-existing casualty Phase 1's exploration missed: `room.ephemeraWire.integration.test.ts`'s `'throws when Render DisplayName is whitespace-only inside Room'` asserted the same retired schema-converter throw via `treeFromWML` --- repointed to `'collapses a whitespace-only Render DisplayName to absent (RA-2) at the schema-converter layer'`.
  - [X] Verified: of the 17 Phase 1 tests, the 2 schema-converter-level ones (`components.test.ts`'s RA-2 collapse tests) now pass. The 15 standardize-consumer partial-triplet tests (3 combos × 5 components) still fail with the same `children.length !== 3` throw as before --- expected, since each consumer (`room.ts`, `character.ts`, `knowledge.ts`, `feature.ts`, `object.ts`) has its own duplicate arity guard sitting in front of `parseProseTripletChildren`, unaffected by this phase. That guard removal is exactly Phase 3's scope.
- [X] **Phase 3. Relax the five standardize consumers.** (Done 2026-08-04)
  - [X] Deleted the duplicated `children.length !== 3` guard (and its `'Render tag must contain exactly three children...'` throw) from `room.ts`, `character.ts`, `knowledge.ts`, `feature.ts`, `object.ts`. Each falls straight through to `parseProseTripletChildren`, which already resolved children by tag via `processWithConsumers` and needed no changes. `hasNonEmptyDisplayName()` (RA-1) left untouched in all five files, as did the unrelated `matched.length > 1` "at most one Render tag" check.
  - [X] Confirmed the five blocks differ only in component name (used in the two error strings) --- no shared-helper extraction done, per the plan's explicit call to leave that as a follow-on rather than fold a refactor into this behavioral change.
  - [X] Verified: all 17 of Phase 1's round-trip tests now pass (`npm run test -- --watchAll=false standardize/ schema/converters/` --- 1682 passed, 0 failed, up from the 1667 passing / 15 failing baseline after Phase 2). `npx tsc --noEmit` clean. `lambda/ephemera`'s `dataSource/perception/` and `guestCharacter/` suites also still pass in full (135/135) --- no incidental breakage from this layer, as expected since Phase 4/5 (placeholder cleanup, emit-only test sweep) haven't started.
- [X] **Phase 4. Retire the arity-driven placeholder hacks (RA-3).** (Done 2026-08-04)
  - [X] Deleted `PLACEHOLDER_RENDER_INVISIBLE_TITLE` from `orchestrate.ts` and `roomFullPlaceholderWml.ts`, along with the TEMPORARY docstring above each. `PLACEHOLDER_RENDER_BODY` and `placeholderRoomFullWml` now omit `displayName` entirely rather than faking a word joiner into it.
  - [X] Dropped the `summary: ['']` triplet padding in the same two call sites and the `?? ['']` at [`objectRenderWmlFromCacheRecord.ts:51`](../../../lambda/ephemera/dataSource/perception/objectRenderWmlFromCacheRecord.ts#L51) (now `summary: renderedContent.summary`). RA-2 collapses these to absent anyway, so they were no-ops that still read as required.
  - [X] Rewrote the stale strictness comments: [`objectRenderWmlFromCacheRecord.ts`](../../../lambda/ephemera/dataSource/perception/objectRenderWmlFromCacheRecord.ts) (both the `hasProse`/`renderPayload` comment and the `PLACEHOLDER_SHORT_NAME` docstring, which referenced the now-deleted `PLACEHOLDER_RENDER_INVISIBLE_TITLE`), the `PROVISIONAL` docstring on `toProseTripletChildren` in [`situationRoom.ts`](../../../packages/mtw-wml/ts/standardize/keys/facets/situationRoom.ts), and the matching paragraph in [`dataSource/perception/AGENT.md`](../../../lambda/ephemera/dataSource/perception/AGENT.md) --- all now describe the tag-matched/optional contract as permanent rather than provisional.
  - [X] **Kept** `PLACEHOLDER_SHORT_NAME` ([`objectRenderWmlFromCacheRecord.ts:21`](../../../lambda/ephemera/dataSource/perception/objectRenderWmlFromCacheRecord.ts#L21)) --- different constraint, still live. Its docstring no longer cross-references the deleted constant, otherwise unchanged.
  - [X] **Found and fixed an RA-1 implementation gap surfaced by this phase.** Removing the invisible-title placeholder exposed that all five `standardize/components/*.ts` `Render` consumers (`room.ts`, `character.ts`, `knowledge.ts`, `feature.ts`, `object.ts`) threw `'Render DisplayName must contain non-empty text after trim'` whenever `DisplayName` was **absent**, not only when present-and-empty --- stricter than RA-1's decided text ("validate only when present"). This predates Phase 3 (part of the original ISS7495 implementation) and was untested, since Phase 1's round-trip combos always included `DisplayName`. Added `SituationProseFacetPayload.hasDisplayName()` (presence check, distinct from `hasNonEmptyDisplayName()`'s non-empty check) and gated all five throws on `payload.hasDisplayName() && !payload.hasNonEmptyDisplayName()`, so an absent `DisplayName` now passes through to the client's `Unknown` fallback as RA-1 intended, while a present-but-empty one (still reachable if a caller bypasses `finalize`) still throws.
  - [X] Verified the room placeholder now emits `<Render><Description>...</Description></Render>` with no `DisplayName`, and confirmed via `grep -rl "'Unknown'"` that `charcoal-client/src/components/Message/ComponentDescription.tsx` and `CharacterDescription.tsx` already have an `Unknown`-name fallback path.
  - [X] **Found and fixed a second, pre-existing bug in `objectRenderWmlFromCacheRecord.ts`, surfaced during doc review of the comment this phase edited.** `<ShortName>` and `<Render><DisplayName>` are distinct WML fields (e.g. `ShortName` "Agatha" vs. `DisplayName` "Agatha Panzer von Sparkles III"), but the function silently used `renderedContent.displayName` as the emitted `<ShortName>` text whenever present, discarding the real `fallbackShortName` (confirmed both in code and in a pre-existing test explicitly titled *"prefers renderedContent.displayName over fallbackShortName when both are present"*). Fixed so `shortName` comes only from `fallbackShortName` (falling back to `PLACEHOLDER_SHORT_NAME`), and `renderedContent` --- including any authored `displayName` --- passes straight through to the `<Render>` facet unmodified, matching the Room/Feature/Knowledge/Character convention. Updated `orchestrate.ts`'s `placeholderObjectFullWml` to pass placeholder text via `fallbackShortName` instead of `displayName` (it relied on the old conflation to surface "Generating"/"Error" as the placeholder's ShortName). Rewrote the misleading tests in `objectRenderWmlFromCacheRecord.test.ts` and `orchestrate.objectStream.test.ts`, and the matching paragraph in `dataSource/perception/AGENT.md`.
  - [X] Verified: `mtw-wml`'s `standardize/` + `schema/converters/` suite (1682 passed), `lambda/ephemera`'s `dataSource/perception/` + `guestCharacter/` suite (135 passed) and full suite (2598 passed, 1 pre-existing unrelated skip), both packages' `tsc --noEmit` clean. `charcoal-client`'s suite has one pre-existing failure (`personalAssets/reducers.test.ts`'s TTL-timing `saveEdit lazy TTL purge` test) unrelated to `<Render>`/WML, not touched by this phase.
- [X] **Phase 5. Fix the tests that assert un-reparseable output.** (Done 2026-08-04)
  - [X] `characterRenderWmlFromCacheRecord.test.ts`'s `includes Render-backed prose`: keep the emitted-string assertion but **add a reparse** so the case can never again assert output the parser rejects. Also fixed the identical pattern in `featureKnowledgeRenderWmlFromCacheRecord.test.ts`'s `featureRenderWmlFromCacheRecord > includes Render-backed prose` (both asserted a 2-child DisplayName+Description `<Render>` with no reparse).
  - [X] Swept sibling render-WML tests for the same emit-only pattern (`grep -rl "<Render>" --include="*.test.ts"` across all 17 matching files) and gave each a round-trip assertion. Found and fixed 6 more:
    - `objectRenderWmlFromCacheRecord.test.ts`: 3 its (`'builds a placeholder ShortName WML...'`, `'keeps ShortName and DisplayName distinct...'`, `'selects the default situation cache record when present'`) asserted a 1-child `<Render>` via `toContain` with no reparse.
    - `lambda/ephemera/perception/index.test.ts`'s `'should send a PerceptionMessage with generating status for room headers'` asserted a hand-written full-triplet `wmlContent` literal via `toHaveBeenCalledWith` with no reparse.
    - `packages/mtw-wml/ts/standardize/components/character.test.ts`'s `'round-trips render from StandardCharacterData to schema'` was named as a round-trip but only checked `schemaToWML` output, never reconstructed a `StandardCharacter` from it.
    - `packages/mtw-wml/ts/standardize/components/object.test.ts`'s `'round-trips render from StandardObjectData to schema'` had the same gap, but here the emitted WML **actually would have thrown on reparse**: the fixture had no `shortName`, and `<Object>` structurally requires exactly one non-empty `<ShortName>` at parse time --- unrelated to the Render arity work, but only caught by finally adding the reparse the test's name already promised. Fixed by adding `shortName: 'roller skates'` to the fixture and reparsing through `StandardForm` (a bare `<Object>` fragment needs an `<Asset>` wrapper to parse, unlike `<Character>`).
  - Verified: `packages/mtw-wml`'s `standardize/` + `schema/converters/` suite (1682 passed, 0 regressions), `lambda/ephemera`'s `dataSource/perception/` + `perception/` + `guestCharacter/` suite (139 passed) and full suite (2598 passed, 1 pre-existing unrelated skip), both packages' `tsc --noEmit` clean.
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
| Phase 1 (failing round-trip test) | Done (2026-08-04) --- 17 new tests fail as expected, 0 regressions |
| Phase 2 (schema converter) | Done (2026-08-04) --- `Render.finalize` is tag-matched and RA-2-collapsing; 2/17 Phase 1 tests now pass, 15 (standardize consumers) correctly still blocked on Phase 3 |
| Phase 3 (five standardize consumers) | Done (2026-08-04) --- duplicate arity guard deleted from `room.ts`/`character.ts`/`knowledge.ts`/`feature.ts`/`object.ts`; all 17 Phase 1 tests now pass, 0 regressions, `tsc --noEmit` clean |
| Phase 4 (retire arity-driven placeholders) | Done (2026-08-04) --- placeholder hacks removed, docs updated, plus an RA-1 gap in the five standardize consumers (absent DisplayName wrongly throwing) found and fixed; 0 regressions |
| Phase 5 (emit-only test sweep) | Done (2026-08-04) --- fixed 8 tests across 5 files that asserted `<Render>` output without reparsing; one (`object.test.ts`) was a genuine latent throw (missing ShortName), not just a coverage gap; 0 regressions |
| Phase 6 (durable docs) | Not started |
