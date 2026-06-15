# Positions gateway: decouple presentation from topology

**Status:** PR1 complete (Phase 0 + Phase 1). Next step: Phase 2 (topology-only `PlayPositionGraph`; drop package `getRoomRoster`). All implementation decisions (D1--D3) locked.

Skim [`taskPlanning/AGENT.md`](../../../../../AGENT.md) once for durability expectations, what belongs in task plans vs durable package docs, and recommended-order checkbox conventions.

## Purpose

Remove presentation-layer fields and roster compose surfaces from **`@tonylb/mtw-gateways`** positions read types and handler API so the package owns **play manipulation topology + adjacency memo only**. Roster display (`DisplayName`, `SessionIds`, `Color`, `fileURL`) stays in ephemera compose ([`hydrateRoomRoster.ts`](../../../../../../lambda/ephemera/internalCache/hydrateRoomRoster.ts) --- **`getRoomCharacterList`**).

Production already behaves this way; this initiative aligns **types, exports, tests, and docs** with the graph-role model in [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#graph-roles-shared-shape-different-authority).

## Problem statement (task-only)

`PlayPositionGraph` currently extends `StandardPositionGraphData` with optional presentation/memo fields:

| Field / type | Smell | Steady-state reality today |
| --- | --- | --- |
| `characterRosterMeta` on [`PlayPositionGraph`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/types.ts) | Roster display cached on topology read envelope | `Positions.set` seeds topology only; `getRoomCharacterList` hydrates from topology + `CharacterMeta` + `CharacterSessions` |
| `PlayPositionRoomRosterEntry` in gateway package | Presentation DTO exported from positions layer | Only ephemera `hydrateRoomRoster` imports it today (via `PositionsData.getRoomRoster` --- to be removed per D2) |
| `roomEndpoint` on `PlayPositionGraph` | Reverse membership on forward character graph | Production uses `getMembershipContainers` / adjacency only; helpers are package-test-only |
| `PositionsCacheHandler.getRoomRoster` | Package handler implies roster authority | Returns empty for topology-only graphs unless `characterRosterMeta` was patched; ephemera overrides |

Durable steady-state architecture belongs in package and positions docs --- not duplicated here. Link and change only what this task ships.

## Getting started

1. **Task planning framework** --- [`taskPlanning/AGENT.md`](../../../../../AGENT.md)
2. **Graph roles (mental model)** --- [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) (Type boundary table)
3. **Normative boundaries** --- [`lambda/ephemera/dataSource/positions/AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) (Scope of authority; Read surface)
4. **Gateway module scope** --- [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md)
5. **Ephemera roster compose path** --- [`lambda/ephemera/internalCache/AGENT.md`](../../../../../../lambda/ephemera/internalCache/AGENT.md) (Membership presentation and roster)
6. **Implementation map** --- [`lambda/ephemera/dataSource/positions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md)

### Baseline verification (run before edits)

Command authority: **`packages/mtw-gateways`** uses Jest (`npm test` in package dir). **`lambda/ephemera`** uses Jest (`npm test` in lambda dir). Run targeted suites when touching each area.

```bash
cd packages/mtw-gateways && npm test -- ts/ephemera/positions
cd lambda/ephemera && npm test -- internalCache/positions.test.ts internalCache/hydrateRoomRoster.test.ts dataSource/positions/membership
```

## Target end state

| Layer | Owns |
| --- | --- |
| **`mtw-gateways/positions`** | `getPositionGraph` (topology), `getMembershipContainers` (adjacency), invocation memo for those two |
| **`PositionsData`** (`internalCache/positions.ts`) | Topology + adjacency memo only --- **no roster compose** |
| **`hydrateRoomRoster.ts`** | Roster presentation compose: **`getRoomCharacterList(roomId)`** (topology ids from `Positions.getPositionGraph`, display from `CharacterMeta` + `CharacterSessions`) |
| **`EphemeraPlayPositionGraph`** (`mtw-interfaces`) | Dynamo manipulation truth (character identity nodes only) |

`PlayPositionGraph` becomes **topology only** (alias of `StandardPositionGraphData`). No `characterRosterMeta`, no `roomEndpoint`.

**Hydrated roster (ephemera):** one canonical type --- **`RoomCharacterListItem`** in [`baseClasses.ts`](../../../../../../lambda/ephemera/internalCache/baseClasses.ts) --- for compose, affordance wire, and membership-apply snapshots. Required `DisplayName` (`''` when unknown) and `SessionIds` (`[]` when none); optional `Color`, `fileURL`. Replaces `PlayPositionRoomRosterEntry`, `ActiveCharacterRosterEntry`, and `playPositionRosterEntryToRoomCharacterListItem`.

## Out of scope (separate retirement)

Keep until a dedicated ticket; not part of this plan's deletion list:

- `getRoomActiveCharactersFromDynamo`, `getCharacterRoomIdFromDynamo` (legacy Dynamo reads for tests/tooling)
- `effectiveRoomPositionGraph` / `seedGraphFromActiveCharacters` in [`positionGraphMerge.ts`](../../../../../../lambda/ephemera/dataSource/positions/membership/positionGraphMerge.ts) (drift-repair bootstrap when stored `positionGraph` absent)

## Decided (implementation --- plan only)

| ID | Decision | Rationale |
| --- | --- | --- |
| D1 | **One canonical ephemera roster type (Option A).** Consolidate `PlayPositionRoomRosterEntry`, `RoomCharacterListItem`, and `ActiveCharacterRosterEntry` into **`RoomCharacterListItem`** ([`baseClasses.ts`](../../../../../../lambda/ephemera/internalCache/baseClasses.ts)). | `DisplayName` and `SessionIds` have clear empty values (`''`, `[]`); no need for parallel wire vs apply shapes with optional fields. |
| D2 | **Dedicated roster compose helper (Option B).** Remove `getRoomRoster` from `PositionsData` / `PositionsCacheHandler`. Steady-state API: **`getRoomCharacterList`** in [`hydrateRoomRoster.ts`](../../../../../../lambda/ephemera/internalCache/hydrateRoomRoster.ts) --- reads topology via `internalCache.Positions.getPositionGraph`, hydrates display fields. | Keeps `Positions` / `mtw.ephemera.positions` focused on play manipulation truth; roster is ephemeral presentation compose. |
| D3 | **Doc-only guard (no CI).** Record must-not rules in durable docs; run full-repo grep from **Verification** at PR2/PR3 close and initiative completion. No standing CI check --- migration is short-lived. | Avoids CI churn for a brief transitional state; grep at cleanup is sufficient. |

When decisions ship, record in `AGENT.implementation.md` / `AGENT.contract.md` and remove rows here.

## Open decisions (implementation --- plan only)

None.

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| 0 | Deprecation markers (D3: doc obligation only) | Complete |
| 1 | Remove `roomEndpoint` and reverse-encoding helpers | Complete |
| 2 | Topology-only `PlayPositionGraph`; drop package `getRoomRoster` | Not started |
| 3 | Roster DTO consolidation + remove `PositionsData.getRoomRoster` (D1, D2) | Not started |
| 4 | Durable doc + contract alignment | Not started |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines `[X]` as you complete them.

### PR1 --- Phase 0 + Phase 1 (low risk)

- [X] Phase 0: add `@deprecated` JSDoc on `characterRosterMeta`, `roomEndpoint`, legacy `project*` helpers, package `getRoomRoster`, and `PositionsData.getRoomRoster`
- [X] Phase 1: remove `roomEndpoint` from `PlayPositionGraph`
- [X] Phase 1: delete `projectCharacterGraphFromRoomEndpoint`, `projectMembershipContainersFromRoomEndpoint`
- [X] Phase 1: delete `roomRosterCacheKey` (exported, unused)
- [X] Phase 1: update [`packages/mtw-gateways/ts/ephemera/positions/index.test.ts`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/index.test.ts) (remove endpoint tests)
- [X] Phase 1: run gateway positions tests; update this plan checkboxes

### PR2 --- Phase 2 (topology-only gateway)

- [ ] Narrow `PlayPositionGraph` to `StandardPositionGraphData` (topology only)
- [ ] Simplify `projectRoomGraphFromStoredPositionGraph` --- drop optional `activeCharacters` arg
- [ ] Delete `projectRoomGraphFromActiveCharacters`, `projectRoomRosterFromGraph`, `projectRoomGraphFromRosterEntries`, `toRosterEntry`
- [ ] Remove `PositionsCacheHandler.getRoomRoster` from [`factory.ts`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/factory.ts)
- [ ] Tighten `PositionsCacheSetParams.graph` to topology-only type
- [ ] Rewrite package tests: topology/adjacency/memo only (remove roster-from-graph assertions)
- [ ] Confirm production paths unchanged: [`applyCharacterRoomMembership.ts`](../../../../../../lambda/ephemera/dataSource/positions/membership/applyCharacterRoomMembership.ts) still seeds via `projectRoomGraphFromStoredPositionGraph(storedGraph)` only
- [ ] Run gateway + ephemera membership tests; run cleanup grep (see **Verification**); update this plan checkboxes

### PR3 --- Phase 3 (roster DTO consolidation + compose seam; D1, D2)

- [ ] Implement D1: **`RoomCharacterListItem`** as the only hydrated roster entry type (see **Decided** above)
- [ ] Implement D2: move compose into [`hydrateRoomRoster.ts`](../../../../../../lambda/ephemera/internalCache/hydrateRoomRoster.ts) --- **`getRoomCharacterList`** calls `internalCache.Positions.getPositionGraph` + `extractCharacterIdsFromPlayPositionGraph` + `hydrateRoomRosterFromCharacterIds`; remove `PositionsData.getRoomRoster` override and delete [`positions.test.ts`](../../../../../../lambda/ephemera/internalCache/positions.test.ts) `getRoomRoster` tests (cover via `hydrateRoomRoster.test.ts`)
- [ ] Update `affordanceRoomDeliverable` to call `getRoomCharacterList` (not `Positions.getRoomRoster`)
- [ ] Update `buildRoomRosterSnapshots` / membership apply tests (already use `getRoomCharacterList`)
- [ ] Replace `ActiveCharacterRosterEntry` with `RoomCharacterListItem` on `MembershipApplyResult.roomRosterSnapshots`; delete `playPositionRosterEntryToRoomCharacterListItem`
- [ ] Remove `PlayPositionRoomRosterEntry` from gateway exports ([`types.ts`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/types.ts), [`index.ts`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/index.ts))
- [ ] Run ephemera `hydrateRoomRoster.test.ts`, `affordanceRoomDeliverable.test.ts`, membership apply tests; run cleanup grep (see **Verification**); update this plan checkboxes

### PR4 --- Phase 4 (durable docs)

- [ ] Update [`AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) type boundary table (`PlayPositionGraph` = topology projection only)
- [ ] Update [`AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) --- roster steady-state via **`getRoomCharacterList`** (not `Positions.getRoomRoster`); remove `characterRosterMeta` clauses; add doc-only must-not for reintroducing removed symbols (D3)
- [ ] Update [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) --- topology + adjacency only; no roster API
- [ ] Update [`packages/mtw-gateways/AGENT.md`](../../../../../../packages/mtw-gateways/AGENT.md) and [`lambda/ephemera/internalCache/AGENT.md`](../../../../../../lambda/ephemera/internalCache/AGENT.md) for D2 compose seam
- [ ] Final cleanup grep (see **Verification**); update this plan Progress table; mark initiative done

## Verification

After each PR:

```bash
# Gateway positions package
cd packages/mtw-gateways && npm test -- ts/ephemera/positions

# Ephemera consumers
cd lambda/ephemera && npm test -- internalCache/positions.test.ts internalCache/hydrateRoomRoster.test.ts internalCache/affordanceRoomDeliverable.test.ts dataSource/positions/membership
```

### Cleanup grep (D3 --- manual, at PR2/PR3/PR4 close)

No CI job. Run when completing gateway cleanup (PR2), ephemera compose migration (PR3), and initiative sign-off (PR4). Expect **zero** matches in TypeScript sources:

```bash
rg 'characterRosterMeta|roomEndpoint|PlayPositionRoomRosterEntry|projectRoomGraphFromRosterEntries|projectRoomRosterFromGraph|getRoomRoster' \
  --glob '*.ts' --glob '!taskPlanning/**'
```

Symbols are removed from the gateway package as well as ephemera --- not an "outside gateways" rule. Exclude `taskPlanning/**` only so this plan's historical text does not fail the check.

Doc obligation (Phase 4): durable docs record must-not reintroduction; grep at cleanup verifies.

### Regression watchlist

| Risk | Mitigation |
| --- | --- |
| Plain `createPositionsCacheHandler` used without `PositionsData` override | Only [`membershipContainersSharedMemo.test.ts`](../../../../../../lambda/ephemera/dataSource/positions/membership/membershipContainersSharedMemo.test.ts) swaps handler for adjacency memo test; does not call roster compose |
| `Positions.set` accidentally accepts presentation fields | Phase 2 types `PositionsCacheSetParams.graph` as topology-only |
| Callers still use `Positions.getRoomRoster` after D2 | Grep for `getRoomRoster`; update `affordanceRoomDeliverable` tests to mock `getRoomCharacterList` |

## Coordination

- **No client changes** expected (roster compose is server-side ephemera only).
- **Land gateway type/export changes before or with** ephemera import updates in PR3 (same PR is fine if monorepo CI runs both packages).
- When initiative completes: move any lasting normative text into contract/implementation docs (Phase 5), then **delete this planning file** per [`taskPlanning/AGENT.md`](../../../../../AGENT.md).

## Related docs

- Positions DataSource durable index: [`lambda/ephemera/dataSource/positions/AGENT.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.md)
- Graph / edge authoring (Area topology, separate concern): [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md)
