# Component `ludicGraph` alignment (WML to ephemera parity)

**Status:** Draft, not started --- written to be argued with.

**Restructured 2026-09-20, third framing, and the scope grew deliberately.** The plan began as "give Object and Feature a `_ludicGraph`," then as "do the minimum for nested object affordances." Both were rejected in discussion for the same reason: they would have written an `arity === 1` assumption into WML, a layer that does not have one today, in order to avoid a bounded piece of representation work. **The plan is now an alignment: bring WML's `ludicGraph` to the same type contract ephemera has refined, with the behaviors it enables explicitly unimplemented.** The two superseded framings are recorded under [Where this sits in the arc](#where-this-sits-in-the-arc) so the scope growth reads as a decision rather than as drift.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../AGENT.md).

## Purpose

WML's `ludicGraph` is a narrower shape than ephemera's. It has one edge-union member, no `ports`, no `rootId`, and a node list that cannot represent a presence node. Ephemera's is `{ rootId, nodes, edges?, ports }` with a heterogeneous tagged node array.

Every consequence of that gap is a symptom of one cause:

- `StandardObject` and `StandardFeature` carry no graph at all, so "what is nested inside this thing" cannot cross the wire for them.
- Room grew two flat, wire-only side-channels (`_objects`, `_characters`) that carry membership with its structure discarded.
- **Every projection between the two shapes is lossy, and a lossy projection loses fields silently.** This has already happened once, totally and undetected, for months --- see [Other standing facts](#other-standing-facts).

**Scope in one sentence: make WML's `ludicGraph` the same type contract as ephemera's, migrate the components that use it, and let Object, Feature and Room follow from the aligned shape.**

The downstream consumer that motivates the work --- nested contents on `look <object>` --- is **not** in this plan. It is the payoff, tracked separately, and named here only so the shape is designed against a real reader. Two findings it needs are recorded in [Forwarded findings](#forwarded-findings) so they are not lost.

## Where this sits in the arc

**This plan is the first instance of a recurring shape, not a one-off.** It arrived as a tangent off [`AGENT.ludicCacheRebuild.planning.md`](../../../lambda/ephemera/dataSource/positions/AGENT.ludicCacheRebuild.planning.md) and the nested-affordance work, and it would be easy to file as local cleanup. It is not: the position model was prototyped entirely inside ephemera, and **the general problem is lifting each proven piece of it back into WML so it can cross the wire.** `ludicGraph` is the first lift. There will be others.

Recorded here because this file is deleted when the work lands, and the arc has to outlive it --- see [Slice 6](#recommended-order), which gives it a durable home.

### The lift rule: take the type contract, defer the behavior

**This is the rule the whole plan turns on, and it is not invented here --- it is what the presenceNodes plan already did inside ephemera.** That plan made the shape arity-general *before* anything could mint a second binding:

- [`presenceSubGraph.ts:47`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/presenceSubGraph.ts#L47) --- PN-18: `fullCoverage` "is written at every arity now, not derived from it, so this is a rewrite of that arm, not a behavior change for it." The `presencePortCount <= 1` short-circuit was **deliberately retired**.
- `nodesFromPresenceBinding(graph, presenceUuid)` is binding-grained by parameter; `nodesFromPresenceBindings` unions over a set.
- [`collapseCrossingPorts`](../../../../lambda/ephemera/dataSource/positions/ludicCache/mergeReducer.ts#L182) takes `presenceUuid` explicitly --- "the caller tells this function which of `childGraph`'s own bindings it is folding."
- [`EphemeraLudicCacheSupportHop.presenceBucketIds`](../../../../lambda/ephemera/dataSource/positions/ludicCache/types.ts#L74) is a **list**, justified as "binding-grained, not host-grained."
- The `Enumerated` cover arm is typed and unit-exercised, just not reachable from a real move.

**So `arity === 1` in ephemera is a data fact, not a code assumption.** There is no pile there to unwind. The mass would have been created by us, in this layer, if either earlier framing had shipped.

**The rule, stated for the next lift:** a lift takes the proven layer's **type contract** in full, immediately, and its **behavior** on demand. Unimplemented arms are typed, guarded and unit-exercised in isolation; they are not omitted from the shape. The test for whether something may be deferred is not "does anything need it yet" --- it is *does deferring it write an assumption into a signature or a stored shape.*

### Why the two earlier framings were rejected

Both are recorded because each was argued at length and each has a specific defect worth not repeating.

- **"Object and Feature only."** Leaves Room's three-mechanism membership story in place and leaves every projection lossy. Its real defect: it treats the asymmetry as the problem when the asymmetry is a symptom.
- **"The minimum cut for nested object affordances."** Genuinely small --- roughly half of the old Slice 1, a reduced projection, one lint clause, one client formatter. Its defect is the one that killed it: **it pays for a bounded representation cost by taking on an unbounded signature cost.** A projection with no binding parameter and a node list that cannot hold presence is an `arity === 1` assumption at a call boundary, in the one layer that had none. *Technical debt is not measured by the functional gain foregone; it is measured by how much harder later steps become.*

### Readiness is per-layer, not per-phase

**There is no moment at which "ephemera is done" and lifting begins.** Presence, edge abstractions, abstraction layers and attention history all have live design plans right now. The stack **stratified**, and the layers differ sharply in how liftable they are:

| Layer | State in ephemera | Liftable? |
| --- | --- | --- |
| `ludicGraph` --- nodes, edges, ports, `rootId` | Shipped and stable; the shape has not moved since ports became structured values | **Yes, now.** This plan. |
| Presence nodes --- the node exists, `cover` is a field | Shipped as *structure*; unbuilt as *behavior*. Every binding is minted `Full`, nothing computes an enumerated cover, descent does not exist ([`AGENT.presence.planning.md`](../../../lambda/ephemera/dataSource/positions/AGENT.presence.planning.md)) | **Yes, as shape.** Which is what the lift rule asks for. |
| `ludicCache` | **Prototype tier by explicit election**; D9 (leg-vs-chain typing) is open, and the rebuild plan says settle it before persisting | **No.** Do not lift a shape that is still being argued. |

**Use the gradient as the ordering rule.** Lift a layer when *it* settles, rather than waiting on the subsystem. A layer that is shipped-as-structure but unbuilt-as-behavior is exactly the lift rule's case: take the shape, say out loud that the behavior did not come with it.

### The wire-lift and author-lift fork

WML is the authoring format and the wire format at once, and **the two halves of any lift have very different costs**:

- **Wire-lift is cheap.** Components are mode-blind, the wire carries plain WML text, and the projection is server-side.
- **Author-lift is expensive.** It drags in asset-stack merge, identity across cache runs, retraction. **Both of this plan's hard rows live entirely on this side:** LG-6 (does authoring express presence?) and LG-7 (authored objects and recache).

**The seam between them already exists and is already tested:** [`assetWirePolicy.ts`](../../../../packages/mtw-wml/ts/standardize/assetWirePolicy.ts) is the mechanism for *this field crosses the wire but is not authorable yet*. So the expensive half is deferrable **per structure**, not as one gate.

**This is what keeps the alignment bounded.** Aligning the type contract makes presence *representable* in WML; it does not make it *authored*. Type permits, lint forbids. LG-6 and LG-7 both stay deferred behind clauses in the same function --- see [Why merge does not force LG-6](#why-merge-does-not-force-lg-6), which is the check that establishes this rather than assuming it.

### Relationship to `ludicCacheRebuild`

**The two plans do not block each other, which is worth stating because it looks like they should.** This plan projects from the **stored** payload --- `Meta::<Kind>.ludicGraph` --- not from `ludicCache`. D9 is a question about cache-*edge* typing. Different structure; this plan works against a shape that is not in flux, and `ludicCacheRebuild`'s Slice 6 can land before, after, or during without interaction.

**The coupling is deferred, not absent.** If nested-affordance *display* eventually wants attention-scoped depth --- an unopened box contributing only a handle --- that is `ludicCache`'s job, and this plan disclaims it (see the note under [Open decisions](#open-decisions-implementation-----plan-only)).

## Getting Started

1. **Read the orientation first:** [`lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md). It is the present-tense map of the play-time model. In particular sections 1 (sharding), 2 (ports and legs) and 5 (`ludicCache`) --- **the distinction between a `ludicGraph` shard and the `ludicCache` is the single easiest thing to get wrong here**, and getting it wrong invents visibility problems that sharding already solves.
2. **Then the target shape:** [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), `EphemeraLudicGraphData` at `:660` onward, then the terminal and port block. **This is what WML is being aligned to**, so read it as a specification rather than as background. `EphemeraMetaObject.ludicGraph` and `EphemeraMetaFeature.ludicGraph` already exist (MK2/MK3).
3. **Then the ephemera class:** [`positions/ludicGraph/index.ts`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts) --- specifically `_nodes` (`:116`), the `presenceNodes` derived getter (`:252`), and `_playOnlyEdges` (`:118`). The accessor-as-tag-filter idiom is the thing being copied.
4. **Then the current WML shape:** [`components/ludicGraph.ts`](../../../../packages/mtw-wml/ts/standardize/components/ludicGraph.ts) and [`dataTypes/ludicGraph.ts`](../../../../packages/mtw-wml/ts/standardize/components/dataTypes/ludicGraph.ts). **Then read [The two representational traps](#the-two-representational-traps) before concluding anything about how far apart they are** --- the field names line up better than the contents do, in both directions.
5. **Testing doc:** this package has no `AGENT.development.md`; command authority is the package `package.json` (`"test": "jest"`). For the ephemera side, [`lambda/ephemera/dataSource/perception/AGENT.development.md`](../../../../lambda/ephemera/dataSource/perception/AGENT.development.md) is authoritative over anything written here.
6. **Baseline before edits** (should pass):

   ```bash
   cd packages/mtw-wml && npm run test -- --watchAll=false ts/standardize/
   ```

## What exists today

### The authoring and play graphs are one structure, not two

The stored and authoring `ludicGraph` are **the same structure at different stages of build-out** --- not a rival design:

| | Stored (play) | Authoring (WML) |
| --- | --- | --- |
| Type | `EphemeraLudicGraphFieldPayload` | `StandardLudicGraphData` |
| Shape | `{ rootId, nodes, edges?, ports }` | `{ nodes?, edges? }` |
| Nodes | one tagged array: five component kinds **+ `Presence`** | `ReferenceListData` --- component *references* only |
| Edges | relational kinds (`In`, `On`, `PartOf`, `Under`, `Against`, `Custom`) | `Exit` --- **"the first edge union member"** |
| `rootId` | recorded, never derived | absent |
| `ports` | yes | absent |

[`AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) states the extension point directly: the edge list is "tagged union ready," its section is headed **"v1 member: Exit edge,"** and `edgeFactory.ts` / `edgeListFactory.ts` are generic. Adding relation kinds is **taking a designed extension point**, not bridging two incompatible graphs.

**Contents differ by host kind; structure does not.** Area authors exits in `edges`; Room authors features in `nodes` (which is what the Workbench's [`roomFeaturesListAccessor`](../../../../charcoal-client/src/components/Workbench/RoomEdit/roomReferenceListAccessors.ts#L37) reads); Object and Feature author nothing today.

### The two representational traps

**Both rows of the table above where the field names match are traps. Neither gap is a widening; both are decisions.** These are the subject of Slice 0, and nothing else should start before they are settled.

**Trap 1 --- WML's `nodes` is doing two jobs (LG-8).** Ephemera's `_nodes` is purely a membership list; `presenceNodes`, `objectIds` and `characterIds` are all derived tag filters over it ([`index.ts:252`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts#L252), [`:221`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts#L221)). WML's `nodes` is a `ReferenceList` of `StandardReferenceData` --- `{ key?, universalKey?, tag: ComponentTag, ref? }`, a **pointer to a component with no payload** --- and [`area.ts:201-204`](../../../../packages/mtw-wml/ts/standardize/components/area.ts#L201-L204) emits every entry into `referenceKeys` as both a `Direct` and a `Dependency` reference. **The node list is implicitly an asset dependency declaration.**

A presence node references no component --- `PRESENCE#<uuid>` is not a component, and `ComponentTag` is `Exclude<SchemaWithKey["tag"], 'Asset' | 'Story'>`, which cannot name it. So it cannot go into that list as-is without poisoning dependency resolution. Adding presence to WML is a **representation change, not a new tag**.

### The root node inverts an existing guard

**Found 2026-09-20 while settling LG-8, and it is the sharpest single consequence of parity.**

Ephemera's graph is *rooted at its own host*: `rootId === hostId` for a host-bound graph, and the root node is **present in `nodes`** ([`AGENT.concepts.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) --- "the host's own node as **root**, its member **nodes**"; [`ephemeraMeta.ts:662`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts#L662) --- "present in `nodes`").

WML currently **forbids exactly that by exception.** [`area.ts:90-100`](../../../../packages/mtw-wml/ts/standardize/components/area.ts#L90-L100)'s `assertNoSelfAreaReference`, called from `fromJSON`, throws `Area cannot reference itself in ludicGraph.nodes`.

So aligning is not "add `rootId` alongside the existing rules." **The guard inverts**: from *the host must not appear in its own node list* to *the host is the root and is present in it.* Two things follow, and both are easy to miss:

- **`referenceKeys` must exclude the root**, or every component acquires a dependency on itself and dependency ordering breaks. This is the "non-root" clause in LG-8's decision, and it is not a refinement --- it is what keeps asset compilation correct.
- **The guard is not simply deleted.** Its replacement asserts the positive invariant (`rootId` is present in `nodes`, and equals the component's own identity), so the case it was written to catch stays caught, inverted rather than abandoned.

**Trap 2 --- the two `edges` fields share a name and are not the same list (LG-9).** WML's `edges` holds `Exit` edges. The **stored payload's** `edges` holds relational edges only --- Exit edges are not in `EphemeraLudicGraphFieldPayload` at all; they live in a separate in-memory `_playOnlyEdges` field ([`index.ts:118`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts#L118)). So the naive read, that WML's `edges` is a subset of the stored `edges`, is false.

**But the split is about persistence, not about semantics --- which is what makes LG-9 answerable.** [`extractPlayOnlyEdges`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts#L94) takes a **WML-shaped envelope whose single `edges` list already carries both kinds** and separates them by discriminating each entry (`isEphemeraLudicRelationalEdgeData`, else `new StandardExitEdge`). One mixed WML list is therefore already the shape ephemera consumes and splits; the split exists downstream because relational edges persist in `Meta::*.ludicGraph.edges` and Exit edges do not.

### Edge kinds (LG-9)

**An Exit is an edge in exactly the sense a relational edge is.** [`AGENT.concepts.md`'s fractal ladder](../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#fractal-ludic-graphs-container-scale-and-edges) puts the same node+edge pattern at every scale:

```text
Area.ludicGraph            Room.ludicGraph          Container graph
  rooms, macro edges   ->   characters          ->   inventory / nested objects
  Exit, bearing, ...        in-room edges            In, On, ...
```

So one `edges` list, over these kinds:

| Group | Relates | Payload | Kinds |
| --- | --- | --- | --- |
| **Topology** | **places** (Area scale) | `from`, `to`, per-direction labels (`forward` / `back`) | **`Navigation`** (today's `<Exit>`) and `Bearing` --- concepts.md's *"non-traversable spatial facts (e.g. 'north of' without a door)"* |
| **Membership** | **things**, hosted | `from`, `to`, `kind`, `edgeId?`, `chainId?` | `In`, `On`, `PartOf` |
| **Peer** | **things**, side by side | same, plus `relationLabel` on `Custom` | `Under`, `Against`, `Custom` |

**The one decision here: `kind` is the stored discriminant, and no `category` field restates it.** A stored field that duplicates what `kind` already says is state that can disagree with itself.

**Naming sub-unions over those kinds is free, and worth doing.** `MembershipEdge`, `PeerEdge`, `TopologyEdge` composing into one edge type is a readability choice with no serialization consequence and no semantic commitment --- name them however reads best at the call sites. The table's grouping is exactly that: a name for a set, not a claim.

**One caution.** Do not infer provenance from a group name. A runtime-minted exit is a Topology edge minted as improvisation; origin lives in the asset dimension (`ASSET#IMPROVISATION`), not on the edge.

**Two corrections to earlier drafts of this plan, kept because both are facts about live code that a reader may otherwise get wrong:**

- **Hosting-kind edges *are* written**, by two paths: a move op's `containment?: 'On' | 'In' | 'PartOf'` compiles to an `establishRelation` step ([`compilePositionKernelOp.ts:116-123`](../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/compile/compilePositionKernelOp.ts#L116)), and [`containmentPopulationSteps`](../../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts) writes a `PartOf` edge at cache time. `AGENT.edges.md`'s *"there is no operation that 'establishes `On`'"* means there is no user-facing **command** for it --- it arrives as a rehost argument --- not that no edge exists. The ingress lane's `nestingDefer` ([`relationKind.ts`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/relationKind.ts)) refuses to parse a containment *phrase* into a relation command, which is narrower than it looks.
- **Membership is three facts, carried by three mechanisms:** node placement says *that* a thing is hosted, a hosting-kind edge says *how*, a presence node says *which binding* and with what cover. `containmentPopulationSteps` writes all three with independent idempotency checks, precisely because they can fall out of step.

### Why merge does not force LG-6

**Checked 2026-09-20. Still load-bearing now that [LG-6 is decided](#authored-nesting-implies-presence-----and-that-is-the-fork-lg-6), because it is what makes that decision safe to rely on:** ephemera's cache-time path is the single writer of presence, and this section is why WML cannot become a second one by accident. If WML graph merge ever saw a presence node, presence merge semantics would become live and the two minters could diverge. It does not.

- **Stored graphs never enter a WML component.** [`ludicGraphCache.ts:42-48`](../../../../lambda/ephemera/internalCache/ludicGraphCache.ts#L42-L48) uses `fromFieldPayload`/`toStored`, the ephemera-native lossless pair that `commitStepSequence` reads and writes through. The WML-mediated pair was **deleted** in the 2026-09-03 fix.
- **`StandardRoom.merge` does merge `_ludicGraph`** ([`room.ts:336`](../../../../packages/mtw-wml/ts/standardize/components/room.ts#L336)) and runs inside ephemera via [`mergeRoomAcrossStack`](../../../../lambda/ephemera/dataSource/state/mergeComponentsAcrossStack.ts#L50) --- but over **authored** rooms across the asset stack, never over runtime state.
- **[`affordanceRoomDeliverable`](../../../../lambda/ephemera/internalCache/affordanceRoomDeliverable.ts#L93) keeps them apart by construction:** it fetches the ephemera `ludicGraph` and the merged room *in parallel*, takes membership from `ludicGraph.objectIds`, and uses `mergedRoom` only for `shortName`. The two never meet inside a merge.

**So WML graph merge sees authored content exclusively, and the lint is what keeps presence out of authored content.** This is a **condition, not an observation**: the presence-not-authorable clause must ship in the same change as the type widening (Slice 2). If that clause slips, LG-6 goes live.

### Presence on the wire

**Decided (LG-5). Presence nodes are part of the aligned type**, so they cross by default rather than by a projection choice. The projection **sub-graphs by binding** --- cut the host's graph to one binding's bucket --- using the shipped [`nodesFromPresenceBinding`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/presenceSubGraph.ts) and `subGraphFromNodes`, called with a real binding parameter.

- **In practice each message carries exactly one presence node with a `Full` cover.** Every binding is minted `Full` today and no writer computes an enumerated cover, so the cut is currently a no-op. **Per the lift rule this changes nothing about the shape or the signature.**
- **`Full` is legal on the wire.** `ludicCache` forbids `Full` on a folded presence node because "every node of the host" has no referent in a merge. That rule is scoped to the cache and **must not** be imported into the wire projection or its validators.
- **A reader deriving "what is in here" must filter by tag.** The node list is heterogeneous; taking it whole is a bug. Note that a host's own graph carries *its own* presence node (describing its binding to its parent), so an unfiltered contents list would include the container's binding as an item inside the container.
- **The payoff arrives with the mechanism.** Sub-graphing by binding is exactly how "the part of the rope that is *here*" is expressed: viewing `OBJECT#Rope` from the Lab yields `EndA` and not `EndB`, with no special-casing. Worth a test even while every real cover is `Full`.

### Two projections, not one

"What does the player see" is **already** a projection, and it is not the flattening kind. Keeping the two apart is an organising idea of this plan:

| | **Scoping projection** | **Display projection** |
| --- | --- | --- |
| From -> to | ludicNetwork (an ensemble of shards) -> individual `ludicGraph`s, presence-limited and sub-graphed | a subgraph -> a contents line, links, prose |
| Decides | what the player may **know** | how it is **drawn** |
| Must run | server-side | client-side |
| Shape | graph -> **graph** (a subgraph of a graph is a graph) | graph -> presentation |
| Status | `ludicCache`'s job; attention-scoped depth is its clause 2; not yet wired to delivery | today's `roomHeaderPhaseC.ts` formatter |

**`objects` collapses the two.** It performs display formatting at the layer that should only be scoping, which is why it cannot express relations --- and the scoping it does perform is degenerate: one level, no bindings, no attention. The knowledge-control argument for keeping a server-side projection is real but is satisfied *entirely* by the scoping projection; it is not an argument for flattening.

**Consequence, now stronger than when this section was written.** Under alignment the stored-to-wire projection is **total**: same shape in, same shape out, minus only what the binding cut removes. There is no narrowing step, so there is no field to lose.

### Authored nesting implies presence --- and that is the fork (LG-6)

**Read this section's verdict first: Design A is not a proposal, it is shipped --- discovered 2026-09-20, after the fork below was written.** [`containmentPopulationSteps.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts) is *"the pure step-computer for **cache-time containment authoring** (Room-in-Area, **Feature-in-Room**, Feature-in-Feature)"* --- exactly this row's case --- and it **already mints the presence binding**, guarded by a check for an existing presence node with `fromHostId === parentId`. Ephemera derives presence from authored nesting, at cache time, with the contract in [`AGENT.contract.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md)'s `Component Updated` ingress section.

**Two facts that come with it:**

- **Authored nesting produces `PartOf`, always.** *"Always `PartOf`, never `In` (2026-09-05): Room-in-Area and Feature-in-Room/Feature are fixed/authored nestings, not the mobile placement `In` is for."*
- **It emits three separate steps, not one.** Node membership, containment edge, and presence binding, each with its **own** idempotency check, *"because a cache rerun can land in any partially-populated state."* Membership, how-it-is-hosted, and which-binding are three facts; nothing collapses into anything.

**What remains genuinely open** is narrower than the fork below: whether WML should be *able* to express presence directly (Design B), not whether something derives it today. The lint clause in Slice 2 is what keeps that question shut, and the rest of this section is the argument for leaving it shut.

---

`<Room uuid=(A)><Feature uuid=(C) /></Room>` means C is member-hosted in A, which under the aligned model **implies a presence node on C's graph** with `fromHostId: ROOM#A`. Author the same C under Room B as well and that is a **second binding** --- so if *authoring* minted presence, the questions the presence design deferred (enumerated covers, inherited arity, descent) would arrive in **WML and asset-stack merge** rather than in ephemera.

**The concrete hazard if authoring mints presence.** Presence nodes are keyed `PRESENCE#<uuid>` and `ReferenceList` merge dedupes by target reference. Two assets that both nest C in Room A --- exactly what an asset stack is *for* --- would mint two different uuids and merge to **arity 2**, when the correct answer is one binding. Stable identity derived from `(hostedThing, fromHostId)` would dedupe; a minted uuid cannot. Any Design B below has to answer this before anything else.

**There is a precedent, but it is a derivation step, not a representation split.** The wire carries **plain WML text**, parsed by the same parser in both directions. `standardizeMode` is **not** a parse or JSON difference: [`wmlStandardizeMode.ts`](../../../../packages/mtw-wml/ts/standardize/wmlStandardizeMode.ts) states that **components are mode-blind** --- they always parse the wire tags they understand --- and the mode gates exactly one thing, a `validateAssetWirePolicy()` call inside `StandardForm.validate()` when the mode is `asset` ([`index.ts:713-716`](../../../../packages/mtw-wml/ts/standardize/index.ts#L713-L716)). Freestanding components (ephemera merge, gateways) sit **outside that boundary entirely**. So the asset-mode prohibitions are a **lint over asset blueprints**, not an invariant and not a second format.

The load-bearing precedent is therefore the *other* half of the `exits` story: **Area authors the edges; [`projectRoomExits`](../../../../packages/mtw-wml/ts/standardize/projection/projectRoomExits.ts) derives Room's wire facet at runtime.** The analogue is that assets author **nesting** and something downstream derives **presence**.

So the fork:

| | **Design A --- derived presence** | **Design B --- authored presence** |
| --- | --- | --- |
| Assets express | nesting only | nesting **and** presence |
| Presence derived by | ephemera --- at rehost, **and at cache time by `containmentPopulationSteps`** | asset-stack merge |
| Cover / arity / descent | stay in ephemera, unchanged | become WML problems now |
| Precedent | `projectRoomExits` (derivation) --- **and, decisively, the shipped cache-time path above** | none |
| Asset-mode lint | keep the presence clause permanently | remove the presence clause |

**The merge-identity hazard does not disappear under Design A --- it relocates.** Two assets nesting C in Room A still have to produce one binding rather than two; Design A just makes that the derivation's problem, at spawn, where the presence single-write-path already lives. That is the natural home, not an escape.

**There is a worked example of the solution in this same plan, found 2026-09-20 while settling LG-10.** Topology edges face the identical question --- two assets authoring an exit between the same two rooms --- and **it is already solved, by an author-provided stable key.** Both assets write `<Exit uuid=(highwayToTown)>`, uuid-keyed merge yields one edge, and one `edgeId` follows. The contrast is exact: presence fails here *because* `PRESENCE#<uuid>` is **minted at merge** rather than authored, and a minted key cannot dedupe. **So the general shape of the answer looks like *author-provided or deterministically-derived stable keys, never mint-at-merge*** --- which is an argument for Design A's `(hostedThing, fromHostId)` derivation and applies equally to LG-7. Recorded as evidence, not as a decision: Topology edges get their key from an author, and presence has no author to get one from, so the analogy constrains the answer without supplying it.

**Re-graded twice on 2026-09-20.** First from blocker to non-blocker: it gated the old Slices 1 and 2 when the question was whether presence belonged in the wire shape at all, and alignment answers that structurally (presence is in the type because it is in ephemera's type), with [Why merge does not force LG-6](#why-merge-does-not-force-lg-6) establishing that nothing in WML's merge paths can see a presence node while the lint holds. **Then from Open to Decided**, on finding the shipped cache-time derivation described at the head of this section --- the fork was being argued as though neither side existed, when one side is running in production.

### Authored objects and recache stateliness (LG-7)

**Deferred, with a `not yet` gate --- not a prohibition.** Authoring objects into rooms is wanted eventually; it is out of scope for the Coyote Game and expensive to do correctly.

**The eventual challenge:** if an asset authors a table into a room, players take the table, and the asset is re-cached, is a second table generated? Declarative authoring against mutated runtime state.

**This plan does not force it.** Objects today are **runtime improvisational** --- `(OBJECT#, ASSET#IMPROVISATION)` pair rows spawned at play time ([`objects/AGENT.md`](../../../../lambda/ephemera/dataSource/objects/AGENT.md)), never authored in an asset. Nothing in [`lambda/assets/`](../../../../lambda/assets/) reads a Room's authored graph to create objects; its only `ludicGraph` read is Area topology for exit diffing. This plan changes the **representation of runtime membership**, not the authoring of objects. The stateliness question stays shut because the spawn mechanism does not exist, not because a type forbids it.

**Why Features are safe and Objects are not.** A feature is **static** --- never moved, never the subject of a peer relation ([`AGENT.ludicNetwork.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) section 1). Recache stateliness only bites for things that can *move*, so authored Features carry no such risk and Object is the only movable authored thing in prospect.

**The adjacency to watch, and it is real.** `Object` is **already** an admissible node reference in a Room's authored graph, and nothing lints it --- it is simply inert. This plan makes Room's authored graph considerably more load-bearing, which makes that inert door more inviting. Meanwhile **Slice 5 deletes the `objects` clause from [`assetWirePolicy.ts`](../../../../packages/mtw-wml/ts/standardize/assetWirePolicy.ts)**, which is today the only written signal that authored objects-in-rooms are not wanted.

**So: keep a gate, but a `not yet` one, never a `no`.** Authoring objects into rooms is **wanted and expected eventually** --- it is simply not needed for the Coyote Game, and it is not cheap. A blanket prohibition would be read by a later contributor as a settled design position and cited as one; that is the failure this gate has to avoid even more than it has to avoid a premature implementation.

The replacement clause **blocks with a forward-looking message**, wording to the effect of: *authored objects in rooms are intended but unbuilt --- blocked pending recache reconciliation, see <durable doc>.* Two properties are load-bearing:

- **It states the intent, not just the refusal.** Someone who hits it should learn that the feature is coming and what it is waiting on.
- **It points at a durable home, not at this plan.** This file gets deleted; a lint pointing into `taskPlanning/` is a dangling pointer and a named anti-pattern. **The doc entry and the clause ship in the same slice** (Slice 2), doc first, so the ordering cannot slip across a slice boundary.

**What makes it complicated, so the gate is not just a vibe:**

- **Identity across cache runs.** Is the authored table the same table after a recache? `<Object uuid=(...)>` gives a stable handle, so this is likely tractable --- but it is the hinge everything else hangs on.
- **Reconciliation against mutation.** A player took the table; it exists, elsewhere. Another player moved it. Someone destroyed it. Recache has to distinguish "absent because never created" from "absent because the world moved on."
- **Retraction semantics.** If the asset stops authoring the table, does it vanish from the inventory of a player holding it?
- **Asset-stack merge.** Two assets authoring the same object into the same room --- the same identity-under-merge question as LG-6, again. **But note the worked example under LG-6:** Topology edges solve this with an **author-provided stable key** (`<Exit uuid=(...)>` merges to one edge). An authored object would likewise carry `<Object uuid=(...)>`, so this clause may be the *easiest* of the five rather than the hardest --- it is the identity-across-*recache* question, not identity-across-*merge*, that has no such handle.
- **Nearest existing machinery --- repointed 2026-09-20.** Start at [`containmentPopulationSteps.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts), **not** `topologyDiff.ts`. It solves the recache-idempotency half of this problem already, and for the same reason: *"`cacheAsset` reruns frequently over state that already reflects a prior write,"* met by **checking current state per-step** rather than relying on the reducer to absorb a replay, with three independent checks *"because a cache rerun can land in any partially-populated state."* That is the shape an authored-object path needs. **What it does not solve is the hard half:** its subjects are Rooms and Features, which never move, so "absent" is unambiguous. An object can be absent because a player took it --- reconciliation against mutation is still unaddressed anywhere. [`topologyDiff.ts`](../../../../lambda/assets/componentTopology/topologyDiff.ts) remains worth reading for authored-vs-existing diffing, but it is the weaker of the two starting points.

**Interaction with LG-6.** Authored presence on a movable thing is this same problem wearing a different hat --- a further argument for Design A, and a reason not to settle LG-6 without settling this.

### Other standing facts

- **The projection hazard is real and has bitten once --- and it dropped more than `ports`.** `ludicGraphCache`'s serde pair was `fromPlayEnvelope`/`toPlayEnvelope` until 2026-09-03; it projected through the authored WML shape and dropped **`ports`, `rootId`, and Room/Feature/Area nodes** on every read *and* every `set`, silently and totally ([`ludicGraphCache.ts:42-48`](../../../../lambda/ephemera/internalCache/ludicGraphCache.ts#L42-L48); [`AGENT.concepts.md`'s correction note](../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md)). **Every one of those losses is a gap this plan closes** --- which is not a coincidence, it is the same gap seen from the other side. That file's own verdict: *"An authoring-shaped type on the operational read path is the defect, not the design."* Retiring the whole hazard class is the strongest argument for this plan.
- **A new hazard this plan creates, and the reason to write it down.** Once WML's shape equals ephemera's, a WML-mediated serde for stored graphs would no longer be *lossy* --- which makes reintroducing one **tempting** rather than obviously wrong. It would still be pointless: `fromFieldPayload`/`toStored` is already lossless and direct, and routing through WML adds a translation for nothing. The 2026-09-03 scar is the reason to say this explicitly rather than trust that it is self-evident. Slice 6 lands it.
- No play-side compose writes `ludicGraph` onto a wire row anywhere today. Every current client read of `ludicGraph` is Workbench authoring.
- Room's membership therefore reaches players through `objects` (projected from `Meta::Room.ludicGraph.objectIds`, flattened) and `characters` (from the room **roster**, not the graph at all) --- two derivations, two sources, no shared mechanism. This is Slice 5.

### Forwarded findings

**Found while scoping the nested-affordance capability. Neither is this plan's work; both would be lost if not written down.**

- **The object render channel has no invalidation on membership change.** When an object moves into or out of `OBJECT#A`, nothing refreshes A's render channel: the only affordance consumer of `Object Moved` runs through [`roomsAffectedByObjectMoved.ts`](../../../../lambda/ephemera/dataSource/affordanceOrchestration/roomsAffectedByObjectMoved.ts), which filters both `froms` and `to` through `isEphemeraRoomId` and so yields `[]` for an Object host. **A nested-contents display built on this plan's wire would be correct on first look and silently stale after.** This is an ephemera orchestration gap; it belongs to the capability, not here.
- **The object look path already builds a wire row.** [`objectRenderWmlFromCacheRecord.ts:42-52`](../../../../lambda/ephemera/dataSource/perception/objectRenderWmlFromCacheRecord.ts#L42-L52) constructs a `StandardObjectData` and serialises it with `standardizeMode: 'ephemeraWire'`. The capability's wire change is adding a `ludicGraph` key there --- it does **not** need a new delivery channel. Recorded so the capability is not over-scoped.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **LG-8** | **Is WML's `ludicGraph.nodes` a dependency declaration or a membership list?** Today it is both by accident: a `ReferenceList` whose every entry is emitted into `referenceKeys` as `Direct` **and** `Dependency` ([`area.ts:201-204`](../../../../packages/mtw-wml/ts/standardize/components/area.ts#L201-L204)). Presence nodes reference no component and cannot enter it. See [The two representational traps](#the-two-representational-traps). | --- | **Decided (2026-09-20): membership list, with dependency derived.** `nodes` becomes a tagged union mirroring ephemera's `_nodes`. **`referenceKeys` derives from it by filtering to the non-root component nodes** --- presence nodes are excluded because they reference no component, and the root is excluded because it is the host itself. Full parity: the projection reshapes nothing. Consequences, all real work: Area and Room migrate, LG-4 is answered, and the self-reference guard **inverts** (see [The root node inverts an existing guard](#the-root-node-inverts-an-existing-guard)). |
| **LG-9** | **How does WML's `edges` align, given the stored `edges` is relational-only?** See [Edge kinds](#edge-kinds-lg-9). | --- | **Decided (2026-09-20): one `edges` list over Topology (`Navigation`, `Bearing`), Membership (`In`, `On`, `PartOf`) and Peer (`Under`, `Against`, `Custom`) kinds.** `kind` is the stored discriminant; **no `category` field restates it.** Named sub-unions over those kinds are a free readability choice, not a design commitment. A **new** heterogeneous `EdgeList` type is required --- [`AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) says outright *"do not overload `ExitEdgeList` with mixed tags."* **The WML surface tag `<Exit>` does not change**; it parses to `kind: 'Navigation'`. |
| **LG-10** | **Which identity scheme does a heterogeneous `edges` list store?** [`AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) required this explicitly --- *"A heterogeneous `EdgeList` must decide which scheme it stores rather than assuming `uuid` covers both."* | 1 | **Decided (2026-09-20): the authored `uuid` *is* the `edgeId`. Not two schemes --- one slot that was never filled.** [`ephemeraMeta.ts:534-539`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts#L534) is the authority: `edgeId` is *"an optional label an edge may carry, and nothing more (EA-8). **No constructor mints one, and no comparison consults one**"* --- an opaque stable label for the relationship, endpoint-independent. Exit's `uuid` is the same notion: *"merge/diff/edit identity ... not the `(from, to)` pair,"* surviving endpoint `Replace`. **So an authored Topology edge becomes `edgeId`'s first real minter.** `chainId` stays orthogonal --- one route realizing the relationship, consulted by `edgesMatch` ahead of structure. *(A superseded framing claimed `edgeId` was endpoint-constituted and therefore orthogonal to `uuid`; that misread `AGENT.edges.md`'s appositive gloss as a derivation rule.)* **Slice 0 portal sub-question --- resolved 2026-09-20: the reconfiguration makes multi-leg portal exits representable; no constructor mints one yet.** Under the aligned type, `chainId`/`edgeId` sit on the shared edge base (LG-9's one-list design), so a portal decomposed into two `Navigation` legs sharing a `chainId`, meeting at a crossing port, is exactly as valid as it is for a Membership/Peer edge --- the type doesn't distinguish Topology as a special case. Nothing mints this today: no producer chops a portal into legs, and none is proposed in this plan. This is the lift rule applied to LG-10, not a new argument --- matching presence's `Enumerated` cover, typed and unit-exercised while every real binding stays `Full`. (The first framing of this answer argued from what no code implements today rather than from the type; that is exactly the mistake [the lift rule](#the-lift-rule-take-the-type-contract-defer-the-behavior) exists to prevent, and it was corrected before landing here.) |
| **LG-1** | **Which union members and fields does the wire carry?** | --- | **Decided (2026-09-20): all of them --- full parity.** Dissolved by the alignment. The wire carries the graph type, scoping decides content rather than shape, and `rootId` is carried rather than inferred because parity is the point and inference is a narrowing. *(Three superseded framings: reuse-widen-or-fork; which members to defer; whether `rootId` is residual.)* |
| **LG-4** | Room's `_ludicGraph.nodes` currently means *features* to the Workbench ([`roomFeaturesListAccessor`](../../../../charcoal-client/src/components/Workbench/RoomEdit/roomReferenceListAccessors.ts#L37)). Does the accessor need a tag filter? | 1 | **Decided (2026-09-20) by LG-8: yes --- one field, tag-filtered.** Authoring and play membership share `nodes`; the accessor filters to `Feature`-tagged entries. **It must also exclude the root**, for the same reason `referenceKeys` does. The node list becomes heterogeneous the moment the type changes, so this lands **in Slice 1**, not as later cleanup --- the Workbench breaks at the same commit or it breaks silently. |
| **LG-5** | Do presence nodes cross to the wire? | --- | **Decided (2026-09-20): yes, structurally.** They are part of the aligned type rather than a projection choice. The projection sub-graphs by binding, so in practice a message carries one presence node with a `Full` cover. See [Presence on the wire](#presence-on-the-wire). |
| **LG-6** | **Does authoring express presence, or does ephemera derive it?** See [Authored nesting implies presence](#authored-nesting-implies-presence-----and-that-is-the-fork-lg-6). | --- | **Decided (2026-09-20): ephemera derives it --- Design A, and it is already shipped.** [`containmentPopulationSteps.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts) does cache-time containment authoring for **Feature-in-Room** (and Room-in-Area, Feature-in-Feature), minting node membership, a `PartOf` containment edge and the presence binding as three separately-idempotent steps. Authored nesting yields **`PartOf`, never `In`**. **The obligation this creates:** Slice 2's lint clause keeps presence unauthorable, so WML never competes with that path --- if the clause slips, the two mint independently and the arity-2 hazard below becomes real. *(Superseded framing: argued as an open fork between two designs, when one was in production. Caught by checking whether hosting relations are written at all.)* |
| **LG-7** | **Do authored objects become expressible, and what happens on recache?** | 5 | **Deferred (2026-09-20) behind a `not yet` gate.** Not forced by this plan --- objects are runtime improvisational and no cache-time path spawns them from authored content. Authored objects **are wanted eventually**; the gate must say so, must point at a durable doc rather than this file, and must not read as a design position. See [Authored objects and recache stateliness](#authored-objects-and-recache-stateliness-lg-7). |
| **LG-2** | Does Room's `_objects` get replaced, kept, or shimmed? | 5 | **Decided (2026-09-20): replaced --- it is a retirement, not a migration.** Confirmed with the author: `objects` began as a **list of shortName strings** and has accreted `StandardComponent` scaffolding in place ever since. `{ uuid, shortName }` is a string list that grew a uuid. There is no principled reason for the flatness, so nothing needs preserving across the change --- only sequencing (see Slice 5). |
| **LG-3** | `_characters` comes from the roster, not the graph, and the graph *also* holds `CHARACTER#` nodes. | --- | **Decided (2026-09-20): out of scope, forwarded.** A two-sources-of-truth problem with its own evidence ([`roomOccupancyDriftSweep`](../../../../lambda/diagnostics/roomOccupancyDriftSweep/classification.ts), whose named failure mode is "ghost on graph"); resolving it means deciding whether roster or graph is authoritative --- an ephemera question, not a WML one. Do **not** fold it into Slice 5. |

Not decisions, recorded so they are not mistaken for them:

- **Attention-scoped depth** (an unopened box contributing only a handle) is `ludicCache`'s job, not this plan's --- `AGENT.ludicNetwork.md` section 5, clause 2.
- **Apprehension scale** is declared, not derived, and not yet modelled anywhere.
- **Both forwarded findings** above. They are the capability's work.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark each nested line `[X]` as it is done, so partial progress is visible.

**Slice 0 decides the shape of every slice after it. Do not start Slice 1 with LG-8 open.**

- [X] **Slice 0 --- the portal sub-question, and survey before building.** No code. **LG-4, LG-8, LG-9 and LG-10 are all decided; no whole row is open.** What remains is one sub-question and one measurement.
  - [X] **LG-10's portal sub-question.** Resolved above in the LG-10 row: the reconfiguration makes a multi-leg portal representable (`chainId`/`edgeId` are base fields, not scoped to Membership/Peer); no constructor mints one, and none is proposed here.
  - [X] **Survey `referenceKeys` consumers.** Done: only [`schemaOrganization.ts:355-357`](../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts#L355) (`_getParentChildEdges`, feeding `_buildComponentGraph`'s `topologicalSort` --- the real asset-compilation-ordering consumer) does structural work with `referenceType`, and it already filters to `'Direct' | 'Position' | 'Facet'`, silently ignoring `Dependency`. `StandardForm.referencedBy()` and the diff-repair pass are unfiltered (dedup by `sameKey`, so doubling is harmless there); the cascade/subset traversal's `connectionType` filter has no production caller passing `'Dependency'`. **New finding:** Area emits both `Direct` and `Dependency` for every node ([`area.ts:200-202`](../../../../packages/mtw-wml/ts/standardize/components/area.ts#L200-L202)); Room emits `Direct` only for the same concept ([`room.ts:460`](../../../../packages/mtw-wml/ts/standardize/components/room.ts#L460)). Since nothing consumes `Dependency` today, Slice 1 can most likely emit `Direct` only for non-root component nodes (matching Room), dropping the inert duplicate --- confirm no dynamic cascade construction depends on it first. No consumer of `referencedKeys()` exists outside `packages/mtw-wml/ts/standardize/`.
  - [X] Deliverable: the target `StandardLudicGraphData`, field by field, mirroring `EphemeraLudicGraphData` ([`ephemeraMeta.ts:660-669`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts#L660)):
    ```ts
    type StandardLudicGraphData = {
        rootId?: StandardReference          // LG-1: carried, not inferred. A component's own node always
                                             // designates itself as root once populated.
        nodes?: LudicGraphNodeListData      // LG-8: tagged union, mirrors EphemeraLudicGraphNode.
                                             //   ComponentNode: { tag: NodeTag; ref: StandardReference }
                                             //     for NodeTag in Area | Room | Feature | Character | Object
                                             //   StructureNode: { tag: 'Presence'; universalKey; fromHostId; cover }
                                             //     -- typed and unit-exercised, forbidden in asset mode by Slice 2's lint
        edges?: LudicEdgeListData           // LG-9/LG-10: one kind-discriminated list, NOT ExitEdgeList reused.
                                             //   Topology:   Navigation (<Exit> surface tag), Bearing
                                             //   Membership: In, On, PartOf
                                             //   Peer:       Under, Against, Custom (+ relationLabel)
                                             //   kind is the sole discriminant; no category field restates it.
                                             //   edgeId/chainId are base fields on every kind, Topology included --
                                             //   a decomposed portal is two Navigation legs sharing a chainId and
                                             //   edgeId. No constructor mints this yet, on any kind.
        ports?: LudicGraphPortListData       // LG-1 full parity: field exists on the type for contract parity.
                                             // Never authored, never populated by any WML write path -- ports
                                             // are minted only by play-time crossing (containmentPopulationSteps
                                             // and its kin), which never runs through a WML component. The lift
                                             // rule's "type now, behavior on demand" applied to the one field
                                             // WML has no writer for at all.
    }
    ```
    Two notes for Slice 1: **the self-reference guard inverts** --- `rootId` present in `nodes` becomes the positive invariant the replacement guard asserts, for all five node-hosting components, not just Area. **`edges` is a genuinely new type**, not a widening of `ExitEdgeList` --- `dataTypes/ludicGraph.ts` and `ludicGraph.ts` hardcode `ExitEdgeList`/`StandardExitEdgeData` today, and `AGENT.edges.md` already says not to overload it; `LudicEdgeListData` is a sibling, not a modification.
- [ ] **Slice 1 --- the aligned type and its existing consumers.** **Atomic by necessity:** changing `StandardLudicGraphData` breaks Area and Room at compile time, so they cannot land separately. Sequence within the slice:
  - [ ] `dataTypes/ludicGraph.ts` --- the target shape from Slice 0: nodes per LG-8, edges per LG-9, `ports`, `rootId`, with typeguards. Mirror ephemera's **accessor-as-tag-filter** idiom rather than inventing a parallel one.
  - [ ] `StandardLudicGraph` ([`components/ludicGraph.ts`](../../../../packages/mtw-wml/ts/standardize/components/ludicGraph.ts)) --- `toJSON`/`fromJSON`/`merge`/`diff` over the new shape.
  - [ ] **The `edges` union (LG-9)** via [`edgeFactory.ts`](../../../../packages/mtw-wml/ts/standardize/keys/edges/edgeFactory.ts) --- Topology, Membership and Peer kinds in one list, `kind` as the discriminant and **no `category` field**. The first exercise of the union, so expect to discover whether "tagged union ready" is fully true or aspirational in places. **A new heterogeneous `EdgeList`; do not widen `ExitEdgeList`.** Identity per LG-10 (the authored `uuid` is the `edgeId`). **The WML surface tag stays `<Exit>`** --- no authored asset changes.
  - [ ] **`referenceKeys` correctness (LG-8)** --- derive from the **non-root component nodes** only. **A presence node must never reach the dependency graph, and neither must the root**, or every component depends on itself. Test both exclusions directly; a wrong answer here is a silent asset-compilation bug, not a type error.
  - [ ] **Invert the self-reference guard.** Replace `assertNoSelfAreaReference` ([`area.ts:90-100`](../../../../packages/mtw-wml/ts/standardize/components/area.ts#L90-L100)) with the positive invariant: `rootId` is present in `nodes` and equals the component's own identity. **Do not simply delete it** --- see [The root node inverts an existing guard](#the-root-node-inverts-an-existing-guard).
  - [ ] Migrate [`area.ts`](../../../../packages/mtw-wml/ts/standardize/components/area.ts) and [`room.ts`](../../../../packages/mtw-wml/ts/standardize/components/room.ts) to the new shape.
  - [ ] **LG-4** --- the Workbench accessor filters to `Feature`-tagged nodes and excludes the root. Lands here, not later.
  - [ ] Round-trip test: a graph with every union member and both absent-field cases serialises and re-parses without loss.
- [ ] **Slice 2 --- the lint clauses, doc first.** Both clauses and their durable-doc entries land together, so no clause ever cites a doc that does not exist.
  - [ ] Durable entries in [`standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md)'s asset-wire-policy section: the authored-objects `not yet` (LG-7 --- intent, what it waits on, the complications list) and the presence-not-authorable clause (LG-6 --- why the type permits what the lint forbids).
  - [ ] **Presence-not-authorable clause** in [`assetWirePolicy.ts`](../../../../packages/mtw-wml/ts/standardize/assetWirePolicy.ts). **This is what keeps LG-6's shipped derivation the single writer of presence** --- [`containmentPopulationSteps`](../../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts) mints bindings at cache time, and an authored presence node would be a second, uncoordinated minter. Its idempotency check looks for an existing binding with `fromHostId === parentId`, so an authored one would either suppress the derived binding or sit alongside it --- **arity 2 where the answer is one.** Not a deferral device; a single-writer guard.
  - [ ] Test that an asset-mode form with an authored presence node fails validation, and that the same form in `ephemeraWire` mode passes.
- [ ] **Slice 3 --- `_ludicGraph` on `StandardObject` and `StandardFeature`.** Straightforward once the type is aligned.
  - [ ] Field, constructor/clone branches, `toJSON`/`fromJSON`, `merge`, `diff`, accessor --- mirroring [`area.ts:41-61`](../../../../packages/mtw-wml/ts/standardize/components/area.ts#L41-L61), the smaller precedent.
  - [ ] Data type + typeguard in `dataTypes/object.ts` and `dataTypes/feature.ts`.
  - [ ] Schema converter: `<Object>` currently throws unless a Room or Asset is in the context stack, and type-checks children against `ShortName | Situation | Render | Replace | Remove` ([`components.ts:327-349`](../../../../packages/mtw-wml/ts/schema/converters/components.ts#L327-L349)). Widen for graph child tags and for Object-in-Object context.
  - [ ] Round-trip test: an Object with a graph serialises and re-parses without loss.
- [ ] **Slice 4 --- the stored-to-wire projection.** One shared function, sub-graphed by binding, **taking a binding parameter even while arity is 1** --- the lift rule's central case, and the one thing that is expensive to retrofit.
  - [ ] Call the real arity-general primitives (`nodesFromPresenceBinding`, `subGraphFromNodes`), never a hand-rolled node walk.
  - [ ] **Assert totality:** a round-trip test that a stored payload projects to WML and back with every field intact. Under alignment nothing should be dropped --- if something is, the alignment is incomplete and that test is where it surfaces.
  - [ ] A rope-shaped test that a second binding's nodes do **not** cross, even though nothing mints one yet.
- [ ] **Slice 5 --- Room realignment.** Two differently-shaped items; do not treat as one.
  - [ ] **5a --- retire `_objects` (LG-2).** Strictly sequenced, because the room header breaks if the order slips: **(i)** Room's wire carries the scoped subgraph; **(ii)** [`roomHeaderPhaseC.ts`](../../../../charcoal-client/src/slices/messages/roomHeaderPhaseC.ts) derives its contents line from graph nodes instead of `objects`, with the existing `Contents: a, b, and c` output unchanged as the regression guard; **(iii)** only then delete `StandardRoomObjectData`, `_objects`, the `Object` `StandardizeConsumer` in [`room.ts:129`](../../../../packages/mtw-wml/ts/standardize/components/room.ts#L129), both schema-emit sites ([`:235`](../../../../packages/mtw-wml/ts/standardize/components/room.ts#L235), [`:300`](../../../../packages/mtw-wml/ts/standardize/components/room.ts#L300)), and the `objects` clause in `assetWirePolicy.ts` --- **replacing** it with the LG-7 `not yet` gate whose doc landed in Slice 2. Do not simply delete it.
  - [ ] **5b --- `characters`: hand off, do not fix here (LG-3).** Write the two-sources-of-truth finding and the drift-sweep evidence into a durable home; open a row wherever the roster/graph authority question belongs.
  - [ ] **`exits`: no action.** Genuine derivation (one bidirectional Area edge -> a per-room directional view). Recorded so a later reader does not "finish the job" by retiring it alongside `objects`.
- [ ] **Slice 6 --- durable docs.**
  - [ ] **The arc and the lift rule.** Move [Where this sits in the arc](#where-this-sits-in-the-arc) into [`AGENT.ludicNetwork.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md): the ephemera-proves / WML-lifts / wire-carries progression, the readiness gradient, the wire-lift vs author-lift fork with `assetWirePolicy` as its seam, and **the lift rule itself** (take the type contract, defer the behavior) with the presenceNodes citations as its worked precedent. **This plan is deleted when it lands, and the next lift will otherwise re-derive all of it from scratch.** Present tense, rewrite in place, no dated corrections (that file's own rule) --- so write the gradient as *how liftability is judged*, not as a September snapshot.
  - [ ] **The do-not-reintroduce note.** In the same file or in [`positions/ludicGraph/AGENT.md`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md): a WML-mediated serde for stored graphs is no longer lossy and is still wrong. Cite the 2026-09-03 fix.
  - [ ] [`components/AGENT.implementation.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) --- the aligned shape; the scoping/display projection split; LG-8's answer as the standing rule for what `nodes` means.
  - [ ] **[`AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) --- the kinds and the single list, plus a correction it needs independently of this plan.** Its kind-partition table lists a **third class, "Partitioning: `Present`"**, but `Present` was **retired** from `HostRelationalEdgeKind` at presenceNodes Slice 3 (PN-14; [`ephemeraMeta.ts:462-467`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts#L462)). **A builder reading that table today would implement a kind that no longer exists** --- fix it whether or not the rest of this slice lands. Its `List typing note` can also be resolved rather than deferred.
  - [ ] Update this file's Recommended order and Progress as the last step.

## Progress

| Slice | State | Notes |
| --- | --- | --- |
| 0. Portal sub-question + survey | Done | Portal answer: type permits multi-leg decomposition (`chainId`/`edgeId` are base fields), nothing mints it yet -- lift rule applied, not argued from current implementation. `referenceKeys` survey: only `schemaOrganization.ts`'s parent/child filter does real work, and it already ignores `Dependency`; Area/Room asymmetry flagged for Slice 1. Target `StandardLudicGraphData` written out in the LG-8 row |
| 1. Aligned type + existing consumers | Not started | Atomic by necessity; `referenceKeys` is the silent-failure risk; guard inverts |
| 2. Lint clauses, doc first | Not started | LG-6's deferral is conditional on this shipping |
| 3. Object/Feature field | Not started | Straightforward once the type is aligned |
| 4. Stored -> wire projection | Not started | Binding parameter is the non-negotiable; totality test is the payoff |
| 5a. Retire `_objects` | Not started | Retirement, not migration (LG-2); sequencing is the whole risk |
| 5b. `characters` | Not started | Hand-off only (LG-3); do not fix here |
| 6. Durable docs | Not started | The arc, the lift rule, the do-not-reintroduce note |

## Verification

```bash
# Package under change
cd packages/mtw-wml && npm run test -- --watchAll=false ts/standardize/

# Full package suite before merge
cd packages/mtw-wml && npm run test -- --watchAll=false

# Consumers of the component types (run after Slice 1; tsc alone is not sufficient ---
# *.integration.test.ts sit outside lambda/ephemera's tsconfig)
cd lambda/ephemera && npm run test -- --watchAll=false

# Asset compilation --- referenceKeys feeds the dependency graph (Slice 1, LG-8 Option A)
cd lambda/assets && npm run test -- --watchAll=false

# Cross-stack merge over StandardForm (Slice 1)
cd lambda/wml && npm run test -- --watchAll=false

# Client Workbench accessors (Slice 1, LG-4 --- now forced, not deferred)
# NOTE: charcoal-client runs vitest, not jest --- `--run`, never `--watchAll=false`
cd charcoal-client && npm run test -- --run src/components/Workbench/
```

## Known unknowns

Recorded because the author's confidence is uneven, not as hedging:

- ~~The blast radius of `referenceKeys` is the largest unknown in the plan, and LG-8 being decided does not shrink it.~~ **Surveyed in Slice 0 (2026-09-20):** only [`schemaOrganization.ts:355-357`](../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts#L355) (`_getParentChildEdges`, feeding `topologicalSort` --- the real asset-compilation-ordering consumer) does structural work with `referenceType`, filtering to `'Direct' | 'Position' | 'Facet'` and already ignoring `Dependency`. Every other consumer (`referencedBy`, the diff-repair pass) is unfiltered by type and dedups by `sameKey`; the cascade/subset traversal's `connectionType` filter has no production caller passing `'Dependency'`. So Slice 1's two new exclusions (root, presence) only need to keep non-root component nodes emitting `Direct` --- **Area's existing `Dependency` duplicate is inert and can most likely be dropped rather than carried forward**, matching Room's existing `Direct`-only emission ([`room.ts:460`](../../../../packages/mtw-wml/ts/standardize/components/room.ts#L460)); confirm no dynamic cascade construction depends on it first.
- Whether the edge list's "tagged union ready" claim holds under a second member is untested --- `Exit` is the only one that has ever existed, so Slice 1 is where any latent Exit-specific assumption in the factories surfaces.
- Whether any current consumer depends on `StandardRoomData.objects` staying flat has not been surveyed beyond [`roomHeaderPhaseC.ts`](../../../../charcoal-client/src/slices/messages/roomHeaderPhaseC.ts). **Survey before 5a(iii)**, not before 5a(i) --- the sequencing makes an incomplete survey visible as a broken header rather than as silent data loss.
- `StandardCharacter` also hosts a graph in storage and is **not** in this plan's title. Under alignment it is a Slice 3 sibling costing almost nothing; whether to include it is worth one sentence of discussion before Slice 3.
- ~~Whether `_playOnlyEdges`' envelope sourcing has a WML analogue at all.~~ **Answered while settling LG-9 (2026-09-20):** it was a provenance question, and the provenance runs WML-to-ephemera. [`extractPlayOnlyEdges`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts#L94) *splits* a WML-shaped mixed `edges` list; ephemera's two fields are the downstream persistence distinction, not a rival structure.
