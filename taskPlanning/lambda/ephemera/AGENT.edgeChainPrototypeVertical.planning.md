# Edge-chain prototype vertical (PV-1)

**Status:** Not started, seeded 2026-08-30. **Next step: PV1-0**, write the readout, before any code.

**This is an implementation plan, deliberately.** It follows [`taskPlanning/AGENT.md`](../../AGENT.md) and **not** [`AGENT.designVariant.md`](../../AGENT.designVariant.md), which matters in three ways the design corpus's habits would otherwise import: code here is **licensed by shipping**, not by a tier; resolved decision rows are **removed**, not graduated; and Progress is a running log, not a phase-grain view. Nothing in this file needs a Prototype classification, a dependency tag, or a rollback trigger.

Area commands: [`taskPlanning/charcoal-client/AGENT.development.md`](../../charcoal-client/AGENT.development.md) for the client (Vitest, `npm run test:single`).

## Why this initiative exists

Three prototypes are shipped and **inert** --- the port machinery with no producer, `edgeId` (EA-8) minted by nothing, and `chainId` (P8 iteration 1) written by nothing. Each was elected on the promise that building it cheaply would buy evidence. **None of them can produce any**, because the observation each one needs is only reachable when the other two are live. P8's rollback trigger --- *a write path must decide same chain or not* --- cannot fire, since no write path can express chain membership at all.

**This vertical is the smallest configuration that makes all three observable at once.** It is not a design initiative and it settles no design question. It exists to produce one readout.

## The vertical, and why each step is load-bearing

[AB-54](dataSource/positions/AGENT.abstractionLayers.planning.md#settled-register) is settled and supplies the mechanism:

> **Hosting kinds --- `On`, `In`, `PartOf` --- put the subordinate node in the superior's own shard** (a cup `On` a tray is a member of the tray's `ludicGraph`, not the room's). **Peer kinds --- `Under`, `Against`, `Custom` --- leave both endpoints in one graph and host nothing.**

1. **`On` in the UI creates a boundary.** Because `On` is a hosting kind, "put the cup on the tray" moves the cup into the tray's shard. `In`/`PartOf` are deferred and cost nothing to defer --- one hosting kind is enough to make a boundary.
2. **Nesting breaks referent search, immediately.** [`roomObjectCatalogForCharacter.ts`](../../../lambda/ephemera/dataSource/actions/roomObjectCatalogForCharacter.ts) enumerates the room's own `objectIds`, so the cup stops being nameable the moment it is hosted. AB-54's own rule is that **`On` admits nested things to referent-search always**, so this is a correctness fix, not an optimisation.
3. **A `Custom` relation across that boundary is the first multi-leg chain.** `Custom` is a peer kind and hosts nothing, so "tie the rope to the cup" --- rope in the room, cup in the tray's shard --- cannot be one edge. It needs a port and produces two legs: room-side and tray-side. **That is a chain, and it is the first one the system will ever have held.**

## What already exists to build on

- **Hosting.** [Channel D](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order) exists to make `On` root-anchored in code per AB-54; **CD1 and CD2 have landed.** Step 1 continues that work rather than starting a stream.
- **Relation establishment, including re-hosting.** [`applyObjectRelationalChange.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/relational/applyObjectRelationalChange.ts) already emits `[dissolveRelation*, transferMembership, establishRelation]` when hosts differ, through `commitStepSequence`.
- **Port shape, with no producer.** Types, terminal union and matcher shipped when the ports plan closed 2026-08-23. Nothing calls `withPorts` outside tests --- **the producer is this plan's step 3.**
- **`chainId`, carried and compared, written by nothing.** The field round-trips through storage and `edgesMatch` consults it; the mutation vocabulary in [`manipulation/types.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/types.ts) cannot express it.
- **The commit path already mixes item kinds.** `transactWrite([multiKeyItem, ...adjacencyItems])`, so sibling records in one transaction is an established shape.

## The readout

**Written before the code, because this is the one obligation that has failed twice** --- P8's rollback trigger cannot fire, and EA-8's pinning test was declared a forcing function and did not fire when the decision came. **PV-1's entire value is that it can produce an observation, so the observation is specified first and is [PV1-0](#recommended-order).**

Provisional shape, to be sharpened by PV1-0 and not treated as settled by it:

- **Chains work** if, after `put cup on tray` and `tie rope to cup`, the two legs carry the same `chainId`, the rope is still nameable, and the cup is still nameable.
- **Chain identity is the wrong model** if the two legs cannot be given one id without a fact no caller possesses, or if the id has to be invented at read time rather than carried.

## Progress

| Date | Note |
| --- | --- |
| 2026-08-30 | Seeded from conversation. Nothing built. |

## Recommended order

Pending work is `- [ ]` and completed work is `- [X]`; mark **nested** lines `[X]` as each is done, so partial progress on a slice is visible. Updating these checkboxes is part of *done* for the slice, after tests pass.

- [ ] **PV1-0. Write the readout, before any code.** Sharpen the two clauses above into observations that can be made by running the game, and record what each one would look like if it came out the other way. **Done when** both clauses name a concrete observable and neither can be satisfied by a passing unit test alone.
- [ ] **PV1-1. `On` nests, end to end.** Continue [Channel D](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order) far enough that establishing `On` re-hosts the subordinate into the superior's shard, and expose one path to it in the client.
  - [ ] Server: `On` re-hosts on establish, and dissolving returns the object to its prior host.
  - [ ] Client: a path that issues `put <object> on <object>`.
  - [ ] **Done when** a cup put on a tray is a member of the tray's `ludicGraph` and not the room's, asserted in test and observed in the running client.
- [ ] **PV1-2. Referent search survives nesting --- naive recursion, deliberately.** Extend the catalog to walk into hosted objects' graphs by Dynamo read recursion. **No `ludicCache`.**
  - [ ] **Why naive is the right call and not a shortcut:** the design corpus records the cache serving referent search as *"a hard prerequisite for the constructor ever nesting"* ([CC3](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order)). A correct recursive read discharges that prerequisite, which **takes the whole `ludicCache` ladder off this plan's critical path** and off P8's. Replacing it with the cache later is a substitution behind a stable interface.
  - [ ] **Done when** the cup on the tray can be named and acted on from the room, with a test that fails against the pre-nesting enumeration.
- [ ] **PV1-3. A `Custom` relation across the boundary, and the port producer it needs.** This is the step that mints the first chain.
  - [ ] Client: a path for `tie <object> to <object>`.
  - [ ] Server: a **port producer** --- the currently unowned piece ([AB-55/AB-62](dataSource/positions/AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only)) --- so a peer relation whose endpoints are in different shards produces a room-side leg and a tray-side leg.
  - [ ] Carry chain membership through the mutation vocabulary: `manipulation/types.ts`'s edge type and the kernel's relational steps cannot express `chainId` today.
  - [ ] **Done when** `tie rope to cup` produces two legs sharing one `chainId`, and both are readable back from storage.
- [ ] **PV1-4. Take the readout.** Run PV1-0's observations against the built vertical and write down what actually happened, including if it is uninteresting.
- [ ] **PV1-5. Write back into the design corpus --- a bounded list, not a sweep.** The `P8-i1-dependent` tag names exactly the rows that owe an update; that set is **one row** today ([EA-10](dataSource/positions/AGENT.edgeAbstractions.planning.md#ea-10)). Scheduling this here rather than afterward is deliberate: a consistency pass run *after* a body of work inherits its debris.
  - [ ] [P8](dataSource/positions/AGENT.abstractionLayers.proposals.planning.md#status-1): record what the readout showed, and whether the rollback trigger fired.
  - [ ] [EA-10](dataSource/positions/AGENT.edgeAbstractions.planning.md#ea-10): the five structure-as-identity sites now have live traffic; say what that changed.
  - [ ] [AB-55/AB-62](dataSource/positions/AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only): the port producer exists; close or re-scope.
  - [ ] [AB-65](dataSource/positions/AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only) (*is an edge a value or an entity?*): report evidence, do not answer it here.
  - [ ] **Done when** each row above is either updated or explicitly recorded as unaffected. **Add no new open rows from this plan.**

## Open decisions (implementation --- plan only)

| # | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **PV-a** | Does dissolving `On` return the object to its previous host, or to the room? | PV1-1 | Open. Needed only for the dissolve half; establish does not depend on it |
| **PV-b** | Is one `chainId` minted per crossing relation at establish time, or assigned by a later explicit operation? | PV1-3 | Open. The design corpus defers *when to mint* to AB-64; **PV-1 needs only a mint that produces a chain**, and may pick the cheaper one and say so |
| **PV-c** | Recursion depth and cycle guard for the naive catalog walk | PV1-2 | Open. Recursive hosting permits nesting; a depth cap plus a visited set is likely enough |

## Verification

- **Ephemera:** `npm --prefix lambda/ephemera run test -- --watchAll=false`. **Run the full suite**, not a filtered subset --- `*.integration.test.ts` files sit outside `tsconfig`, so `tsc` does not cover them.
- **Typecheck:** `npx tsc --noEmit` in `lambda/ephemera`, `packages/mtw-interfaces`, and `packages/mtw-gateways`.
- **Client:** `npm --prefix charcoal-client run test:single` (Vitest; **not** Jest, and `--testPathPattern` does not apply).
- **The vertical itself:** PV1-0's observations, taken by hand in a running client at PV1-4. No unit test substitutes for this --- a passing suite is what the inert prototypes already have.

## When this finishes

Per [`taskPlanning/AGENT.md`](../../AGENT.md): move anything durable into the code-adjacent `AGENT.md` files under [`dataSource/positions/`](../../../lambda/ephemera/dataSource/positions/), then **delete this plan.** PV1-5 is what makes that safe --- the design corpus is updated before the file goes, so nothing lasting is lost with it.
