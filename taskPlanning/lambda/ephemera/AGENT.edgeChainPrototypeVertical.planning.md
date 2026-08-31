# Edge-chain prototype vertical (PV-1)

**Status:** In progress. **Next step: PV1-1b**, consolidate object-lifecycle membership onto the pipeline.

**This is an implementation plan.** It follows [`taskPlanning/AGENT.md`](../../AGENT.md) and **not** [`AGENT.designVariant.md`](../../AGENT.designVariant.md): code here is licensed by shipping, not by a tier; resolved decision rows are removed, not graduated; Progress is a running log, not a phase-grain view.

Area commands: [`taskPlanning/charcoal-client/AGENT.development.md`](../../charcoal-client/AGENT.development.md) for the client (Vitest, `npm run test:single`).

## Why this initiative exists

Three prototypes are shipped and inert: port machinery with no producer, `edgeId` (EA-8) minted by nothing, and `chainId` (P8 iteration 1) written by nothing. Each needs an observation that is only reachable once the other two are live. P8's rollback trigger (*a write path must decide same chain or not*) cannot fire, since no write path can express chain membership at all.

This vertical is the smallest configuration that makes all three observable at once. It is not a design initiative and settles no design question; it produces one readout (below).

## Mechanism this vertical builds on

[AB-54](dataSource/positions/AGENT.abstractionLayers.planning.md#settled-register) is settled: hosting kinds (`On`, `In`, `PartOf`) put the subordinate node in the superior's own shard (a cup `On` a tray is a member of the tray's `ludicGraph`, not the room's); peer kinds (`Under`, `Against`, `Custom`) leave both endpoints in one graph and host nothing.

Consequences that shape the build order:

1. Putting the cup on the tray requires the tray to be a host with its own persisted `ludicGraph` — [CD2h](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order). `In`/`PartOf` are deferred; one hosting kind is enough to make a boundary.
2. [`roomObjectCatalogForCharacter.ts`](../../../lambda/ephemera/dataSource/actions/roomObjectCatalogForCharacter.ts) enumerates the room's own `objectIds` only, so a hosted cup becomes unnameable unless referent search is extended to walk into hosted objects' graphs.
3. A `Custom` relation across that boundary ("tie the rope to the cup", rope in the room, cup in the tray's shard) cannot be one edge — it needs a port and produces two legs (room-side, tray-side). That is the first multi-leg chain the system will hold.

**Build order is 1→2 inverted:** [CD2h](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order) is gated on [CC3](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order) because a hosted cup vanishes from flat-catalog referent search with no guard to fire. Referent search (PV1-1) goes before hosting (PV1-2), built against hand-built nested fixtures — the graph already round-trips hosting shape (CD1 found `In`/`PartOf` persistence-tested but inert).

## What already exists to build on

- **Hosting, partly.** `On` is unauthorable today: [Channel D](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order) exists to make `On` root-anchored per AB-54; CD0/CD1/CD2 have landed, and CD2 retired `On` at the ingress lane ([`normalizeRelationSpan.ts:10`](../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/normalizeRelationSpan.ts) defers `on`/`onto`/`on top of`). The shard-hosting mechanism (CD2h) is unbuilt and gated on CC3, which PV1-1 discharges.
- **The move operation**, extended by PV1-2. [`executeObjectMove.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/membership/executeObjectMove.ts) is the single call site for every object membership move, takes hosts rather than a verb (take-hold `room -> character`, drop `character -> room`, give `character -> character`), and re-derives the carry closure and boundary sweep fresh at commit time.
- **The step sequence a compiler can emit.** [`applyObjectRelationalChange.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/relational/applyObjectRelationalChange.ts) commits `[dissolveRelation*, transferMembership, establishRelation]` through `commitStepSequence` as a repair path (see PV1-2 for why that is distinct from the hosting model).
- **Port shape, with no producer.** Types, terminal union, and matcher shipped when the ports plan closed 2026-08-23; nothing calls `withPorts` outside tests. `EphemeraPresencePort` gets its producer at PV1-2, `EphemeraCrossingPort` at PV1-3.
- **`chainId`, carried and compared, written by nothing.** The field round-trips through storage and `edgesMatch` consults it; the mutation vocabulary in [`manipulation/types.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/types.ts) cannot express it.
- **The commit path already mixes item kinds.** `transactWrite([multiKeyItem, ...adjacencyItems])` — sibling records in one transaction is an established shape.

## The readout

Specified before the code (PV1-0), since PV-1's value is that it can produce an observation.

**The run**, taken by hand in a running client with the Dynamo console open, at PV1-4:

1. Order a table, a cup, and a string from Acme.
2. `put cup on table` (PV1-2).
3. `tie string to cup` (PV1-3) — the first chain the system will have held. This step is also PV1-1's test: if referent search cannot find the cup ("you don't see a cup"), PV1-1 broke, not PV1-3.
4. Read the four records below.

**Records to read.** No `EDGE#` item — PV-1 mints no Edge record, so both ids ride as optional fields on the legs themselves.

| Record | Where | What should be in it |
| --- | --- | --- |
| Room | `Meta::Room` on VORTEX, `ludicGraph` | table and string as nodes; the room-side leg, `string -> port` |
| Table | `Meta::Object` on the table, `ludicGraph` | the cup as a member node; its containment edge `cup -> root`, kind `On`; the crossing-port record (`fromHostId: ROOM#VORTEX`, stored interior-side); the table-side leg, `port -> cup` |
| Cup | `Meta::Object` on the cup, `ludicGraph` | its own root node (concepts clause 3), and one presence port — `{ fromHostId: OBJECT#<table>, kind: 'Present' }` |
| Adjacency | `EphemeraId: OBJECT#<cup>` | `DataCategory: POSITION#OBJECT#<table>` |

**Clauses to check against the run:**

- **Chains work** if both legs carry the same `chainId` and the same `edgeId`, and the string and the cup are both still nameable. Compare the two legs' fields directly — a leg count alone can read as success while the `chainId`s differ.
- **Chain identity is the wrong model** if PV1-3 cannot set the second leg's `chainId` without a fact no caller possesses, or if the ids have to be reconciled at read time rather than carried. Record this the moment it happens during construction, not only if it shows up in the dump.
- **The presence port earns its place** if the cup's presence port answers something the adjacency row does not — read the two rows side by side. If they say the same thing in two places, that is evidence for [AB-55](dataSource/positions/AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only) (*does the presence port subsume adjacency?*) and grounds for taking the port back out.

**What this run cannot observe** — name these at PV1-4 rather than letting the silence read as coverage:

- The find path: PV-1 mints first chains only. A second route over an existing relationship needs an Edge record to find, and there is none.
- A relation that predates its boundary: optional second pass, tie the string first, then put the cup on the table (PV1-2's boundary sweep will most likely untie it — run it anyway and record which way it went).

## Progress

| Date | Note |
| --- | --- |
| 2026-08-30 | Seeded from conversation. Nothing built. |
| 2026-08-31 | Hosting reframed: a rehost carrying a containment argument, not a relation with a side effect. Nothing built. |
| 2026-08-31 | Presence ports added: one port, no `Present` edges. PR-10 collapses the cover's edge set, not the port record. CD6 is crossing-only. Nothing built. |
| 2026-08-31 | Open decisions resolved; referent search and hosting order swapped per the CC3 gate. Nothing built. |
| 2026-08-31 | PV1-0 done: table/cup/string manual run, four records specified. Found while checking it: the cup's own row and the adjacency row both carry clause 3; Acme delivery does not go through `executeObjectMove`, so the spawn path's missing ports are an uncovered path, not clause-3 evidence. Nothing built. |
| 2026-08-31 | PV1-1b added: room-only entry points are not required by any live rule (`AGENT.implementation.md`'s citation of `D14` is undefined in the repo, and the atomicity gap it traces to was closed by the `MultiKeyUpdate` migration). Presence-port mint location pinned at PV1-2. Nothing built. |
| 2026-08-31 | PV1-1b re-scoped: room-level membership joins the same pipeline as play-level, and the scale-specific mutators are deleted (not generalized in place). The op layer and kernel are already host-general and nullable-destination; all three narrowings sit in the ring between them. PV1-2's singular-`fromHostId` bullet corrected to match. Nothing built. |
| 2026-08-31 | PV1-1 done: `roomObjectCatalogForCharacter.ts` walks into hosted objects' own `ludicGraph`s (`collectNestedObjectIds`, BFS, depth cap 5, visited set for cycles), each object fetched via `internalCache.Positions.getLudicGraph`. Tested against hand-built fixtures (nested-cup regression test, depth-cap boundary, cyclic-fixture termination). Scope is the room catalog only — `heldInventoryCatalogForCharacter.ts` is left flat, deliberately, since neither this slice's done-when nor the readout's test step needs held-object nesting; CC3's fuller discharge (both catalogs) is future work. `roomObjectLabelsForCharacter.test.ts`'s shared deps fixture needed the same `getObjectLudicGraph` no-op default the new recursion introduced. Full ephemera suite and `tsc --noEmit` (ephemera, mtw-interfaces) green. |

## Recommended order

Pending work is `- [ ]` and completed work is `- [X]`; mark nested lines `[X]` as each is done, so partial progress on a slice is visible. Updating these checkboxes is part of *done* for the slice, after tests pass.

- [X] **PV1-0. Write the readout, before any code.** Done 2026-08-31 — see [The readout](#the-readout).
- [X] **PV1-1. Referent search survives nesting.**
  - [X] Extend the catalog to walk into hosted objects' graphs by Dynamo read recursion. No `ludicCache` — a correct recursive read discharges CC3's prerequisite and a cache can substitute later behind a stable interface.
  - [X] Depth cap of five (testing bound, not a claim about real nesting depth) plus a visited set (terminates cyclic graphs).
  - [X] Build against hand-built nested fixtures — the graph already round-trips hosting shape (CD1: `In`/`PartOf` persistence-tested but inert).
  - [X] **Done when:** a cup nested in a tray fixture can be named and acted on from the room, with a test that fails against the pre-nesting enumeration.
- [ ] **PV1-1b. Consolidate object-lifecycle membership onto the instruction / planner / compiler / kernel pipeline; retire the scale-specific mutators.**
  - [ ] Widen [`parsePlanStep.ts:10-15`](../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/parsePlanStep.ts)'s `TransferMembershipStep`: `fromHostId` to a set, `toHostId` to nullable (matches the op layer's `froms`/`to` and the kernel step's `fromHostIds`/`toHostId`, both already general).
  - [ ] Widen [`buildObjectMoveOp.ts:47-48`](../../../lambda/ephemera/dataSource/positions/membership/buildObjectMoveOp.ts): stop narrowing `froms: [args.fromHostId]` and `to` non-null.
  - [ ] Add error detail to `ExecuteObjectMoveResult`'s `ok: false` (`errorCode`/`errorMessage`, matching `applyObjectRoomMembership` today) — spawn's S1 compensating delete keys off placement failure.
  - [ ] State the carry-closure rule directly: carry closure is the singleton when `toHostId === null` (no destination means no carry-partner growth); the executor always runs operand expansion.
  - [ ] Thread `suppressRelationalFacts` through `executeObjectMove` — [`repairObjectPlacementDrift`](../../../lambda/ephemera/dataSource/positions/membership/repairObjectPlacementDrift.ts) needs it to keep a silent consistency fixup from streaming `Object Relation Changed`; it is already a `commitStepSequence` option.
  - [ ] Land the four widenings above first, behind the existing call sites, so the pipeline is general before any coordinator is deleted.
  - [ ] Delete `applyObjectRoomMembership`, [`applyObjectClearMembership`](../../../lambda/ephemera/dataSource/positions/manipulation/membership/applyObjectClearMembership.ts), and the membership half of `applyCharacterRoomMembership`; delete adapters `planMembershipTransfer`, `computeEndStateRoomDiff`, `planObjectClearFromAllHosts`.
  - [ ] Move four call sites onto the pipeline: `spawnImprovisationObjectsBatch`, `repairObjectPlacementDrift`, `applyObjectsChange`, `clearCoyoteGameImprovisationObjects`.
  - [ ] Move `applyCharacterRoomMembership`'s membership half onto the pipeline; leave its room-stack machinery (`membershipRoomStack`, `mergeRoomStack`, `trimEvictionLadder`, `persistRoomStackNavigate`) untouched — different machinery, not a scale-specific narrowing.
  - [ ] Strike `AGENT.implementation.md:51`'s "do not extend room-only entry points" and the `D14` citation in `AGENT.contract.md:228` (full corpus sweep at PV1-5).
  - [ ] **Done when:** every object membership change (spawn, place, remove, drift repair, clear, take-hold, drop) reaches the kernel through one pipeline; the three adapters and retired coordinators are deleted; the full suite passes.
- [ ] **PV1-2. `On` nests end to end, as a rehost carrying a containment argument** (not a relation with a side effect; establishing `On` moves nothing and there is no operation that "establishes `On`").
  - [ ] Add `containment?: 'On' | 'In' | 'PartOf'` to `ExecuteObjectMoveArgs` and the plan-stage shape that feeds it (hosting kinds only — peer kinds host nothing, AB-54). Optional because take-hold's containment kind is unnamed, not because take-hold lacks one.
  - [ ] Lower in `buildObjectMoveOp`/`compilePositionKernelOp`: emit `[...boundaryDissolves, transferMembership, ...(containment ? [establishRelation(moved -> destination root, containment)] : [])]`. Do not widen `MutationKernelTransferStep` ([`kernelStep.ts:28-33`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/kernelStep.ts)) — the containment edge commits through the ordinary edge path instead.
  - [ ] Mint one presence port in the moved object on any rehost (containment set or not — take-hold counts as containment too): `{ portId, fromHostId: <destination>, kind: 'Present' }` on the moved object's own graph ([`EphemeraPresencePort`](../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)); drop it again when the object leaves. No `Present` edges — PR-10 makes the cover's edge set implicit, not the port record itself.
  - [ ] Land the mint in `buildObjectMoveOp`/`compilePositionKernelOp` for now (reaches `executeObjectMove` only); revisit once PV1-1b unifies both lanes onto one pipeline (note for PV1-5: minting from the kernel step instead needs a gate so characters don't get ported on every navigate).
  - [ ] Mint a `ludicGraph` (with root node, per concepts clause 3 / LP4i) on both sides of the move: the destination's, to hold the moved object as a member, and the moved object's own, to hold its presence port. `Meta::Object.ludicGraph` is optional and storage-only today (MK2).
  - [ ] Remove the old containment edge explicitly, sequenced outside the boundary sweep — an edge to its own graph's root node is not a boundary edge. [`interactionUnderTransfer.ts`](../../../lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts)'s `classifyInteractionUnderTransfer` currently throws on `'On' | 'In' | 'PartOf'` reaching `boundaryEdgeOutcomes`; this step is what retires that throw (LD-11).
  - [ ] Client: route `put cup on tray` to the move lane carrying `containment: 'On'` — not back to the relational ingress (`normalizeRelationSpan.ts`'s `nestingDefer` stays correct, now with a destination). Resolve what `take cup off tray` names as its destination when no containment kind is given.
  - [ ] Note: [CD6](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order) does not apply here — it is a crossing-port kind-agreement check, and a presence port has no exterior edge to disagree with. CD6 stays with PV1-3; reword its trigger at PV1-5.
  - [ ] **Done when:** a cup put on a tray is a member of the tray's `ludicGraph` (not the room's), its containment edge is root-anchored inside the tray's graph, its presence port names the tray, and both are gone when it leaves — asserted in test and observed in the running client.
- [ ] **PV1-3. A `Custom` relation across the boundary, and the crossing-port producer it needs.**
  - [ ] Client: a path for `tie <object> to <object>`.
  - [ ] Server: a crossing-port producer ([AB-55/AB-62](dataSource/positions/AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only)) — a peer relation whose endpoints are in different shards produces a room-side leg and a tray-side leg.
  - [ ] Carry chain membership through the mutation vocabulary: `manipulation/types.ts`'s edge type and the kernel's relational steps cannot express `chainId` today.
  - [ ] Mint `chainId` together with `edgeId` at the moment the edge gains identity — both stay optional fields on the inline leg base; PV-1 mints no Edge record.
  - [ ] Scope: first chains only. A second route over an existing relationship should mint a new chain on the existing `edgeId`, but finding that existing Edge is out of scope here (no Edge record exists to find). Note this gap at PV1-4.
  - [ ] **Done when:** `tie rope to cup` produces two legs sharing one `chainId`, and both are readable back from storage.
- [ ] **PV1-4. Take the readout.** Run PV1-0's observations against the built vertical and write down what happened, including the find path this vertical could not observe.
- [ ] **PV1-5. Write back into the design corpus** — the `P8-i1-dependent` tag names the rows that owe an update (currently one: [EA-10](dataSource/positions/AGENT.edgeAbstractions.planning.md#ea-10)).
  - [ ] [P8](dataSource/positions/AGENT.abstractionLayers.proposals.planning.md#status-1): record what the readout showed, and whether the rollback trigger fired.
  - [ ] [EA-10](dataSource/positions/AGENT.edgeAbstractions.planning.md#ea-10): the five structure-as-identity sites now have live traffic — say what that changed.
  - [ ] [AB-55/AB-62](dataSource/positions/AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only): both port producers exist — close or re-scope. AB-55 takes the readout's presence-port clause directly.
  - [ ] [CD6](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order): reword its travel rule from "whichever step first writes a port record" to "first writes a *crossing* port record" (PV1-2 writes presence ports and does not discharge it).
  - [ ] [CD3](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order) / [CD2h](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order): record what PV1-2 did instead of the retired classification throw, and whether LD-11 is now live.
  - [ ] [AB-65](dataSource/positions/AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only) (*is an edge a value or an entity?*): report evidence, do not answer it here.
  - [ ] Strike "do not extend room-only entry points" ([`AGENT.implementation.md:51`](../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md)) and the `D14` bullet ([`AGENT.contract.md:228`](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md)). Sweep references to the deleted coordinators/adapters in `AGENT.contract.md` (object room membership section, room-only bundle section, graph-forward repair, relational-patch prohibition), `AGENT.implementation.md` (file table, objects-lane rows), `AGENT.concepts.md` (spawn+place, place/remove), and `manipulation/AGENT.implementation.md`'s route table. Give `D8`/`D13`/`D14`/`D16` a register or strike the tags — they are cited in the contract and defined nowhere.
  - [ ] **Done when:** each row above is either updated or explicitly recorded as unaffected, and no new open rows are added from this plan.

## Verification

- **Ephemera:** `npm --prefix lambda/ephemera run test -- --watchAll=false`. Run the full suite, not a filtered subset — `*.integration.test.ts` files sit outside `tsconfig`, so `tsc` does not cover them.
- **Typecheck:** `npx tsc --noEmit` in `lambda/ephemera`, `packages/mtw-interfaces`, and `packages/mtw-gateways`.
- **Client:** `npm --prefix charcoal-client run test:single` (Vitest; not Jest, `--testPathPattern` does not apply).
- **The vertical itself:** PV1-0's observations, taken by hand in a running client at PV1-4. No unit test substitutes for this.

## When this finishes

Per [`taskPlanning/AGENT.md`](../../AGENT.md): move anything durable into the code-adjacent `AGENT.md` files under [`dataSource/positions/`](../../../lambda/ephemera/dataSource/positions/), then delete this plan. PV1-5 is what makes that safe.
