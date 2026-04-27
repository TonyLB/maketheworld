# Acme order enrich: Coyote object cap (`Too Many Objects`)

**Status:** In progress. Coyote placement count helper is in [`actions/utilities/`](../../../../../../../lambda/ephemera/dataSource/actions/utilities/); next wire **`enrichAcmeOrder`** guard.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../../../../taskPlanning/AGENT.md). For workflow scaffolding, see the root [`AGENT.md`](../../../../../../../AGENT.md) (complex-task Getting Started pattern where present).

## Purpose

Cap LLM-facing complexity by rejecting **new** Acme order enrich (`invokeBedrockAcmeOrderEnrich`) when the **total count of placed objects** across **all** Coyote Game demo rooms already exceeds **20**. The check must run **before** any Acme enrich Bedrock call.

Player-facing copy (exact string for the error path):

`You already have more than twenty items placed ... even Acme thinks this plan is getting too complicated.`

## Scope and boundaries

### In scope

- Deterministic count of objects placed in Coyote Game rooms: iterate the same Coyote room set used elsewhere (for example [`collectCoyoteOccupiedStableKeys`](../../../../../../../lambda/ephemera/dataSource/actions/stableKey/collectCoyoteOccupiedStableKeys.ts)), and sum **`meta.objects.length`** per room (total placements, **not** de-duplication by `stableKey`).
- Enforcement at the **`enrichAcmeOrder`** boundary in [`lambda/ephemera/dataSource/actions/enrich/acmeOrder/index.ts`](../../../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/index.ts): if count **>** `20`, return immediately **without** calling `invokeBedrockAcmeOrderEnrich`.
- Surface the outcome as a terminal parse result the orchestrator already understands: **`ParseCommandErrorResult`** (`type: 'Error'`, optional **`errorMessage`**) so [`parseCommand`](../../../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) and [`actions/index.ts`](../../../../../../../lambda/ephemera/dataSource/actions/index.ts) imperative handling stay aligned (see **`parseErrorMessageForPlayer`**: unknown **`errorMessage`** values pass through as the displayed line).
- Unit tests for the counter helper (injectable deps mirroring **`CollectCoyoteOccupiedStableKeysDeps`** style), **`enrichAcmeOrder`** early exit (mock counter or injected getter), and a **`parseCommand`** test proving Bedrock enrich is **not** invoked when over cap.

### Explicitly out of scope (unless discovered as required for correctness)

- Changing catalog line-level **`errorType`** unions (`Not a thing`, etc.): this is a **global pre-enrich** gate, not a per-line catalog rejection.
- Persisting object counts or caching beyond what room meta already provides.
- Client or protocol changes if **`Error`** already streams correctly through existing actions paths.

## Design notes

- **Threshold:** reject when **count > 20** (allow up to **20** objects; block starting at **21**). Align naming in code (for example `ACME_ORDER_COYOTE_MAX_OBJECTS` = `20`) so the comparison **`count > ACME_ORDER_COYOTE_MAX_OBJECTS`** matches the product wording.
- **Placement:** implement the guard inside **`enrichAcmeOrder`** so every caller that uses the enrich entry point (including [`runAcmeOrderAffinitiesHarness`](../../../../../../../lambda/ephemera/dataSource/actions/actionHandlers/runAcmeOrderAffinitiesHarness.ts) if applicable) gets the same behavior without duplicating checks in **`parseCommand`** alone.
- **Return typing:** widen **`enrichAcmeOrder`**'s **`result`** type to **`ParseCommandAcmeOrderResult | ParseCommandErrorResult`** (or an equivalent narrow union exported from [`baseClasses.ts`](../../../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts)), and update **`parseCommandCore`** to pass through **`Error`** unchanged.
- **Dependency injection:** follow the repo pattern for testability (optional **`deps`** on the counter and/or **`enrichAcmeOrder`** for **`getGameRooms`** / **`getRoomMeta`**, consistent with [`collectCoyoteOccupiedStableKeys`](../../../../../../../lambda/ephemera/dataSource/actions/stableKey/collectCoyoteOccupiedStableKeys.ts)).

## Getting started

1. Read [`lambda/ephemera/dataSource/actions/enrich/acmeOrder/index.ts`](../../../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/index.ts) and [`parseCommand.ts`](../../../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) for the Acme enrich orchestration path.
2. Read [`collectCoyoteOccupiedStableKeys.ts`](../../../../../../../lambda/ephemera/dataSource/actions/stableKey/collectCoyoteOccupiedStableKeys.ts) and [`loadCoyoteRoomObjectsByRoom`](../../../../../../../lambda/ephemera/dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.ts) for room iteration and **`Meta::Room.objects`** shape.
3. Read [`actions/index.ts`](../../../../../../../lambda/ephemera/dataSource/actions/index.ts) (**`respondImperativelyForIntent`**, **`isParseCommandErrorResult`**) to confirm **`Error`** messaging reaches the player.
4. Skim [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../../../lambda/ephemera/dataSource/actions/AGENT.md) and [`enrich/AGENT.md`](../../../../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md) for durable boundaries; update those docs only if this task changes steady-state contracts.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines `[X]` as each sub-step lands.

- [X] Add a small exported helper under [`actions/utilities/`](../../../../../../../lambda/ephemera/dataSource/actions/utilities/) (**`countCoyotePlacedObjectsAcrossRooms`**) that returns the **total** Coyote Game object count across rooms, with **injectable deps** for tests.
- [ ] Wire **`enrichAcmeOrder`**: await count; if **`count > 20`**, return **`{ result: { type: 'Error', errorMessage: '<exact string>' }, enrichReasoningMarkdown: '' }`** and **do not** call **`invokeBedrockAcmeOrderEnrich`**.
- [ ] Update **`parseCommand`** / **`parseCommandCore`** typings so **`AcmeOrderIntent`** can yield **`Error`** from enrich without casts.
- [ ] Add tests: helper unit tests; **`enrichAcmeOrder`** asserts no enrich invoke when over cap; **`parseCommand`** (or harness) asserts enrich mock not called; optional test at **exactly** 20 objects still allows enrich.
- [ ] Run targeted Jest for touched files under `lambda/ephemera/` (see **Verification**).
- [ ] After merge, update **Progress** below and **Recommended order** checkboxes; then archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../../../../taskPlanning/AGENT.md).

## Verification

From `lambda/ephemera/` (adjust file list to match what changed):

```bash
npx jest --config "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera/jest.config.js" --runInBand \
  dataSource/actions/utilities/countCoyotePlacedObjectsAcrossRooms.test.ts \
  dataSource/actions/enrich/acmeOrder/index.test.ts \
  dataSource/actions/parseCommand.test.ts
```

## Progress

| Milestone | Status |
| --- | --- |
| Task plan authored | Done |
| Count helper + tests | Done |
| `enrichAcmeOrder` guard + parse wiring | Not started |
| Verification commands green | Not started |
| Durable docs updated (if needed) | Not started |
| Task plan retired | Not started |
