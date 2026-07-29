# Positions --- contracts

This file records **falsifiable rules** for `mtw.ephemera.positions` **as implemented today**. Mental models: [`AGENT.concepts.md`](AGENT.concepts.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md).

Play membership persistence uses **`Meta::Room.positionGraph`** (forward) + **adjacency index** (reverse) as sole authority --- see [Room play graph + adjacency reverse index](AGENT.concepts.md#room-play-graph--adjacency-reverse-index). **`Character Moved`** and **`Object Moved`** are **membership host transfer** projections on the bus --- `froms[]` / `to` describe eligible host endpoints, not kernel **`HostEffect[]`** granularity, and the fact bus shape uses plural **`froms[]`**.

---

## DataSource identity

- **`dataSourceKey`** must be `mtw.ephemera.positions`.
- **`replayable`** is `false` for v1.
- **`publisherStrategy`** is `busOnly` (outbound **`Character Moved`** on internal bus).
- Subscription guards live in [`subscribedEvents.ts`](subscribedEvents.ts); new ingress types must register a header guard there (not a separate DataSource module).

---

## Scope of authority (manipulation vs presentation)

Mental model: [**Graph roles**](AGENT.concepts.md#graph-roles-shared-shape-different-authority). This section states normative boundaries only.

**Positions must own (play manipulation truth):**

- Membership persist (`Meta::Room.positionGraph`, adjacency index) and eviction ladder (`RoomStack`) bundled with apply per membership sections below.
- **`Object`** nodes on room **`positionGraph`** + **`OBJECT#`** adjacency rows (**I5**); objects lane owns existence rows (improvisation pair + **`Meta::Object`**) only.
- **`Meta::Character.positionGraph`** for character-hosted inventory (**D16**); cross-host membership apply under [`manipulation/membership/`](manipulation/membership/).
- **`Character Moved`** and **`Object Moved`** descriptive fact streams --- **membership host transfer projection** from persist outcome at apply.
- Gateway topology read backing for stored membership graph and adjacency (see [Read surface](#read-surface-forward-graph-vs-reverse-containers)).

**Positions must not own (presentation truth):**

- Roster **display** fields (`DisplayName`, `SessionIds`, `Color`, `fileURL`) as steady-state authority --- hydrate at read time per [Read surface](#read-surface-forward-graph-vs-reverse-containers).
- Affordance wire compose (`AffordanceRoomDeliverable`) or exit topology (`projectRoomExits`, `ComponentTopology`, `AffordanceCache`).

**Gateway read envelope:**

- **`PlayPositionGraph`** **must** be topology only (alias of `StandardPositionGraphData`); **must not** carry roster display fields or reverse-membership encodings on the forward graph.
- Forward **`getPositionGraph`** **must** return stored topology only on Dynamo load; **`Positions.set`** **must** accept topology-only graphs.

**Deferred (edge-reference cleanup):** object removal prunes play-only (Exit) edges on hosts participating in the removal transaction only (Relational edges are assert-and-throw, not pruned --- caller must dissolve them explicitly first). Cross-host or edge-only references without a node-removal path are not swept by membership adjacency today. See [`positionGraph/AGENT.md`](positionGraph/AGENT.md) **Known limitation (deferred)** and [`../objects/AGENT.md`](../objects/AGENT.md) **Deferred (cross-host edge references)**.

**Deferred (character-relation widening, BD-36):** `HostRelationalEdge` endpoints are `EphemeraObjectId`-typed only --- a character can never hold a Relational edge, so `removeCharacter`'s assert-and-throw is vacuously satisfied today. Widening to admit `EphemeraCharacterId` waits for a KR-write path that authors character relations, which does not exist yet. See [`positionGraph/AGENT.md`](positionGraph/AGENT.md) **Known limitation (deferred)**.

---

## Manipulation persist layering

Mental model: [**Manipulation layering**](AGENT.concepts.md#manipulation-layering-membership-transfer). Code map: [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md). Gateway conflict policy: [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md).

**Architectural:**

- Every graph-grounded persist **must** converge on one kernel entrypoint, **`commitStepSequence`**. Planning happens strictly upstream --- in the shared membership adapter, or in the Synthesize executor re-run at execute time; the kernel only transacts.
- Kernel **must** accept explicit **`KernelStep[]`** only; **must not** call **`getMembershipContainers`** to discover priors.
- **Must not** add parallel persist paths (new `update*PositionGraphs` with bundled planner + transact; per-verb diff computers outside [`manipulation/adapters/`](manipulation/adapters/)).
- **Shipped kernel:** one general **`commitStepSequence`** (**`KernelStep[]`**) covers membership-node add/remove (`transferMembership`, entity-kind-general per BD-36) and in-host relational edge add/remove (`establishRelation`/`dissolveRelation`) --- see [`manipulation/kernel/`](manipulation/kernel/).
- Positions kernel in-memory graph simulation **must** use **`EphemeraPositionGraph`** / **`EphemeraPositionGraph[]`** --- **must not** reintroduce bare **`EphemeraPositionGraphFieldPayload`** simulation or ad-hoc merge helpers outside [`positionGraph/`](positionGraph/). Mental model: [`AGENT.concepts.md`](AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope); module spec: [`positionGraph/AGENT.md`](positionGraph/AGENT.md).
- Actions **may** import **`EphemeraPositionGraph`** read-only for observation/legality; actions **must not** persist graphs or build transact items.

**Today (shipped behavior):**

- On graph vs adjacency conflict, **`positionGraph` wins** (diagnostics repair from graph).
- Transfer-planning pre-reads (**`getMembershipContainers`**) **must** run on coordinator / adapter side, **not** in kernel persist.

**Apply modes (shared membership adapter):**

Both modes filter observed prior containers to **room hosts** before diffing. This planner **must not** be extended to plan character-inventory transfers.

| Mode | Coordinators | Scrub rule |
| --- | --- | --- |
| **end-state** | navigate, connect, disconnect, home, object room place / remove, spawn, drift repair | Remove from **every** prior room host `!== target` |
| **bounded** | direct positions ingress and paths that bypass parse | Remove **only** from the trusted-ingress hosts the entity is actually present on; **must not** end-state scrub other hosts of the same kind |

**`takeHold`** and **`drop`** do **not** reach the kernel through this planner. Their transfer set is grounded by the Synthesize executor, re-run at execute time against live graphs --- see [`Object Take Hold`](#object-take-hold-positions-owned) and [`Object Drop`](#object-drop-positions-owned).

Module paths: [`manipulation/adapters/`](manipulation/adapters/) (transfer planner), [`manipulation/kernel/`](manipulation/kernel/) (kernel --- `commitStepSequence.ts`, `applyStepSequenceCore.ts`, `kernelStep.ts`). Fact emission: adapter **`MembershipTransferProjection`** on successful persist (provisional; see [`manipulation/AGENT.implementation.md` --- Fact emission](manipulation/AGENT.implementation.md#fact-emission-projection-first-provisional)). Kernel invariants: [`manipulation/AGENT.implementation.md` --- Kernel invariants](manipulation/AGENT.implementation.md#kernel-invariants).

---

## Membership persistence API

All character **room-membership** mutations for **disconnect**, **navigate**, and **connect** **must** go through [`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts).

### Public apply shape

- **Args:** `{ characterId, targetRoomId: EphemeraRoomId | null }` --- `null` = out of play (disconnect). **Must not** consume stream / intent `fromRoomId` for persist.
- **Result:** `{ froms, to, changed }` where `changed` is true iff prior container set differs from end state (`{ targetRoomId }` or `{}` when out of play). **`froms`** is required (same semantics as **`MembershipDiff`** / bus fact).
- **Navigate orchestration:** [`orchestrateCharacterNavigate`](navigate/orchestrateNavigate.ts) receives full **`froms[]`** from the apply result for presentation (arrival-room header slot, render kicks). Does **not** publish **`MapUpdate`** (server map runtime retired; see [`../maps/AGENT.md`](../maps/AGENT.md)). Multi-departure leave is fan-in's job. Leave/arrive world lines are **not** emitted from navigate orchestration (membership fan-in owns them).
- **Graph persist path:** coordinator -> [`planMembershipTransfer`](manipulation/adapters/planMembershipTransfer.ts) (end-state) -> [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) (`MultiKeyUpdate`) --- a bare `transferMembership` step only. No `dissolveRelation` steps accompany it: a character can never be a relational-edge endpoint, `HostRelationalEdge` being object-only. `Character Moved` fact emission is folded into `commitStepSequence` / [`factsForStep`](manipulation/kernel/factsForStep.ts) rather than layered on top by the coordinator. Detail: [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md).

### Graph apply (end-state)

- **Must** use pure end-state apply on **`targetRoomId`** only.
- **Must** derive **`MembershipDiff.froms`** from observed prior containers removed (may be **`length > 1`** on drift repair).
- **Must** maintain **`positionGraph`** + adjacency in the same **`transactWrite`** bundle; **must not** write legacy **`activeCharacters`** / **`RoomId`** membership projections. Mental model: [Room play graph + adjacency reverse index](AGENT.concepts.md#room-play-graph--adjacency-reverse-index).
- On conflict between graph and adjacency, **`positionGraph` wins** (diagnostics repair from graph).

### Membership-changed bundle

When **`MembershipDiff.changed`** is true, persist and its follow-on effects **must** happen together or not at all. **The kernel owns most of the bundle** --- coordinators **must not** re-implement any of it:

1. **`Character Moved`** on `mtw.ephemera.positions` (membership host transfer projection), streamed from [`factsForStep`](manipulation/kernel/factsForStep.ts) in step order.
2. Cache memo for **every** committed graph --- `Positions.set` unconditionally, plus `ComponentEphemeraMeta.invalidate` / `AffordanceRoomDeliverable.invalidate` for Room hosts. **Must** run *before* any fact streams, to avoid an affordance-refresh race.
3. `setMembershipContainers` for the moved entity.
4. `RoomUpdate` per affected Room host, published *after* the fact stream.
5. `beatAnchorTime` recorded at apply and returned on the kernel result.

The character coordinator ([`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts)) adds only what is character-specific, after a successful commit:

6. `CharacterMeta.invalidate(characterId)`.
7. `EphemeraUpdate` `CharacterInPlay` room projection.
8. `roomRosterSnapshots` on the apply result, built from **`getRoomCharacterList`** after the kernel's graph memo seed.

When **`changed`** is false: the coordinator **must** return before calling the kernel at all --- no persist, no fact stream, no cache, no `RoomUpdate`, no `EphemeraUpdate`. This includes eviction-ladder-only updates where the room membership endpoint is unchanged.

**Post-move presentation split:** step 4 **`RoomUpdate`** (affordance refresh for all occupants in **`froms`** / **`to`**) is **separate** from the mover-only arrival header render (an ingress slot registered with **`mtw.ephemera.messageOrchestration`** in navigate orchestration --- see [`../messageOrchestration/AGENT.md`](../messageOrchestration/AGENT.md)). Positions **must not** conflate affordance refresh with header render on the membership API. **`Object Moved`** affordance refresh consumer: **`mtw.ephemera.affordanceOrchestration`** ([`../affordanceOrchestration/index.ts`](../affordanceOrchestration/index.ts)).

### Eviction ladder (`RoomStack` storage)

Mental model: [**Eviction ladder**](AGENT.concepts.md#eviction-ladder). Code map: [`AGENT.implementation.md` --- Eviction ladder](AGENT.implementation.md#eviction-ladder-roomstack-storage).

- **Must not** expose eviction ladder edits on **`MembershipApplyArgs`** --- public apply remains `{ characterId, targetRoomId | null }` only. Ladder shape is internal to persist / resolution helpers.
- **Legal placement resolution:** trim `RoomStack` to accessible assets; surviving top frame is the proposed `targetRoomId`. **Connect** --- place from nowhere (`froms: []`). **Asset visibility loss** --- relocate from an illegal occupancy when top frame differs from current membership.
- **Navigate ladder timing:** after successful graph persist when **`MembershipDiff.to !== null`**, navigate callers **must** run ladder maintenance in the parallel tail ([`persistRoomStackNavigate`](membership/persistRoomStackNavigate.ts) + [`orchestrateCharacterNavigate`](navigate/orchestrateNavigate.ts) via [`afterCharacterMembershipNavigateChanged`](navigate/afterCharacterMembershipNavigateChanged.ts)). **Must not** gate the membership-changed bundle on ladder completion.
- **Navigate merge:** ladder persist **must** use per-frame `timeWritten` (epoch ms) stamped from **`beatAnchorTime`** at graph persist. A write at time `T` **must not** overwrite or truncate frames with `timeWritten > T`, and **must not** extend outer frames unless `T` exceeds all existing frame timestamps. Missing `timeWritten` **must** be treated as `0` (legacy rows).
- **Trim persist:** asset/connect trim **must** filter inaccessible frames and **preserve** survivor `timeWritten` values. **Must not** use navigate merge semantics on trim paths.
- **Failure tolerance:** ladder persist failure after retry exhaustion **must not** fail membership apply or navigate presentation orchestration; errors **must** be logged.
- On **disconnect**, the coordinator **must** purge play membership (`positionGraph`, adjacency) and **must preserve** `RoomStack` (connect resolves legal placement from the retained stack).
- **Must not** emit **`Character Moved`** or run the membership-changed bundle when **only** the eviction ladder changes and the room membership endpoint is unchanged.
- When asset loss **trim** changes the membership endpoint for an **in-play** character, relocation **must** go through [`repairCharacterLegalPlacement`](membership/repairCharacterLegalPlacement.ts) -> [`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts). **Out-of-play** characters (**`getMembershipContainers`** empty): trim **`RoomStack` only** --- **must not** re-insert into play.

### `Character Moved` fact

Membership host transfer projection --- coordinators **must** derive fact fields from persist diff (or adapter projection), not from ingress args alone.

- **Must** stream only when **`MembershipDiff.changed`** after successful graph persist.
- **`froms: EphemeraRoomId[]`** = distinct prior membership hosts removed at apply (`[]` = out of play). **May** emit **`froms.length > 1`** when drift repair scrubs multiple hosts.
- **`to`** = destination membership host after apply (`null` on disconnect).
- **`beatAnchorTime`** = recorded time at persistence apply.
- **Must not** populate **`legalExits`** on emitted facts.
- **Must not** branch **`streamEvent`** on ingress type (navigate vs disconnect); emission is descriptive from **`MembershipDiff`** only.
- **`streamEvent`** is a **required** coordinator dependency (no in-module fallback). **`receiveEvents`** passes the DataSource instance `streamEvent`.
- Payload contract: [`publishedEvents.ts`](publishedEvents.ts). Fan-in consumer: [`../perception/membershipPresentationFanIn.ts`](../perception/membershipPresentationFanIn.ts).

### Object room membership (nodes only)

All improvisational **object room-placement** mutations **must** go through [`applyObjectRoomMembership`](membership/applyObjectRoomMembership.ts).

- **Args:** `{ objectId, targetRoomId: EphemeraRoomId | null }` --- `null` = removed from all rooms.
- **Graph persist path:** coordinator -> [`planMembershipTransfer`](manipulation/adapters/planMembershipTransfer.ts) (end-state) -> [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) (`MultiKeyUpdate`). Every departure room's edges referencing the object **must** be swept explicitly first (`boundaryEdgeOutcomes` on the singleton object set, no carry-closure growth) and dissolved via an explicit `dissolveRelation` step ahead of the transfer step, rather than silently stripped --- `removeObject` throws on a residual relational edge by design. Detail: [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md).
- **Must** persist **`positionGraph`** + adjacency in the same transact; on conflict **`positionGraph` wins** (mirrors the character-route rule above).
- **Spawn initial placement (objects-lane coordinator):** improvisational **existence** (pair + **`Meta::Object`**) is objects-lane owned; **initial room placement** at spawn **must** call [`applyObjectRoomMembership`](membership/applyObjectRoomMembership.ts) from the objects coordinator ([`spawnOneImprovisationObject`](../objects/spawnImprovisationObjectsBatch.ts)) --- same adapter + kernel path as place/remove/drift repair. **Two atomic steps**, not one cross-lane transact (**I1** cross-lane spawn bundle retired).
- **S1 compensating delete:** if placement fails after successful existence create, objects coordinator **must** call `persistDeleteImprovisationObject` before treating the row as failed. If compensation delete also fails, **must** `console.error` with `objectId`, placement error, and delete error **and** emit **`Spawn Compensation Problem`** on **`mtw.ephemera.objects`** via [`streamSpawnCompensationProblem`](../objects/problemReports.ts). Diagnostics intake runs [`orphanedImprovisedObjectSweep`](../../../diagnostics/orphanedImprovisedObjectSweep/); when litmus confirms orphan, **must** emit **`Orphaned Improvised Object Finding`** on **`mtw.diagnostics`** (sweep contract: [`lambda/diagnostics/AGENT.md`](../../../diagnostics/AGENT.md) **Orphaned improvised object sweep**). Objects lane **must** subscribe to the finding and call **`persistDeleteImprovisationObject`** (delete-only repair; see [`objects/AGENT.md`](../objects/AGENT.md) **Diagnostics repair**).
- **Orphan vs adjacency lag (existence-without-placement):**
  - **Orphan:** `(OBJECT#, ASSET#IMPROVISATION)` pair **and** `Meta::Object` present, no **`Object`** node on any host `positionGraph`, and `getMembershipContainers(objectId)` empty --- diagnostics **`Orphaned Improvised Object Finding`** (not [`repairObjectPlacementDrift`](membership/repairObjectPlacementDrift.ts)).
  - **Adjacency lag:** **`Object`** node present on a host graph but containers empty or missing that host --- [`repairObjectPlacementDrift`](membership/repairObjectPlacementDrift.ts) owns sync; orphan sweep **must not** emit a finding.
- **Cross-lane sequencing:** spawn sequences existence then graph (rows-then-graph); remove sequences graph then row delete (graph-then-rows) --- both are two-step by design.
- **Must not** route cross-host membership transfers (room <-> character inventory) through [`applyObjectRoomMembership`](membership/applyObjectRoomMembership.ts) --- use [`manipulation/membership/`](manipulation/membership/) coordinators instead (**D14**).

### `Object Moved` fact (I4)

Membership host transfer projection --- coordinators **must** derive fact fields from persist diff (or adapter projection), not from ingress args alone.

- **Must** stream only when membership diff **`changed`** after successful object graph persist.
- Payload: `{ type: 'Object Moved', objectId, froms[], to, beatAnchorTime }` --- membership-host endpoints (`ROOM#`, `CHARACTER#` in v1; **D8**). v1 **`takeHold`**: `froms: [ROOM#...]`, `to: CHARACTER#...`. v1 **`drop`**: `froms: [CHARACTER#...]`, `to: ROOM#...`.
- **Must not** populate presentation fields on the fact.
- Fan-in consumer for affordance refresh: **`mtw.ephemera.affordanceOrchestration`** ([`../affordanceOrchestration/index.ts`](../affordanceOrchestration/index.ts)).

### Object membership-changed bundle (room-only)

When object room-only **`MembershipDiff.changed`**, the bundle is the kernel's --- **`Object Moved`** fact, `Positions.set` + Room-host cache invalidation, `setMembershipContainers(objectId)`, and one **`RoomUpdate`** per affected room, in that order. [`applyObjectRoomMembership.ts`](membership/applyObjectRoomMembership.ts) **must not** duplicate any of it; on `changed: false` it returns before calling the kernel.

A severed boundary relation streams **`Object Relation Changed`** alongside the move, suppressed only when the caller passes `suppressRelationalFacts: true` (e.g. [`repairObjectPlacementDrift`](membership/repairObjectPlacementDrift.ts)'s consistency scrub). [`applyObjectClearMembership.ts`](manipulation/membership/applyObjectClearMembership.ts) (destroy/edit --- `{ objectId }`, always end-state-to-null across every prior host of either kind) follows the identical kernel path and fact rule, leaving `suppressRelationalFacts` unset.

### Cross-host object membership-changed bundle (`takeHold`)

Graph persist: [`executeObjectTakeHold`](manipulation/membership/executeObjectTakeHold.ts) seeds and runs the Synthesize executor, then commits the resulting step sequence via [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) --- one atomic `MultiKeyUpdate` over departure room + arrival character.

The transfer set is **re-derived, not scrubbed from trusted ingress**: operand expansion recomputes the carry closure fresh against current graph state, and the reducer re-validates presence and boundary-edge classification on the locked graphs at commit time. A concurrent modification since selection aborts the whole transact rather than applying a stale plan.

The post-persist bundle is the kernel's, per entity in the transfer set:

1. **`Object Moved`** (`froms: [ROOM#...]`, `to: CHARACTER#...`), streamed in step order after any `Object Relation Changed` for severed boundary edges.
2. `Positions.set` on **every** committed graph --- source room *and* target character; `ComponentEphemeraMeta.invalidate` / `AffordanceRoomDeliverable.invalidate` for Room hosts only.
3. `setMembershipContainers(objectId)` -> `[CHARACTER#...]`.
4. **`RoomUpdate`** per Room host only --- a character **`to`** has no room affordance to refresh.

An illegal or stale executor verdict **must** return without committing (no persist, no bundle).

### Cross-host object membership-changed bundle (`drop`)

The character -> room mirror of take-hold. [`executeObjectDrop`](manipulation/membership/executeObjectDrop.ts) seeds the same executor with `from`/`to` reversed and commits via [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) --- one atomic `MultiKeyUpdate` over departure character + arrival room. Same live re-derivation and commit-time re-validation as take-hold; **must not** introduce `updateDropPositionGraphs` or any new `update*PositionGraphs` fork.

Kernel-owned bundle per entity: **`Object Moved`** with `froms: [CHARACTER#...]`, `to: ROOM#...`; `Positions.set` on both committed graphs with Room-host cache invalidation; `setMembershipContainers(objectId)` -> `[ROOM#...]`; **`RoomUpdate`** for the destination room only. Playbook: [`manipulation/AGENT.implementation.md` --- Apply modes](manipulation/AGENT.implementation.md#apply-modes).

### Host-local relational-changed bundle (`establishRelation` / `dissolveRelation`)

Graph persist: [`applyObjectRelationalChange`](manipulation/relational/applyObjectRelationalChange.ts) builds an `establishRelation` / `dissolveRelation` step sequence and commits it via [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts). Relational steps **must not** route through the shared membership adapter; they compose with membership transfer by appearing in the same step sequence.

The bundle is kernel-owned:

1. **`Object Relation Changed`** streamed in step order.
2. `internalCache.Positions.set` for **`hostId`** --- **unconditional** across host kinds; **must not** skip the cache seed just because the host isn't a Room (that would leave a character's cached graph stale).
3. **`ComponentEphemeraMeta.invalidate`** / **`AffordanceRoomDeliverable.invalidate`** for **`hostId`** --- **only** when **`hostId`** is a Room (`isEphemeraRoomId`); these caches have no Character-hosted equivalent.
4. Internal **`RoomUpdate`** for **`hostId`** --- **only** when **`hostId`** is a Room; a Character-hosted relation has no room affordance to refresh.

**Must skip** the entire bundle when **`changed: false`** (idempotent duplicate edge on **`op: 'add'`**). Relational fan-in **requires** actions intent leg; perception does not defer on fact-only settle for relational clusters. Character-hosted relation narration is unresolved UX/copy design (BD-15/16) --- the perception leg adapter declines (returns no leg) for a non-Room **`hostId`** rather than guessing copy.

### Object placement drift repair

- **Steady state:** at most one room per **`OBJECT#`**; multi-room adjacency is drift.
- **Graph-forward repair:** [`repairObjectPlacementDrift`](membership/repairObjectPlacementDrift.ts) --- adjacency-only via [`syncObjectMembershipAdjacencyToRoom`](membership/syncObjectMembershipAdjacency.ts); multi-container scrub via **`applyObjectRoomMembership`** retaining the finding room, with `suppressRelationalFacts: true` --- a severed boundary relation here is a silent consistency fixup, not a player-visible event, so it must not stream **`Object Relation Changed`** (`Object Moved` streams unaffected). Applies when a graph **`Object`** node exists (adjacency lag); **not** for existence-without-placement orphans (pair + meta without graph node --- see **Orphan vs adjacency lag** above and [`orphanedImprovisedObjectSweep`](../../../diagnostics/orphanedImprovisedObjectSweep/)).
- **Deferred:** `Object Placement Drift Finding` diagnostics sweep (character analog: [`roomOccupancyDriftSweep`](../../../diagnostics/roomOccupancyDriftSweep/)).

---

## Host-local relational patch

Kernel: [`manipulation/kernel/`](manipulation/kernel/) (`establishRelation` / `dissolveRelation` steps). Coordinators: [`manipulation/relational/`](manipulation/relational/). Code map: [`manipulation/AGENT.implementation.md` --- Host-local relational patch](manipulation/AGENT.implementation.md#host-local-relational-patch).

Mental model: [**Host-local relational patch**](AGENT.concepts.md#manipulation-layering-membership-transfer) (in-host topology without membership-host change). Distinct from membership transfer (**`HostEffect[]`**) and from adjacency reverse index (**no** adjacency dual-write for relational edges).

### Relation kind enum (BD-2)

v1 **`HostRelationalEdgeKind`** on stored forward-graph edges **must** be one of:

| Kind | Player language (examples) | Persist |
| --- | --- | --- |
| **`On`** | on, onto | **`kind: 'On'`** only |
| **`Under`** | under, beneath | **`kind: 'Under'`** only |
| **`Against`** | against, leaning against | **`kind: 'Against'`** only |
| **`Custom`** | tied to, wrapped around, long-tail phrases | **`kind: 'Custom'`** + **`relationLabel`** (see below) |

**Excluded from this operator (BD-2):** **`In`**, **`inside`**, and other containment language --- **must not** persist as **`establishRelation`** v1; actions routes to future **nested container** operator with player-facing defer copy (not positions ingress).

Parse/enrich owns normalization from **`relationSpan`** -> **`kind`** (+ optional label); positions **must** trust ingress **`kind`** / **`relationLabel`** at apply (same pattern as trusted **`objectId`** on **`Object Take Hold`**). Implementation: [`normalizeRelationSpan`](../actions/enrich/objectManipulation/normalizeRelationSpan.ts) + [`relationKind`](../actions/enrich/objectManipulation/relationKind.ts) types in actions enrich (B2 shipped). B3 legality pre-ingress: [`evaluateRelationalLegality`](../actions/enrich/objectManipulation/evaluateRelationalLegality.ts) observes host graph via read-only **`EphemeraPositionGraph`** from [`positionGraph/`](positionGraph/); stored edge wire shape is **`EphemeraPositionRelationalEdgeData`** (`tag: 'Relational'` on host **`positionGraph.edges`**); gateway read projection passes through stored relational edges ([`packages/mtw-gateways/ts/ephemera/positions/project.ts`](../../../../packages/mtw-gateways/ts/ephemera/positions/project.ts)).

### Edge persist shape (BD-3)

Relational mutations **must** persist on a **fixed host** --- **`Meta::Room.positionGraph`** or **`Meta::Character.positionGraph`** forward graph only. Both host kinds are live end to end (BD-15/16): `RelationalIngressArgs.hostId` is an `EphemeraMembershipHostId`, and production ingress genuinely produces a Character host when subject and target already share the acting character's inventory graph. **Must not** write adjacency rows for relational edges (forward-graph only; see [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md#host-local-relational-patch)).

**`HostRelationalPatch`** (kernel input; one add or remove on one host):

```typescript
type HostRelationalEdgeKind = 'On' | 'Under' | 'Against' | 'Custom'

type HostRelationalEdge = {
    from: EphemeraId   // subject node on host graph (v1: EphemeraObjectId)
    to: EphemeraId     // target node on host graph (v1: EphemeraObjectId)
    kind: HostRelationalEdgeKind
    /** Required when kind === 'Custom'; persisted on the stored edge (BD-3). */
    relationLabel?: string
}

type HostRelationalPatch = {
    hostId: EphemeraMembershipHostId
    edge: HostRelationalEdge
    op: 'add' | 'remove'
}
```

**BD-3 rules:**

- **`Custom`** edges **must** persist **`relationLabel`** on the stored forward-graph edge --- **not** presentation-only copy in perception.
- Enum kinds (**`On`**, **`Under`**, **`Against`**) **must not** require **`relationLabel`** at persist; transcript may still paraphrase per unknowns.
- **`establishRelation`** ingress **must** map to **`op: 'add'`**; **`dissolveRelation`** **must** map to **`op: 'remove'`** matching **`from`**, **`to`**, **`kind`**, and **`relationLabel`** (when **`Custom`**) (**BD-7**).

### Kernel and compound apply (BD-9)

- All **`establishRelation`** / **`dissolveRelation`** applies **must** route through **`commitStepSequence`** as explicit relational steps. **Must not** add a relational-specific kernel entrypoint alongside it.
- Composed commands (**drop** + **`establishRelation`**, etc.) **must** carry membership and relational steps in **one** step sequence and therefore **one** **`transactWrite`** (atomic all-or-nothing --- **BD-9**); **must not** apply them as independent transacts with partial commit.
- **Legality is re-verified inside the transaction, never from a snapshot.** The `MultiKeyUpdate` reducer re-runs `EphemeraPositionGraph.applyRelationalPatch` --- the single shared legality authority, including `bothObjectsOnGraph` --- against freshly-fetched, locked graphs, and throws to abort on any staleness or illegality. On conflict, **`positionGraph` wins** (same authority as membership graph).
- A `sameHost` violation discovered only at commit time (a concurrent write moved one of the objects since selection) is caught by that same `bothObjectsOnGraph` check --- **must not** be given a bespoke `sameHost`-specific mechanism.
- Self-healing a stale assumption (recomputing a fresh repair and bundling it atomically) is **not** attempted: any staleness fails the whole transact with one generic error code. This is an acknowledged interim answer standing in for a not-yet-built persistence-level backtrack channel, not a permanent design conclusion (**BD-18**).

### Legality (actions-owned pre-ingress; positions-owned at apply)

| Case | Phase B--C (actions) | Positions apply |
| --- | --- | --- |
| Both **`from`** and **`to`** nodes on host graph | Required before egress | Re-validate; reject if absent |
| Exact duplicate edge already present | Idempotent success / no-op | **`op: 'add'`** no-op when edge matches |
| Conflicting or non-trivial existing relational topology on subject/target | **Error** stub (**BD-10** defer bucket until Phase D plan LLM) | **Must not** receive ingress until actions resolves |
| **`dissolveRelation`** with no matching edge | **Error** before egress | Reject **`op: 'remove'`** when edge absent |

### Ingress summary

Actions **must** publish **`Object Establish Relation`** and **`Object Dissolve Relation`** on grounded **`EstablishRelation`** parse from **`Parse Requested`** ([`../actions/index.ts`](../actions/index.ts); payload + guards in [`../actions/publishedEvents.ts`](../actions/publishedEvents.ts)). Positions **must** subscribe in [`subscribedEvents.ts`](subscribedEvents.ts) and delegate to coordinators under [`manipulation/relational/`](manipulation/relational/). Normative handler rules: [Ingress --- `Object Establish Relation`](#object-establish-relation-positions-owned), [Ingress --- `Object Dissolve Relation`](#object-dissolve-relation-positions-owned). Coordinators **must** trust actions-resolved **`subjectId`**, **`targetId`**, **`relationKind`**, optional **`relationLabel`**, and **`hostId`** (Room or Character) --- no catalog re-resolve in positions v1. A cross-host case needing repair (compound atomic apply, **C2**, not yet built) is declined at the compiler and never reaches ingress.

### `Object Relation Changed` fact

- Payload: `{ type: 'Object Relation Changed', subjectId, targetId, hostId, relationKind, relationLabel?, operation: 'establish' | 'dissolve', beatAnchorTime }`.
- Streamed from coordinator on successful persist when **`changed: true`**; perception fan-in wires actions intent + **`Object Relation Changed`** fact -> **`WorldMessage`** ([`../perception/objectManipulationPresentationFanIn.ts`](../perception/objectManipulationPresentationFanIn.ts)).
- Post-persist bundle detail: [Host-local relational-changed bundle](#host-local-relational-changed-bundle-establishrelation--dissolverelation).

**Must not** route relational patch through **`applyObjectRoomMembership`** or membership adapter **`planMembershipTransfer`**.

---

## Ingress

### `mtw.connections.characters`

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Character Connected` | [`handleCharacterConnected`](handleConnectionsCharactersPresence.ts) |
| `Character Disconnected` | [`handleCharacterDisconnected`](handleConnectionsCharactersPresence.ts) |

Positions **must not** subscribe to `Character Registered` (session orientation is render + affordance orchestration; see [`../../AGENT.md`](../../AGENT.md)).

### `mtw.ephemera.actions`

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Character Navigate` | [`index.ts`](index.ts) `receiveEvents` -> [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) |
| `Character Home` | [`index.ts`](index.ts) `receiveEvents` -> [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) |
| `Object Take Hold` | [`index.ts`](index.ts) `receiveEvents` -> [`manipulation/membership/executeObjectTakeHold.ts`](manipulation/membership/executeObjectTakeHold.ts) |
| `Object Drop` | [`index.ts`](index.ts) `receiveEvents` -> [`manipulation/membership/executeObjectDrop.ts`](manipulation/membership/executeObjectDrop.ts) |
| `Object Establish Relation` | [`index.ts`](index.ts) `receiveEvents` -> [`manipulation/relational/executeObjectEstablishRelation.ts`](manipulation/relational/executeObjectEstablishRelation.ts) |
| `Object Dissolve Relation` | [`index.ts`](index.ts) `receiveEvents` -> [`manipulation/relational/executeObjectDissolveRelation.ts`](manipulation/relational/executeObjectDissolveRelation.ts) |

### `Object Take Hold` (positions-owned)

- **Ingress:** typed pick-up via actions **`Parse Requested`** only (**D13** --- no **`Action Assessed`** branch in v1).
- **Must** trust actions-resolved `objectIds` (carry-closed transfer set, BD-13; size 1 for an ordinary command) and `roomId` (source room at egress) at apply --- no re-read of in-room catalog in positions.
- **Must** call [`executeObjectTakeHold`](manipulation/membership/executeObjectTakeHold.ts) with `{ objectIds, roomId, characterId }` --- one atomic `MultiKeyUpdate` transact (departure room + arrival character) via [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts) (**D14**).
- **Live re-derivation, not bounded scrub from trusted ingress alone:** the executor re-runs at execute time and the `MultiKeyUpdate` reducer re-validates the transfer (presence + boundary-edge classification) against freshly-fetched host graphs at commit time --- a concurrent modification since selection aborts the whole transact rather than applying a stale plan.
- **Character inventory:** **must** add every object in `objectIds` at target `characterId`; internal relational edges among the set are recreated on the destination host, derived live from the fetched source graph (not passed in).

### `Object Drop` (positions-owned)

- **Ingress:** typed drop via actions **`Parse Requested`** only (no **`Action Assessed`** branch in v1). Stream contract: **`Object Drop`**, payload `{ characterId, objectIds, roomId }` (symmetric to **`Object Take Hold`**; `objectIds` is a set, not a singular id). Payload type + guard in actions [`publishedEvents.ts`](../actions/publishedEvents.ts); actions **`Parse Requested`** publishes **`Object Drop`** when enrich yields `operationKind: drop`.
- **Must** trust actions-resolved `objectIds` (carry-closed transfer set, BD-13; size 1 for an ordinary command) and `roomId` (destination room at egress) at apply --- no re-read of held inventory catalog in positions.
- **Must** call [`executeObjectDrop`](manipulation/membership/executeObjectDrop.ts) with `{ objectIds, roomId, characterId }` --- one atomic `MultiKeyUpdate` transact (departure character + arrival room) via [`commitStepSequence`](manipulation/kernel/commitStepSequence.ts).
- **Live re-derivation, not bounded scrub from trusted ingress alone:** same commit-time re-validation as `Object Take Hold`, above.

### `Object Establish Relation` (positions-owned)

- **Ingress:** typed establish via actions **`Parse Requested`** only (no **`Action Assessed`** branch in v1). Stream contract: **`Object Establish Relation`**, payload `{ characterId, subjectId, targetId, hostId, relationKind, relationLabel?, confidence? }` (**`hostId`** widened from Room-only **`roomId`**, BD-15/16 slice 4). Payload type + guard in actions [`publishedEvents.ts`](../actions/publishedEvents.ts); actions **`Parse Requested`** publishes when enrich yields grounded **`EstablishRelation`** with **`operationKind: establishRelation`**.
- **Must** trust actions-resolved `subjectId`, `targetId`, `hostId` (Room or Character), `relationKind`, and optional `relationLabel` at apply --- no re-read of in-room catalog in positions.
- **Must** call [`applyObjectRelationalChange`](manipulation/relational/applyObjectRelationalChange.ts) via [`executeObjectEstablishRelation`](manipulation/relational/executeObjectEstablishRelation.ts) with `{ subjectId, targetId, hostId, relationKind, relationLabel?, operation: 'establish' }` --- kernel **`op: 'add'`** in one transact.
- **Idempotency:** duplicate establish when exact edge already present (`changed: false`) **must** be a no-op (no bundle).

### `Object Dissolve Relation` (positions-owned)

- **Ingress:** typed dissolve via actions **`Parse Requested`** only (no **`Action Assessed`** branch in v1). Stream contract: **`Object Dissolve Relation`**, same payload shape as establish. Actions **`Parse Requested`** publishes when enrich yields grounded **`EstablishRelation`** with **`operationKind: dissolveRelation`**.
- **Must** trust actions-resolved ids and relation fields at apply --- no catalog re-resolve in positions.
- **Must** call [`applyObjectRelationalChange`](manipulation/relational/applyObjectRelationalChange.ts) via [`executeObjectDissolveRelation`](manipulation/relational/executeObjectDissolveRelation.ts) with `{ subjectId, targetId, hostId, relationKind, relationLabel?, operation: 'dissolve' }` --- kernel **`op: 'remove'`** matching edge **`from`**, **`to`**, **`kind`**, and **`relationLabel`** when **`Custom`**.
- **Must** reject apply when matching edge absent on host graph.

### `Character Home` (positions-owned)

- **Ingress:** typed **`home`** / **`HomeIntent`** via actions **`Parse Requested`**, trusted home via actions **`Action Assessed`** **`Home`** (`source: 'uiHome'`).
- **Must** trust actions-resolved `toRoomId` (`CharacterMeta.HomeId`) at apply --- no exit topology re-check in positions.
- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: content.toRoomId })` then post-persist orchestration when `changed`.
- **Must not** rely on imperative `MoveCharacter` bus messages from actions for home (retired).
- Leave/arrive world copy for home is owned by fan-in emission ([`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts)); orchestration registers perception threads and map updates only.

### `Character Connected` (positions-owned)

- **Must** resolve `targetRoomId` via [`resolveConnectTargetRoom`](membership/resolveConnectTargetRoom.ts) --- legal placement from nowhere: trim ladder to accessible assets, then top surviving frame (default VORTEX when stack normalizes empty).
- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId })` then post-persist orchestration when `changed`.
- **Must not** publish `CheckLocation` or perform inline membership Dynamo writes outside [`membership/`](membership/).
- **Idempotency:** duplicate connect when already in target room (`changed: false`) **must** be a no-op (no bundle, no orchestration).
- Arrive world-line copy for connect is owned by fan-in emission ([`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts)); connect orchestration does not publish imperative leave/arrive world lines.

### `Character Disconnected` (positions-owned)

- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: null })` --- purges play membership; **must not** clear `RoomStack` (connect re-resolves legal placement from retained ladder).
- **Must not** perform inline membership writes outside [`membership/`](membership/).
- **Idempotency:** duplicate disconnect when already out of play (`changed: false`) **must** be a no-op (no bundle).
- World-line copy for disconnect is owned by fan-in emission ([`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts)); no imperative `PublishMessage` in the handler.

### `Character Navigate` (positions-owned)

- **Ingress:** typed commands via actions **`Parse Requested`**, UI exit clicks via actions **`Action Assessed`** **`Navigation`** (same execution contract).
- **Must** trust actions-validated `toRoomId` at apply (no topology re-check in positions).
- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: content.toRoomId })` then post-persist orchestration when `changed`.
- **Must not** rely on imperative `MoveCharacter` bus messages from actions for parse-based or UI-exit navigation (retired).
- Leave/arrive world copy for navigate is owned by fan-in emission ([`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts)); orchestration registers perception threads and map updates only.

### `mtw.diagnostics` --- occupancy drift repair

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Room Occupancy Drift Finding` | [`index.ts`](index.ts) `receiveEvents` -> [`repairRoomOccupancyDrift`](membership/repairRoomOccupancyDrift.ts) |

**Repair model (graph-forward):**

- Enumerate character nodes on the room **`positionGraph`**; **must not** use **`Meta::Character.RoomId`** or **`Meta::Room.activeCharacters`** as authority.
- **Sessions gate:** no live sessions -> **`applyCharacterRoomMembership({ characterId, targetRoomId: null })`** (full graph purge; membership-changed bundle when `changed`).
- **In-play, adjacency lag:** graph correct but **`getMembershipContainers`** omits this room -> [`syncMembershipAdjacencyToRoom`](membership/syncMembershipAdjacency.ts) only (**must not** run the membership-changed bundle).
- **Idempotency:** at-least-once finding delivery **must** be safe (no-op when already repaired).
- **Explicit gap:** stale adjacency without a graph node is out of scope for this room-forward scan.

Sweep (read-only classification): [`../../../diagnostics/roomOccupancyDriftSweep/`](../../../diagnostics/roomOccupancyDriftSweep/).

---

## Read surface (forward graph vs reverse containers)

- Steady-state roster reads (**affordance compose**, perception fan-out, membership snapshots) **must** use **`getRoomCharacterList`** ([`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts)), not raw `ephemeraDB` `activeCharacters` and not any gateway roster API.
- **`getRoomCharacterList`** **must** derive on each call from **`internalCache.Positions.getPositionGraph(roomId)`** -> **`graph.characterIds`** -> **`hydrateRoomRosterFromCharacterIds`** (`CharacterMeta` + `CharacterSessions`); **must not** read stored **`activeCharacters`** from Dynamo on the steady path. Compose pipeline: [`../../internalCache/AGENT.md`](../../internalCache/AGENT.md#membership-presentation-and-roster).
- After membership apply when **`changed`**, the coordinator **must** seed **`Positions.set(postApplyGraph)`** from kernel **`postApplyGraphs`** (each graph is **`EphemeraPositionGraph`**); **`roomRosterSnapshots`** on the apply result **must** come from **`getRoomCharacterList`** after graph memo seed; **must not** use transact **`successCallback`** on **`activeCharacters`** for snapshot capture.
- **Roster display** **must** hydrate at read time from **`CharacterMeta`** (`Name` -> `DisplayName`, `Color`, `fileURL`) + **`CharacterSessions`** (`SessionIds`) via [`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts); membership topology from stored **`positionGraph`** nodes only.
- **Character forward `getPositionGraph`** **must** read stored **`Meta::Character.positionGraph`** topology only (D16); empty topology when absent. **Must not** use character forward read for room-membership / reverse reads.
- **Reverse membership reads** (navigate parse endpoint in [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts), membership pre-read in coordinators) **must** use **`internalCache.Positions.getMembershipContainers`** (adjacency index only), not raw `Meta::Character.RoomId` or `CharacterMeta.RoomId`.
- **Reverse object placement reads** **must** use **`internalCache.Positions.getMembershipContainers(objectId)`** (adjacency only); returns eligible host ids (`ROOM#`, `CHARACTER#` in v1). Empty adjacency means out of play (`[]`). Room-only apply paths **must** filter to **`ROOM#`** hosts when computing room placement diffs.
- **Forward room graph** **must** read stored **`Meta::Room.positionGraph`** topology only; when graph absent, return empty topology; **must not** merge stored **`activeCharacters`** on gateway forward load for roster display ([sole-authority stance](AGENT.concepts.md#room-play-graph--adjacency-reverse-index)). Forward graph **must** include **`Object`** nodes when present.
- **Forward character inventory graph** **must** read stored **`Meta::Character.positionGraph`** topology only (D16); v1 nodes are **`Object`** membership only; empty topology when absent.
- **Affordance compose** **must** derive in-room object ids via **`graph.objectIds`** on **`Positions.getPositionGraph`** ([`../../internalCache/affordanceRoomDeliverable.ts`](../../internalCache/affordanceRoomDeliverable.ts)); **`shortName`** from improvisation merge, not room meta.
- **Reverse membership** **must** read adjacency rows only; empty adjacency means out of play (`[]`).
- **Authoritative writer** for play position state remains the membership persistence API; ephemera memo when `changed`: **`Positions.set(EphemeraPositionGraph)`** from **`postApplyGraphs`**; **`setMembershipContainers`** for the character or object. Gateway **`createPositionsCacheHandler`** remains **`PlayPositionGraph`** in/out (wrapper adapts on ephemera only). Gateway module scope: [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md).

### Must not reintroduce (D3 --- doc-only guard, no CI)

**Must not** reintroduce removed presentation-layer symbols on the positions gateway read envelope or ephemera roster compose path: **`characterRosterMeta`**, **`roomEndpoint`**, **`PlayPositionRoomRosterEntry`**, **`projectRoomGraphFromRosterEntries`**, **`projectRoomRosterFromGraph`**, **`PositionsCacheHandler.getRoomRoster`**, **`PositionsData.getRoomRoster`**. Roster presentation belongs in ephemera **`getRoomCharacterList`** only.

---

## Explicit non-ownership

- **Must not** implement `projectRoomExits`, `ensureAffordanceTopology`, or exit validation (owned by topology + [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts)).
- **Must not** mutate legacy `Meta::Room.objects` (field removed from room meta Phase 6; objects lane writes improvisation pair + **`Meta::Object`** + graph only --- see [`../objects/`](../objects/)).
- **Must not** write play membership fields outside [`membership/`](membership/).
- **Must not** publish **`CheckLocation`** (retired).

### Disconnect ingress

- **Must** consume disconnect only via **`mtw.connections.characters`** / **`Character Disconnected`** (not legacy `Disconnect Character` EventBridge or ephemera `disconnectMessage`).
- **`unregistercharacter`** WebSocket ingress is **connections-owned** (`service: connections`); ephemera does not handle it.

---

## Consumer expectations

Downstream code **may** assume that after a **successful** membership apply with `changed: true`, `Positions` memo and affordance invalidation reflect the updated roster for all affected rooms in **`froms`** and **`to`**. After a **successful** object membership apply with `changed: true`, downstream **may** assume affordance memo reflects updated **`StandardRoom.objects`** for affected rooms. After a **successful** relational apply with `changed: true`, downstream **may** assume **`Positions`** memo for **`hostId`** reflects updated **`positionGraph`** topology including stored relational edges (gateway read projection passes through relational edges per [`packages/mtw-gateways/ts/ephemera/positions/project.ts`](../../../../packages/mtw-gateways/ts/ephemera/positions/project.ts)); affordance deliverable invalidation only applies when **`hostId`** is a Room. Downstream **must** remain idempotent under at-least-once ingress (see [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md) consumer guidance).
