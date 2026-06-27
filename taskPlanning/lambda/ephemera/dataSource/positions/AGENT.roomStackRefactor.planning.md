# RoomStack unbundle + timestamp merge refactor

**Status:** In progress (planning). **Next:** Phase 3 --- trim preserves per-frame timestamps.

Task-scoped plan for unbundling eviction-ladder (`RoomStack`) maintenance from the manipulation kernel transact, running navigate ladder updates in parallel with post-navigate presentation orchestration, and mitigating out-of-order races with per-frame `timeWritten` merge semantics.

Follows [`taskPlanning/AGENT.md`](../../../../AGENT.md). **Delete this file** when the refactor merges and durable docs are updated.

---

## Purpose

**What we are changing (task-only summary):**

Today, character navigate persists `Meta::Character.RoomStack` in the **same** `applyHostEffects` transact as room `positionGraph` + adjacency updates via optional `CharacterRowEffect` ([`manipulation/types.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/types.ts), [`characterRoomStackTransactItems.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/characterRoomStackTransactItems.ts)). This plan **removes** ladder writes from the kernel and **replaces** atomic bundling with:

1. **Graph-only kernel** --- `applyHostEffects` accepts `HostEffect[]` only.
2. **Parallel navigate tail** --- after `applyCharacterRoomMembership` completes the membership-changed bundle, **`Promise.all`** runs ladder persist and `orchestrateCharacterNavigate` together (RS-2). `RoomUpdate` / `EphemeraUpdate` handlers from the bundle run in parallel with both branches (`publish` does not await subscribers).
3. **Per-frame timestamps + navigate merge** --- each `RoomStackItem` gains `timeWritten` (epoch ms). **Navigate** follow-up persists merge into stored state so **older navigates cannot regress newer frames** (extend / truncate / anti-resurrection). **Trim** only filters inaccessible frames and **preserves** `timeWritten` on survivors (no stack-level write time).

**What we are not changing:**

- Public coordinator ingress (`MembershipApplyArgs`: `{ characterId, targetRoomId }` only --- **S1-9**).
- In-play authority (`positionGraph` + adjacency via `getMembershipContainers`).
- Disconnect asymmetry (purge membership, **retain** ladder).
- `Character Moved` / membership-changed bundle gating on **`MembershipDiff.changed`** from graph persist only (ladder lag must not block facts, cache, or bus bundles).

**Design rationale (brief):** While in play, `RoomStack` is write-only for navigate; live reads use graph membership ([`resolveCharacterRoomId.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/resolveCharacterRoomId.ts)). Ladder staleness primarily surfaces at reconnect or asset trim --- outcomes that are **story-survivable** (recent fallback rooms). Engineering hygiene still requires **monotonic merge** so parallel ladder jobs cannot undo newer moves.

Steady-state architecture remains in package docs --- link, do not duplicate:

| Doc | Role |
| --- | --- |
| [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) | Eviction ladder mental model |
| [`lambda/ephemera/dataSource/positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) | Normative rules (**must** update contract when this ships) |
| [`lambda/ephemera/dataSource/positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) | Code map |
| [`lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) | Kernel + adapter layering |

---

## Calling sequence

### Today

```text
executeCharacterNavigate / handleCharacterConnected (connect)
  ├─ characterMeta = CharacterMeta.get (before apply; used by orchestrate)
  ├─ await applyCharacterRoomMembership
  │    ├─ applyHostEffects (graph + RoomStack in one transact)
  │    ├─ stream Character Moved, seed caches, invalidate CharacterMeta
  │    └─ messageBus.publish RoomUpdate + EphemeraUpdate
  └─ if changed: await orchestrateCharacterNavigate (sequential after apply)
```

### After refactor

```text
executeCharacterNavigate / handleCharacterConnected (connect)
  ├─ characterMeta = CharacterMeta.get (before apply; orchestrate still uses pre-apply snapshot)
  ├─ await applyCharacterRoomMembership
  │    ├─ applyHostEffects ({ hostEffects } only)
  │    ├─ stream Character Moved, seed caches, invalidate CharacterMeta
  │    └─ messageBus.publish RoomUpdate + EphemeraUpdate
  │         (handlers start; not awaited)
  └─ if changed && to !== null:
       await Promise.all([
         persistRoomStackNavigate(...).catch(log),   // RS-3: must not fail navigate
         orchestrateCharacterNavigate(...),
       ])
```

**Disconnect:** `applyCharacterRoomMembership({ targetRoomId: null })` only --- no orchestrate, no ladder navigate persist.

**No new messageBus type** for RoomStack. The invoke chain **`await`s** the parallel tail before lambda return; [`flushAndSettle`](../../../../../lambda/ephemera/app.ts) still drains `RoomUpdate` / `Perception` handlers from earlier publishes.

Extract shared tail logic (e.g. `afterCharacterMembershipNavigateChanged`) so [`executeCharacterNavigate.ts`](../../../../../lambda/ephemera/dataSource/positions/navigate/executeCharacterNavigate.ts) and [`handleConnectionsCharactersPresence.ts`](../../../../../lambda/ephemera/dataSource/positions/handleConnectionsCharactersPresence.ts) do not duplicate the `Promise.all` block.

---

## Target design

### Flow (after refactor)

```text
applyCharacterRoomMembership
  -> planMembershipTransfer -> applyHostEffects({ hostEffects })   // graph only
  -> membership-changed bundle (unchanged): fact, caches, RoomUpdate, EphemeraUpdate
  -> return { ok, froms, to, beatAnchorTime, ... }   // unchanged shape

afterCharacterMembershipNavigateChanged (when changed && to !== null)
  -> persist inputs: result.to + result.beatAnchorTime; characterMeta.assets from caller
     pre-apply snapshot; roomAssets/canon via internalCache.RoomAssets + Global (not invalidated by apply)
  -> Promise.all([
       persistRoomStackNavigate(...),
       orchestrateCharacterNavigate({ characterMeta, froms, to, beatAnchorTime, messageBus }),
     ])
```

### `RoomStackItem` shape

```typescript
export type RoomStackItem = {
    asset: string
    RoomId: string
    /** Epoch ms: navigate beatAnchorTime on frames this write applied. Omitted/0 = legacy. */
    timeWritten?: number
}
```

Readers (`resolveLegalRoomIdFromRoomStack`, trim helpers, connect resolution) **ignore** `timeWritten`.

### `mergeRoomStack(current, proposed, writeTime)` (navigate follow-up only)

Pure merge function used by **navigate** ladder persist only. Given stored `current`, algorithm output `proposed` (frames without timestamps yet), and navigate `writeTime` (`beatAnchorTime`):

| Rule | Behavior |
| --- | --- |
| **Update frame at index `i`** | If `i < proposed.length` and (`i >= current.length` OR `writeTime >= (current[i].timeWritten ?? 0)`): set `merged[i] = { ...proposed[i], timeWritten: writeTime }`. Else keep `current[i]`. |
| **Extend outer frames** | Allow indices `i >= current.length` only when `writeTime > max(current[*].timeWritten ?? 0)` (prevents stale writes **re-adding** truncated outer layers). |
| **Truncate (fork)** | Drop `current[i]` for `i >= proposed.length` only when `(current[i].timeWritten ?? 0) <= writeTime`. |

**Write time source:** use **`beatAnchorTime`** recorded at graph persist success (same anchor as `Character Moved`), **not** wall clock at async completion (RS-1).

**Legacy rows:** treat missing `timeWritten` as `0`.

### Trim persist (no merge)

[`trimPersistCharacterRoomStack.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/trimPersistCharacterRoomStack.ts) **filters** inaccessible frames and **keeps** `timeWritten` unchanged on survivors. No stack-level timestamp; no `mergeRoomStack`. If a stale navigate job races trim, per-frame timestamps + navigate merge rules prevent resurrecting removed outer layers.

### Kernel simplification

Remove from manipulation kernel:

- `CharacterRowEffect`, `characterRowEffects` on `ApplyHostEffectsArgs`
- `buildCharacterRoomStackTransactItems` from `buildTransactItemsFromHostEffects`
- Kernel transact branch for `characterRowEffects`-only writes

`applyCharacterRoomMembership` owns graph persist + membership-changed bundle only. Navigate callers own the parallel tail (`persist` + `orchestrate`). **No** extra persist fields on `MembershipApplyResult` --- tail helper uses existing result fields plus caller pre-apply `characterMeta` and [`internalCache`](../../../../../lambda/ephemera/internalCache/index.ts) (`RoomAssets`, `Global` assets); prior ladder shape comes from Dynamo in the persist reducer, not cache.

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) (durability ladder, open decisions, checkbox conventions).
2. Read eviction ladder sections in [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#eviction-ladder-shipped) and [`AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#eviction-ladder-roomstack-storage) (note contract clause to **replace** on ship: same-transact bundling).
3. Read current implementation map: [`AGENT.implementation.md` --- Eviction ladder](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md#eviction-ladder-roomstack-storage) and [`manipulation/AGENT.implementation.md` --- CharacterRowEffect](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md#characterroweffect-navigate-only-not-a-hosteffect).
4. Review code touchpoints:
   - [`applyCharacterRoomMembership.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/applyCharacterRoomMembership.ts)
   - [`executeCharacterNavigate.ts`](../../../../../lambda/ephemera/dataSource/positions/navigate/executeCharacterNavigate.ts)
   - [`handleConnectionsCharactersPresence.ts`](../../../../../lambda/ephemera/dataSource/positions/handleConnectionsCharactersPresence.ts)
   - [`orchestrateNavigate.ts`](../../../../../lambda/ephemera/dataSource/positions/navigate/orchestrateNavigate.ts)
   - [`applyHostEffects.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.ts)
   - [`membershipRoomStack.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/membershipRoomStack.ts)
   - [`trimPersistCharacterRoomStack.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/trimPersistCharacterRoomStack.ts)
   - [`characterRoomStackTransactItems.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/characterRoomStackTransactItems.ts) (to retire or repurpose)
5. **Testing:** From repo root, baseline before edits:

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/membership/membershipRoomStack.test.ts \
  dataSource/positions/membership/planMembershipTransfer.characterPersist.test.ts \
  dataSource/positions/manipulation/applyHostEffects.test.ts \
  dataSource/positions/membership/applyCharacterRoomMembership.test.ts \
  dataSource/positions/navigate/executeCharacterNavigate.test.ts \
  dataSource/positions/handleConnectionsCharactersPresence.test.ts
```

Command authority: [`lambda/ephemera/dataSource/positions/AGENT.implementation.md` --- Verification](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md#verification) for full positions suite when closing the task.

---

## Implementation decisions (plan only)

Decisions for upcoming slices. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| RS-1 | **`writeTime` source:** `beatAnchorTime` at graph persist vs monotonic per-character sequence when `beatAnchorTime` collides in the same ms | Phase 1 merge tests | **Decided:** `beatAnchorTime`; add per-character sequence only if tests prove same-ms collisions in production paths |
| RS-2 | **Navigate tail concurrency:** bus publish vs sequential await vs parallel with orchestrate | Phase 2 wiring | **Decided:** after membership-changed bundle in `apply`, callers run **`Promise.all([persistRoomStackNavigate, orchestrateCharacterNavigate])`**. No new bus type. `RoomUpdate` handlers from `apply` run in parallel with both branches. |
| RS-3 | **Failed ladder retry:** exponential backoff in-module vs rely on next navigate to catch up | Phase 2 | **Decided:** exponential backoff with a **small capped retry count** in `persistRoomStackNavigate`; log and **resolve** (do not reject) --- **next navigate** is long-tail catch-up; **must not** fail `executeCharacterNavigate` / connect path |
| RS-4 | **Trim vs timestamps** | Phase 3 | **Decided / N/A:** timestamps are **per frame**, not per stack. Trim filters frames and preserves survivor `timeWritten`; no trim merge or stack-level `writeTime` |
| RS-5 | **Module location for merge + persist + tail helper** | Phase 1--2 | **Decided:** [`membership/mergeRoomStack.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/mergeRoomStack.ts) + [`membership/persistRoomStackNavigate.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/persistRoomStackNavigate.ts) + shared navigate tail helper (e.g. [`navigate/afterCharacterMembershipNavigateChanged.ts`](../../../../../lambda/ephemera/dataSource/positions/navigate/afterCharacterMembershipNavigateChanged.ts)); keep algorithm in [`membershipRoomStack.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/membershipRoomStack.ts) |

---

## Progress

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Task plan (this doc) | Done |
| 1 | `mergeRoomStack` + race unit tests | Done |
| 2 | Kernel unbundle + persist + `Promise.all` navigate tail | Done |
| 3 | Trim preserves per-frame timestamps | Not started |
| 4 | Test migration + contract/implementation doc updates | Not started |
| 5 | Delete this plan | Not started |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines as you complete them.

- [X] **Phase 1 --- Merge primitive**
  - [X] Add `timeWritten?: number` to `RoomStackItem` in [`types.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/types.ts).
  - [X] Implement `mergeRoomStack` (pure) + tests: out-of-order navigate (C then D, stale C arrives last), fork truncate, stale resurrection blocked, legacy `timeWritten` missing.
  - [X] Implement `buildProposedRoomStackForNavigate` (wrap existing `computeRoomStackUpdate` + `applyLadderUpdateFromDestinationChain` without timestamps on proposed frames).

- [X] **Phase 2 --- Unbundle kernel + parallel navigate tail**
  - [X] Add `persistRoomStackNavigate` in [`persistRoomStackNavigate.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/persistRoomStackNavigate.ts): `optimisticUpdate` + merge reducer; capped exponential backoff (RS-3); catch/log at tail helper so navigate does not fail.
  - [X] Add shared [`afterCharacterMembershipNavigateChanged`](../../../../../lambda/ephemera/dataSource/positions/navigate/afterCharacterMembershipNavigateChanged.ts) (name as implemented): `Promise.all` persist + orchestrate when `changed && to !== null`.
  - [X] Wire [`executeCharacterNavigate.ts`](../../../../../lambda/ephemera/dataSource/positions/navigate/executeCharacterNavigate.ts) and [`handleConnectionsCharactersPresence.ts`](../../../../../lambda/ephemera/dataSource/positions/handleConnectionsCharactersPresence.ts) through tail helper (replace inline `orchestrateCharacterNavigate` await).
  - [X] Remove `CharacterRowEffect` / `characterRowEffects` from [`manipulation/types.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/types.ts), [`applyHostEffects.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.ts).
  - [X] Update [`applyCharacterRoomMembership.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/applyCharacterRoomMembership.ts): graph-only kernel; no ladder write; **unchanged** `MembershipApplyResult` shape.
  - [X] Retire or narrow [`characterRoomStackTransactItems.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/characterRoomStackTransactItems.ts) (no kernel transact items).
  - [X] Update [`applyHostEffects.test.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.test.ts) (remove RoomStack bundle case); update navigate/connect/persist tests.

- [ ] **Phase 3 --- Trim + defaults**
  - [ ] Update [`trimPersistCharacterRoomStack.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/trimPersistCharacterRoomStack.ts): filter-only persist; preserve `timeWritten` on surviving frames (RS-4).
  - [ ] Confirm guest character / default stack initialization sets sensible `timeWritten` or omits (legacy 0).

- [ ] **Phase 4 --- Docs and verification**
  - [ ] Replace contract clause "same character-row transact" with parallel persist + merge rules in [`AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#eviction-ladder-roomstack-storage).
  - [ ] Update [`AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) and [`manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) (remove `CharacterRowEffect` from kernel table; document persist, merge, and navigate tail).
  - [ ] Run full positions verification (see below).
  - [ ] Delete this planning file.

---

## Verification

**Per slice (Phase 1--3):**

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/membership/ \
  dataSource/positions/navigate/ \
  dataSource/positions/handleConnectionsCharactersPresence.test.ts \
  dataSource/positions/manipulation/applyHostEffects.test.ts
```

**Before merge (Phase 4):**

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/ \
  dataSource/perception/ \
  dataSource/actions/index.test.ts
```

**Grep sanity (after kernel unbundle):**

```bash
rg 'CharacterRowEffect|characterRowEffects' lambda/ephemera/dataSource/positions/
rg 'buildCharacterRoomStackTransactItems' lambda/ephemera/dataSource/positions/manipulation/
rg 'PersistRoomStackNavigate' lambda/ephemera/
```

Expect zero hits for kernel RoomStack bundling and bus persist type.

**Behavioral checks (manual or integration):**

- Navigate with membership change: graph + adjacency persist; `Character Moved` fires; ladder persist and orchestrate run in parallel without blocking each other.
- `RoomUpdate` handlers overlap with ladder persist (publish before `Promise.all`).
- Rapid navigate B -> C -> D: simulated out-of-order ladder writes leave top frame at D.
- Ladder persist failure after retries: navigate/orchestrate still succeed; error logged.
- Disconnect: membership cleared; ladder unchanged.
- Connect: trim + membership apply + parallel tail still resolve legal room.

---

## Contract updates (when shipping)

Replace in [`AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md):

- **Remove:** "On successful navigate membership persist, `applyHostEffects` **must** update `Meta::Character.RoomStack` in the same character-row transact."
- **Add (sketch):**
  - Navigate ladder maintenance **must** run after successful graph persist when `MembershipDiff.to !== null`; **must not** gate membership-changed bundle on ladder completion.
  - Navigate ladder persist **must** use merge semantics so a write with time `T` cannot overwrite or truncate frames with `timeWritten > T`, and cannot extend outer frames unless `T` exceeds all existing frame timestamps.
  - Trim persist **must** filter inaccessible frames and **preserve** per-frame `timeWritten` on survivors (no navigate merge).
  - Ladder persist failure **must not** fail membership apply or navigate presentation orchestration after successful graph persist.

---

## When this task finishes

1. Move normative merge rules into `AGENT.contract.md`; update `AGENT.implementation.md` / manipulation implementation doc.
2. Do **not** add implementation forks to `AGENT.concepts.md` (eviction ladder vocabulary is unchanged).
3. Delete this file --- git retains history.
