# StandardRoom.examples legacy investigation plan

Status: in progress. Next step: classify runtime sites by migration strategy (`remove` / `replace` / `defer`).

## Purpose and scope

This task plan tracks how we investigate and methodically work through remaining dependencies on `StandardRoom.examples` so the property can be deprecated and eventually removed with low risk.

This file is task-scoped and temporary. Keep durable behavior docs in package `AGENT.md` files and link them here.

## Getting Started

1. Read the task-planning framework in [`taskPlanning/AGENT.md`](../../AGENT.md) for durability, checklist, and verification expectations.
2. Read WML and standardization orientation docs:
   - [`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md)
   - [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md)
   - [`packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.md)
3. Use the root complex-task pattern for sequencing and verification:
   - [`AGENT.md#getting-started-pattern-for-complex-tasks`](../../../../AGENT.md#getting-started-pattern-for-complex-tasks)
4. Baseline the current `StandardRoom.examples` footprint before changing code.

## Working assumptions

- Room prose for active ephemera paths is moving to situation facets and/or ephemera-wire room `render` payloads.
- Feature and Knowledge still use `examples` references for now.
- We should not remove `StandardRoom.examples` until all runtime call sites are either migrated or intentionally retained with explicit rationale.

## Progress

| Phase | Goal | Status | Notes |
| --- | --- | --- | --- |
| 1 | Build complete call-site inventory | Complete | Baseline frozen on 2026-04-22 (runtime/test/docs buckets below) |
| 2 | Classify each site (hard dependency vs transitional fallback vs test/docs) | Pending | |
| 3 | Refactor highest-confidence runtime sites | Pending | Prefer smallest behavior-preserving steps |
| 4 | Update tests/docs and re-baseline inventory | Pending | |
| 5 | Decide deprecation gate for `StandardRoom.examples` | Pending | Gate should be explicit and test-backed |

## Recommended order

Use `[ ]` for pending and `[X]` for completed work. Mark each nested line `[X]` as it is completed so partial progress is visible.

- [X] Freeze a baseline inventory of direct `StandardRoom.examples` usage.
  - [X] Capture runtime call sites (non-test, non-doc files).
  - [X] Capture test-only references.
  - [X] Capture documentation-only references.
- [ ] Classify runtime sites by migration strategy.
  - [ ] `remove`: no longer needed after situation-facet migration.
  - [ ] `replace`: should read from situations/render instead of examples.
  - [ ] `defer`: intentionally keep for temporary compatibility.
- [ ] Refactor runtime sites one by one, smallest surface first.
  - [ ] Keep behavior stable with targeted tests for each site.
  - [ ] Update related docs/comments in the same slice.
- [ ] Run full verification for touched packages/lambdas.
  - [ ] Unit tests for modified areas.
  - [ ] Typecheck/build checks for modified areas.
  - [ ] Re-run inventory and compare against baseline.
- [ ] Propose deprecation gate and removal checklist for `StandardRoom.examples`.

## Investigation matrix (living)

Track each call site and its disposition here before code changes.

| Area | File | Current usage shape | Classification | Action owner | Status |
| --- | --- | --- | --- | --- | --- |
| assets | `lambda/assets/componentExamples/exampleEnrichment.ts` | `Room` included in helper that returns `component.examples` for parent-id lookup | Runtime dependency | TBD | Recommended (`replace`) |
| ephemera | `lambda/ephemera/internalCache/componentRender.ts` | default `StandardRoomData` includes `examples: []` and room fallback paths read cached examples | Runtime transitional | TBD | Investigate |
| ephemera | `lambda/ephemera/dataSource/perception/orchestrate.ts` | placeholder room WML uses synthetic Example + `room.examples` reference | Runtime transitional | TBD | Investigate |
| charcoal-client | `charcoal-client/src/components/Message/RoomDescription.tsx` | room prose fallback reads `component.examples.payload[0]` when render/situation are absent | Runtime dependency | TBD | Recommended (`replace`) |
| charcoal-client | `charcoal-client/src/slices/personalAssets/index.ts` | LLM generation update path reads `room.examples.payload[0]` | Runtime dependency | TBD | Investigate |
| charcoal-client | `charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts` | layered tab utilities read `parent.examples` for Room/Feature/Knowledge sibling detection | Runtime mixed dependency | TBD | Recommended (`replace` Room path, `defer` Feature/Knowledge path) |
| charcoal-client | `charcoal-client/src/components/Message/ComponentDescription.tsx` | feature/knowledge description reads first example from parent reference list | Runtime non-room dependency | TBD | Recommended (`defer`) |

## Baseline inventory snapshot (2026-04-22)

This baseline is frozen before refactor work so we can compare deltas after each slice.

### Runtime call sites (non-test, non-doc)

Direct reads of `room`/`component`/`parent` example references where `Room` can participate:

- `lambda/assets/componentExamples/exampleEnrichment.ts`
- `charcoal-client/src/components/Message/RoomDescription.tsx`
- `charcoal-client/src/components/Message/ComponentDescription.tsx`
- `charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts`
- `charcoal-client/src/slices/personalAssets/index.ts`

Room row construction paths that still serialize examples for room payloads:

- `lambda/ephemera/dataSource/perception/orchestrate.ts` (`StandardRoomData.examples = [exKey]` placeholder path)
- `lambda/ephemera/internalCache/componentRender.ts` (default room payload includes `examples: []`)

### Test-only references

Known tests that currently include room example fields or read room examples:

- `packages/mtw-wml/ts/standardize/components/component.test.ts`
- `packages/mtw-wml/ts/standardize/components/room.test.ts`
- `packages/mtw-wml/ts/standardize/index.test.ts`
- `lambda/assets/internalCache/assetData.test.ts`
- `lambda/assets/internalCache/componentData.test.ts`
- `lambda/assets/componentExamples/exampleAssociatedFilter.test.ts`
- `lambda/ephemera/internalCache/componentAssetMeta.test.ts`
- `lambda/ephemera/internalCache/componentRender.test.ts`
- `lambda/ephemera/internalCache/componentStackMerge.test.ts`
- `charcoal-client/src/components/Maps/Controller/index.test.tsx`

### Documentation-only references

Known documentation/planning mentions to revisit after runtime migration:

- `charcoal-client/src/components/Message/AGENT.md`
- `charcoal-client/src/components/Message/AGENT.RoomDescription.md`
- `charcoal-client/src/components/Workbench/foundations/LayeredContext/AGENT.layered-context-patterns.md`
- `lambda/assets/AGENT.event.md`
- `packages/mtw-wml/ts/AGENT.md` (critical note still mentions room examples)

### Inventory commands used

- `rg "\.examples\b" /Users/anthonylower-basch/Code/maketheworld`
- `rg "\b(room|component|parent)\.examples\b" /Users/anthonylower-basch/Code/maketheworld`
- `rg "tag:\s*'Room'[\s\S]{0,180}examples|StandardRoomData[\s\S]{0,220}examples" /Users/anthonylower-basch/Code/maketheworld --multiline`

## Runtime slice recommendation: `lambda/assets/componentExamples/exampleEnrichment.ts`

### Current behavior in context

- `enrichExampleEvent()` is used for `Example` component events in `mtw.assets.componentExamples`.
- It computes `parentIds` via `getParentIdsForExample()`.
- `getParentIdsForExample()` currently treats `Room`, `Feature`, and `Knowledge` identically by reading each parent's `examples` reference list.
- For `Room`, this is legacy behavior that conflicts with the room-situations migration.
- Existing unit test coverage (`exampleEnrichment.test.ts`) still asserts room parent discovery through `Room.examples`.

### Recommendation

Classification: `replace` (not `remove` yet).

For this slice, update parent lookup semantics so `enrichExampleEvent()` no longer derives room parent relationships from `Room.examples`:

1. Restrict `getExamplesReferenceList()`/parent scan to `Feature` and `Knowledge` only.
2. Keep `Room` parent relationship handling on the room-situation event path in `componentExamples/index.ts` (already explicit: `parentIds: [roomId]` for situation updates/removals).
3. Do not remove `StandardRoom.examples` type support in this slice; only remove this call-site dependency.

Rationale:

- This is the smallest change that aligns `assets.componentExamples` with current room-situations architecture.
- It isolates room migration work from feature/knowledge example behavior, reducing blast radius.
- It prevents stale room example references from affecting parent-id enrichment for Example events.

### Risks and mitigations

- Risk: hidden producer still emitting Example events intended to resolve room parents via `Room.examples`.
  - Mitigation: add/adjust tests to assert that room parents are not inferred from `Room.examples` in `enrichExampleEvent()`.
- Risk: regressions for Feature/Knowledge parent-id enrichment.
  - Mitigation: keep and strengthen existing Feature/Knowledge example-parent tests.

### Acceptance criteria for this slice

- `enrichExampleEvent()` parent-id discovery no longer uses `Room.examples`.
- `Feature` and `Knowledge` parent-id discovery remains unchanged.
- Test coverage includes:
  - positive parent-id case for Feature/Knowledge via examples
  - negative case proving Room examples are ignored in this path
- Re-run inventory confirms this runtime call site is removed from the `room/component/parent.examples` bucket for `lambda/assets/componentExamples/exampleEnrichment.ts`.

## Runtime slice recommendation: `charcoal-client/src/components/Message/RoomDescription.tsx`

### Current behavior in context

- `RoomDescription` already prefers room prose in this order:
  1. `StandardRoom.render` (ephemera wire `<Render>`)
  2. first room `Situation` facet payload
  3. fallback to first `StandardExample` via `component.examples.payload[0]`
- The third step is the remaining room-example dependency in this component.

### Recommendation

Classification: `replace`.

For this initiative, remove room prose fallback through `StandardRoom.examples` in `RoomDescription` and rely on:

1. `StandardRoom.render` (primary)
2. room `situations` payloads (secondary)
3. existing safe defaults (`Untitled` / empty description/summary) when prose payload is missing

Rationale:

- This component is already structured around render/situation precedence, so removing examples is a narrow and coherent change.
- It directly removes one of the remaining room-example runtime dependencies.

### Risks and mitigations

- Risk: some payloads may still arrive without render/situation prose and previously displayed Example-derived text.
  - Mitigation: add/update tests that assert expected fallback to defaults (not Example) for prose-missing rooms.
- Risk: docs still state Example fallback.
  - Mitigation: update docs after behavior change (tracked in documentation-only inventory bucket).

### Acceptance criteria for this slice

- `RoomDescription.tsx` no longer reads `component.examples`.
- Tests cover:
  - render-based prose path
  - situation-based prose path
  - prose-missing path using defaults
- Inventory query no longer reports `RoomDescription.tsx` in the room examples runtime bucket.

## Runtime slice recommendation: `charcoal-client/src/components/Message/ComponentDescription.tsx`

### Current behavior in context

- `ComponentDescription` resolves display text only for `StandardFeature` and `StandardKnowledge`.
- It reads `component.examples.payload[0]` to fetch first `StandardExample` and render name/description.
- It does not execute against `StandardRoom`.

### Recommendation

Classification: `defer` for this task.

Keep this call site unchanged for now because it is not a `StandardRoom.examples` dependency and is tied to current Feature/Knowledge authoring semantics.

Rationale:

- Changing this now broadens scope from room-specific migration to a larger examples-to-situations migration for other component types.
- It is valuable to keep Feature/Knowledge behavior stable while we retire room-specific legacy paths first.

### Acceptance criteria for this slice

- This file remains intentionally unchanged during room-example dependency removal.
- Plan records it as out-of-scope for room-only deprecation, to revisit when Feature/Knowledge migration is scheduled.

## Runtime slice recommendation: `charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts`

### Current behavior in context

- This utility drives layered-tab detection and sibling derivation for Workbench.
- It already has first-class room-situation support (`SituationFacet` tag path via `isSituationFacetChild()` / `findSituationFacetSiblings()`).
- It still uses `parent.examples` in shared helpers (`getReferenceList`, `isReferenceListChild`, `getLayeredContext`) where parent may be `Room`, `Feature`, or `Knowledge`.
- As written, Room example membership can still classify stack context as `Example`, even though Room situation facets are now the preferred room layering model.

### Recommendation

Classification: split strategy.

- `replace` for Room path:
  - Remove Room participation in Example-membership checks (`parent.examples`) for layered context.
  - Keep Room layered behaviors to:
    1. `SituationFacet` path
    2. `Guidance` path
- `defer` for Feature/Knowledge path:
  - Keep Example-based layering for Feature/Knowledge unchanged in this initiative.

Rationale:

- This isolates room-specific deprecation without destabilizing Feature/Knowledge editors.
- The utility already has explicit Room situation handling, so migration is mostly a gate/branching refinement rather than a redesign.

### Risks and mitigations

- Risk: existing drafts that rely on Room->Example layered tabs may no longer show as layered.
  - Mitigation: add selector/utility tests for Room stacks:
    - Room->Situation => layered (`SituationFacet`)
    - Room->Guidance => layered (`Guidance`)
    - Room->Example => no layered context (or expected non-layered behavior)
- Risk: regressions in Feature/Knowledge Example tabs due to shared helper edits.
  - Mitigation: explicit regression tests for Feature/Knowledge Example sibling derivation and child membership.

### Acceptance criteria for this slice

- `layeredContextUtils.ts` no longer treats `Room.examples` as a layered membership source.
- Room layered context remains valid for `SituationFacet` and `Guidance`.
- Feature/Knowledge Example layered context remains unchanged.
- Inventory query no longer reports Room-example dependency from this file (while acknowledging intentional Feature/Knowledge example usage remains).

## Verification checklist (per slice)

For each individual call-site refactor:

1. Prove behavior before change with a focused test or fixture.
2. Apply the minimal code change.
3. Run local tests for the touched module.
4. Re-run targeted inventory search to confirm expected delta.
5. Update this plan's matrix and recommended-order checkboxes.

## Suggested inventory commands

Prefer narrow searches and keep outputs with the task PR/notes.

- `rg "\.examples\b" lambda/assets lambda/ephemera lambda/wml`
- `rg "instanceof StandardRoom" lambda/assets lambda/ephemera lambda/wml`
- `rg "tag:\s*'Room'[\s\S]{0,160}examples" lambda --multiline`
- `rg "StandardRoomData[\\s\\S]{0,220}examples" lambda --multiline`

## Exit criteria

Treat this task as complete when all are true:

- No unclassified runtime `StandardRoom.examples` call sites remain.
- Every retained site has an explicit compatibility rationale and owner.
- Tests cover migrated behavior for each changed runtime path.
- A concrete deprecation/removal gate for `StandardRoom.examples` is documented.

## Cleanup when done

- Move any lasting subsystem guidance to durable package docs.
- Remove this planning doc once the initiative is shipped.
