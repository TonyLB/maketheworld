# Positions manipulation --- implementation map and kernel spec

**Status:** Phase 2 spec (kernel + shared adapter). Phase 3 vocabulary graduated to [`../AGENT.concepts.md`](../AGENT.concepts.md) and [`../AGENT.contract.md`](../AGENT.contract.md). TypeScript scaffold ships in Phase 4a; expedient persist paths remain authoritative until Phase 4b migration.

Contracts (shipped today): [`../AGENT.contract.md`](../AGENT.contract.md). Concepts: [`../AGENT.concepts.md`](../AGENT.concepts.md). Task plan: [`taskPlanning/.../AGENT.manipulationModel.planning.md`](../../../../../taskPlanning/lambda/ephemera/dataSource/positions/manipulation/AGENT.manipulationModel.planning.md).

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
| Graph | Update via [`positionGraphMerge`](../membership/positionGraphMerge.ts) helpers (`addCharacterToGraph`, `removeCharacterFromGraph`, `addObjectToGraph`, `removeObjectFromGraph`) |
| Adjacency | Each `add` emits adjacency **Put**; each `remove` emits adjacency **Delete** (`buildPositionAdjacencyDataCategory`) |
| Host row | Room hosts: `Meta::Room`; character inventory hosts: `Meta::Character` |
| Edges | **None** in v1 --- relational patch is a separate future primitive |

**Reference transact builders today:** [`objectPlacementTransactItems.ts`](../membership/objectPlacementTransactItems.ts) (room + object), [`characterInventoryTransactItems.ts`](membership/characterInventoryTransactItems.ts) (character + object). Phase 4a kernel should reuse or wrap these builders rather than duplicating reducers.

### `applyHostEffects` contract

| Concern | Rule |
| --- | --- |
| **Input** | Explicit `HostEffect[]` only (**M1**) --- kernel **must not** call `getMembershipContainers` or plan transfers |
| **Reads** | `getPositionGraph` (or row fetch for transact reducers) **only** on hosts appearing in the effect list |
| **Validate** | Before transact: for each effect, confirm expected node presence/absence on that host's graph; fail fast on impossible plans |
| **Transact** | Single `transactWrite` bundling all host graph + adjacency items; exponential backoff on `TransactionCanceledException` (same pattern as expedient modules) |
| **Output** | `{ changed: boolean; postApplyGraphs: Partial<Record<hostId, EphemeraPlayPositionGraph>> }` for memo seeding |
| **Module path** | Top-level [`manipulation/`](./) --- sibling to `adapters/` and `membership/` (**M5**); entry: `applyHostEffects.ts` |
| **v1 scope** | Membership-node add/remove only (**M4**) |
| **Conflict** | On conflict between graph and adjacency, **`positionGraph` wins** (unchanged positions authority) |

**`changed` derivation:** `true` iff at least one effect alters stored graph state (equivalent to today's `MembershipDiff.changed` / `ObjectMembershipDiff.changed` after successful persist).

### `CharacterRowEffect` (navigate-only; not a `HostEffect`)

**Eviction ladder** (`RoomStack`) maintenance is **not** membership-host transfer. It is a separate optional input bundled in the **same kernel transact** when the operator is character navigate with a non-null target room.

| Concern | Rule |
| --- | --- |
| **Trigger** | Character navigate (or equivalent ingress) with `targetRoomId !== null` |
| **Mechanism** | `Meta::Character` Update with `updateKeys: ['RoomStack']`; reducer calls `computeRoomStackUpdate` + `applyRoomStackToCharacterDraft` ([`membershipRoomStack.ts`](../membership/membershipRoomStack.ts)) |
| **Inputs** | `targetRoomId`, current `RoomStack` from fetched character row, `characterAssets`, destination `roomAssets`, `canonAssets` (mirror [`updatePositionGraphs.ts`](../membership/updatePositionGraphs.ts) lines 132--158) |
| **Disconnect** | No `RoomStack` purge --- ladder retained for connect resolution (unchanged **S1-9**) |
| **`changed` gate** | Ladder-only updates **must not** gate `MembershipDiff.changed` --- coordinator skips membership-changed bundle when membership endpoint unchanged |

`CharacterRowEffect` is **not** projected to bus facts as a host transfer; facts remain membership host transfer (`froms`/`to` on rooms).

### Future: host-local relational patch (M4 stub)

Second kernel primitive (slice 5+): add/remove **edges** on a fixed host **`positionGraph`** without changing membership host. Document module stub path only --- no implementation until relational operator slice. Kernel v1 **`applyHostEffects`** does **not** accept edge mutations.

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
| **bounded** | **`takeHold`** v1 | Remove from **only** `boundedHostIds` when entity is present on that host; **do not** end-state scrub other room hosts (**M2**) | Typically `[ingress roomId]` when removed |

### Bounded + character inventory nuance (shipped `computeTakeHoldDiff`)

Cross-host **`takeHold`** uses **mixed** planning:

| Host kind | Mode at apply | Behavior |
| --- | --- | --- |
| **Room** (source) | **bounded** | Scrub **only** trusted ingress `roomId` when object is on that room |
| **Character** (destination) | **end-state** on character hosts | Add at target character; remove from **other** character inventory hosts if present (`needsCharacterMove`) |

This preserves shipped semantics in [`updateTakeHoldPositionGraphs.ts`](membership/updateTakeHoldPositionGraphs.ts) `computeTakeHoldDiff`. Phase 4b tests **must** lock this behavior.

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
| `computeMembershipDiff` | [`updatePositionGraphs.ts`](../membership/updatePositionGraphs.ts) | end-state (room hosts) | Character room membership; object room placement reuses same diff |
| `computeTakeHoldDiff` | [`updateTakeHoldPositionGraphs.ts`](membership/updateTakeHoldPositionGraphs.ts) | bounded room + character end-state | **M2** reference; emits split `roomDiff` + `characterDiff` today |

Phase 4a adapter tests should assert `planMembershipTransfer` matches these functions for equivalent inputs.

### Parse alignment (M2 gate)

Actions parse steady-state ([`actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md#objectmanipulationintent-steady-state-shipped---membership-aware-classify--enrich--egress)) guarantees:

- Atomic **`takeHold`** egress supplies trusted `objectId` + ingress `roomId` (`fromRoomId`).
- **`multiPresent`** (`containers.length > 1`) terminalizes before egress.
- Zero-host objects terminalize before egress.

Bounded adapter mode is still specified correctly for **repair** and **direct ingress** paths that bypass parse.

---

## Section C --- Compose rules

### End-to-end flow

```text
Ingress args (coordinator)
  -> membership observation (getMembershipContainers or repair graph-forward read)
  -> shared adapter.planMembershipTransfer(observation + applyMode + target + boundedHostIds?)
  -> HostEffect[] + projection { froms, to, changed }
  -> [navigate only] optional CharacterRowEffect for RoomStack
  -> kernel.applyHostEffects({ hostEffects, characterRowEffects? })
  -> coordinator: fact stream, cache memo, RoomUpdate / EphemeraUpdate bundle (unchanged contracts)
```

Public coordinator APIs remain membership-shaped at ingress --- **not** raw `HostEffect[]`.

### Per-operator compose table

| Coordinator | Ingress | Adapter mode | `boundedHostIds` | Kernel extras | Fact |
| --- | --- | --- | --- | --- | --- |
| [`applyCharacterRoomMembership`](../membership/applyCharacterRoomMembership.ts) | `{ characterId, targetRoomId }` | end-state | --- | `CharacterRowEffect` when `targetRoomId !== null` | `Character Moved` |
| [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) | `{ objectId, targetRoomId }` | end-state | --- | none | `Object Moved` |
| [`applyObjectTakeHold`](membership/applyObjectTakeHold.ts) | `{ objectId, roomId, characterId }` | bounded (room) + character end-state | `[roomId]` | none | `Object Moved` (cross-host) |

### Future operators

| Operator | Expected adapter mode | Notes |
| --- | --- | --- |
| **`drop`** (deferred) | bounded or end-state TBD at slice | New coordinator under `manipulation/membership/` only; **no** new `update*PositionGraphs` fork |

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
| **M4** | Kernel v1 = membership-node add/remove only; relational patch stub | Section A future primitive |
| **M5** | Kernel at `manipulation/` top-level (`applyHostEffects.ts`) | Section A module path |
| **M8** | Shared adapter at `manipulation/adapters/` | Section B module location |
| **M7** | Incremental migration order (Phase 4b) | Table below |

### Phase 4b migration order (M7)

1. **Object room** --- `updateObjectPositionGraphs` -> adapter + kernel; coordinator [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) thins.
2. **Character + RoomStack** --- `updatePositionGraphs` -> adapter + kernel + `CharacterRowEffect`; coordinator [`applyCharacterRoomMembership`](../membership/applyCharacterRoomMembership.ts) thins.
3. **Cross-host takeHold** --- `updateTakeHoldPositionGraphs` -> adapter + kernel; coordinator [`applyObjectTakeHold`](membership/applyObjectTakeHold.ts) thins.

### Migration mapping (expedient -> target)

| Expedient module (today) | Transfer planning (future) | Graph persist (future) | Coordinator |
| --- | --- | --- | --- |
| [`updateObjectPositionGraphs.ts`](../membership/updateObjectPositionGraphs.ts) | `adapters/planMembershipTransfer` (end-state) | `applyHostEffects` | `applyObjectRoomMembership` |
| [`updatePositionGraphs.ts`](../membership/updatePositionGraphs.ts) | `adapters/planMembershipTransfer` (end-state) | `applyHostEffects` + `CharacterRowEffect` | `applyCharacterRoomMembership` |
| [`updateTakeHoldPositionGraphs.ts`](membership/updateTakeHoldPositionGraphs.ts) | `adapters/planMembershipTransfer` (bounded room + character end-state) | `applyHostEffects` | `applyObjectTakeHold` |

Expedient modules become thin wrappers or are removed after Phase 4b tests pass.

---

## Section E --- Verification hooks

### Phase 2 (this spec)

Peer review: spec covers all three shipped apply paths without contradicting [`../AGENT.contract.md`](../AGENT.contract.md). Cross-check **M2** against actions parse steady-state and cross-host membership-changed bundle.

### Phase 4a (kernel + adapter scaffold)

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

Baseline before migration edits:

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/membership/updatePositionGraphs.test.ts \
  dataSource/positions/manipulation/membership/updateTakeHoldPositionGraphs.test.ts
```

**No parallel persist paths (Phase 4c):**

```bash
rg -n "getMembershipContainers" \
  lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.ts 2>/dev/null || true

rg -n "computeTakeHoldDiff|computeMembershipDiff|updatePositionGraphs|updateObjectPositionGraphs|updateTakeHoldPositionGraphs" \
  lambda/ephemera/dataSource/positions/
```

Goal: transfer planners live in **shared adapter**; kernel has no `getMembershipContainers`; legacy `update*PositionGraphs` are thin wrappers or removed.

---

## This folder (code map)

### Shipped today (`manipulation/membership/`)

| File | Role |
| --- | --- |
| [`membership/executeObjectTakeHold.ts`](membership/executeObjectTakeHold.ts) | `Object Take Hold` ingress entry |
| [`membership/applyObjectTakeHold.ts`](membership/applyObjectTakeHold.ts) | Cross-host membership-changed bundle |
| [`membership/updateTakeHoldPositionGraphs.ts`](membership/updateTakeHoldPositionGraphs.ts) | Expedient: pre-read, diff, single transact |
| [`membership/characterInventoryTransactItems.ts`](membership/characterInventoryTransactItems.ts) | Character-host graph + adjacency transact builders |
| [`membership/types.ts`](membership/types.ts) | Cross-host diff + apply result types |

### Phase 4a+ (not yet on disk)

| Path | Role |
| --- | --- |
| [`adapters/`](adapters/) | Shared membership transfer planner (**M8**) |
| [`applyHostEffects.ts`](applyHostEffects.ts) | Manipulation kernel (**M5**, **M4**) |

Shared primitives consumed by kernel: [`../membership/positionGraphMerge.ts`](../membership/positionGraphMerge.ts), [`../membership/objectPlacementTransactItems.ts`](../membership/objectPlacementTransactItems.ts).

---

## Cross-links

| Doc | Role |
| --- | --- |
| [`../AGENT.md`](../AGENT.md) | Positions package entry |
| [`../AGENT.contract.md`](../AGENT.contract.md) | Shipped normative rules (graduates Phase 3) |
| [`../../actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md) | Object manipulation parse steady-state; atomic operator playbook |
| [`../../diegeticLogic/AGENT.implementation.md`](../../diegeticLogic/AGENT.implementation.md) | Operator intent/fact/presentation playbooks |
