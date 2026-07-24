# Positions manipulation --- implementation map and kernel spec

**Status:** Membership transfer and host-local relational patch shipped. **Coordinators now route through the shared membership adapter + [`kernel/commitStepSequence.ts`](kernel/commitStepSequence.ts) (all routes, as of 2026-07-23) --- `applyHostEffects` is retired.** See the file-top superseded notes below for the migration history.

**Superseded 2026-07-23 for take-hold/drop/establish/dissolve (the two player-command routes).** `applyObjectSetTakeHold.ts`/`applyObjectSetDrop.ts`/`applyObjectSetTransfer.ts` and `applyObjectRelationalChangeWithTransfer.ts`/`applyHostRelationalPatch.ts`/`planHostRelationalPatch.ts` --- everything this doc describes below as the live `MultiKeyUpdate` kernels for those four commands --- are **deleted**. `executeObjectTakeHold.ts`/`executeObjectDrop.ts` now seed and run the general Synthesize executor (`enrich/objectManipulation/synthesize/executor.ts`) fresh at execute time and commit via one general kernel entrypoint, [`kernel/commitStepSequence.ts`](kernel/commitStepSequence.ts); `applyObjectRelationalChange.ts` collapsed its satisfied/repaired branch into the same `commitStepSequence` call.

**Superseded 2026-07-23 for the object-lifecycle routes (destroy/edit/spawn/place/drift-repair) --- see the same Migrate row.** [`membership/applyObjectClearMembership.ts`](membership/applyObjectClearMembership.ts) and [`../membership/applyObjectRoomMembership.ts`](../membership/applyObjectRoomMembership.ts) (used by [`../membership/repairObjectPlacementDrift.ts`](../membership/repairObjectPlacementDrift.ts) too) no longer call `applyHostEffects`. Each sweeps every departure host's edges referencing the object via `boundaryEdgeOutcomes` on the singleton `{objectId}` set --- no carry-closure growth, since there is no destination for a carry partner to move into, so every outcome (carry/dissolve/defer alike) collapses to "sever it" (dissolve-only, no cascade: a destroyed object's dependents have their relation severed, not swept along) --- then commits an explicit `dissolveRelation` + widened `transferMembership` step sequence via `commitStepSequence`, same as the player routes. This required widening `KernelTransferMembershipStep` (kernel-layer only, `kernelStep.ts`) from a singular non-null `fromHostId`/`toHostId` pair to `fromHostIds: ReadonlySet<HostId>` / `toHostId: HostId | null`, matching `MembershipDiff`'s existing `{froms, to}` shape --- one step kind now covers a real transfer (both populated), a pure add (`fromHostIds` empty, spawn), and a pure remove (`toHostId` null, destroy/clear/stray-room scrub); `applyStepSequenceCore.ts`/`computeStepSequenceFootprint.ts`/`factsForStep.ts`/`commitStepSequence.ts`'s adjacency-item builder all updated accordingly. `commitStepSequence` also gained an optional `suppressRelationalFacts` dep, gating only the `Object Relation Changed` fact (not `Object Moved`) --- destroy/edit leaves it unset (facts now stream, delivering BD-28's originally-silent dissolution), `repairObjectPlacementDrift`'s multi-room scrub sets it `true` (a silent consistency fixup, not a player-visible event).

**Superseded 2026-07-23 for the character route (navigate/connect/disconnect), retiring the legacy pipeline entirely.** [`../membership/applyCharacterRoomMembership.ts`](../membership/applyCharacterRoomMembership.ts) --- the last live caller of `applyHostEffects` --- now builds a bare `transferMembership` `KernelStep` (`entityIds: {characterId}`) and commits via `commitStepSequence`, same kernel as every other route. Unlike the object routes, it builds **no** `dissolveRelation` steps at all: `HostRelationalEdge` is object-only (BD-36's character-relation widening is explicitly deferred), so a character can never be a relational-edge endpoint --- there is structurally nothing for `boundaryEdgeOutcomes` to sweep here, not just nothing found in practice. `Character Moved` fact emission is folded into `commitStepSequence`/`factsForStep` (via a new `characterNames` dep) rather than layered on top after the kernel call returns --- that's what keeps it streaming before the kernel's own `RoomUpdate` publish loop, matching `Object Moved`'s existing ordering guarantee (the route's own test suite asserts this ordering). With this route migrated, `applyHostEffects.ts`, `membership/objectPlacementTransactItems.ts`, `membership/characterRoomMembershipTransactItems.ts`, and `membership/characterInventoryTransactItems.ts` have no remaining callers and are **deleted**, along with the dead adapter subtree only reachable through them (`adapters/computeDropDiff.ts`, `adapters/computeTakeHoldDiff.ts`, `adapters/planObjectDropTransfer.ts`, `adapters/planObjectTakeHoldTransfer.ts`, and the two `Object*Diffs` exports from `adapters/hostEffectsFromDiffs.ts`) --- confirmed unreachable except via `adapters/index.ts`'s barrel before deletion. **Residual finding, surfaced this slice and resolved as an immediate same-day follow-up:** the pre-assert-and-throw `EphemeraPositionGraph.removeObject`/`applyMembershipEffect` and `positionGraph/expandValidate/applyTransferSet.ts` had zero remaining production callers, `applyHostEffects.ts` having been their last one --- deleted, and the surviving assert-and-throw implementations (`removeObjectAsserted`/`applyTransferSetAsserted.ts`) renamed onto the now-free plain names (`removeObject`/`applyTransferSet.ts`), since each is the only implementation left. `removeCharacterAsserted` similarly merged into `removeCharacter` (one method, assert-and-throw always, vacuously satisfied until BD-36's character-relation widening lands).

The sections below describing the now-deleted/superseded files are kept as historical record of the design they superseded, not as current fact; see `kernel/commitStepSequence.ts`, `kernel/applyStepSequenceCore.ts`, and `kernel/kernelStep.ts` for the shipped replacement.

**Play graph model (P2):** [`../positionGraph/`](../positionGraph/) is the shared in-memory primitive. Kernels load via **`EphemeraPositionGraph.fromPlayEnvelope`**, simulate with **`applyMembershipEffect`** / **`applyRelationalPatch`**, and return **`postApplyGraphs: EphemeraPositionGraph[]`**. Transact reducers assemble host-bound graphs at the Dynamo read boundary (`fromRoomMeta` / `fromCharacterMeta`) and persist via **`toStored()`**. See [`../positionGraph/AGENT.md`](../positionGraph/AGENT.md).

Contracts: [`../AGENT.contract.md`](../AGENT.contract.md). Concepts: [`../AGENT.concepts.md`](../AGENT.concepts.md).

**Vocabulary:** Layered terms (host effect, membership host transfer, graph-grounded persist) live in [`../AGENT.concepts.md` --- Manipulation layering](../AGENT.concepts.md#manipulation-layering-membership-transfer) and [`../AGENT.contract.md` --- Manipulation persist layering](../AGENT.contract.md#manipulation-persist-layering).

---

## Target layering

```text
Per-operator ingress            verb-specific args, trusted ids (parse egress, navigate, repair, ...)
        |
        v
Shared membership adapter       froms/to planning, apply mode, membership observation -> HostEffect[]
        |                     (reusable across navigate, object place, takeHold, drop, ...)
        v
Manipulation kernel             validate + apply HostEffect[] on affected positionGraphs only
        |
        v
Per-operator coordinators       membership fact projection, stream/cache/bus bundles
```

**Invariant:** One kernel path for graph-grounded persist. Kernel accepts explicit **`HostEffect[]`** --- it does **not** independently discover priors via **`getMembershipContainers`**. Transfer planning lives in the **shared membership adapter** upstream.

---

## Section A --- Manipulation kernel (M4, M5)

### Read / simulate / persist (`EphemeraPositionGraph`)

Kernels and transact reducers share one boundary through [`../positionGraph/`](../positionGraph/). Type vocabulary: [`../AGENT.concepts.md`](../AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope).

| Phase | Boundary | API |
| --- | --- | --- |
| **Read** | Cache or row fetch | `await getPositionGraph(hostId)` (already **`EphemeraPositionGraph`** on ephemera cache) or `fromFieldPayload` / `fromRoomMeta` / `fromCharacterMeta` in transact reducers |
| **Simulate** | In-memory only | `applyMembershipEffect` / `applyRelationalPatch` on host-bound instance; multi-host -> **`EphemeraPositionGraph[]`** upserted by `hostId` |
| **Persist** | Dynamo attribute | `graph.toStored()` assigned to `draft.positionGraph`; row `EphemeraId` = `graph.hostId` |
| **Memo seed** | Ephemera cache wrapper | Coordinators call **`internalCache.Positions.set(graph)`** on **`postApplyGraphs`** |

### `HostEffect` (v1 membership-node only)

A **host effect** is one graph-grounded alteration on a fixed membership host: add or remove an identity node on that host's **`positionGraph`**, with matching adjacency dual-write. v1 covers **Character** and **Object** identity nodes only --- no in-room edges (slice 5+).

Spec shape (Phase 4a implements):

```typescript
type HostEffect =
    | { hostId: EphemeraRoomId; identityId: EphemeraCharacterId; op: 'add' | 'remove' }
    | { hostId: EphemeraRoomId; identityId: EphemeraObjectId; op: 'add' | 'remove' }
    | { hostId: EphemeraCharacterId; identityId: EphemeraObjectId; op: 'add' | 'remove' }
```

**Per-effect invariants:**

| Concern | Rule |
| --- | --- |
| Graph | Update via [`EphemeraPositionGraph`](../positionGraph/) (`applyMembershipEffect` in kernel; transact reducers use `fromRoomMeta` / `fromCharacterMeta` + `toStored()`) |
| Adjacency | Each `add` emits adjacency **Put**; each `remove` emits adjacency **Delete** (`buildPositionAdjacencyDataCategory`) |
| Host row | Room hosts: `Meta::Room`; character inventory hosts: `Meta::Character` |
| Edges | Membership-node effects only in **`applyHostEffects`** --- relational edges use **`applyHostRelationalPatch`** (shipped) |

**Reference transact builders (historical, Phase 4a):** `objectPlacementTransactItems.ts` (room + object), `characterInventoryTransactItems.ts` (character + object) --- both retired 2026-07-23 along with `applyHostEffects.ts`; the shipped kernel (`kernel/commitStepSequence.ts`) builds its own adjacency items directly, see [`kernel/commitStepSequence.ts`](kernel/commitStepSequence.ts).

### `applyHostEffects` contract

| Concern | Rule |
| --- | --- |
| **Input** | Explicit `HostEffect[]` only (**M1**) --- kernel **must not** call `getMembershipContainers` or plan transfers |
| **Reads** | `getPositionGraph` (or row fetch for transact reducers) **only** on hosts appearing in the effect list |
| **Validate** | Before transact: for each effect, confirm expected node presence/absence on that host's graph; fail fast on impossible plans |
| **Transact** | Single `transactWrite` bundling all host graph + adjacency items; exponential backoff on `TransactionCanceledException` (same pattern as expedient modules) |
| **Output** | `{ changed: boolean; postApplyGraphs: EphemeraPositionGraph[] }` for memo seeding (coordinators seed cache via `graph.toPlayEnvelope()`) |
| **Module path** | Top-level [`manipulation/`](./) --- sibling to `adapters/` and `membership/` (**M5**); entry: `applyHostEffects.ts` |
| **v1 scope** | Membership-node add/remove only (**M4**) |
| **Conflict** | On conflict between graph and adjacency, **`positionGraph` wins** (unchanged positions authority) |

**`changed` derivation:** `true` iff at least one effect alters stored graph state (equivalent to today's `MembershipDiff.changed` / `ObjectMembershipDiff.changed` after successful persist).

**RoomStack (eviction ladder):** **not** a kernel input. Navigate ladder persist runs in the parallel tail after [`applyCharacterRoomMembership`](../membership/applyCharacterRoomMembership.ts) --- see [`persistRoomStackNavigate.ts`](../membership/persistRoomStackNavigate.ts) and [`afterCharacterMembershipNavigateChanged.ts`](../navigate/afterCharacterMembershipNavigateChanged.ts). Merge/trim detail: [`../AGENT.implementation.md` --- Eviction ladder](../AGENT.implementation.md#eviction-ladder-roomstack-storage); normative rules: [`../AGENT.contract.md` --- Eviction ladder](../AGENT.contract.md#eviction-ladder-roomstack-storage).

### Host-local relational patch (Phase B; shipped B4)

Second kernel primitive: add/remove **edges** on a fixed host **`positionGraph`** without changing membership host. Distinct from membership transfer (**`applyHostEffects`** / **`HostEffect[]`**).

**Layering:**

```text
Per-operator ingress (relational)     Object Establish Relation | Object Dissolve Relation
        |
        v
planHostRelationalPatch               pure builder: RelationalIngressArgs -> HostRelationalPatch
        |
        v
applyHostRelationalPatch (kernel)     MultiKeyUpdate: re-validate live, apply patches on affected hosts
        |
        v
applyObjectRelationalChange           Object Relation Changed fact, cache seed, RoomUpdate
```

Relational ops **do not** route through the **shared membership adapter**. Membership transfer and relational patch may **compose** in Phase C (**BD-9** compound transact); each primitive keeps its own kernel entry.

**Redesigned as a `MultiKeyUpdate` reducer (BD-15/16 slice 3, 2026-07-15)**, mirroring `applyObjectSetTransfer.ts`'s Pipeline A -> B migration Slice 3 redesign: the earlier fetch-then-simulate-then-separately-transact design had the exact same race Arc A already fixed once for `transferMembership` --- legality was checked once against a snapshot (`validateAndSimulatePatches`, since removed), then the commit-time reducer (`hostRelationalPatchTransactItems.ts`, since deleted) blindly applied the precomputed edge with no re-validation. `planHostRelationalPatch.ts` compounded this: it did its own separate fetch purely to precompute a `changed` gate that `applyObjectRelationalChange.ts` used to **skip calling the kernel entirely** on an apparent no-op --- a stale snapshot there could silently skip a command that should have taken effect, never even reaching persistence. Both are fixed: `planHostRelationalPatch` is now a pure, synchronous builder (no fetch, no `changed` field); the kernel is always called; `changed` is now computed live inside the reducer (`!next.equals(prior)` per host, threaded through a closure) and gates the fact-stream/`RoomUpdate` publish in `applyObjectRelationalChange.ts`. **BD-15/16 slice 4 (2026-07-16):** the kernel can genuinely accept a Character `hostId`; at the time, the compiler (`compileRelational.ts`) fetched both the room's and the acting character's own inventory graph and tried both via `expandSameHost` (already-satisfied same-host case only; cross-host repair declines cleanly, C2 not yet built). **[Superseded 2026-07-20:** `compileRelational.ts` and `expandSameHost` were retired with the frame-extract deletion (iteration 3, Step 3); the replacement native relational compiler (`actions/enrich/objectManipulation/compileRelationalFromSkeleton.ts`) grounds only against the acting character's room and does **not** currently drive a Character `hostId` through this kernel path --- sameHost expansion is unbuilt on the native route until BD-15/16 is rebuilt there. The kernel capability below is unchanged and still correct; it's just not currently exercised with a Character host. See `actions/AGENT.concepts.md` (Expansion sub-role).**]** `applyObjectRelationalChange.ts`'s cache-seeding (renamed `seedGraphMemos`, was `seedRoomGraphMemos`) fixed to call `internalCache.Positions.set` unconditionally rather than skipping non-Room graphs entirely --- the old version would have left a Character's cached `positionGraph` stale after every such write; `RoomUpdate` publish is now guarded on `isEphemeraRoomId(hostId)`.

| Item | Shipped value |
| --- | --- |
| **Kernel entry** | [`applyHostRelationalPatch.ts`](applyHostRelationalPatch.ts) --- `MultiKeyUpdate`-based; `transactWrite`'s own internal fetch is the only fetch performed |
| **Edge helpers** | [`../positionGraph/`](../positionGraph/) (`HostRelationalEdge`, `edgesMatch`, relational mutators, `hostDataCategory`/`graphFromMeta` Room/Character dispatch) |
| **Planner** | [`relational/planHostRelationalPatch.ts`](relational/planHostRelationalPatch.ts) --- pure, synchronous |
| **Coordinator** | [`relational/applyObjectRelationalChange.ts`](relational/applyObjectRelationalChange.ts) |
| **Ingress** | [`relational/executeObjectEstablishRelation.ts`](relational/executeObjectEstablishRelation.ts), [`relational/executeObjectDissolveRelation.ts`](relational/executeObjectDissolveRelation.ts) |
| **Types** | `HostRelationalPatch` in [`types.ts`](types.ts) --- `hostId: EphemeraMembershipHostId` (widened from `EphemeraRoomId`, BD-15/16 slice 3) |
| **Normative contract** | [`../AGENT.contract.md` --- Host-local relational patch](../AGENT.contract.md#host-local-relational-patch-phase-b-shipped-b4) |

**Kernel contract:** explicit **`HostRelationalPatch[]`** only; reducer re-runs `EphemeraPositionGraph.applyRelationalPatch` (the shared legality authority, including `bothObjectsOnGraph`) against freshly-fetched graphs, one `MultiKeyUpdate` key per distinct affected host (Room or Character); **`op: 'add'`** idempotent when exact edge present (detected live); reject **`op: 'remove'`** when absent; throws to abort the whole transact on any staleness/illegality (single error code, `HOST_RELATIONAL_PATCH_TRANSACT_FAILED`, for all failures --- same collapse-to-failure precedent as `applyObjectSetTransfer.ts`, same BD-18 caveat: interim, not permanent); **`postApplyGraphs`** output; **no** adjacency dual-write.

---

## Section B --- Shared membership adapter (M8, M2)

### Module location

[`manipulation/adapters/`](adapters/) (**M8**). Suggested planner entry: **`planMembershipTransfer`** (final export name may match Phase 4a code).

### Planner inputs

| Field | Meaning |
| --- | --- |
| `entityId` | `CHARACTER#` or `OBJECT#` being moved |
| `entityKind` | `'character'` \| `'object'` --- determines eligible host types and effect shapes |
| `applyMode` | `'end-state'` \| `'bounded'` |
| `target` | Destination membership host (`ROOM#`, `CHARACTER#`, or `null` for out-of-play / remove-from-all) |
| `boundedHostIds?` | Trusted ingress hosts to scrub when `applyMode === 'bounded'` |
| `priorContainers` | From `getMembershipContainers(entityId)` (or graph-forward observation on repair paths) |

Coordinator **owns** membership observation; adapter **consumes** `priorContainers` and does not re-fetch unless a repair path passes graph-forward priors explicitly.

### Apply modes

| Mode | Used by | Scrub rule | `froms` projection |
| --- | --- | --- | --- |
| **end-state** | Navigate, connect, disconnect, object room placement | Remove from **every** prior membership host `!== target` | All distinct priors removed |
| **bounded** | **`takeHold`** v1, **`drop`** v1 | Remove from **only** `boundedHostIds` when entity is present on that host; **do not** end-state scrub other hosts of the same kind (**M2** on room scrub for **`takeHold`**) | **`takeHold`**: typically `[ingress roomId]` when removed; **`drop`**: `[ingress characterId]` when removed |

### Bounded + character inventory nuance (shipped `computeTakeHoldDiff`)

Cross-host **`takeHold`** uses **mixed** planning:

| Host kind | Mode at apply | Behavior |
| --- | --- | --- |
| **Room** (source) | **bounded** | Scrub **only** trusted ingress `roomId` when object is on that room |
| **Character** (destination) | **end-state** on character hosts | Add at target character; remove from **other** character inventory hosts if present (`needsCharacterMove`) |

This preserves shipped semantics in [`computeTakeHoldDiff`](adapters/computeTakeHoldDiff.ts). Locked by adapter + kernel tests.

### Planner output

```typescript
type MembershipTransferPlan = {
    hostEffects: HostEffect[];
    projection: {
        froms: EphemeraMembershipHostId[];
        to: EphemeraMembershipHostId | null;
        changed: boolean;
    };
}
```

- **`hostEffects`:** adapter -> kernel contract.
- **`projection`:** membership host transfer semantics for bus facts (`froms[]` / `to`) and coordinator `changed` gates --- same fields as today's `MembershipDiff` / `ObjectMembershipDiff`.

### Expedient function mapping (reference impl)

| Expedient function | Location | Adapter mode | Notes |
| --- | --- | --- | --- |
| `computeMembershipDiff` | [`adapters/computeEndStateRoomDiff.ts`](adapters/computeEndStateRoomDiff.ts) | end-state (room hosts) | Character room membership; object room placement reuses same diff |
| `computeTakeHoldDiff` | [`adapters/computeTakeHoldDiff.ts`](adapters/computeTakeHoldDiff.ts) | bounded room + character end-state | **M2** reference; split `roomDiff` + `characterDiff` consumed by `hostEffectsFromObjectTakeHoldDiffs` |
| `computeDropDiff` | [`adapters/computeDropDiff.ts`](adapters/computeDropDiff.ts) | bounded room + character bounded | Symmetric inverse of **`takeHold`**; consumed by `planObjectDropTransfer` |

Phase 4a adapter tests assert `planMembershipTransfer` / `planObjectTakeHoldTransfer` / `planObjectDropTransfer` match these functions for equivalent inputs.

### Parse alignment (M2 gate)

Actions parse steady-state ([`actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md#objectmanipulationintent-steady-state-shipped---membership-aware-classify--enrich--egress)) guarantees:

- Atomic **`takeHold`** egress supplies trusted `objectId` + ingress `roomId` (`fromRoomId`).
- Atomic **`drop`** egress supplies trusted `objectId`, `characterId`, and destination `roomId` from actions **`Parse Requested`** ([`actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md#objectmanipulationintent-steady-state-shipped----membership-aware-classify--enrich--egress)).
- **`multiPresent`** (`containers.length > 1`) terminalizes before egress.
- Zero-host objects terminalize before egress.

Bounded adapter mode is still specified correctly for **repair**, **direct ingress** (positions **`Object Drop`**), and paths that bypass parse.

### Bounded + drop nuance (shipped `computeDropDiff`)

Cross-host **`drop`** uses **bounded** planning on both host kinds (symmetric inverse of **`takeHold`** room bounded + character end-state):

| Host kind | Mode at apply | Behavior |
| --- | --- | --- |
| **Character** (source) | **bounded** | Scrub **only** trusted ingress `characterId` when object is on that character |
| **Room** (destination) | **bounded** | Add at trusted ingress `roomId` when object is not already on that room; **do not** end-state scrub other room hosts |

Shipped in [`computeDropDiff`](adapters/computeDropDiff.ts) -> [`planObjectDropTransfer`](adapters/planObjectDropTransfer.ts) -> [`hostEffectsFromObjectDropDiffs`](adapters/hostEffectsFromDiffs.ts). **Superseded (Pipeline A -> B migration Slice 3, 2026-07-15):** the singular `applyObjectTakeHold.ts`/`applyObjectDrop.ts` coordinators described in this section are deleted; every take-hold/drop command --- including the ordinary single-object case --- now goes through [`applyObjectSetTakeHold`](membership/applyObjectSetTakeHold.ts)/[`applyObjectSetDrop`](membership/applyObjectSetDrop.ts), thin wrappers over [`applyObjectSetTransfer`](membership/applyObjectSetTransfer.ts) (`MultiKeyUpdate`-based; see below). Ingress: [`executeObjectDrop`](membership/executeObjectDrop.ts)/[`executeObjectTakeHold`](membership/executeObjectTakeHold.ts) + positions **`Object Drop`**/**`Object Take Hold`** stream subscriptions.

Fact projection: `froms: [CHARACTER#...]`, `to: ROOM#...`. Actions held-catalog identity + parse egress: [`actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md#adding-an-atomic-position-manipulation-operator).

---

## Section C --- Compose rules

### End-to-end flow

```text
Ingress args (coordinator)
  -> membership observation (getMembershipContainers or repair graph-forward read)
  -> shared adapter.planMembershipTransfer(observation + applyMode + target + boundedHostIds?)
  -> HostEffect[] + projection { froms, to, changed }
  -> kernel.applyHostEffects({ hostEffects })
  -> coordinator: fact stream, cache memo, RoomUpdate / EphemeraUpdate bundle (unchanged contracts)
  -> [character navigate only, when changed && to !== null] parallel tail:
       persistRoomStackNavigate + orchestrateCharacterNavigate
```

Public coordinator APIs remain membership-shaped at ingress --- **not** raw `HostEffect[]`.

### Fact emission: projection-first (provisional)

**For the moment**, coordinators emit stream facts, cache memo keys, and bus bundles from the adapter's **`MembershipTransferProjection`** on successful kernel persist --- **assuming apply succeeded as planned** --- rather than re-deriving membership transfer semantics from post-apply `postApplyGraphs` or applied `hostEffects`.

| Chosen (now) | Deferred alternative |
| --- | --- |
| Use forward **`projection`** `{ froms, to, changed }` for `Character Moved` / `Object Moved` facts after `applyHostEffects` succeeds | Derive facts from **`postApplyGraphs`** or applied effects (graph-grounded projection) |

Matches today's expedient coordinators (facts from forward diff, not a second graph read). **May revisit** when graph-grounded fact verification or slice 5+ relational ops land.

### Per-operator compose table

| Coordinator | Ingress | Adapter mode | `boundedHostIds` | Fact |
| --- | --- | --- | --- | --- |
| [`applyCharacterRoomMembership`](../membership/applyCharacterRoomMembership.ts) | `{ characterId, targetRoomId }` | end-state | --- | `Character Moved` |
| [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) | `{ objectId, targetRoomId }` | end-state | --- | `Object Moved` |
| [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) (objects spawn) | via [`spawnOneImprovisationObject`](../../objects/spawnImprovisationObjectsBatch.ts) after existence create | end-state | --- | `Object Moved` |
| [`applyObjectSetTakeHold`](membership/applyObjectSetTakeHold.ts) (was `applyObjectTakeHold`, superseded 2026-07-15) | `{ objectIds, roomId, characterId }` | `MultiKeyUpdate` reducer over both hosts (see below) | n/a --- reducer re-derives live | `Object Moved` (cross-host, one per object) |
| [`applyObjectSetDrop`](membership/applyObjectSetDrop.ts) (was `applyObjectDrop`, superseded 2026-07-15) | `{ objectIds, roomId, characterId }` | `MultiKeyUpdate` reducer over both hosts (see below) | n/a --- reducer re-derives live | `Object Moved` (cross-host, one per object) |

### Anti-patterns

- New `update*PositionGraphs` modules with bundled planner + transact.
- Per-verb diff computers outside the shared adapter.
- Kernel prior-read via `getMembershipContainers`.
- Parse-local persist fork for atomic object manipulation (egress must route through positions coordinator -> adapter -> kernel).

---

## Section D --- Migration decisions (graduated to durable docs)

Decisions **M1**--**M5**, **M7**, **M8**, **M2** are recorded in [`../AGENT.contract.md`](../AGENT.contract.md#manipulation-persist-layering) and [`../AGENT.concepts.md`](../AGENT.concepts.md#manipulation-layering-membership-transfer). This section retains the migration map for Phase 4b.

| ID | Decision | Spec location |
| --- | --- | --- |
| **M1** | Kernel accepts explicit `HostEffect[]` only; no independent prior discovery | Section A `applyHostEffects` |
| **M2** | Bounded **`takeHold`**: scrub **only** trusted ingress `roomId` on room hosts | Section B apply modes |
| **M4** | Two kernels shipped: **`applyHostEffects`** (membership nodes) + **`applyHostRelationalPatch`** (host-local edges) | Section A kernels |
| **M5** | Kernel at `manipulation/` top-level (`applyHostEffects.ts`) | Section A module path |
| **M8** | Shared adapter at `manipulation/adapters/` | Section B module location |
| **M7** | Incremental migration order (Phase 4b) | Table below |

### Phase 4b migration order (M7) --- **Done**

1. **Object room** --- coordinator [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) -> `planMembershipTransfer` -> `applyHostEffects`.
2. **Character navigate** --- coordinator [`applyCharacterRoomMembership`](../membership/applyCharacterRoomMembership.ts) -> `planMembershipTransfer` -> `applyHostEffects` (graph only); ladder via parallel tail.
3. **Cross-host takeHold** --- coordinator `applyObjectTakeHold` -> `planObjectTakeHoldTransfer` -> `applyHostEffects` (historical; **superseded 2026-07-15** by [`applyObjectSetTakeHold`](membership/applyObjectSetTakeHold.ts) -> [`applyObjectSetTransfer`](membership/applyObjectSetTransfer.ts) -> `MultiKeyUpdate`, see below).
4. **Cross-host drop** --- coordinator `applyObjectDrop` -> `planObjectDropTransfer` -> `applyHostEffects` (historical; **superseded 2026-07-15** by [`applyObjectSetDrop`](membership/applyObjectSetDrop.ts) -> [`applyObjectSetTransfer`](membership/applyObjectSetTransfer.ts) -> `MultiKeyUpdate`, see below).

Legacy `update*PositionGraphs` wrappers **removed** in Phase 4c (2026-06-26). Persist tests (historical; retired 2026-07-23 with `applyHostEffects` --- see [`applyStepSequenceCore.test.ts`](kernel/applyStepSequenceCore.test.ts)/[`commitStepSequence.test.ts`](kernel/commitStepSequence.test.ts) for the shipped equivalent): `planMembershipTransfer.characterPersist.test.ts`, `planMembershipTransfer.objectPersist.test.ts`.

---

## Section E --- Verification hooks

### Phase 2 (this spec)

Peer review: spec covers all three shipped apply paths without contradicting [`../AGENT.contract.md`](../AGENT.contract.md). Cross-check **M2** against actions parse steady-state and cross-host membership-changed bundle.

### Phase 4a (kernel + adapter scaffold)

**Stale as a runnable command (2026-07-23): `applyHostEffects.test.ts` is deleted along with `applyHostEffects.ts` --- see file-top note.** Kept below as historical record of what Phase 4a originally verified; use [`kernel/`](kernel/)'s own test suites (`applyStepSequenceCore.test.ts`, `commitStepSequence.test.ts`, etc.) for the shipped replacement's equivalent coverage.

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/manipulation/adapters/ \
  dataSource/positions/manipulation/applyHostEffects.test.ts
```

Acceptance: planner modes produce correct `HostEffect[]`; kernel produces correct transact items and `changed` / `postApplyGraphs`.

### Phase 4b--4c (persist migration)

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/membership/ \
  dataSource/positions/manipulation/
```

**No parallel persist paths (Phase 4c)** (the first `rg` target below no longer exists post-2026-07-23 --- `applyHostEffects.ts` deleted; check `kernel/commitStepSequence.ts` for the equivalent invariant instead):

```bash
rg -n "getMembershipContainers" \
  lambda/ephemera/dataSource/positions/manipulation/kernel/commitStepSequence.ts 2>/dev/null || true

rg -n "computeTakeHoldDiff|computeDropDiff|computeMembershipDiff|updatePositionGraphs|updateObjectPositionGraphs|updateTakeHoldPositionGraphs|updateDropPositionGraphs" \
  lambda/ephemera/dataSource/positions/
```

Goal: transfer planners live in **shared adapter**; kernel has no `getMembershipContainers`; no `update*PositionGraphs` modules.

### Phase 4c ingress audit (shipped 2026-06-26)

| Ingress | Coordinator | Adapter | Kernel |
| --- | --- | --- | --- |
| Navigate / connect / disconnect / home (**superseded 2026-07-23**, see file-top note) | [`applyCharacterRoomMembership`](../membership/applyCharacterRoomMembership.ts) | `planMembershipTransfer` (end-state) | [`commitStepSequence`](kernel/commitStepSequence.ts) (`MultiKeyUpdate`) |
| Object room place / remove / drift repair (**superseded 2026-07-23**, see file-top note) | [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) | `planMembershipTransfer` (end-state) | [`commitStepSequence`](kernel/commitStepSequence.ts) (`MultiKeyUpdate`) |
| Improvisational object spawn (objects lane) (**superseded 2026-07-23**) | [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) via [`spawnOneImprovisationObject`](../../objects/spawnImprovisationObjectsBatch.ts) | `planMembershipTransfer` (end-state) | [`commitStepSequence`](kernel/commitStepSequence.ts) (`MultiKeyUpdate`) |
| Object destroy/edit (**superseded 2026-07-23**) | [`applyObjectClearMembership`](membership/applyObjectClearMembership.ts) | `planObjectClearFromAllHosts` (end-state, target null) | [`commitStepSequence`](kernel/commitStepSequence.ts) (`MultiKeyUpdate`) |
| **`takeHold`** (superseded 2026-07-15, then 2026-07-23 --- see file-top note) | stale: [`applyObjectSetTakeHold`](membership/applyObjectSetTakeHold.ts) --- **deleted**; live entry is [`executeObjectTakeHold.ts`](membership/executeObjectTakeHold.ts) | n/a --- reducer re-derives live | [`commitStepSequence`](kernel/commitStepSequence.ts) (`MultiKeyUpdate`) |
| **`drop`** (superseded 2026-07-15, then 2026-07-23 --- see file-top note) | stale: [`applyObjectSetDrop`](membership/applyObjectSetDrop.ts) --- **deleted**; live entry is [`executeObjectDrop.ts`](membership/executeObjectDrop.ts) | n/a --- reducer re-derives live | [`commitStepSequence`](kernel/commitStepSequence.ts) (`MultiKeyUpdate`) |

**Kernel invariant (now enforced by [`commitStepSequence.ts`](kernel/commitStepSequence.ts) --- `applyHostEffects.ts` deleted 2026-07-23):** the kernel does **not** call `getMembershipContainers`.

**Documented exceptions (not membership-transfer parallel paths):**

| Path | Role |
| --- | --- |
| [`syncMembershipAdjacency.ts`](../membership/syncMembershipAdjacency.ts) / [`syncObjectMembershipAdjacency.ts`](../membership/syncObjectMembershipAdjacency.ts) | Adjacency-only sync when graph is correct but reverse index lags |

**Removed:** `updatePositionGraphs`, `updateObjectPositionGraphs`, `updateTakeHoldPositionGraphs`, `postApplyGraphProjection` (redundant with coordinators / kernel). Spawn no longer bypasses kernel via cross-lane transact or `postApplyGraphProjection`.

### Relational patch verification (shipped Phase B)

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/manipulation/relational/ \
  dataSource/positions/manipulation/applyHostRelationalPatch.test.ts
```

Acceptance: kernel idempotency, dissolve edge match, coordinator fact bundle; diegetic logic and positions contract link to [Section A --- Host-local relational patch](#host-local-relational-patch-phase-b-shipped-b4).

---

## This folder (code map)

### Phase 4a--4b scaffold and migration (shipped 2026-06-25 / 2026-06-26)

| Path | Role |
| --- | --- |
| [`types.ts`](types.ts) | `HostEffect`, `MembershipTransferPlan` |
| [`adapters/`](adapters/) | Shared membership transfer planner (**M8**): `planMembershipTransfer`, `planObjectTakeHoldTransfer`, `planObjectDropTransfer`, `computeEndStateRoomDiff`, `computeTakeHoldDiff`, `computeDropDiff`, `hostEffectsFromDiffs` |
| [`applyHostEffects.ts`](applyHostEffects.ts) | Manipulation kernel (**M5**, **M4**): validate + transact graph + adjacency only |

Shared primitives consumed by kernel: [`../positionGraph/`](../positionGraph/), [`../membership/objectPlacementTransactItems.ts`](../membership/objectPlacementTransactItems.ts), [`../membership/characterRoomMembershipTransactItems.ts`](../membership/characterRoomMembershipTransactItems.ts), [`membership/characterInventoryTransactItems.ts`](membership/characterInventoryTransactItems.ts).

### Shipped coordinators (adapter + kernel)

| File | Role |
| --- | --- |
| [`membership/executeObjectTakeHold.ts`](membership/executeObjectTakeHold.ts) | `Object Take Hold` ingress entry (widened to `objectIds: EphemeraObjectId[]`, 2026-07-15) |
| [`membership/applyObjectSetTakeHold.ts`](membership/applyObjectSetTakeHold.ts) | Thin directional wrapper over [`applyObjectSetTransfer`](membership/applyObjectSetTransfer.ts) (replaces the deleted singular `applyObjectTakeHold.ts`) |
| [`membership/executeObjectDrop.ts`](membership/executeObjectDrop.ts) | `Object Drop` ingress entry (widened to `objectIds: EphemeraObjectId[]`, 2026-07-15) |
| [`membership/applyObjectSetDrop.ts`](membership/applyObjectSetDrop.ts) | Thin directional wrapper over [`applyObjectSetTransfer`](membership/applyObjectSetTransfer.ts) (replaces the deleted singular `applyObjectDrop.ts`) |
| [`membership/applyObjectSetTransfer.ts`](membership/applyObjectSetTransfer.ts) | **Pipeline A -> B migration Slice 3 (2026-07-15); rewired onto the shared Expand+Validate core the same day.** Single MultiKeyUpdate-based kernel primitive for both take-hold and drop, any transfer-set size >=1. Issues exactly one `transactWrite` call --- no separate pre-fetch: a `MultiKeyUpdate` item (`Keys` = departure + arrival host) whose reducer looks up both draft entries structurally, runs an inline presence guard (every id in the transfer set present on the source graph, absent from the destination --- the one check with no equivalent in `applyTransferSet` or the compiler's locus check), then calls [`applyTransferSet`](../positionGraph/expandValidate/applyTransferSet.ts) against the freshly-fetched graphs (the *same* function the compiler's `sandboxStep.ts` uses at selection time) and throws to abort the whole transact on anything other than `legal`, rather than applying a stale plan. **Note (2026-07-15):** this collapses a freshly-discovered `defer` (e.g. a `Custom`-kind boundary edge that only appeared between selection and commit) into the same generic transaction-abort as a hard `illegal` --- a real, working answer today, but confirmed (see BD-18, `AGENT.backtrackChannel.planning.md`) to be an interim stand-in for a not-yet-built persistence-level backtrack channel, not a permanent design conclusion. A thrown reducer error aborts before any `TransactWriteItemsCommand` is ever sent, so there's no "wasted write" a separate pre-check would protect against --- only a wasted extra fetch, which this version no longer pays. Plain sibling `Delete`/`Put` items per object build the `positionAdjacency#<hostId>` reverse-index rows (no `cascade` needed --- the transfer set and both host ids are caller-known before the reducer runs). Supersedes `applyHostEffects` + precomputed `HostRelationalEdgeCarry[]` for this operation; internal relational edges among the transfer set are derived live from the fetched source graph instead of passed in. `computeObjectSetTransfer.ts` (the bespoke, duplicate implementation this used before the rewire) is deleted. |
| [`membership/characterInventoryTransactItems.ts`](membership/characterInventoryTransactItems.ts) | Character-host graph + adjacency transact builders (kernel reuse) |
| [`membership/types.ts`](membership/types.ts) | Cross-host diff + apply result types |

### Relational patch (Phase B; shipped B4)

| Path | Role |
| --- | --- |
| [`applyHostRelationalPatch.ts`](applyHostRelationalPatch.ts) | Second kernel primitive: host-local edge add/remove. `MultiKeyUpdate`-based (BD-15/16 slice 3, 2026-07-15) --- accepts Room or Character hosts, re-validates live at commit |
| [`relational/`](relational/) | Per-operator relational coordinators + planner + fact builders |

Spec: [Section A --- Host-local relational patch](#host-local-relational-patch-phase-b-shipped-b4).

---

## Cross-links

| Doc | Role |
| --- | --- |
| [`../AGENT.md`](../AGENT.md) | Positions package entry |
| [`../AGENT.contract.md`](../AGENT.contract.md) | Shipped normative rules (graduates Phase 3) |
| [`../../actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md) | Object manipulation parse steady-state; atomic operator playbook |
| [`../../diegeticLogic/AGENT.implementation.md`](../../diegeticLogic/AGENT.implementation.md) | Operator intent/fact/presentation playbooks |
