# Abstraction layers: the Phase 0 corpus

**Companion to [`AGENT.abstractionLayers.planning.md`](AGENT.abstractionLayers.planning.md), split out 2026-08-07** when the parent plan passed 1600 lines. This file holds **Phase 0's worked-example corpus** and nothing else: the evidence base that plan's later phases argue from. Open questions, proposals, the locked frame, and the progress table all stay in the parent.

**Read this as part of the plan, not as an appendix.** A case here is the reason an AB row is worded the way it is, and the per-case annotation lines are the direct input to Phases 1 and 2.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md).

---

## Phase 0 corpus

The evidence base later phases argue from. Each case is written against **today's** model and names the **code site** where it stops --- a case that cites a remembered claim rather than a line of code is not yet corpus.

**Cases C1--C4 were mined from the ladder's data-blocked parks** (see [The dependency is asymmetric](AGENT.abstractionLayers.planning.md#the-dependency-is-asymmetric-representation-unblocks-reasoning)) rather than invented, per Phase 0's first sub-step. Mining them produced three corrections to this plan, recorded in [Discussion record](AGENT.abstractionLayers.discussion.planning.md#discussion-record) and applied in place.

**A second axis the corpus was silent on until 2026-08-07: *depth*.** Every case C1--C10 has exactly **two levels** --- a whole and its parts --- so no object in the corpus had ever occupied both roles at once, and an argument that treated *whole* and *part* as disjoint kinds could stand unchallenged for two days. **[C11](#c11-the-rube-goldberg-machine) is the first case with a four-level chain**, and it falsified that argument immediately. Treat two-level cases as the corpus's known blind spot rather than its normal shape: a claim that survives C1--C10 has not yet met recursion.

**One axis the corpus was silent on until 2026-08-06: scale of apprehension.** C1--C9 are all human-scale or extent-of-human-scale --- things you can see, hold, or recognise as one thing from where you stand. **[C10](#c10-the-moonbase-computer-system) is the first case that ladders *above* that**, and it is deliberately built from plain `OBJECT#`s so the question can be asked before Features-as-nodes or Areas are unparked. Expect the remaining corpus work to need at least one more above-scale case that is *not* authored, since C10's own annotation line records that gap.

**Annotation line, uniform across cases:** read-side | write-side --- part kind (~~AB-16~~ **descriptive only since 2026-08-06** --- the row is retired and the tag no longer decides anything; kept because it still reads usefully) --- Improvisation | Recognition (AB-14) --- description | mechanism (AB-19) --- which of the [three improvisation gaps](AGENT.abstractionLayers.planning.md#improvisation-is-the-objects-lanes-mechanism-generalized) it exercises. These tallies are the direct input to Phases 1 and 2, which is why the shape is fixed now rather than after the remaining cases land.

**The axis tag is the exception, and lives in the [axis tally](#axis-tally-c1--c11) instead of on the line.** It was assigned to all eleven cases at once on 2026-08-07, it is read as a column rather than per case, and keeping one home stops it drifting from a per-case copy. **Note the convergence rather than duplicating it:** AB-19's *description or mechanism* tag on each line is **apprehension versus reasoning under an earlier name**, which is why the retro-fit cost nothing and why the two should not both be maintained as though they were independent.

### Axis tally (C1--C11)

**Retro-fitted 2026-08-07** against [the five axes](AGENT.abstractionLayers.planning.md#the-five-axes-what-the-graphs-flexibility-is-in-service-to). **The axis tag lives here rather than on each case's annotation line, deliberately:** it is the one tag assigned across the whole corpus at once, reading it as a column is the point, and a single home means it cannot drift from a per-case copy. New cases add a row.

**Primary** = the axis on which the case actually bites. **Secondary** = also exercised, but not what makes the case sharp.

| Case | Primary | Secondary | Where the bite is |
| --- | --- | --- | --- |
| [C1](#c1-look-at-the-character-standing-here-look-at-the-north-wall) --- character / north wall | Apprehension | Positioning | The utterance cannot ground; the wall has no node kind it *could* occupy |
| [C2](#c2-the-rope-in-two-rooms-refused-at-the-gate) --- rope refused at the gate | **Mutation** | Apprehension | Storage permits it, so **positioning does not discriminate at all**; the gate refuses, the planner scrubs, compose duplicates |
| [C3](#c3-the-snare-trap-coyote-cannot-name) --- the snare Coyote cannot name | **Reasoning** | --- | Assembled and heaped produce **byte-identical** prompt context |
| [C4](#c4-the-place-setting-at-the-faerie-court) --- place setting at the Faerie Court | Reasoning | Apprehension, Authoring | The same arrangement is inert in one frame and loaded in another; no state carrier below Room |
| [C5](#c5-the-chain-mounted-at-both-ends) --- chain mounted at both ends | **Mutation** | Positioning | `removeObject` asserts and throws; migration-down and reabsorption are separate *events* |
| [C6](#c6-the-rope-the-candle-and-the-impromptu-timer) --- rope, candle, impromptu timer | **Positioning** | Reasoning | A tree cannot express it. **Added zero `H1-dependent` rows** --- the frame's clearest retro-diagnosis |
| [C7](#c7-ariadnes-thread) --- Ariadne's thread | **Positioning**, then **Reasoning** | --- | The filter firing, and the only clean instance: one node cannot record *where along*. **Then the axis goes quiet and the case continues** --- [the nesting question](#the-nesting-question-run-2026-08-07) is decided on reasoning alone, flat and nested being positionally identical. **The corpus's only case that bites twice, on two axes, in sequence** |
| [C8](#c8-the-flashlight-that-vanished-when-someone-looked-at-it) --- the vanishing flashlight | **Apprehension** | Authoring | Looking closely makes a thing unreferrable |
| [C9](#c9-coiling-the-rope-back-in) --- coiling the rope back in | **Mutation** | Positioning | A worked operation: one record inside the spread, two at a boundary, no edge changes |
| [C10](#c10-the-moonbase-computer-system) --- moonbase computer system | **Apprehension** | Reasoning | What a room's description contains, when the graph cannot tell you |
| [C11](#c11-the-rube-goldberg-machine) --- Rube Goldberg machine | Reasoning | Positioning | The purpose half. **Its clause-1a falsification is axis-independent** --- see below |

**Three results worth reading off the column rather than the rows.**

1. **Authoring has no primary case.** Eleven cases and zero coverage. C4 and C8 touch it secondarily and that is all. **This is a measurement, not a to-do:** the initiative has evaluated representations for players and LLMs and never once from the position of the person writing the world. C10 and C11 are both *authored* and both record that neither AB-14 trigger fires, so the corpus has improvisation at human scale and authorship above it **with nothing crossing**.
2. **The positioning-primary cases are the ones that discriminated least.** C6 explicitly added zero `H1-dependent` rows; C7 discriminated once and then the axis went quiet. That is the filter behaving exactly as [the frame](AGENT.abstractionLayers.planning.md#the-five-axes-what-the-graphs-flexibility-is-in-service-to) predicts, arrived at from the corpus side.
3. **[C11](#c11-the-rube-goldberg-machine) bit on none of the five, and that is a sixth mode worth naming.** Clause 1a was not falsified by an audience noticing anything --- it was falsified by **internal contradiction**, one object taking two incompatible rules. A case can therefore discriminate by making a proposal *inconsistent with itself*, independent of any consumer. Rare, decisive when it happens, and it should not be forced into an axis it does not belong to.

### C1. Look at the character standing here; look at the north wall

**Origin:** the CPG-5 remainder park.

**Today's model.** A room graph holds one tag-discriminated `_nodes` array, `'Character' | 'Object'`. Features are not nodes at any tag. [`roomObjectCatalogForCharacter.ts:76`](../../../../../lambda/ephemera/dataSource/actions/roomObjectCatalogForCharacter.ts) builds the referent catalog from `[...positionGraph.objectIds]` and never touches `characterIds`.

**Limit hit.** No non-Object candidate is producible at runtime, so neither utterance can ground. [`compileDescribeFromSkeleton.ts:92`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/compileDescribeFromSkeleton.ts)'s `candidates.find(isEphemeraObjectId)` **says so in its own comment** --- "filtering to `EphemeraObjectId` candidates is today a no-op guard." The filter cannot fire because nothing upstream can produce anything for it to reject. The north wall is worse than unresolvable: it is not merely absent from the catalog, it has no node kind it *could* occupy.

**Found while verifying.** The same function takes the *character's own* room as `containers[0]` (line 70) --- a third silent single-host assumption, in the read path rather than the write path. Noted for C2 rather than developed here.

**Annotations.** Read-side --- part kind n/a (this is the participation question, upstream of composition) --- Improvisation, and specifically AB-21's **latent** flavor (a room has walls whether or not anyone wrote them) --- description --- exercises none of the three gaps directly, because it is upstream of minting: the thing cannot be *referred to*, so the question of whether it would be *minted* never arises.

**Rows grounded.** AB-12 (the Room/Feature half, and this is the concrete case for it), AB-2, AB-9, AB-21.

### C2. The rope in two rooms, refused at the gate

**Origin:** the BD-16(3) `multiPresent` park.

**Today's model.** Adjacency stores `(OBJECT#, POSITION#ROOM#...)` rows with nothing unique-constraining them; `getMembershipContainers` returns an array. Multi-room presence is therefore **storable**.

**Limit hit --- and it is five layers disagreeing about one object, in three different ways.**

| Layer | Behavior on a two-room rope | Site |
| --- | --- | --- |
| Adjacency storage | Permits it | `getMembershipContainers` returns an array |
| **Membership compile** | **Terminal error to the player** | [`complexityPreGates.ts:29`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/complexityPreGates.ts) --- `containers.length > 1` -> `multiPresent` -> `preGateOutcomeToTerminalError` |
| **Relational compile** | **Silently omits it** | [`compileRelationalFromSkeleton.ts:168`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/compileRelationalFromSkeleton.ts) --- `if (containers.length === 1)` populates `hostByObjectId`; otherwise the object simply has no host for Expansion, and `getCurrentHostForExpansion` returns `undefined` |
| End-state planner | Scrubs every room but the target | `computeEndStateRoomDiff` --- `froms = priorContainers.filter(!== to)` |
| Presentation | Renders a whole rope in each room | Affordance compose reads `graph.objectIds` per room |

Refuse, ignore, scrub, duplicate --- four incompatible answers, none of them wrong locally. **This is the corpus's sharpest single argument that the level structure currently lives in each consumer's head rather than in the model**, which is the burden [Why this initiative exists](AGENT.abstractionLayers.planning.md#why-this-initiative-exists) names.

**Note the gate is route-scoped, not global.** `evaluateComplexityPreGates` has exactly one caller, [`compileMembershipAtomic.ts:121`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/compileMembershipAtomic.ts). The relational route and `executeObjectMove` / `orchestrateObjectMove` never reach it. The plan already recorded that the cross-host move route bypasses the end-state planner; the non-uniformity is therefore **worse than recorded** --- it is not one constraint applied unevenly but three different constraints on three routes.

**Annotations.** Write-side --- **homogeneous extent** (AB-16) --- Improvisation, downward and operation-driven (lowering the rope is what makes the ends separately addressable) --- mechanism --- exercises gap 1, **no composition relation**: improvisation would mint two rope parts as free-standing objects with nothing expressing that they are one rope.

**Rows grounded.** AB-8 (primary), AB-16, AB-25, AB-26, AB-27.

### C3. The snare trap Coyote cannot name

**Origin:** the Coyote genre-bounded reasoning context park.

**Today's model.** [`loadCoyoteRoomObjectsByRoom`](../../../../../lambda/ephemera/dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.ts) walks `getGameRooms()`, and per room takes `[...graph.objectIds]`, stitching each into a `CoyoteStagedObject` of `{ objectId, shortName, stableKey, tropeAffinities? }`.

**Limit hit --- and it is sharper than "a flat bag."** That type has **no edges in it**, and the snapshot never reads `graph.relationalEdges`. So the *arrangement is discarded at the boundary*: the rope tied to the branch, the loop laid on the road, and the same three objects lying unrelated in a heap produce **byte-identical** prompt context. Coyote's prediction pipeline is asked to reason about a contraption from an inventory of nouns with role tags and no structure at all. The room-scoping limit (everything staged, relevant or not) is real but secondary --- widening or narrowing the scope of a set that cannot express relation does not help.

This is the strongest available evidence for the conclusion already recorded under [Coyote as prior art](AGENT.abstractionLayers.planning.md#coyote-as-prior-art-bounded-llm-reasoning-that-is-not-bounded-structurally): the missing piece is per-**assembly**, and it is missing at the point where structure is projected into prompt context.

**Annotations.** Write-side --- **heterogeneous separable** (AB-16) --- Recognition, and the **multi-step** variety Phase 0 requires: tie loop, attach to branch, lay on road are separated in time with no single transition to fire on --- mechanism (reasoning about a snare *as* a snare is the whole point) --- exercises gap 2, **Recognition fits less cleanly**: the snare's body is nearly empty and its **member set is the content**, which is exactly what the objects lane has no concept of.

**Rows grounded.** AB-18 (scope and trigger; the no-transition-to-fire-on problem is visible here), AB-19, AB-22, AB-14, AB-6.

### C4. The place setting at the Faerie Court

**Origin:** the situational-meaning / mark-state-axis park.

**Today's model, and this corrects the plan's own premise.** The situational axis is **not** "built and unpopulated." It is **populated for Rooms and structurally absent for everything else**: [`requestIntake.ts:11`](../../../../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.ts) states it as a rule --- "**Feature/Knowledge/Object/Character hosts:** no `Meta::Room`; always `markState: { markValue: [] }` and `allowGeneration: false`" --- and [`findRender.ts:95`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts) gates generation on `isEphemeraRoomId`. Rooms meanwhile carry real state: [`handleApiStateChange.ts`](../../../../../lambda/ephemera/dataSource/state/handleApiStateChange.ts) merges `markState` into `Meta::Room.state.marks`, with [`computeDefaultMarksForRoom.ts`](../../../../../lambda/ephemera/dataSource/state/computeDefaultMarksForRoom.ts) supplying defaults.

**Limit hit.** The empty pin on non-Room hosts is **not a deferral waiting to be switched on** --- it is downstream of there being no state carrier. `Meta::Room` is the carrier, and no other host kind has one. So an interpretive frame can attach to *a room* and cannot attach to *a thing*: the Faerie Court can be a Faerie Court, but the place setting on its table cannot be situationally significant, because there is nowhere on the place setting for significance to live.

**This links AB-23 to AB-7 in a way the plan did not record.** Situational meaning for anything below room scale needs a diegetic-state carrier for non-Room hosts, which is AB-7's question --- flagged there as "possibly out of scope" and now with a second consumer.

**Annotations.** Read-side, becoming write-side exactly if Recognition mints --- heterogeneous separable (AB-16) --- Recognition --- **description in one frame and mechanism in the other, which is the case's whole point** --- exercises gap 3, `EMBEDDING#IMPROMPTU` being `shortName`-derived, since "the place setting" is the plan's own named example of a questionable embedding.

**A finding about the annotation scheme itself.** C4 does not have a description-vs-mechanism value. At an inn the place setting is inert and its recognition is pure projection under AB-9's guardrail; at the Faerie Court the same six objects carry consequence. **AB-19's tag is therefore a property of *(case, frame)*, not of the case** --- so a per-case column cannot hold it. This does not need a new row: AB-23 already says the member-affinity filter is context-dependent, and this is that statement arriving from the corpus side. It does mean Phase 2 should not read the AB-19 tally as a partition.

**Rows grounded.** AB-23 (primary), AB-7, AB-19, AB-22, AB-24.

### C5. The chain mounted at both ends

**Origin:** not a park --- raised in conversation 2026-08-05 as a sharper instrument than rope state (iv) for the same test. **This is the first [H1](AGENT.abstractionLayers.planning.md#h1-single-host-objects-hosting-at-the-containing-node) falsification case run**, and it falsified a sub-claim; see below.

**The case.** A chain in a dungeon cell, mounted to the wall at one end and attached to a chest at the other. Later the chest is dragged into the next room and then dragged back.

**Why it is a better instrument than rope state (iv).** Re-coiling a rope changes co-location **and** load-bearing at the same moment, so it cannot distinguish them. The chain holds co-location fixed --- everything is in the cell --- while leaving the ends load-bearing. It isolates the variable.

**Today's model.** Not representable in full. Chain-end -> chest is an ordinary intra-host Relational edge and works today. Chain-end -> **wall** does not exist, because Features are not graph nodes at any tag ([C1](#c1-look-at-the-character-standing-here-look-at-the-north-wall)). So the case's more interesting anchor needs AB-12's Room/Feature half before it can be stated at all --- **noted rather than worked around**, since the half that can be stated is enough to carry the finding.

**What it establishes.** **Co-location and load-bearing are independent axes**, so migration-down and reabsorption are different events. All three nodes (chain, chain-end-1, chain-end-2) must persist in the cell's graph for the relations to have endpoints, *while* the whole is correctly hosted in the cell rather than the Area. Dragging the chest out and back cycles the chain up to the Area and down again **without ever dissolving a part**.

**The guard is already shipped, and it throws.** Reabsorbing a part means removing its node, and [`removeObject`](../../../../../lambda/ephemera/dataSource/positions/positionGraph/AGENT.md#known-limitation-deferred) **asserts and throws** `RelationalEdgeStillReferencedError` when a Relational edge still references it (BD-33/35, with deliberately no silent-strip variant). So dissolving chain-end-2 while it is attached to the chest is not a subtle data-loss bug --- it fails at the kernel. The load-bearing test for the relational half is therefore a **graph query** (`nodeHasRelationalEdge`, already on the class), not an LLM judgment, and the unsafe version is already impossible. Third instance of the same convergence AB-28 records: the boundary-edge discipline anticipated the case.

**A third decomposition trigger, previously unnamed.** The chain's ends exist *while everything is co-located*, so decomposition was not triggered by spanning. It was triggered by needing an endpoint **finer than the whole** to bear a relation --- "chain the chest to the chain" requires a chain-end. That is on-demand Improvisation under AB-14, and it restores the symmetry the granularity insight claimed while relocating the axis P1 guessed at: **parts exist while they are needed as distinct loci, by position *or* by relation; the whole hosts wherever it must to contain them.** Two independent questions that P1 collapsed into one.

**Annotations.** Write-side --- **homogeneous extent** (AB-16) --- Improvisation, on-demand and relation-driven (the newly named third trigger) --- mechanism --- exercises gap 1, **no composition relation**.

**Rows grounded.** AB-17 (primary --- splits its criterion), AB-9 (escalated from acute to routine), AB-14, AB-16, AB-12 (via the wall anchor), AB-27.

### C6. The rope, the candle, and the impromptu timer

**Origin:** not a park --- a scenario already used in conversation as a specimen of the hi-jinks creative players actually attempt. Raised 2026-08-05 as a hard test.

**The case.** Tie a rope to the bedpost. Throw the rope out of the window. Place a lit candle **under** the span of rope between bedpost and window. Climb down; wait for the candle to burn the rope through; retrieve most of the rope from below.

**What it establishes, and it is not what it was aimed at.** Offered as a test against AB-25, it is really **AB-13's** case: one part with two wholes, neither containing the other. **This is a DAG requirement, not a DAG preference** --- a tree cannot express it at all. It is stronger evidence than AB-13's existing fork example, because the fork's three wholes (place setting, silverware set, inheritance) are categories of one kind that a reader can talk into a nesting, whereas C6's two wholes are different **in kind**: the rope is a physical object and the impromptu timer is a mechanism.

**The constraint it puts on AB-25.** The two wholes host at **different heights** --- the rope spans room and garden so it hosts at the Area; the timer's members are both in the room so it hosts in the room. Walking up from the shared span therefore yields parents at inconsistent levels, so **hosting height does not correlate with composition depth** and no implementation may treat the parent index as "the next level up." AB-25's core question --- whether Room/Area containment is a tree --- is untouched.

**Granularity, again from the third trigger.** The candle is under the **span**, not an end, and the span must exist as a distinct locus *because the candle relation needs something to attach to*. That is [C5](#c5-the-chain-mounted-at-both-ends)'s newly-named third decomposition trigger firing in a scenario built for an unrelated purpose --- two independent cases producing it is reasonable evidence it is real.

**Two gaps it opens.** Dissolution is **per-whole**: the timer dies when the candle burns out while the rope persists, so the shared span is released by one parent and retained by another, which AB-17 could not previously express. And the scenario's whole payoff --- the rope **burning through** --- is **fission**, one whole becoming two, which no row owned. Now **AB-31**.

**One separation this case forces, so the expensive claim does not ride in on the cheap one's evidence.** *The representation must permit the timer* --- multi-parent composition, per-whole dissolution, fission --- is a hard requirement, and C6 is strong evidence for it. *The system spontaneously recognizes rope-plus-candle as a timer* is AB-18's unbounded search, and C6 is only an aspiration for it. Same discipline AB-12 applies to the Object versus Room/Feature bets. Worth noting the case is nonetheless a good advertisement for AB-22's affinity filter: a candle carrying `trigger` aptness beneath a rope under tension is exactly the arrangement cheap to notice **without** a pattern library.

**It does not threaten H1.** Every object in it is single-hosted and every whole hosts at the node containing its parts. Recorded explicitly because H1's other two falsification cases are spent, and a hard case that H1 passes incidentally must not be miscounted as a test that was aimed at it.

**Annotations.** Write-side --- **both part kinds in one case** (homogeneous extent for the rope, heterogeneous separable for the timer's candle-plus-span) --- Improvisation for the span, **Recognition** for the timer --- mechanism, emphatically --- exercises gap 2, since the timer's body is empty and its member set is the whole of its content.

**Rows grounded.** AB-13 (primary, and its best example), AB-31 (opens it), AB-17, AB-25 (constrains), AB-16, AB-18, AB-22.

### C7. Ariadne's thread

**Origin:** the character-held rope end, run 2026-08-05 as [H1](AGENT.abstractionLayers.planning.md#h1-single-host-objects-hosting-at-the-containing-node)'s first *discriminating* falsification case, and then recognised for what it actually is. **Naming it correctly is not decoration** --- the myth is a specification, and players who know it will attempt it.

**The case.** Theseus ties one end of a thread at the labyrinth entrance and unspools it as he walks, room by room, so he can retrace the route. Later he follows it back. Along the way: a bystander could trip over it, it could be cut, and someone could follow it *inward*.

**Why it is stronger than the two-room rope.** **(i)** It is *many* rooms, so it tests the mechanism at scale rather than at its minimum. **(ii)** Its entire purpose **is** the path --- "which rooms does this pass through" is not an incidental question about the object, it is the object's reason for existing. **(iii)** It is unspooled **progressively**, one threshold at a time, so it is the per-crossing cost iterated twenty times rather than paid once. **(iv)** It is **retraced**, making the read path a first-class operation rather than an afterthought.

**A structural convergence worth noticing.** The thread **is** **AB-26**'s part-connection graph made literal: a record of which exits were traversed, with the licensing relation on each connection. The data structure the plan proposes and the fictional object turn out to be the same shape. **And it sharpens AB-26's own correction:** the part graph is not *assumed* to be a sequence, but a thread's happens to be one, because a thread is unspooled continuously. A net's is not. So "not a sequence" means the shape cannot be presumed --- not that paths never occur.

**What the case establishes --- the bystander test.** Someone standing in a labyrinth room who is *not* Theseus tries to grab the thread trailing past.

| Framing | What happens | Cost | **Is the resulting state faithful?** |
| --- | --- | --- | --- |
| **(a) multi-host** | Add the room to the thread's container set; it becomes a node in that room's graph and is grabbable | One pure-add per room --- **but `MutationKernelTransferStep`'s singular `toHostId` means the kernel cannot express a pure-add today** | **No.** The thread is **one node**, so the bystander grabs the *entire thread*, not a middle. Attachments (tied at the entrance, tied to a pillar, held by Theseus) sit on three hosts with **nothing recording where along the thread each is**. A container set is unordered, and the route is not recoverable from exits --- a labyrinth has multiple paths. **(a) cannot represent this object.** |
| **H1** | There is no thread node to add --- the whole is at the Area and only *parts* are room-present. Requires **minting a span-part** in the room, placing it, connecting it via AB-26, updating the member set, recomputing the LCA | A write **per threshold crossing**, times the length of the labyrinth, each unwound on the way back subject to [C5](#c5-the-chain-mounted-at-both-ends)'s load-bearing check | **Yes.** The bystander grabs the local segment; each attachment sits on a specific part; the part-connection graph records which exit each connection traverses, so the route is explicit. |

**Verdict, after two reversals recorded below: C7 is a *passed discriminating test of [H1 clause 3](AGENT.abstractionLayers.planning.md#h1-is-a-conjunction-and-its-clauses-are-tested-separately)* --- spanning things are modelled as parts.** The strongest result a discriminating test can give: not that H1 survived, but that the alternative **broke**. It says nothing about clauses 1, 4 or 5, which were used in working the case and never stressed --- nothing here asks whether the LCA is computable or the cascade plannable. The axis it actually tests is **one node versus parts** --- and conceding parts lands in AB-8's framing (c), which H1 embodies. An (a)-with-segments variant would be framing (c) with multi-host still permitted, at which point single-host is a secondary question rather than a settled one.

**And "mint it lazily, on reference" does not rescue H1 --- it is circular.** A player cannot refer to what they cannot perceive, so the trigger cannot be reference. **The constraint that falls out is the durable finding: presence must be established at *description* time, not reference time**, because description is upstream of reference. That kills lazy minting rather than repairing it, since description runs on every look and mint-on-describe is eager minting with extra steps.

**Three live options, no choice made:** eager minting (a write per crossing); **derived presence** --- description walks the part-connection graph and collects the rooms the licensing relations traverse, which is AB-9's projection answer applied to *presence* rather than to level; or accept that only Theseus can interact with it, which is cheap and, for a thread lying across a floor, hard to defend.

**The finding that reframes the comparison: framing (a) needs the same derivation.** Someone must still infer that a character entering a room while holding one end means the thread now occupies that room --- a flat container set does not supply that either. **(a) stores the result at write time; H1 would compute it at read time.** So the real discriminator is **stored versus derived presence**, which is AB-6 one level over, and the trade is the familiar one: stored is cheap to read and needs drift repair, derived is always correct and pays per describe --- though the render cache already exists to absorb exactly that.

**Held and present are not mutually exclusive, and nothing can currently say both.** AB-4 records that today's membership is exclusive: an object is in a host. A thread is held by Theseus *and* lying across the floor of the room he is standing in. For a coin in a pocket exclusivity is right; for a spanning thing it is not. **This is the gap underneath the whole case**, and it is why both framings need an explicit step.

**Two more the case supplies cheaply.** **Cutting the thread** is AB-31's fission with the stakes made concrete --- the severed portion no longer connects to the entrance, so the *identity* question ("is this still Ariadne's thread?") has a real answer that matters to a player. And **the ball it unspools from** is a diminishing reservoir generating parts, which is an unusual composition shape the corpus has no other instance of; noted, not developed.

#### The nesting question (run 2026-08-07)

**A second question on the same object, and the first in this corpus that positioning cannot touch.** Once the one-node framing is eliminated (above), two representations remain:

| | **Flat** | **Nested** |
| --- | --- | --- |
| Shape | A skein, a tied endpoint, and **twenty span parts** with connective topology | A skein, a tied endpoint, and **one multi-room `thread-span` whole** that nests those twenty appearances and their topology |
| Positioning | Records the arrangement correctly | Records the arrangement correctly |
| Apprehension | Adequate | Adequate |

**Both clear the [positioning filter](AGENT.abstractionLayers.planning.md#the-five-axes-what-the-graphs-flexibility-is-in-service-to) identically, so the axis has nothing to say.** This is the frame's own prediction arriving as a worked case: positioning fires once, eliminates the crude option, and goes quiet. **Reasoning ranks them, decisively.**

**Test 1 --- Theseus tugs the thread.** He wonders whether it is still tied at the far end; maybe the minotaur cut it, maybe Ariadne had second thoughts.

- **Flat:** the LLM must inspect twenty span elements and derive that they compose one continuous run before it can reason about the tug at all. A **heavy and unnecessary derivation**, re-performed every time.
- **Nested:** the whole is a place to put a **reasoning summary** --- *a long thread winding through many rooms* --- which is **sufficient** for the question asked.

**The point is scale, not size.** A small sufficient fact is not merely a cheaper input to the same reasoning; it is the input that makes the reasoning **reliable**. Focused attention on one adequate fact has fewer places to go wrong than correct reasoning over a large redundant structure. Compression is the side effect.

**Test 2 --- the thread is snagged on something in one room, and this is the sharper half.** The snag is a relation on a constituent.

- **Nested:** it **ports through the span**. Reading the span *alone*, without expanding constituents, **already reports that a snag exists**. Where and how are available and **omittable**.
- **Flat:** the snag sits on one of twenty spans. You cannot know whether one exists without reading all twenty. **The information cannot be omitted, only missed.**

**This is [no silent omission](AGENT.abstractionLayers.planning.md#correction-same-day-reasoning-wants-no-silent-omission-not-losslessness) delivered structurally**, and it is what corrected the reasoning axis from the overstated "lossless." It also gives ports [a developed argument on a third axis](AGENT.abstractionLayers.planning.md#a-third-argument-on-a-third-axis-the-port-is-the-summarization-seam-2026-08-07).

**The two halves are not equally robust, and the difference should be carried forward.**

| Mechanism | Generalises? |
| --- | --- |
| **Snag ports through the span** --- structural | **Yes.** *Any* relation crossing the boundary is visible, whatever the question was |
| **Reasoning summary** --- curated prose | **No.** Sufficiency is a property of *(summary, question)*. *A long thread winding through many rooms* answers *is it still attached*; it does not answer *can I climb it* or *where is the nearest reachable bit* |

**So the porting is the load-bearing mechanism and the summary is the softer claim.** Worth having; cannot be what the argument rests on.

**And the summary costs something the comparison does not price.** Authored, it goes stale when the thread changes; derived, the derivation has moved to write time rather than gone away. That is the **mutation** axis charging for a reasoning gain --- exactly the cross-axis cost the frame exists to surface --- and it is now **AB-37**. One encouraging wrinkle: by [the strength test](AGENT.abstractionLayers.planning.md#the-port-record-split-complementary-with-the-interior-authoritative-settled-2026-08-06), a whole-level summary saves reading twenty constituents, making it **N:1 and therefore strong** --- the same class as the membership node, and unlike the ingress list that got moved to cache.

**Competitor check.** The flat form can answer *is there a snag* with a reverse index over constituents --- **AB-36**. But that is a special-purpose index recovering what nesting supplies structurally: a second mechanism for a subclass, which is [position 3](AGENT.abstractionLayers.planning.md#three-positions-on-reference-and-what-clause-1b-actually-costs). **Rescuable only by an epicycle**, stated rather than asserted.

**Annotations.** Both sides --- read-side for retracing and description, write-side for unspooling --- **homogeneous extent** (AB-16) --- Improvisation, on-demand, per crossing --- mechanism --- exercises gap 1, and gap 3 for whether a thread gets a semantic embedding at all.

**Rows grounded.** AB-6 (stored vs derived, at presence level), AB-4 (held vs present), AB-8, AB-9, AB-15, AB-16, AB-26, AB-31.

### C8. The flashlight that vanished when someone looked at it

**Origin:** seed example 2, run 2026-08-06 against [the non-positional-whole candidate](AGENT.abstractionLayers.planning.md#candidate-drop-clause-1b-and-the-whole-chain-with-it) --- which it broke. The case had been in this plan since day one and the candidate was never checked against it.

**The case.** Someone looks at Room A: a flashlight is there. They look *carefully* at the flashlight, and its parts are improvised --- battery, casing, bulb. **Is the flashlight now absent from the room, replaced by three components?**

**Under the candidate as written, yes, and worse than that.** Decomposition makes the flashlight a *whole*; a non-positional whole is not a graph node; so `graph.objectIds` for Room A holds battery, casing and bulb and no flashlight. Affordance compose describes three components. **And [`roomObjectCatalogForCharacter.ts:76`](../../../../../lambda/ephemera/dataSource/actions/roomObjectCatalogForCharacter.ts) builds the referent catalog from the same `objectIds`**, so "pick up the flashlight" stops grounding. **Looking closely at a thing makes it unreferrable.**

**The conceptual error: decomposition changed positional status while nothing happened fictionally.** Someone looked. The flashlight is still on the table.

**The finding --- containment and extent want *opposite* answers.**

| Composition kind | Positional | Non-positional |
| --- | --- | --- |
| **Containment** (flashlight, place setting) | the **whole** --- it is the thing in the room | the **parts** --- they are inside it |
| **Extent** ([Ariadne's thread](#c7-ariadnes-thread), rope, chain) | the **parts** --- each is somewhere | the **whole** --- it is not anywhere in particular |

~~This is **AB-16**'s heterogeneous-separable versus homogeneous-extent distinction surfacing as a *positional* difference --- evidence that the row's two part-kinds are genuinely distinct things.~~ **Withdrawn 2026-08-06, and this sentence is the exact site of the error.** The comparison put the *shipped* host-bound model on the containment side against the [unadopted drop-clause-1b candidate](AGENT.abstractionLayers.planning.md#candidate-drop-clause-1b-and-the-whole-chain-with-it) on the extent side, and --- worse --- **this case is what scoped that candidate to extent in the first place**, so the asymmetry it reports is one this case imposed rather than found. **AB-16 was retired on the strength of this correction.** What C8 actually shows is undamaged and stands below: decomposition must not silently un-ground a referent.

**What it does to the candidate: narrows it, does not kill it.** The non-positional whole was derived **entirely from C7**, an extent case, and generalised without being checked against a containment case sitting in the same document. Not wrong --- **overgeneralised from one part-kind**, which is the instance-taken-for-the-category error already twice in this plan's catalogue. Positional status looks like a property of the **composition kind** rather than a global rule. Pleasant consequence for clause 4: a containment whole needs no LCA (it sits where it sits) and an extent whole needs no host (it is non-positional), which would confine the LCA machinery to **scattered containment** --- a flashlight whose battery has been carried next door --- possibly rare enough to handle by dissolving the composition instead of hosting it.

**To test before trusting that split: is containment-versus-extent *clean*?** A ship's rigging is arguably containment at the ship's scale and extent within it. If compositions can be both, positional status cannot be read off the kind.

**A second, separable problem the case exposes --- AB-9 and AB-14 collide here.** "Look carefully" acting as a mint trigger puts **description on a write path**, which is exactly what AB-9's guardrail forbids (*description selects among levels that already exist and must never create one*). But AB-14 says operational necessity licenses minting and AB-20 says the player's own reference is the licence --- and a player asking for detail plausibly qualifies. **Both rows are defensible and they disagree about this case.** Note it is genuinely separable: the positional defect above stands even if a screwdriver triggered the decomposition instead of a look.

**Annotations.** Read-side trigger, write-side effect --- **heterogeneous separable** (AB-16) --- Improvisation, on-demand, downward --- description shading into mechanism, which is the collision --- exercises gap 1.

**Rows grounded.** AB-9 and AB-14 (primary --- the collision), AB-4, AB-32, AB-2. ~~AB-16 (primary --- positional asymmetry)~~ **removed 2026-08-06**: the grounding ran backwards, and AB-16 is retired.

### C9. Coiling the rope back in

**Origin:** the rope's fourth state, owed since Phase 0 was written, run 2026-08-06 against [P3](AGENT.abstractionLayers.planning.md#provisional-p3-ports-as-host-boundary-bindings) on the **multi-host** framing. Unlike C5--C8 this is not a falsification case: it is a **worked operation**, and the interesting result is what it does *not* require.

**The state.** `OBJECT#ROPE` has parts `RopeEnd1`, `RopeSpan`, `RopeEnd2`, in Rooms A, B and C. The rope's own graph carries three ports --- 1 -> `ROOM#A`, 2 -> `ROOM#B`, 3 -> `ROOM#C` --- each **presence-linked** to the corresponding part. Each room's graph holds an `OBJECT#ROPE` node whose ingress list names the port live there.

**The operation.** Standing in Room A, haul the rope in. `RopeSpan` moves B -> A: **change port 2's egress to `ROOM#A`** --- and that is the entire write, since [the ingress list lives in `positionCache`](AGENT.abstractionLayers.planning.md#the-port-record-split-complementary-with-the-interior-authoritative-settled-2026-08-06), not in the rooms' graphs. `RopeEnd2` moves C -> B the same way, and because that was `ROOM#C`'s last port, **the `OBJECT#ROPE` node leaves `ROOM#C` entirely.**

**The write count, stated precisely, because it is where the transaction footprint lives.** **Relocation *within* the spread is one record** --- rewrite the port's egress host, nothing else. **Crossing a boundary is two**, because a room's port count going 0 -> 1 or 1 -> 0 changes membership, which stays in `positionGraph`. So hauling a rope through the middle of its own span is nearly free, and only its endpoints cost.

**The result, and it is the case's point: no edge changes at all.** The `part` links and sibling links are untouched. **Structure and position are independent** --- the rope's internal model is invariant under moving through the world, and only presence changes. Today's model cannot express this: relocating a segment means removing a node from one graph and adding it to another, and since relational edges are same-host-only, a segment carrying a relation needs dissolve-and-recreate.

**Scope of "no edge changes," and the fiction agrees with the limit.** It holds for **presence-only** ports. Were `RopeSpan` tied to a tree in Room B, the tie is `tree -TiedTo-> ROPE:2` in B's graph, and moving port 2's egress leaves B referencing a port that no longer exits there. That is not a defect --- it is `boundaryEdgeOutcomes`' existing **carry / dissolve / defer / error** verdict --- and it reads correctly: *you cannot haul in a rope that is tied to a tree in the next room without untying it.* **The clean case is exactly the presence-only case.**

**What it does to [H1](AGENT.abstractionLayers.planning.md#h1-single-host-objects-hosting-at-the-containing-node) clause 5: leaves it nothing to do.** Under H1 coiling migrates the *whole* down from the Area into a room, with the cascade and plan-time pre-locking clause 4 demands. Under multi-host + ports **there is no whole-migration** --- the whole is present wherever its ports say, and coiling shrinks the port set. Clause 5's queued concurrent-migration and thrash cases target machinery that would not exist. **Third time a queued test set has dissolved rather than run.**

**Two rows it clears outright.**

- **AB-15's naming seam** --- flagged as the one step of [part-mediated reference](AGENT.abstractionLayers.planning.md#part-mediated-reference-how-h1-answers-its-own-replacement-trigger) that does not fall out of existing machinery. Here the room's node **is** `OBJECT#ROPE`: the rope is present *by name* in every room it passes through, with the ports carrying the where-along. No catalog widening, no aliasing, no two-phase match.
- **AB-17's hosting criterion** --- "all parts co-located" becomes "all ports share an egress host," a read off the egress list rather than a judgment. The *reabsorption* criterion still needs the separately-referenced test: `nodeHasRelationalEdge`, **plus** "does any port carry an exterior edge."

**The membership rule it implies:** an object is present in a room **iff at least one of its ports egresses there**. That is AB-6's presence half answered concretely. **Note what the rule is *not*, after the ingress-list reversal:** it is a **consistency invariant** between the egress list and the room's membership node --- **not** a derivation any reader performs, since scanning every object to answer "what is here" would be absurd. Membership stays in `positionGraph`; only the port-level detail is derived. See **PQ-13** for what uniformity implies on plain objects.

**The rule was falsified as stated, 2026-08-06, by [C10](#c10-the-moonbase-computer-system).** A moonbase computer system has a port egressing to the lab, presence-linked to a terminal --- topology identical to the rope's --- and the rule therefore declares the whole system present in the lab, which is wrong. **The rule is not repairable by inspecting the graph**, since the two cases are structurally indistinguishable; it needs the declared **apprehension scale** the C10 write-up proposes. **What survives unharmed** is everything the rule was actually recruited for here: presence is a *consistency invariant* rather than a reader's derivation, membership stays in `positionGraph`, and AB-17's criterion (i) is still a read off the egress list. Kept in place rather than rewritten, per this plan's supersession rule --- the falsification is a qualification on one clause, not a retraction of the case.

**The rule it needs and does not state:** port 3 goes C -> B rather than C -> A because the rope is continuous and its far end travels the path. So **relocation follows adjacency** --- and nothing in the scheme says so. **PQ-12.**

**Annotations.** Write-side --- **homogeneous extent** (AB-16) --- neither Improvisation nor Recognition; this is *reabsorption-adjacent lifecycle*, which no AB-14 trigger covers --- mechanism --- exercises no improvisation gap, and that absence is itself the finding.

**Rows grounded.** AB-6 (presence derivation), AB-15 (naming seam dissolved), AB-17 (criterion (i) mechanized), AB-26 (adjacency on the write side), H1 clause 5 (nothing to do), AB-8.

### C10. The moonbase computer system

**Origin:** proposed 2026-08-06 to open the question of abstractions that ladder **above** human-scale direct perception. **Deliberately built from plain `OBJECT#`s.** Landmark Features and Areas are the obvious carriers for above-human-scale things and both are parked behind their own prerequisites; this case shows the question can be asked and answered without unparking either, which is why it is cheap enough to run now.

**The state.** `OBJECT#MoonbaseComputer` has parts scattered across the base: `Terminal1` in the lab, `Terminal2` in the mess, `DoorCtl3` at the airlock, `Drone2` wherever it currently is. Nothing about the composition is unusual --- heterogeneous, separable, level-crossing, spatially incoherent by design.

**The limit hit, and it is a rule this plan currently treats as an invariant.** Model the system under the [locked frame](AGENT.abstractionLayers.planning.md#locked-frame-parts-and-ports-2026-08-06) and it comes out **structurally identical to the rope**:

| | Rope | Computer system |
| --- | --- | --- |
| Root | `OBJECT#ROPE` | `OBJECT#MoonbaseComputer` |
| Member in the lab / room A | `RopeEnd1` | `Terminal1` |
| Port | 1 -> `ROOM#A`, presence-linked to `RopeEnd1` | 1 -> `ROOM#Lab`, presence-linked to `Terminal1` |

Same topology, and **[C9](#c9-coiling-the-rope-back-in)'s membership rule --- *an object is present in a room iff at least one of its ports egresses there* --- therefore puts the whole computer system in the lab.** That is the wrong answer. From a terminal you see **a terminal**, not a moonbase computer system; the rope, by contrast, is apprehensible *as a rope* from any room it passes through even though its whole span is not.

**The code consequence, so this is a limit and not a preference.** [`roomObjectCatalogForCharacter`](../../../../../lambda/ephemera/dataSource/actions/roomObjectCatalogForCharacter.ts) scans `positionGraph.objectIds`, so a present whole enters the catalog of **every** room holding a part, and per-room compose renders it once per room. That is [C2](#c2-the-rope-in-two-rooms-refused-at-the-gate)'s defect --- a whole rendered twice --- with fifteen rooms instead of two, and it is exactly counter to scaling attention to the level being attended to.

**What the case establishes: the answer is not derivable from the graph.** Two objects with identical port topology require different room-scale answers. No structural predicate separates them, so **it must be declared.** This is the test **AB-16** failed --- a clean split of the corpus that predicted nothing --- and this one passes it: the fork is visible in what a room's description contains, and no rearrangement of the representation derives it.

#### The reframe: apprehension scale, not a hosting mode

**Proposed as two hosting modes** --- the whole hosted in the rooms where its parts appear (a), or at a higher node (b) --- **selected per-abstraction by perceptibility, rather than globally.** The per-abstraction half is the durable insight. **The hosting half is probably the wrong carrier for it, and adopting it as stated would re-open something the lock closed.**

Under ports there is exactly **one** system graph either way, and the rope is not "hosted in a room" in any strong sense --- it is *listed* where it is present, which [the re-pricing section](AGENT.abstractionLayers.planning.md#consequence-ports-re-price-the-three-positions-table) already noted is closer to a presence index than to real multi-hosting. So (a)-versus-(b) was largely dissolved before this case arrived. **What actually varies is narrower: does the whole surface at the level of its parts, or only by traversal from them.**

**One mechanism with a declared field, not two modes.** Same shape as [PQ-2](AGENT.abstractionLayers.planning.md#open-questions-ab-34-sub-questions-ids-stable-never-reused)'s "a port's exterior end is a graph, plus optionally a local endpoint," and the same shape as the argument that rescued [position 2](AGENT.abstractionLayers.planning.md#three-positions-on-reference-and-what-clause-1b-actually-costs). Working name for the field: **apprehension scale** --- at which level is this thing the answer to *what is here*.

**Consequence for the pending clause-1b decision, and it is the largest fold.** This case suggests **the (a)/(b) fork was mis-framed as global**. The live question has been *which one wins*; C10 argues *that was never one question*. Worth having in hand **before** 1b is decided, because it changes what is being decided rather than adding to one side of it. Note this is not a fifth pressure on 1b in the sense [the motivation section](AGENT.abstractionLayers.planning.md#the-motivation-stated-plainly-2026-08-06) tallies --- it does not push toward withdrawal; it questions the shape of the choice.

#### Two discomforts it resolves

**Non-presence becomes legitimate rather than a defect.** [C7](#c7-ariadnes-thread) recorded that extent "leaves the whole nowhere in particular," and it read as a gap. **Some wholes correctly live nowhere**, and the computer system is the clean example --- Ariadne's thread was weak evidence for this, since a thread *is* apprehensible as a thread.

**It is an instance of [scale-relative truth](AGENT.abstractionLayers.planning.md#clean-fractal-dirty-implementation)**, arriving independently the same day that category was added. "There is a terminal here" is not a lossy version of "there is a computer system here" --- it is correct at room scale, as "there is a rope here" is correct at room scale. Two correct room-scale answers, differing because the objects sit at different apprehension scales. **The category was added from coarsening and is now confirmed from a second direction**, which is worth more than either instance alone.

**It also softens **AB-25**'s residue.** [The scale-invariance assessment](AGENT.abstractionLayers.planning.md#what-the-lock-delivered-for-scale-invariance-and-where-it-stops-assessed-2026-08-06) states the fractal stops at the room boundary. An Object abstraction laddering above human scale **while staying an Object** suggests it extends upward without Room/Area needing to be ported at all. **Not a full answer** --- Room/Area's authored-provenance problem is untouched --- but the boundary is less absolute than that section states, and the section should be read with this case beside it.

#### The live challenge, recorded rather than answered

**Is apprehension scale world truth, or perspective-relative?** A moonbase engineer at a terminal may well say "the computer system"; a newcomer sees a terminal. That is **AB-23** territory, and if apprehension is perspective-relative it cannot be a stored property of the object --- which would unseat the whole reframe.

**A second challenge arrived 2026-08-07 from [C11](#c11-the-rube-goldberg-machine), and it is the harder of the two: *position*-relativity.** A Rube Goldberg machine reads as a contraption from the room holding its trigger and as furniture from the room holding its payoff --- same object, same observer. Perspective-relativity could be pushed to reference time and leave a stored structural fact; position-relativity makes apprehension a property of **(object, host)** rather than of the object, so there is no per-object field to declare. C11 also sits **between** this case and the rope, which tests an assumption made here on two extreme data points: that the field is binary. **Read both challenges together before adopting the reframe.**

**The defence, and it is not yet strong enough to close the question.** [Part-mediated reference](AGENT.abstractionLayers.planning.md#part-mediated-reference-how-h1-answers-its-own-replacement-trigger) **already decouples reference from presence**: "the computer system" binds by traversal from the terminal without the system being present, exactly as with the rope. So the perspective-relative thing is *reference*, handled elsewhere, and what is stored is the structural question of what a room contains. **This is the objection that would unseat the case if it holds**, so it is written here rather than dismissed in passing.

**One genuinely new question, belonging to another initiative.** If a non-present whole changes state, **who is notified?** The rope narrates room-scoped because it is present; the system's parts are in rooms and the system is not. Raised for [relational narration](../../AGENT.relationalNarration.planning.md), not answered here.

**Annotations.** Read-side --- **heterogeneous separable** (AB-16, descriptive) --- neither Improvisation nor Recognition, since the system is *authored* rather than composed in play, and that absence is a finding: the corpus had no authored above-human-scale whole --- description --- exercises no improvisation gap.

**Rows grounded.** AB-12 (above-human-scale abstraction with no Feature or Area dependency), AB-15 (apprehension versus authored binding level), AB-23 (the live challenge), AB-6 (presence half --- C9's rule needs qualifying), AB-25 (residue softened), H1 clause 1b (the fork re-framed).

### C11. The Rube Goldberg machine

**Origin:** proposed 2026-08-07, **as a direct challenge to an assessment made in this plan hours earlier.** An argument for retaining [H1](AGENT.abstractionLayers.planning.md#h1-is-a-conjunction-and-its-clauses-are-tested-separately)'s clause 1a leaned on parts and wholes being different kinds of thing with different hosting rules; the objection was that a scale-invariant system cannot be built on that basis, because **whole and part are consequences of point of view and positioning, not attributes of an item.** No case C1--C10 could settle it: every one of them has exactly two levels, so nothing in the corpus had ever occupied both roles at once. **This case was built to supply the missing level.**

**The state.** `OBJECT#RubeGoldbergMachine` has parts `Platform`, `String`, `Monkey` (on a unicycle), `IroningBoard`, `AlarmClock`.

- `Platform` and `Monkey` are in `ROOM#A`; `IroningBoard` and `AlarmClock` are in `ROOM#B`.
- `Monkey` is **on** `Platform`; `AlarmClock` is **under** `IroningBoard` --- ordinary intra-host relational edges.
- `String` is **multi-present across both rooms**, tied to the platform at one end and the ironing board at the other.
- `String` has its own parts: `StringEnd1`, `StringSpan`, `StringEnd2`.
- And `StringSpan` is **either** a single object present in both rooms **or** itself a whole of two sub-span parts.

**The purpose the machine exists to serve, which the model must eventually support reasoning about:** *something startles the monkey, which rides its unicycle down the string, knocking over the ironing board and setting off the alarm clock.*

#### Finding 1: clause 1a is falsified, on a single object

**The chain has four levels and every middle term occupies both roles at once:**

```text
OBJECT#RubeGoldbergMachine        whole
  +-- OBJECT#String               part of RGM      AND whole of its spans
        +-- OBJECT#StringSpan     part of String   AND whole of its sub-spans
              +-- SpanA, SpanB    parts
```

Now apply the two rules the plan currently holds simultaneously:

| Rule | What it says about `StringSpan` | Because |
| --- | --- | --- |
| **Clause 1a** --- parts have exactly one host | **Single-host.** A span crossing A and B must be decomposed further | `StringSpan` is a part of `String` |
| **Clause 1b withdrawn** --- wholes may be multi-host | **Multi-host is permitted** | `StringSpan` is a whole of `SpanA` and `SpanB` |

**Same object, same moment, two hosting rules.** 1a and a multi-host reading of wholes are **jointly unsatisfiable** the instant whole and part stop being disjoint --- and this case makes them non-disjoint in a single unbroken chain, with no contrivance and nothing borrowed from another axis.

**And 1a's justification was never a derivation.** *"A part spanning two rooms would be decomposed further"* has **no base case**: extent can always be cut again, so the rule does not terminate --- it promises to keep recursing. The plan already carried the caveat *"hold even 1a loosely: it follows from the decomposition rule, not as a theorem."* **That caveat was the whole objection, and it was read as a hedge.** Recorded plainly because this is the second time in this plan that a stated reservation was carried forward without being acted on.

#### Finding 2: decomposition is demoted from correctness to convenience

Both readings of `StringSpan` must be **legal**, and --- this is the load-bearing half --- they must give **the same answers**. Nothing in the fiction distinguishes them: a string crossing a doorway is one string, whether or not anyone has drawn a line on it. If the model's answers depend on which reading was chosen, the model is exposing an artifact of its own bookkeeping as a world fact.

**So decomposition stops being something the model requires and becomes something a modeller may do.** This is the first place in the corpus where a structural choice has been found to be genuinely free, and it is a substantially larger claim than this case was built to make --- **being worked separately rather than settled here.**

#### Finding 3: PQ-13 is the fractal's base case, not a calibration question

**[PQ-13](AGENT.abstractionLayers.planning.md#open-questions-ab-34-sub-questions-ids-stable-never-reused)** --- does a plain object carry a presence port --- was deliberately excluded from the [locked frame](AGENT.abstractionLayers.planning.md#locked-frame-parts-and-ports-2026-08-06), on the grounds that the uniformity argument was good and the ceremony objection survived. **This case raises what being wrong about it costs.** If a lantern is present by membership node and a rope is present by port, there are **two presence mechanisms**, and the level at which an object switches between them is exactly the whole/part distinction this case just dissolved. The invariance claim then fails at the bottom of the ladder rather than at the top.

**It does not answer PQ-13**, and the ceremony objection is untouched. It moves the row from *calibration inside the lock* to *the thing the lock's first claim rests on*, and it should be decided before anything downstream of it.

#### The code consequence, and it retires a claim made earlier the same day

**The claim, now withdrawn:** that [`complexityPreGates.ts:29`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/complexityPreGates.ts)'s `multiPresent` terminal error survives multi-host wholes untouched, because [part-mediated reference](AGENT.abstractionLayers.planning.md#part-mediated-reference-how-h1-answers-its-own-replacement-trigger) binds a player's utterance to the locally-present **part**, which is single-hosted.

**That rested entirely on clause 1a.** With 1a gone, a player in `ROOM#A` can say *"pull the string"* and ground it on an undecomposed, genuinely multi-present object; `containers.length === 2`; the command is refused. **P1's five-code-sites argument is therefore back in force**, not answered.

**What ports offer is a fix, not an exemption.** The gate's question stops being *"which of these hosts did you mean"* --- unanswerable, hence the error --- and becomes *"which port egresses here"*, which the room the speaker is standing in answers. That is a real and bounded change at a site that today refuses the command outright. **Price it as work.** The other four sites (end-state planner, the relational route's `hostByObjectId`, the singular `toHostId`, per-room affordance compose) are **unchecked against this case**, and per-room compose is the one to expect trouble from, on [C10](#c10-the-moonbase-computer-system)'s evidence.

#### What it does that no other case does: depth, where C6 gave breadth

[C6](#c6-the-rope-the-candle-and-the-impromptu-timer) establishes that the composition graph is a **DAG rather than a tree** --- one part, two wholes, side by side. **C11 establishes that it has no privileged level** --- four levels deep, with every interior term both a part and a whole. The two are independent properties and the corpus previously had only the first. Together they are the pair that makes the word *fractal* mean something operationally: no privileged level and no single parent.

**Note what this does to the [three positions](AGENT.abstractionLayers.planning.md#three-positions-on-reference-and-what-clause-1b-actually-costs) table.** Position 2's rescue --- *a loop that sometimes iterates zero times is one mechanism* --- was argued with a one-hop example (a thread in a room). Here reaching the RGM from `ROOM#A` is **two hops or three**, depending on a modelling choice that [Finding 2](#finding-2-decomposition-is-demoted-from-correctness-to-convenience) says should not matter. The argument survives --- *n* hops is still one loop --- but it now has to survive a **variable** *n*, which is a stronger form of the same claim and was never tested.

#### A second live challenge to apprehension scale, and it may be worse than the first

[C10](#c10-the-moonbase-computer-system) proposed **apprehension scale** as a declared field, and recorded AB-23's *perspective*-relativity as the objection that would unseat it. **C11 supplies a different one: position-relativity.**

From `ROOM#A` you see a platform, a monkey on a unicycle, and a string running out through the wall. That is plausibly apprehensible **as a contraption**. From `ROOM#B` you see an ironing board with an alarm clock under it --- furniture. **Same object, same observer, different room, different answer.**

**Why this is the harder objection.** Perspective-relativity could in principle be handled at reference time, leaving what is *stored* a structural fact about the object. Position-relativity cannot: it makes apprehension a property of **(object, room)** rather than of the object, so there is no per-object field to declare. And the RGM sits **between** the rope (apprehensible everywhere) and the moonbase computer (apprehensible nowhere), which tests whether the field is even binary --- C10 assumed it was, having only two data points at the extremes.

**Not fatal, and deliberately not answered here.** A per-(object, host) declaration is a coherent shape --- it is what a port already is --- and the coarsening default may cover the rest. **Recorded as C10's second challenge**, so the reframe is not adopted on one unexamined axis.

#### The locked frame survives this, stated explicitly rather than assumed

**Neither locked clause fails.** A whole has its own graph with a root node: true at every level of the chain, which is the recursion working. Boundary crossings are interior-owned bindings: `ROOM#A -> RGM -> String -> StringSpan` is [PQ-5](AGENT.abstractionLayers.planning.md#open-questions-ab-34-sub-questions-ids-stable-never-reused)'s chaining, and **this is the first case that *requires* it rather than merely permitting it.** The [re-open criterion](AGENT.abstractionLayers.planning.md#what-would-re-open-a-locked-clause) --- a case a clause cannot represent --- is **not met**.

**One clarification the frame does need, and it is a foreclosed misreading rather than a lifted clause.** The lock's wording, and the vocabulary table graduated to [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#wholes-parts-and-ports), define *whole* and *part* in a way a reader can take as **kinds**. They are **roles an object occupies relative to a level, simultaneously and at every level.** Same category as [what a port number is not](AGENT.abstractionLayers.planning.md#what-a-port-number-is-not-added-2026-08-06): the construct was right and its negative statement was missing.

#### The purpose half, kept separate on purpose

The machine's reason for existing is a **causal chain that crosses a room boundary**: startle -> monkey rides the string -> ironing board falls -> alarm sounds. Reasoning about it is [C3](#c3-the-snare-trap-coyote-cannot-name)'s problem --- the arrangement *is* the content, and a flat per-room bag of nouns discards it --- with two things C3 did not have.

1. **The mechanism spans hosts.** C3's snare is assembled within one room, so a room-scoped context could in principle carry it. No room's context contains this machine; `ROOM#A` holds the trigger and `ROOM#B` holds the payoff, and the causal link between them is the string.
2. **The relevant level is one no room describes.** This is [C10](#c10-the-moonbase-computer-system)'s apprehension question arriving from the **reasoning** side rather than the description side --- and the two sides may not want the same answer, since a thing can be worth reasoning about at a level at which it is not worth mentioning.

**Deliberately not developed here.** It is AB-19 / AB-22 / AB-18 territory and it must not be tangled with the hosting argument, which now stands without it.

**Annotations.** Both sides --- **heterogeneous separable** (AB-16, descriptive; the string's own parts are homogeneous extent, so the case carries both tags at different levels, which is itself the point) --- **authored**, so neither AB-14 trigger fires, the same gap [C10](#c10-the-moonbase-computer-system) records --- mechanism, emphatically --- exercises gap 1 (**no composition relation**) at every level of the chain at once, and gap 2 for the machine's purpose.

**Rows grounded.** H1 clause 1a (**falsified**), H1 clause 1b (the joint-unsatisfiability argument), AB-13 (depth where C6 gave breadth), AB-23 (position-relativity, a second challenge), AB-4, AB-6, AB-8, AB-32, AB-2, and **PQ-13** (promoted to base case) and **PQ-5** (first required, not merely permitted).

### Parks deliberately not mined

The other four parks in [The dependency is asymmetric](AGENT.abstractionLayers.planning.md#the-dependency-is-asymmetric-representation-unblocks-reasoning)'s right-hand column were considered and excluded, so a later reader does not re-check them: **BD-24** / iteration 6 and **C3** / `MultipleCommands` are *demand*-blocked (no concrete case currently demands either), **BD-18** / backtrack channel is *architecture*-blocked and is a sibling initiative to schedule against rather than absorb, and iteration 2's remaining fallback steps are prompt and calibration work. None would move on a representation change, so none yields a corpus case.

