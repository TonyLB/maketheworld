# Positions manipulation --- implementation map and kernel spec

Graph-grounded persist for `mtw.ephemera.positions`. Every membership and relational mutation --- navigate/connect/disconnect, object place/spawn/destroy/edit/drift-repair, take-hold/drop, establish/dissolve --- is expressed as an ordered **step sequence** and committed through one kernel entrypoint, [`kernel/commitStepSequence.ts`](kernel/commitStepSequence.ts). Per-operator coordinators own ingress shape and the fact/cache/bus bundle; the kernel owns transaction atomicity, legality re-verification, and fact streaming.

**Play graph model:** [`../positionGraph/`](../positionGraph/) is the shared in-memory primitive. The kernel loads host graphs via `graphFromMeta`, simulates with `EphemeraPositionGraph`'s pure mutators, and persists via `toStored()`. See [`../positionGraph/AGENT.md`](../positionGraph/AGENT.md).

Contracts: [`../AGENT.contract.md`](../AGENT.contract.md). Concepts: [`../AGENT.concepts.md`](../AGENT.concepts.md).

**Vocabulary:** Layered terms (step sequence, membership host transfer, graph-grounded persist) live in [`../AGENT.concepts.md` --- Manipulation layering](../AGENT.concepts.md#manipulation-layering-membership-transfer) and [`../AGENT.contract.md` --- Manipulation persist layering](../AGENT.contract.md#manipulation-persist-layering).

---

## Target layering

```text
Per-operator ingress            verb-specific args, trusted ids (parse egress, navigate, repair, ...)
        |
        v
Shared membership adapter       froms/to planning, apply mode, membership observation -> projection
        |                     (reusable across navigate, object place, takeHold, drop, ...)
        v
Kernel step sequence            KernelMutationStep[]: transferMembership | establishRelation | dissolveRelation
        |
        v
commitStepSequence              footprint lock -> one transactWrite -> re-validate live -> stream facts
        |
        v
Per-operator coordinators       membership fact projection consumption, cache/bus bundles
```

**Invariant:** one kernel path for graph-grounded persist. The kernel accepts an explicit, already-grounded step sequence --- it does **not** independently discover priors via `getMembershipContainers`. Transfer planning lives upstream, in the shared membership adapter or the Synthesize executor.

---

## Section A --- Kernel (`kernel/`)

### Step vocabulary

[`kernel/kernelStep.ts`](kernel/kernelStep.ts) defines a deliberately narrow superset of the Synthesize executor's `ExecutorParsePlanStep`:

```typescript
type KernelTransferMembershipStep = {
    kind: 'transferMembership'
    entityIds: ReadonlySet<EphemeraObjectId | EphemeraCharacterId>
    fromHostIds: ReadonlySet<EphemeraMembershipHostId>
    toHostId: EphemeraMembershipHostId | null
}

type KernelMutationStep = KernelTransferMembershipStep | ExecutorEstablishRelationStep | ExecutorDissolveRelationStep
type KernelStep = KernelMutationStep | ExecutorDescribeStep
```

Two widenings distinguish `KernelTransferMembershipStep` from the executor's object-only, singular-host `TransferMembershipStep`:

- **`entityIds` admits characters as well as objects**, since kernel membership transfer generalizes over entity kind. The executor's own step stays object-only --- character movement never passes through Grounding/Expansion/Validation at all.
- **`fromHostIds` is a set and `toHostId` is nullable**, mirroring `MembershipDiff`'s `{ froms, to }` shape. One step kind therefore covers three shapes:

| Shape | Condition | Route |
| --- | --- | --- |
| **Real transfer** | one `fromHostId`, non-null `toHostId` | take-hold, drop, navigate, relational repair |
| **Pure add** | `fromHostIds` empty | improvisational object spawn |
| **Pure remove** | `toHostId === null` | destroy/edit clear, multi-room drift scrub |

Relational steps are reused verbatim from the executor: relational edges stay `EphemeraObjectId`-typed, so there is nothing to generalize (character-relation widening is deferred).

Callers converting executor output use `fromExecutorStep` (overloaded, so mutation-only call sites get `KernelMutationStep` back with no cast). A shared `KernelStep[]` list is filtered per kernel: `isKernelMutationStep` for the positionGraph kernel, `isDescribeStep` for the perception kernel.

### `commitStepSequence` contract

| Concern | Rule |
| --- | --- |
| **Input** | Explicit ordered `KernelMutationStep[]` only --- the kernel **must not** call `getMembershipContainers` or plan transfers |
| **Footprint** | [`computeStepSequenceFootprint`](kernel/computeStepSequenceFootprint.ts) computes the full lock set up front from a snapshot; `MultiKeyUpdate` does exactly one batched fetch and cannot be re-entered to lock a newly-discovered host |
| **Reads** | Only footprint hosts, and only through the `MultiKeyUpdate` reducer's own fetch --- no separate pre-fetch |
| **Validate** | The reducer re-runs [`applyStepSequenceCore`](kernel/applyStepSequenceCore.ts) against freshly-fetched graphs; a non-`legal` verdict throws and aborts the whole transact rather than applying a stale plan |
| **Transact** | One `transactWrite`: the `MultiKeyUpdate` item plus plain sibling adjacency `Put`/`Delete` items, under `exponentialBackoffWrapper` retrying `TransactionCanceledException` |
| **Output** | `KernelCommitResult` --- `{ ok: true, beatAnchorTime, steps }` or `{ ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage }` |
| **Conflict** | On conflict between graph and adjacency, **`positionGraph` wins** (unchanged positions authority) |

**Footprint derivation.** `transferMembership` contributes every `fromHostIds` member plus `toHostId` when non-null --- all decided at grounding time. `establishRelation`/`dissolveRelation` carry no host field, so both endpoints' *pre-transaction* host comes from the injected `getCurrentHost` resolver. The footprint is a lock-set declaration only, never trusted as ground truth: the reducer independently re-derives each relational step's shared host from the locked graphs.

**Adjacency rows** (`positionAdjacency#<hostId>`) are built as unconditioned sibling items, since the entity set and hosts are caller-known before the reducer runs: a `Delete` per `(entityId, fromHostId)` pair across every departure host, and a `Put` per entity only when `toHostId` is non-null. If the reducer throws, none of these fire either. Relational edges get **no** adjacency dual-write --- forward graph only.

**Optional deps:**

| Dep | Effect |
| --- | --- |
| `suppressRelationalFacts` | Gates only the `Object Relation Changed` fact, never `Object Moved`. Destroy/edit leaves it unset so dissolution becomes player-visible; multi-room drift repair sets it `true` as a silent consistency fixup |
| `characterNames` | Pre-resolved display names so `factsForStep` can build a populated `Character Moved` fact while staying synchronous. Only `applyCharacterRoomMembership` populates it |
| `transactWrite` | Test seam; defaults to `ephemeraDB.transactWrite` |

### Apply modes

[`applyStepSequenceCore`](kernel/applyStepSequenceCore.ts) walks the ordered step array once, dispatching per specific primitive. Applying **in array order, without resorting**, is what makes the sequencing contract hold: a paired `dissolveRelation` step always mutates the graph map before a following `transferMembership` step reads it.

| Step shape | Behavior |
| --- | --- |
| **Real transfer** | Object subset routes through [`applyTransferSet`](../positionGraph/expandValidate/applyTransferSet.ts) --- the full boundary-edge legality machinery, shared with the compiler's selection-time sandbox. Relational edges *internal* to the transfer set are re-materialized on the destination graph by `applyTransferSet` itself, derived live from the freshly-fetched source graph --- never precomputed and passed in. Character subset is a direct `removeCharacter`/`addCharacter` swap with no boundary sweep, since a character can never hold a relational edge |
| **Pure remove** | Presence-check then `removeObject`/`removeCharacter` per departure host. **No** boundary sweep here --- the caller is responsible for having seeded explicit `dissolveRelation` steps for every edge the entity carried. A residual edge makes `removeObject` throw, by design |
| **Pure add** | `addObject`/`addCharacter` on the destination only; a freshly spawned entity has no prior edges, so no assert is needed |
| **Relational** | Derives the shared host live from the graph map, throws on endpoint host mismatch, else applies the patch |

**Throw vs. verdict.** Legitimate legality outcomes --- stale candidate, `Custom`-edge defer, unresolved dissolve edge --- return through the `KernelApplyOutcome` discriminated union. Structural-invariant violations (relational host mismatch, `RelationalEdgeStillReferencedError`) throw, uniformly in dry-run and commit modes.

**Interim policy:** `commitStepSequence` collapses non-`legal` verdicts and structural throws into one generic transact failure. This is a working answer today but an acknowledged stand-in for a not-yet-built persistence-level backtrack channel, not a permanent design conclusion.

### Fact emission: projection-first (provisional)

**For the moment**, membership facts are built forward from the step's own `{ froms, to }` on successful persist --- **assuming apply succeeded as planned** --- rather than re-derived from post-apply graphs.

| Chosen (now) | Deferred alternative |
| --- | --- |
| Build `Character Moved` / `Object Moved` from the committed step's `fromHostIds`/`toHostId` (and, upstream of the kernel, from the adapter's `MembershipTransferProjection` for coordinator `changed` gates) | Derive facts from post-apply graphs (graph-grounded projection) |

**May revisit** when graph-grounded fact verification lands.

[`factsForStep`](kernel/factsForStep.ts) walks the *output-ordered* steps rather than a hand-assembled subset, which is what makes a carry's `[dissolveRelation*, transferMembership]` stream its dissolve facts before the moved fact. It emits **one combined fact per entity** (with plural `froms` and nullable `to`), not one per host, so the widened lifecycle routes keep the same single-fact-per-entity behavior their predecessors had.

Character-kind emission is folded into `factsForStep` rather than layered on after `commitStepSequence` returns --- that is what keeps `Character Moved` streaming before the kernel's own `RoomUpdate` publish loop, matching `Object Moved`'s ordering guarantee. `applyCharacterRoomMembership`'s test suite asserts this ordering.

`factsForStep` also takes a **pre-apply graph snapshot**: a `dissolveRelation` endpoint can be removed from the footprint entirely by a later pure-remove step in the same sequence (destroy), leaving it absent from the post-apply map. The snapshot lets the fact re-derive the host it actually held the edge on rather than throwing.

### Ordering: commit, then perceive

[`executeStepSequence`](kernel/executeStepSequence.ts) invokes the mutation kernel first, `await`s its commit to completion, and only then invokes the perception kernel against the same shared `KernelStep[]`. This is a property of *invocation*, not of array order --- a caller must not rely on `describe` steps trailing mutation steps. If the commit fails, the perception kernel is never invoked: a description must reflect final committed state.

`commit` and `perceive` stay two separate dependency bags because they publish onto different bus payload scopes (`PositionsPublishedPayload` vs. `ActionsPublishedPayload`).

**No live production caller yet** --- Plan-stage dispatch for object-directed look is what will give this a real command route.

### Perception kernel

[`perceiveStepSequence`](kernel/perceiveStepSequence.ts) is explicitly **not** a second `commitStepSequence`: no `transactWrite`, no footprint locking, no retry. Those exist to make a *write* atomic across hosts, and a `describe` step mutates nothing. It is a straight publish loop over the `describe` steps it filters out of the shared list.

Delivery reuses the existing `Look Command Requested` pipeline verbatim --- the same event bare `look`/`l` parse already publishes, consumed unchanged by `renderOrchestration/`. Room, Feature, and Knowledge referents get real end-to-end delivery. Object referents get a **stub** delivery (`shortName` only) since `StandardObjectData` has no `render` field yet. Character referents throw a named error rather than silently no-op --- there is no render content model for them.

---

## Section B --- Shared membership adapter (`adapters/`)

The adapter plans *room-host* membership transfers for the routes that do not go through the Synthesize executor. Its whole public surface is `computeMembershipDiff`, `planMembershipTransfer`, and `planObjectClearFromAllHosts`. There is deliberately **no barrel** --- call sites import the concrete module they need.

### Planner inputs

| Field | Meaning |
| --- | --- |
| `entityId` | `CHARACTER#` or `OBJECT#` being moved |
| `entityKind` | `'character'` \| `'object'` |
| `applyMode` | `'end-state'` \| `'bounded'` |
| `target` | Destination membership host, or `null` for out-of-play / remove-from-all |
| `boundedHostIds?` | Trusted ingress hosts to scrub when `applyMode === 'bounded'`; required in that mode |
| `priorContainers` | From `getMembershipContainers(entityId)`, or graph-forward observation on repair paths |

The coordinator **owns** membership observation; the adapter **consumes** `priorContainers` and never re-fetches.

### Apply modes

| Mode | Used by | Scrub rule | `froms` projection |
| --- | --- | --- | --- |
| **end-state** | Navigate, connect, disconnect, object room placement, spawn, drift repair | Remove from **every** prior room host `!== target` | All distinct priors removed |
| **bounded** | Direct positions ingress and paths that bypass parse | Remove from **only** the `boundedHostIds` the entity is actually present on; **do not** end-state scrub other hosts of the same kind | Only the bounded hosts actually removed |

Both modes filter `priorContainers` to **room hosts** before diffing --- this planner does not plan character-inventory transfers. Take-hold and drop reach the kernel through the Synthesize executor instead, which re-derives its transfer set live at execute time.

### Planner output

```typescript
type MembershipTransferPlan = {
    projection: {
        froms: EphemeraMembershipHostId[];
        to: EphemeraMembershipHostId | null;
        changed: boolean;
    };
}
```

The projection is the planner's whole output --- membership transfer semantics for bus facts and coordinator `changed` gates. It deliberately carries **no per-host effect list**: the kernel derives its own footprint and per-host mutations from the step's `fromHostIds`/`toHostId`, so a planner that also enumerated them would be a second, staleable source of truth for the same thing.

### Clear-from-all-hosts

[`planObjectClearFromAllHosts`](adapters/planObjectClearFromAllHosts.ts) is the destroy/edit counterpart: it takes an object's prior containers of *either* host kind and projects `{ froms: all priors, to: null, changed }`. Imported by [`membership/applyObjectClearMembership.ts`](membership/applyObjectClearMembership.ts).

### Parse alignment

Actions parse steady-state ([`actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md#object-manipulation-classify--enrich-steady-state-b25-split-intents)) guarantees for the atomic operators:

- Atomic **`takeHold`** egress supplies a trusted `objectId` + ingress `roomId`.
- Atomic **`drop`** egress supplies a trusted `objectId`, `characterId`, and destination `roomId`.
- **`multiPresent`** (`containers.length > 1`) terminalizes before egress.
- Zero-host objects terminalize before egress.

---

## Section C --- Compose rules

### End-to-end flow

Two ingress families reach the same kernel:

```text
Adapter-planned routes (navigate, object place/spawn/destroy/edit/drift-repair)
  Ingress args (coordinator)
    -> membership observation (getMembershipContainers or repair graph-forward read)
    -> planMembershipTransfer / planObjectClearFromAllHosts
    -> projection { froms, to, changed }
    -> coordinator builds KernelMutationStep[] and calls commitStepSequence
    -> [character navigate only, when changed && to !== null] parallel tail:
         persistRoomStackNavigate + orchestrateCharacterNavigate

Executor-grounded routes (takeHold, drop, establish/dissolve)
  Ingress args (execute*)
    -> Synthesize executor run fresh at execute time (second, later snapshot than Plan-stage)
    -> ExecutorParsePlanStep[] -> fromExecutorStep -> KernelMutationStep[]
    -> commitStepSequence
```

Re-running the executor at execute time is a deliberate **cross-snapshot recheck**, not duplication --- the same pattern the kernel's own reducer-level re-verification applies one layer further in.

Public coordinator APIs remain membership-shaped at ingress --- **not** raw step sequences.

### Host-local relational patch

Relational operations add/remove **edges** on a fixed host `positionGraph` without changing membership host. They do **not** route through the shared membership adapter; they compose with membership transfer by appearing in the same step sequence.

```text
Per-operator ingress (relational)     Object Establish Relation | Object Dissolve Relation
        |
        v
applyObjectRelationalChange           builds [establishRelation] or, on a repair,
        |                             [dissolveRelation*, transferMembership, establishRelation]
        v
commitStepSequence                    one transactWrite; re-validates live on locked graphs
```

| Item | Value |
| --- | --- |
| **Coordinator** | [`relational/applyObjectRelationalChange.ts`](relational/applyObjectRelationalChange.ts) |
| **Ingress** | [`relational/executeObjectEstablishRelation.ts`](relational/executeObjectEstablishRelation.ts), [`relational/executeObjectDissolveRelation.ts`](relational/executeObjectDissolveRelation.ts) |
| **Edge helpers** | [`../positionGraph/`](../positionGraph/) (`HostRelationalEdge`, `edgesMatch`, relational mutators, `hostDataCategory`/`graphFromMeta` Room/Character dispatch) |
| **Fact** | [`relational/buildObjectRelationalFact.ts`](relational/buildObjectRelationalFact.ts) -> [`relational/streamObjectRelationalFact.ts`](relational/streamObjectRelationalFact.ts) |
| **Normative contract** | [`../AGENT.contract.md` --- Host-local relational patch](../AGENT.contract.md#host-local-relational-patch) |

**Kernel rules for relational steps.** The step carries no host field: `applyStepSequenceCore` derives the shared host live and throws on mismatch. `EphemeraPositionGraph.applyRelationalPatch` is the single legality authority (including `bothObjectsOnGraph`); `op: 'add'` is idempotent when the exact edge is already present, and removing an absent edge is rejected. Host may be a Room or a Character graph. **No adjacency dual-write.**

**Repair transfers.** When ingress carries `transferFromHostId`, the coordinator re-derives the carry closure and boundary-edge outcomes fresh from the live source graph rather than trusting a Plan-stage snapshot. A surviving `carry` outcome on the boundary is an internal inconsistency (`RELATIONAL_TRANSFER_INCONSISTENT`); a `defer` outcome means the candidate went stale and needs LLM validation (`RELATIONAL_TRANSFER_DEFERRED`). Only `dissolve` outcomes become steps.

**Cache seeding.** `seedGraphMemos` calls `internalCache.Positions.set` on **every** committed graph regardless of host kind (skipping non-Room graphs would leave a character's cached graph stale), and additionally invalidates `ComponentEphemeraMeta` + `AffordanceRoomDeliverable` for Room hosts. It runs **before** any fact streams, to avoid an affordance-refresh race.

### Per-route ingress map

| Ingress | Coordinator | Planning | Kernel |
| --- | --- | --- | --- |
| Navigate / connect / disconnect / home | [`applyCharacterRoomMembership`](../membership/applyCharacterRoomMembership.ts) | `planMembershipTransfer` (end-state) | [`commitStepSequence`](kernel/commitStepSequence.ts) |
| Object room place / remove / drift repair | [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) | `planMembershipTransfer` (end-state) | [`commitStepSequence`](kernel/commitStepSequence.ts) |
| Improvisational object spawn | [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) via [`spawnOneImprovisationObject`](../../objects/spawnImprovisationObjectsBatch.ts) | `planMembershipTransfer` (end-state) | [`commitStepSequence`](kernel/commitStepSequence.ts) |
| Object destroy / edit | [`applyObjectClearMembership`](membership/applyObjectClearMembership.ts) | `planObjectClearFromAllHosts` + explicit boundary sweep | [`commitStepSequence`](kernel/commitStepSequence.ts) |
| **`takeHold`** | [`membership/executeObjectTakeHold.ts`](membership/executeObjectTakeHold.ts) | Synthesize executor, re-run at execute time | [`commitStepSequence`](kernel/commitStepSequence.ts) |
| **`drop`** | [`membership/executeObjectDrop.ts`](membership/executeObjectDrop.ts) | Synthesize executor, re-run at execute time | [`commitStepSequence`](kernel/commitStepSequence.ts) |
| Establish / dissolve relation | [`relational/applyObjectRelationalChange.ts`](relational/applyObjectRelationalChange.ts) | Live carry-closure / boundary sweep on repair | [`commitStepSequence`](kernel/commitStepSequence.ts) |

**Documented exception (not a parallel persist path):**

| Path | Role |
| --- | --- |
| [`syncMembershipAdjacency.ts`](../membership/syncMembershipAdjacency.ts) / [`syncObjectMembershipAdjacency.ts`](../membership/syncObjectMembershipAdjacency.ts) | Adjacency-only sync when the graph is correct but the reverse index lags |

**RoomStack (eviction ladder)** is **not** a kernel input. Navigate ladder persist runs in the parallel tail after [`applyCharacterRoomMembership`](../membership/applyCharacterRoomMembership.ts) --- see [`persistRoomStackNavigate.ts`](../membership/persistRoomStackNavigate.ts) and [`afterCharacterMembershipNavigateChanged.ts`](../navigate/afterCharacterMembershipNavigateChanged.ts). Merge/trim detail: [`../AGENT.implementation.md` --- Eviction ladder](../AGENT.implementation.md#eviction-ladder-roomstack-storage); normative rules: [`../AGENT.contract.md` --- Eviction ladder](../AGENT.contract.md#eviction-ladder-roomstack-storage).

---

## Kernel invariants

Normative statements of these live in [`../AGENT.contract.md`](../AGENT.contract.md#manipulation-persist-layering) and [`../AGENT.concepts.md`](../AGENT.concepts.md#manipulation-layering-membership-transfer).

| Invariant | Where enforced |
| --- | --- |
| The kernel accepts an explicit step sequence and performs no independent prior discovery --- never calls `getMembershipContainers` | [`commitStepSequence.ts`](kernel/commitStepSequence.ts) |
| One kernel entrypoint for every route; no route-specific kernel wrappers | [`kernel/`](kernel/) |
| One `transactWrite` per commit, with no separate pre-fetch | [`commitStepSequence.ts`](kernel/commitStepSequence.ts) |
| Legality is re-verified against freshly-fetched, locked graphs at commit time --- never applied from a snapshot | [`applyStepSequenceCore.ts`](kernel/applyStepSequenceCore.ts) |
| Steps apply in array order and are never resorted | [`applyStepSequenceCore.ts`](kernel/applyStepSequenceCore.ts) |
| Facts stream in step order, before the `RoomUpdate` publish loop | [`factsForStep.ts`](kernel/factsForStep.ts) |
| Relational edges are forward-graph only --- no adjacency dual-write | [`commitStepSequence.ts`](kernel/commitStepSequence.ts) |
| On graph/adjacency conflict, `positionGraph` wins | [`../positionGraph/`](../positionGraph/) |
| Transfer planning lives in the shared adapter (`adapters/`) or the Synthesize executor, never in the kernel | [`adapters/`](adapters/) |

### Anti-patterns

- New `update*PositionGraphs` modules bundling planner + transact.
- Per-verb diff computers outside the shared adapter.
- Route-specific kernel wrappers over `commitStepSequence` (this recreates, one layer up, exactly the organization the unified kernel exists to retire).
- Kernel prior-read via `getMembershipContainers`.
- Parse-local persist forks for atomic object manipulation --- egress must route through a positions coordinator.

---

## This folder (code map)

### `kernel/`

| Path | Role |
| --- | --- |
| [`kernel/kernelStep.ts`](kernel/kernelStep.ts) | Step vocabulary; `fromExecutorStep` adapter; `isKernelMutationStep` / `isDescribeStep` filters |
| [`kernel/types.ts`](kernel/types.ts) | `StepSequenceFootprint`, `KernelApplyOutcome`, `KernelCommitResult` |
| [`kernel/commitStepSequence.ts`](kernel/commitStepSequence.ts) | The commit entrypoint: footprint lock, `MultiKeyUpdate` transact, adjacency items, cache seed, fact stream, `RoomUpdate` publish |
| [`kernel/applyStepSequenceCore.ts`](kernel/applyStepSequenceCore.ts) | Pure apply core shared by dry-run and commit |
| [`kernel/computeStepSequenceFootprint.ts`](kernel/computeStepSequenceFootprint.ts) | Transaction lock-set derivation |
| [`kernel/factsForStep.ts`](kernel/factsForStep.ts) | Step -> `Object Moved` / `Character Moved` / `Object Relation Changed` |
| [`kernel/executeStepSequence.ts`](kernel/executeStepSequence.ts) | Commit-then-perceive sequencing (no live production caller yet) |
| [`kernel/perceiveStepSequence.ts`](kernel/perceiveStepSequence.ts) | Read-only perception kernel over `describe` steps |

### `adapters/`

| Path | Role |
| --- | --- |
| [`adapters/planMembershipTransfer.ts`](adapters/planMembershipTransfer.ts) | End-state / bounded room-host transfer planner |
| [`adapters/computeEndStateRoomDiff.ts`](adapters/computeEndStateRoomDiff.ts) | End-state room `MembershipDiff` |
| [`adapters/planObjectClearFromAllHosts.ts`](adapters/planObjectClearFromAllHosts.ts) | Destroy/edit clear projection |

### `membership/`

| Path | Role |
| --- | --- |
| [`membership/executeObjectTakeHold.ts`](membership/executeObjectTakeHold.ts) | `Object Take Hold` ingress; runs the Synthesize executor then commits |
| [`membership/executeObjectDrop.ts`](membership/executeObjectDrop.ts) | `Object Drop` ingress; mirrors take-hold in the character -> room direction |
| [`membership/applyObjectClearMembership.ts`](membership/applyObjectClearMembership.ts) | Destroy/edit clear: explicit boundary sweep + `dissolveRelation` + widened `transferMembership` |
| [`membership/types.ts`](membership/types.ts) | `ObjectMembershipDiff` (shared with `buildObjectMovedFact`) + clear-membership apply result |

### `relational/`

| Path | Role |
| --- | --- |
| [`relational/applyObjectRelationalChange.ts`](relational/applyObjectRelationalChange.ts) | Relational coordinator; builds the step sequence for satisfied and repaired cases |
| [`relational/executeObjectEstablishRelation.ts`](relational/executeObjectEstablishRelation.ts) | `Object Establish Relation` ingress |
| [`relational/executeObjectDissolveRelation.ts`](relational/executeObjectDissolveRelation.ts) | `Object Dissolve Relation` ingress |
| [`relational/buildObjectRelationalFact.ts`](relational/buildObjectRelationalFact.ts) | `Object Relation Changed` payload builder |
| [`relational/streamObjectRelationalFact.ts`](relational/streamObjectRelationalFact.ts) | Fact stream wrapper |
| [`relational/types.ts`](relational/types.ts) | `RelationalIngressArgs`, `RelationalApplyResult` |

### Top level

| Path | Role |
| --- | --- |
| [`types.ts`](types.ts) | `MembershipTransferProjection`, `MembershipTransferPlan`, `HostRelationalEdge`, `HostRelationalPatch` (the last is `EphemeraPositionGraph.applyRelationalPatch`'s own input shape) |

---

## Verification

Kernel and adapter suites:

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/manipulation/
```

Full positions persist surface (coordinators + kernel):

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/
```

**No parallel persist paths.** Both of these should come back empty:

```bash
rg -n "getMembershipContainers" \
  lambda/ephemera/dataSource/positions/manipulation/kernel/

rg -n "updatePositionGraphs|updateObjectPositionGraphs|updateTakeHoldPositionGraphs|updateDropPositionGraphs" \
  lambda/ephemera/dataSource/positions/
```

---

## Cross-links

| Doc | Role |
| --- | --- |
| [`AGENT.md`](AGENT.md) | Folder identity |
| [`../AGENT.md`](../AGENT.md) | Positions package entry |
| [`../AGENT.contract.md`](../AGENT.contract.md) | Shipped normative rules |
| [`../AGENT.concepts.md`](../AGENT.concepts.md) | Mental models: membership, eviction ladder, graph roles |
| [`../positionGraph/AGENT.md`](../positionGraph/AGENT.md) | Shared play graph primitive |
| [`../../actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md) | Object manipulation parse steady-state; atomic operator playbook |
| [`../../../diegeticLogic/AGENT.implementation.md`](../../../diegeticLogic/AGENT.implementation.md) | Operator intent/fact/presentation playbooks |
