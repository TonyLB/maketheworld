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

**The axis tag is the exception, and lives in the [axis tally](#axis-tally-c1--c16) instead of on the line.** It was assigned to all eleven cases at once on 2026-08-07, it is read as a column rather than per case, and keeping one home stops it drifting from a per-case copy. **Note the convergence rather than duplicating it:** AB-19's *description or mechanism* tag on each line is **apprehension versus reasoning under an earlier name**, which is why the retro-fit cost nothing and why the two should not both be maintained as though they were independent.

### Axis tally (C1--C16)

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
| [C12](#c12-the-moonbase-power-system-and-the-cut-cable) --- moonbase power system | **Reasoning** | Mutation, Apprehension | Coarsening a reachability fact **invents a conclusion** rather than dropping detail. Mutation secondarily: **no play-time path exists** by which repairing a generator changes world state |
| [C13](#c13-taking-and-returning-the-fork) --- taking (and returning) the fork | **Mutation** | Reasoning | Neither shipped code nor H3 names a step for a part crossing its whole's interior-graph boundary in either direction; the shrinking whole's remainder has no stated description rule |
| [C14](#c14-the-tray-its-cups-and-how-many-times-it-gets-picked-up) --- the tray, its cups, and how many times it gets picked up | **Mutation** | Positioning, Reasoning | Carry closure and composition turn out to be one computation in two types; which of two survivors (durable vs ephemeral) wins is AB-6's stored/derived fork again, on repetition count. Positioning secondarily: `defer`'s missing resolution path turns out to be a representable-boundary gap, not an ambiguity, and ports close it |
| [C15](#c15-the-microphone-the-wire-and-the-speaker-two-rooms-away) --- the microphone, the wire, and the speaker two rooms away | **Apprehension** | Reasoning | Fails C10's own local-apprehensibility test, unlike a rope or thread; the missing *unauthored* above-scale case, and the first Recognition-tagged case above human scale |
| [C16](#c16-the-bare-table-and-the-room-that-is-just-a-mess) --- the bare table, and the room that is just a mess | **Reasoning** | Apprehension | Two negative cases: no candidate pattern at all (the table), and a candidate pattern that still shouldn't mint, per AB-9's guardrail (the mess) |

**Seven results worth reading off the column rather than the rows.**

1. **Authoring has no primary case.** Eleven cases and zero coverage. C4 and C8 touch it secondarily and that is all. **This is a measurement, not a to-do:** the initiative has evaluated representations for players and LLMs and never once from the position of the person writing the world. C10 and C11 are both *authored* and both record that neither AB-14 trigger fires, so the corpus has improvisation at human scale and authorship above it **with nothing crossing**.
2. **The positioning-primary cases are the ones that discriminated least.** C6 explicitly added zero `H1-dependent` rows; C7 discriminated once and then the axis went quiet. That is the filter behaving exactly as [the frame](AGENT.abstractionLayers.planning.md#the-five-axes-what-the-graphs-flexibility-is-in-service-to) predicts, arrived at from the corpus side.
3. **[C11](#c11-the-rube-goldberg-machine) bit on none of the five, and that is a sixth mode worth naming.** Clause 1a was not falsified by an audience noticing anything --- it was falsified by **internal contradiction**, one object taking two incompatible rules. A case can therefore discriminate by making a proposal *inconsistent with itself*, independent of any consumer. Rare, decisive when it happens, and it should not be forced into an axis it does not belong to.
4. **[C13](#c13-taking-and-returning-the-fork) is the corpus's first case authored against a hypothesis's own clause table rather than mined or offered as a hard scenario**, and the first mutation-primary case that is not a worked *success* (C9, C12 both showed a scheme handling an operation correctly; C13 shows H3 currently cannot). The corpus had tested representability under static and fixed-depth-operational conditions eleven cases running; testing a hypothesis's edges by deliberately mutating across the seams it just drew is a distinct kind of case, worth watching for going forward rather than assuming C1--C12's mix of origins will keep surfacing it on its own.
5. **[C14](#c14-the-tray-its-cups-and-how-many-times-it-gets-picked-up) is the first case to test competing *mechanisms* against one scenario rather than one representation against a limit.** C1--C13 each ask "can this be represented / does this operation work"; C14 asks "of three things that all work, which one should exist," with the answer resolving into a row (AB-6) the corpus had already been using for a different pair of options. Worth watching whether mechanism-comparison cases keep recurring now that H3 has enough shape to have more than one way to satisfy a requirement --- C1--C13 mostly didn't have that problem yet.
6. **[C15](#c15-the-microphone-the-wire-and-the-speaker-two-rooms-away) is the corpus's first Recognition-tagged case above human scale**, and it discriminates on the same test C10 used to define the bucket rather than a looser "spans multiple rooms" reading --- C7's thread already does that at human scale, which is why C15 checks itself against C10's actual sentence rather than assuming scale alone qualifies it. Apprehension-primary and Reasoning-secondary is also a pairing no earlier case has: C10 is Apprehension-then-Reasoning too, but authored, so this is the pairing's first unauthored instance.
7. **[C16](#c16-the-bare-table-and-the-room-that-is-just-a-mess) is the corpus's first pair of deliberately negative cases**, and its own internal split is the finding: "nothing to recognize" (the table, where every axis returns empty) and "something recognizable that still shouldn't mint" (the mess, where AB-9's guardrail rather than absence of pattern does the work) are different failure modes, not the same one at two scales. Both are compact by design --- weight would misstate what they cost to establish.

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

### C12. The moonbase power system, and the cut cable

**Origin:** **seed example 3**, in this plan since day one and never worked. Run 2026-08-07 as the discriminating case for **AB-1's state facet** --- the corpus's only *stateful* aggregate, and the gap that had kept AB-1 parked. Set in the same moonbase as [C10](#c10-the-moonbase-computer-system) deliberately, so a **composition** whose parts are scattered and a **causal network** whose participants are scattered can be compared in one setting.

**The state.** `OBJECT#PowerSystem` has `Generator` in the plant room, `TrunkCable` spanning the base, and `AirlockBranch` and `LabBranch` running off it. `OBJECT#AirlockDoor` sits in `ROOM#Airlock` and is **attached to** the power system --- *not* a part of it.

**The scenario, in three beats.** The generator is broken and the airlock door will not open. Someone repairs the generator **in the plant room**, and the door in another room should now work. Then someone **cuts `AirlockBranch`.** The system is still powered; the lab still has light; the door does not open.

**The rule the fiction wants, and it is exactly the shape this initiative keeps meeting:** *when the power system is powered, everything attached to it is powered* --- a coarse statement, correct almost always, **ripe for exception the moment anyone cuts anything.**

#### Today's model: there is nowhere for any of it to live

| What is needed | Where it would go | Status |
| --- | --- | --- |
| State on the door ("powered") | An object-level state carrier | **Structurally absent.** [`requestIntake.ts:11`](../../../../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.ts) states it as a rule --- Feature/Knowledge/Object/Character hosts always get `markState: { markValue: [] }`. Not a deferral; there is no carrier to switch on |
| An area-wide power fact | `Meta::Room.state.marks` | **Exists, and is the wrong shape twice over.** It is Room-scoped, and it mutates **only** via an inbound API `State Change` message ([`app.ts:264-283`](../../../../../lambda/ephemera/app.ts)) --- an operator poking marks from outside. **No play-time path exists by which repairing a generator changes the world's power state** |
| `Generator -powers-> AirlockDoor` | A relational edge | **No causal edge kind exists.** Kinds are `On` / `Under` / `Against` / `Custom` --- all spatial --- and `HostRelationalEdge` endpoints are object-only. **And it could not cross rooms anyway:** [`applyStepSequenceCore`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/applyStepSequenceCore.ts) derives a relational step's shared host live and **throws** on mismatch |

**So the coarse rule has no home at any of the three plausible ones**, and the exception has nowhere to be recorded even if the rule did.

#### Finding 1: the isomorphism, mechanism by mechanism

**Every construct built on the positional side has a state twin, and the mapping is tighter than "these rhyme."**

| Positional mechanism | State twin |
| --- | --- |
| Whole and part are **roles**, not kinds ([C11](#c11-the-rube-goldberg-machine)) | A power system has subsystems; a subsystem is both |
| **On-demand improvisation** --- a locus minted because a relation needs an endpoint ([C5](#c5-the-chain-mounted-at-both-ends)'s third trigger) | `AirlockBranch` has no parts until it is cut, and then it needs two |
| **Coarsening** --- resolve at the level available | "Is terminal 3 powered?" with no cable-level detail resolves via the system |
| **The summarization seam** --- a snag ports through the span ([C7](#the-nesting-question-run-2026-08-07)) | *"The power system reports a fault"* --- with **where** retrievable and omittable |
| **Scale-relative truth** | "The base has power" and "this door does not" are both correct |
| **No privileged level** | Power at the base, the circuit, the socket |

**This is a requirements argument, not a corpus finding**, and it should be labelled as such: it is the same class as AB-32's same-mechanism requirement, which produced [the three positions](AGENT.abstractionLayers.planning.md#three-positions-on-reference-and-what-clause-1b-actually-costs). That class has been decisive here twice, which is why it carries weight the structural evidence alone did not.

#### Finding 2: the cut cable is fission on a causal edge --- and the locked frame already handles it

Cutting `AirlockBranch` repartitions the power system's interior: one member becomes two, one of which no longer conducts. **That is AB-31, arriving on a relation that is not positional at all.**

**Under the [locked frame](AGENT.abstractionLayers.planning.md#locked-frame-parts-and-ports-2026-08-06) nothing outside the system breaks.** External references name the system through its ports; the repartition is interior; ports rebind. **The encapsulation payoff lands on a case it was never designed for** --- and it means unification costs **no new machinery for the scenario that motivates it**, which is the strongest practical argument available for it.

Fourth time this plan has found a discipline anticipating a case outside its brief (AB-28, AB-29, C5, now this). **Worth noting the pattern is becoming evidence rather than luck**, and worth resisting: the [carry-closure-meets-composition-edge test](AGENT.abstractionLayers.planning.md#what-counts-as-a-falsification-case-learned-the-hard-way-2026-08-05) is still queued precisely to find somewhere it *does not* hold.

#### Finding 3: coarsening is truth-preserving on containment and **truth-destroying** on causality

**This is the case's sharpest technical result, and it changes what the summarization seam is for.**

| | Coarsened claim | After the exception |
| --- | --- | --- |
| **Containment** --- "tied to the bag's strap" -> "tied to the bag" | Less precise | **Still true** |
| **Causality** --- "the system is powered" -> "the door is powered" | Reads like the same move | **False.** The branch is cut |

**The difference is that coarsening a containment fact generalises, while coarsening a reachability fact *assumes reachability*.** One drops detail; the other invents a conclusion.

**So [the summarization seam](AGENT.abstractionLayers.planning.md#a-third-argument-on-a-third-axis-the-port-is-the-summarization-seam-2026-08-07) is not an optimisation on the state side --- it is a correctness requirement.** A fault must port up to the whole, or the coarse answer is unsound rather than merely coarse. This is [no silent omission](AGENT.abstractionLayers.planning.md#correction-same-day-reasoning-wants-no-silent-omission-not-losslessness) with teeth: on the positional side omitting silently costs precision; here it produces a wrong answer a player acts on.

**It also sharpens the two-operations split.** [Coarsening was found to name failure-recovery and deliberate summarization](AGENT.abstractionLayers.planning.md#a-port-is-a-scale-boundary-not-a-relay-2026-08-06), with opposite requirements about silence. **On causal edges, failure-recovery is not safe either** --- resolving an unreachable address by falling back to the whole is exactly the unsound inference above. The safe default on a causal graph is **"unknown", not "the whole's answer"**, which is a third behaviour neither operation currently has.

#### Finding 4: the cost, which the unification argument does not price

**Unifying pulls AB-6 toward *derived*, and position has been pulling it toward *stored*.**

"Is the door powered" is not a lookup --- it is **reachability from a source through intact edges**, and it must be evaluated. It cannot be cached, because a cut anywhere invalidates it, and storing the answer recreates precisely the drift the cut exists to expose.

Position has the opposite pressure: [part-mediated reference](AGENT.abstractionLayers.planning.md#part-mediated-reference-how-h1-answers-its-own-replacement-trigger) forced AB-6 toward **stored** because `computeStepSequenceFootprint` runs once and every part and host must be known before the walk begins.

**So under one substrate the two facets pull AB-6 in opposite directions, each for a good reason.** Recorded as the real content of unification's blast radius. **It is a mutation-axis cost for a reasoning-axis gain --- the same shape as AB-37, one day later**, which is starting to look like this design's characteristic trade rather than a coincidence.

**A softening worth stating:** state does not introduce this problem so much as **remove the option of dodging it.** [C7](#c7-ariadnes-thread)'s derived-presence question is the same reachability walk, unresolved because position can get away with stored. **When it is evaluated, and against which snapshot, is now AB-39.**

#### Finding 5: one substrate, and emphatically not one type

**Two disanalogies, and both argue for the middle option rather than against unification.**

1. **Directionality.** Part-of is containment. *Powers* is **directed**: the generator powers the door and not the reverse, and a traversal that runs backwards produces nonsense. Same substrate, different traversal rule.
2. **Participation, not parthood.** A hinge is part of a door. The door is *attached to* the power system without being part of it --- which this plan noticed early ("a generator is not *part of* a door"). The system's member set is **participants**.

The substrate already tolerates both: AB-26's licensing rule is **any kind, any provenance**.

**A third disanalogy exists and is bounded by charter rather than by argument.** Reachability is binary and composes trivially; water pressure or temperature would need **arithmetic along the graph**, which position never needs. [`diegeticLogic/AGENT.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.md) commits to "enough structure for narrative copy, affordances, and generation context, **without treating the world as a fully simulated physical space**." **So this is out of scope by an existing commitment --- and if that commitment ever changes, this case is where unification gets re-examined.**

#### What this case must not be read as licensing

**Not a power simulator.** AB-19 already rejected compiling fictional physics into deterministic structure: an abstraction's job is the right-sized packet for an LLM step, not a lookup replacing it. Applied here, the system hands the reasoning step *"power system: powered; one fault reported, on the airlock branch"* and lets it work out what follows. **That is the seam, not a solver**, and the distinction is one careless reading apart.

#### Alongside C10, on apprehension

Is the power system apprehensible from the airlock? You see a door, and perhaps a conduit. **The same question [C10](#c10-the-moonbase-computer-system) raised and the same likely answer** --- no --- which is mild evidence that apprehension scale is a property of the abstraction rather than of its kind, since a composition and a causal network land the same way. **Mild, because both are authored above-human-scale systems in one setting**, and two cases sharing a designer is weak sampling.

**Annotations.** Both sides --- read-side (*is the door powered*) and write-side (repair, cut) --- **heterogeneous separable** (AB-16, descriptive; participants are unlike by construction) --- **Improvisation, on-demand and relation-driven**, [C5](#c5-the-chain-mounted-at-both-ends)'s third trigger firing on a causal relation for the first time --- **mechanism**, emphatically --- exercises **gap 1**, and worse than elsewhere: there is no composition relation *and* no causal relation.

**Rows grounded.** **AB-1** (primary --- the state facet, and the case it was waiting for), AB-7 (the carrier question, now with a worked instance), **AB-6** (pulled toward derived, against position), **AB-31** (fission on a causal edge), **AB-39** (opened), AB-19, AB-26, AB-23, AB-37.

### C13. Taking (and returning) the fork

**Origin:** proposed 2026-08-07, run directly against [H3](AGENT.abstractionLayers.planning.md#h3-ports-as-the-boundary-mechanism-decomposition-as-a-modellers-choice) the same day it was adopted --- the corpus's first case authored to test a *hypothesis under construction* for a gap in its own clause table, rather than mined from a park or offered as a hard scenario. Motivated by a structural observation about the corpus itself: C1--C12 are overwhelmingly **static** --- states checked for representability --- or, where operational (C9, C12), operate at a fixed decomposition depth. None combines an **improvised decomposition** (C8's trigger) with a **subsequent mutation on a newly-minted part**, and none checks a mutation's *reverse*.

**The state.** A place setting sits undecomposed on the table in a room, `OBJECT#PlaceSetting`. A character looks closely; per [C8](#c8-the-flashlight-that-vanished-when-someone-looked-at-it)'s trigger, the improvised detail layer generates `Plate`, `Cup`, `Fork`, `Knife`, `Spoon`, minted as parts of `PlaceSetting`'s interior graph per [H3 clause 1](AGENT.abstractionLayers.planning.md#h3-ports-as-the-boundary-mechanism-decomposition-as-a-modellers-choice) --- a root node, `part` edges to each, sibling links recording the arrangement. The room continues to reference `OBJECT#PlaceSetting` by name through its port, per H3 clause 4.

**The operation, in two beats.** The character **takes the fork**. Later, the character **puts the fork back**.

#### Finding 1: "take" has no step kind, because the fork is not where the kernel looks for it

Under today's shipped model a part is an ordinary Object node sitting directly in the room's `positionGraph` --- "works today, unchanged," per [part-mediated reference](AGENT.abstractionLayers.planning.md#part-mediated-reference-how-h1-answers-its-own-replacement-trigger)'s finding for H1. **That stops being true under H3.** [C9](#c9-coiling-the-rope-back-in)'s own worked example puts a part inside the *whole's own* interior graph --- `OBJECT#RopeEnd1` lives in `OBJECT#ROPE`'s `positionGraph`, not in the room's --- and the room holds only a port reference. The fork is exactly this: an interior node of `PlaceSetting`'s graph, not a node `applyStepSequenceCore` or `computeStepSequenceFootprint` has ever been asked to source a step from. **Taking the fork requires a step that (a) removes a node from a graph nested inside another object, and (b) inserts it into an unrelated top-level graph (the character's).** Neither shipped code nor H3's clause table describes this. `MutationKernelTransferStep`'s singular `toHostId` was flagged once already, in [C7](#c7-ariadnes-thread), as unable to express a pure-add; whether it can express *sourcing from an interior graph at all* is untested and looks like a second, independent gap at the same site.

**AB-11 does not answer this.** AB-11's candidate answer --- "pull" expands into per-part steps via Synthesize's Expansion --- was argued for a **whole-level** operation (pull the rope, and the whole's parts each get a step). Taking the fork is the opposite shape: a **single named part**, addressed directly, leaving its whole while the whole stays put. AB-11's mechanism was never asked to cover this, and nothing says it does.

#### Finding 2: the remainder's coherence has no stated rule

Suppose the step problem is solved and the fork is gone. **What does `PlaceSetting` say about itself now?** Three live candidates, and H3 picks none of them:

| Candidate | What it requires |
| --- | --- |
| The interior graph silently drops the `part` edge, `PlaceSetting` reports as before | Wrong --- contradicts the fiction; the setting **is** missing a fork |
| `PlaceSetting`'s description is regenerated to note the absence | Needs a description-regeneration trigger this plan has never named for a *shrinking* whole --- AB-14's triggers are all about **minting**, none about a whole's summary needing to react to a part's departure |
| The absence is only visible by traversing the interior graph and noticing four parts where five were minted | Reproduces [C7](#c7-ariadnes-thread)'s nesting argument **backwards**: the whole point of a nested summary was to avoid reading every constituent; a remainder that can only be known by re-enumerating the parts is the flat framing C7 argued against |

**No case before this one asked what a whole says about itself after it has lost a part it did not lose all at once (fission) or lose entirely (full reabsorption).** AB-31 covers a whole splitting in two; H3 clause 7 covers a part rejoining or a node being fully deleted. A whole that keeps its identity but sheds exactly one member, while everything else about it is unchanged, is a third shape neither row names.

#### Finding 3: "put it back" is not the inverse of "take," and H3 has no path for it at all

Putting the fork back requires reaching **into** `PlaceSetting`'s interior graph from wherever the fork currently is (the character's inventory, possibly in a different room) and re-establishing a `part` edge. This is the mirror of Finding 1's problem, but not its mechanical mirror: taking has a plausible source (the interior graph, reachable by traversal from the room, per H3 clause 1's inward-reaching design goal) and an ordinary destination (the character, an existing host kind). **Putting back has an ordinary source (the character) and a destination that is not an ordinary host at all --- it is a location inside another object's private graph** --- which no existing step kind targets and which AB-11's Expansion answer, built for the opposite direction, does not obviously invert.

**And co-location is untested.** If the character wandered to another room before attempting to put the fork back, is the operation refused (the fork and `PlaceSetting` are not co-located), does it silently relocate `PlaceSetting` itself, or does it spawn some other resolution? [C5](#c5-the-chain-mounted-at-both-ends)'s and [C9](#c9-coiling-the-rope-back-in)'s co-location machinery was built for a *whole's own* ports, not for reintroducing a foreign object as a new part after the fact.

**And drift is untested.** Even granting a mechanism, does the reinserted fork produce an interior graph indistinguishable from one that was never missing a fork at all --- same sibling links, same port assignments --- or does re-attachment leave a residue (a stale sibling link, an orphaned port) that a naive delete-edge/add-edge implementation would not clean up? H3 clause 7 does not speak to this, because clause 7 is about a *whole* rejoining after co-location is restored, not about a *foreign part* being adopted into an existing, undisturbed whole.

**Verdict.** Both operations expose the same underlying absence: **H3 describes how a whole's parts relate to each other and to the boundary they're viewed through, but says nothing about a part crossing that boundary as a live, independently-manipulable object and rejoining later.** That is a write-side gap orthogonal to the eight clauses already in H3's table --- all eight presuppose the part stays inside the interior graph or the whole stays intact. This is the first case where a part actually leaves.

**Annotations.** Write-side, both directions --- heterogeneous separable (AB-16, descriptive) --- Improvisation for the decomposition beat (AB-14, on-demand, per C8), no existing trigger or mechanism for either mutation beat --- mechanism throughout --- exercises gap 1 (**no composition relation** for what happens to the edge on departure) doubled: once for severance, once for reattachment.

**Rows grounded.** AB-11 (shown not to generalise to part-level operations, sharpening "generality untested"), AB-4 (the level-crossing relation must additionally say what happens when a part leaves the graph that would express it), AB-6 (a stored member set needs an on-departure update path this case shows is missing), AB-17 (the reabsorption criterion's shape, tested against the wrong direction --- a *foreign* part joining, not the whole's own part returning), H3 clause 7 (scoped too narrowly to cover this), and **AB-40**, opened here: *the detach/reattach step kind --- does moving a single part across the interior-graph boundary, in either direction, need a step kind AB-11's Expansion answer does not supply?*

### C14. The tray, its cups, and how many times it gets picked up

**Origin:** proposed 2026-08-07, run against three candidate mechanisms at once rather than mined or offered as a single hard scenario --- directly testing **AB-18**'s named-but-unanswered scope candidate ("a carry closure?", see [Open decisions](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only)) and **AB-3**'s already-recorded structural finding that `CarryClosureFragment = {rootId, members, edges}` is "simply what a ported object's graph looks like."

**The state.** `OBJECT#Tray` in `ROOM#A`, with `OBJECT#Cup1` and `OBJECT#Cup2` related to it by `On` edges (tray as target/surface) --- today's shipped shape, per `HostRelationalEdgeKind = 'On' | 'Under' | 'Against' | 'Custom'`. `classifyInteractionUnderTransfer` marks both `On` edges `'carry'`: moving the tray is supposed to move the cups with it.

**The operations, five beats.** (1) Pick up the tray, cups and all. (2) Set it down elsewhere, still fully assembled --- no edge severed. (3) Pick up *just* the tray, leaving the cups behind --- edges severed. (4) Repeat (1)--(3) several times across a session, on the same tray. (5) **Control case:** a single cup on a tray, picked up once, never touched again.

#### Three candidates, not one

**(a) Today's shipped carry closure.** `computeCarryClosure` BFS-walks `relationalEdges` and classifies every edge, **fresh, on every single operation**, producing a `CarryClosureFragment` that is discarded the moment the transfer completes. Nothing is ever remembered between beat (1) and beat (4)'s fourth repetition --- nothing about "this tray tends to travel with these two cups" persists anywhere.

**(b) Durable on-demand minting.** The severance/carry signal carry closure already computes doubles as [C6](#c6-the-rope-the-candle-and-the-impromptu-timer)'s and [C5](#c5-the-chain-mounted-at-both-ends)'s third decomposition trigger, run in the *composing* direction: an operation (pick up) needs a coherent locus, so mint `OBJECT#Tray` as a real, persistent H3 whole with `Cup1`/`Cup2` as parts. Beat (1) becomes an ordinary whole-move (no severance machinery needed at all, per [C9](#c9-coiling-the-rope-back-in)). Beat (3) becomes **AB-40(a)**'s detach --- pull the tray part back out, exactly the mechanism "take the fork" already needs.

**(c) Ephemeral / virtual abstraction.** Construct the **same H3-shaped structure** (b) would mint --- root, parts, ports --- for the duration of a single operation, feed it to the same whole-transfer/detach machinery (b) uses, then **discard it**. Never written to the graph. This is not a new invention: it is AB-3's already-noted collapse of `CarryClosureFragment` into a ported whole's shape, taken literally, with "ephemeral" naming the choice AB-3 left open (the row asks *whether* the root arrives, not whether what arrives must persist).

#### Finding 1: (a) and (c) are the same computation wearing two different types

Beat-for-beat, (a) and (c) do identical work --- walk the edges, classify them, assemble a rooted fragment, execute a transfer, discard the fragment. The only difference is *type*: (a) produces a bespoke `CarryClosureFragment`; (c) produces an H3 whole that happens to be thrown away. **This is not a new mechanism proposed for this case --- it is AB-3's pinned note, discharged.** AB-3 already recorded that the trigger for `CarryClosureFragment` collapsing into a root concept "has now fired from composition, hosting, and ports, independently," and that "the question is less whether the root arrives than which motivation shapes it." This case supplies the fourth motivation and answers the "which": **the root arrives so that carry closure and composition share one code path**, not two parallel ones that need a translation layer between them.

#### Finding 2: (b) versus (c) is AB-6 wearing a new case, and beat (4) is where it bites

Beat (4) --- the same tray, picked up and set down several times across a session --- is the discriminator. Under (c), each repetition re-walks and re-discards the same two edges, paying the derive cost every time. Under (b), the first repetition pays a mint cost and every subsequent one is a free structural read. **This is AB-6's stored-vs-derived fork, not a new tradeoff invented for carry closure** --- a stable, repeatedly-touched arrangement wants minting; a one-off relation may not be worth it. Beat (5), the single cup touched once, is the control that shows the other direction: minting it durably would be exactly the vacuous-abstraction failure mode [Recommended order](AGENT.abstractionLayers.planning.md#recommended-order) already tests for.

**What this dissolves, provisionally.** The threshold question raised when this case was first proposed --- "how severable does an arrangement need to be before it's worth minting" --- had no principled answer on its own. Under (c), it doesn't need one: **construction of the ephemeral form is always cheap and always safe, for beat (5) as much as beat (4)**, because it is discarded either way. The threshold question moves entirely to *promotion* --- when does an ephemeral (c) become a durable (b) --- which is not carry closure's problem to solve at all.

#### Finding 3: promotion is narrative heat's job, not a new mechanism, but it is not built yet

A virtual abstraction touched repeatedly (beat 4) is, structurally, exactly what [P4](AGENT.abstractionLayers.planning.md#proposal-p4-settling-dataflow-and-narrative-heat)'s narrative heat is for: a signal that an ephemeral thing is getting attention and might be worth making durable. **Recorded as the natural home for the promotion decision, not as a solved mechanism** --- heat is iteration 3, not iteration 1, and P4-iteration-1's [named rollback trigger](AGENT.abstractionLayers.planning.md#what-p4-being-load-bearing-here-means-2026-08-07) could still fire before heat is ever built. Until then, (c) alone --- construct, use, discard, every time, with no promotion --- is a complete and correct answer on its own; promotion is a strict improvement layered on top, not a dependency this case needs to work.

#### Finding 4: a second, cheap use for the same construct

An ephemeral whole is **addressable for the length of an operation without ever being a graph member** --- which is close to but distinct from **AB-30**'s wall (addressable, never a member, but *permanently* so, and as an edge rather than a node). Worth a new row rather than folding into AB-30, since permanent structural non-membership and operation-scoped non-persistence are different enough in kind that one answer is unlikely to serve both. **Noted, not developed:** the same construct plausibly gives [C3](#c3-the-snare-trap-coyote-cannot-name)'s snare problem a way to package an arrangement for one reasoning step without committing to whether it deserves permanent world-model status --- a reasoning-axis use of the same mechanism this case reaches from the mutation axis. Now **AB-41**.

#### Finding 5: `defer` had no resolution path, and ports give it one --- a sixth beat

**A sixth beat, added 2026-08-07: tie a string from `Cup1` to something in the room, then pick up just the tray.** Checked against [`interactionUnderTransfer.ts`](../../../../../lambda/ephemera/dataSource/positions/positionGraph/expandValidate/interactionUnderTransfer.ts) directly rather than recalled: `classifyInteractionUnderTransfer` returns exactly **`dissolve` | `carry` | `defer`** --- no fourth outcome, and this plan's own prior citations of a `carry`/`dissolve`/`defer`/`error` set were conflating this classifier with `removeObject`'s separate assert-and-throw guard. Per kind and role: `On`-subject and `Against` (either role) always `dissolve`; `Under`-subject and `Custom` (either role) always `defer`. **`defer` has never had a resolution path** --- it means "ambiguous," full stop, because relational edges are constrained same-host-only (`applyStepSequenceCore` throws on a host mismatch), so there has never been a representable *third* option. Carry closure's severance was not a design choice; it was the only thing the substrate could express.

**Ports supply the missing option, because a port already is the representation for "connected across a boundary."** Minting the virtual whole for the tray gives the string-tie edge somewhere to attach that isn't "same room" or "gone": it becomes a port binding, and the tie survives the tray's move as a live cross-host fact, exactly as [C5](#c5-the-chain-mounted-at-both-ends)'s chain survives being dragged to the next room and back. This is [H3 clause 5](AGENT.abstractionLayers.planning.md#h3-ports-as-the-boundary-mechanism-decomposition-as-a-modellers-choice) --- "ports bind any relation kind crossing a boundary, not only composition" --- getting its first concrete exercise on an ordinary case; it was previously stated only from [C12](#c12-the-moonbase-power-system-and-the-cut-cable)'s directed causal edges and flagged "mechanism untested."

**Not a blanket rule, and the existing per-kind table already says which edges are candidates.** `Against` and `On`-subject dissolving is very likely still correct regardless of ports --- leaning against a wall doesn't make sense stretched across a room, and lifting a cup off a tray *is* what ends its being "on" the tray. The genuine candidates for "preserve as a port instead of dissolve-or-block" are exactly the two rows that already say `defer`: `Under`-subject and `Custom`.

**One correction to an analogy raised in discussion, checked rather than assumed: the corpus does not already have a wire in the flashlight.** [C8](#c8-the-flashlight-that-vanished-when-someone-looked-at-it)'s write-up never mentions one. The closer existing precedent for "a relation spanning a whole's own interior boundary" is [C12](#c12-the-moonbase-power-system-and-the-cut-cable)'s `TrunkCable`/`AirlockBranch`/`LabBranch`. **The underlying point stands regardless of which example carries it:** a string tied to a cup that gets carried away, and a cable connecting a power system's subsystems, are the **same category of reasoning** under ports --- both are "does a relation survive a boundary being crossed," asked once, uniformly, rather than as two historically separate mechanisms (relational edges plus carry closure for the room case; composition edges plus ports for the whole/part case). Virtual-abstraction minting is what makes that uniformity available for the room-boundary case as well as the whole/part case, which it was not before this case.

**Verdict, stated plainly because it is the case's real payoff.** Object-abstractions --- mint, use, retire --- are not a feature carry closure needs to interoperate with; they are an **internal framework that sometimes gets externalized (persisted, durable) when and as helpful**, and carry closure is one caller of it that happened to get built before the framework existed. This is better-supported than Finding 1 alone states: carry closure is actually **two** sub-mechanisms, not one, and both already have H3-native equivalents found independently. The BFS-walk-and-bundle half collapses into ephemeral-whole construction (Finding 1, this case). The boundary-edge classification half (`boundaryEdgeOutcomes`, verdicts `dissolve` / `carry` / `defer` --- **checked against [`interactionUnderTransfer.ts`](../../../../../lambda/ephemera/dataSource/positions/positionGraph/expandValidate/interactionUnderTransfer.ts) 2026-08-07: three outcomes, not four; `error` was this plan's own recurring conflation of this classifier with `removeObject`'s separate assert-and-throw guard, corrected here rather than carried forward again**) was already shown, across this same session and independently of this case, to be closely-related vocabulary to what ports' own boundary-edge discipline uses --- the fifth time AB-28 has now caught that discipline anticipating a case outside its brief (P4's topology-change rule, C5, C9, C12, and this). **Carry closure is therefore not a parallel path that resembles the abstraction framework --- it is the abstraction framework, called before the framework had a name, from a caller that never got migrated.**

**Annotations.** Write-side, all three candidates --- homogeneous extent for the tray-cup arrangement itself (AB-16, descriptive) --- Improvisation, on-demand, operation-driven for (b)/(c)'s minting beat, matching C5/C6's third trigger exactly --- mechanism --- exercises gap 1 (**no composition relation**) for (a) as shipped and for beat (6)'s string-tie alike, answered structurally for (b)/(c) by the same port mechanism in both cases.

**Rows grounded.** AB-3 (discharged --- the collapse this case executes), AB-18 (the carry-closure scope candidate, now with a trigger), AB-6 (stored vs derived, a new instance), AB-40(a) (the detach mechanism beat (3) needs), H3 clause 3 (the on-demand trigger, exercised in the composing direction), **H3 clause 5** (first concrete exercise, not just C12's directed-edge argument), AB-28 (the outcome-count correction), P4 (promotion as heat's job), and **AB-41**, opened here: *ephemeral/virtual abstractions --- construct-per-operation, addressable without membership, promoted to durable only on repeated use.*

### C15. The microphone, the wire, and the speaker two rooms away

**Origin:** proposed 2026-08-07 to close the gap [C10](#c10-the-moonbase-computer-system)'s own annotation left standing --- an above-human-scale case that is **not authored**, so it can actually be tested against [AB-14](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only)'s Recognition trigger rather than skipping it the way C10 and C11 both do.

**The state.** `OBJECT#Microphone` in `ROOM#A` and `OBJECT#Speaker` in `ROOM#B`, both ordinary authored objects, unrelated to each other. The player carries `OBJECT#WireSpool`.

**The operations, four beats.** (1) Splice one end of the wire into the microphone, in `ROOM#A`. (2) Carry the spool to `ROOM#B`, unspooling as C7's thread does. (3) Splice the other end into the speaker. (4) The circuit is now closed: plausible recognition of "a rudimentary intercom." **Control beat (5):** stand in `ROOM#A`, next to the spliced microphone, and ask what it is part of.

#### Finding 1: it fails C10's own test, which is the point

C10 drew the line for this bucket precisely, not impressionistically: *"From a terminal you see a terminal, not a moonbase computer system; the rope, by contrast, is apprehensible as a rope from any room it passes through even though its whole span is not"* (see [C10](#c10-the-moonbase-computer-system)). Apply that test here. Standing in `ROOM#A` at beat (5), what is visible is a microphone with a wire running out of it --- not an intercom. The far splice, and the fact that the loop is complete, are not locally observable at all. That is C10's failure mode exactly, not C7's or C9's: a rope or thread reads as itself from any point along it; this does not. **The case lands in the above-scale bucket on the discriminator the bucket was actually defined by, not merely by spanning two rooms** --- C7's thread already spans many rooms at human scale, which is not sufficient on its own.

#### Finding 2: a causal aggregate, so it is C12's shape, not C10's

C10 is compositional (a system whose parts are all *of* one thing); C12 is a causal network (a system whose parts *do* something to each other across distance). An intercom is squarely the second kind --- its whole point is that an event at one end produces an effect at the other. **This is the missing unauthored instance of the bucket C12 already opened**, not a third bucket: C10 and C12 both being authored is exactly what let the question of *how such a thing would ever come to exist* go untested in both.

#### Finding 3: today's model has nowhere for this to start, checked rather than assumed

[Improvisation is the objects lane's mechanism, generalized](AGENT.abstractionLayers.planning.md#improvisation-is-the-objects-lanes-mechanism-generalized) already names the exact shortfall this case exercises, as its second of three gaps: **"Recognition fits less cleanly than Improvisation... the lane has no concept of a component whose identity is a set of other components."** An intercom's identity *is* `{Microphone, WireSpool, Speaker}` plus the fact of a closed loop --- there is no existence-then-placement sequence that produces that, because nothing in the shipped mechanism represents a component whose entire content is a claim about other, already-existing components. This is not a new gap C15 discovers; it is that gap's first worked instance rather than an abstract description of it.

#### Finding 4: the trigger candidate is concrete, and AB-18's convergence requirement is now testable rather than hypothetical

Beat (3), the second splice, is the natural trigger: a `SolderedTo`-or-similar edge is added that, for the first time, connects two device-role endpoints into one path. Before that beat nothing is recognizable --- a wire spliced into a microphone and trailing off is just a wire spliced into a microphone. **This gives AB-18 an actual state-transition trigger to evaluate on**, rather than the open-ended "a room? a carry closure?" it was scoped against before. It also makes AB-18's convergence requirement concrete for the first time: a player who says "listen through the intercom" *before* any eager recognition pass has run needs the blocking referent-resolution path to mint (or find) the same node the background transition-trigger would have minted on its own. **Both paths existing and having to agree is no longer abstract once there is a specific edge-completion event to hang each of them on** --- this case does not resolve the convergence question, but it is the first case able to state it precisely.

#### Finding 5: it is mechanism-recognition, which gives AB-19 a bounded-reasoning candidate

Per AB-19's description/mechanism split, this is squarely mechanism: "is this a working intercom" has a causally real answer, not a narration nicety, so deriving it from first principles every time is exactly what AB-19 rules out. It is also boundable in Coyote's sense (AB-22): a microphone and a speaker are exactly the kind of authored objects that could already carry structural-role tags (`terminal`, `delivery`, or similar) written at mint/enrich time, so the reasoning step at beat (4) consumes two roles and one connecting edge rather than reasoning about the objects from scratch. **Worth noting as a second, independent use of AB-22's pattern** rather than a new one invented for this case.

#### Finding 6: identity, briefly

Two later references to "the intercom" --- one from `ROOM#A`, one from `ROOM#B` --- must resolve to the same minted node, or the world silently gets two intercoms that happen to share a wire. This is AB-21's obligation, restated at above-human-scale rather than solved here; it is listed because C15 is the first above-scale case where the obligation is actually live (C10 and C12's authored wholes never needed an idempotency key at mint time, since they were never minted at all).

**Verdict.** This closes the specific gap [Recommended order](AGENT.abstractionLayers.planning.md#recommended-order) named --- an unauthored above-human-scale case now exists, and it discriminates on C10's own test rather than a looser one. It does not resolve AB-14, AB-18, AB-19, or AB-21; nothing in today's model can run beat (4) at all. What it does is give each of those rows its first concrete above-scale instance to argue from, the same role C3's snare has long played at human scale.

**Annotations.** Write-side --- heterogeneous separable parts, descriptive (AB-16) --- **Recognition**, not Improvisation, and above human scale, which no prior Recognition-tagged case is --- **mechanism**, not description (AB-19) --- exercises **gap 2** (no concept of a component whose identity is a set of other components) directly, for the first time with a worked scenario rather than the gap's own abstract statement.

**Rows grounded.** AB-14 (Recognition's first above-scale instance), AB-18 (a concrete trigger, and the convergence requirement made precise), AB-19 (a bounded mechanism-recognition candidate, and a second use of AB-22's mint-time-annotation pattern), AB-21 (identity, first live at this scale), AB-38 (an ordinary Recognition trigger, not a third kind --- consistent with, not decisive for, that row's lean toward (a)), and the [Recommended order](AGENT.abstractionLayers.planning.md#recommended-order) Phase 0 bullet this case was written to close.

### C16. The bare table, and the room that is just a mess

**Origin:** proposed 2026-08-08, deliberately compact, to satisfy [Recommended order](AGENT.abstractionLayers.planning.md#recommended-order)'s bound-testing bullet: *"at least two cases that should not become abstractions, to bound the concept."* Both halves are **negative** cases --- their entire content is that nothing fires --- so neither gets the full State/Operations/Findings treatment C1--C15 use; giving them that weight would misrepresent how little work either takes.

**(i) The bare table.** `OBJECT#Table` alone in a room, nothing on it, nothing in it, no relational edges to or from it. **Neither AB-14 trigger has anything to act on.** On-demand has no pending operation needing a part grounded --- nobody has referenced "the table's legs." Recognition has no arrangement to notice --- Recognition needs *multiple* things composing into a pattern (AB-18: "several operations... have composed into a thing"; AB-19: "reasoning about a snare *as* a snare"), and one object alone provides nothing to compose. **Checked against all five axes, not asserted:** Apprehension --- already grounds as one referent, nothing to disambiguate. Positioning --- one node, one host; decomposing adds no position fact. Mutation --- nothing detachable exists to justify parts. Reasoning --- no finer-grained fact anyone needs. Authoring --- no author interest in table-as-assembly. **All five return empty**, the corpus's first case where every axis does. **Scope note, not a loophole:** a player-licensed reference ("look under the table") would still be a legitimate on-demand mint per AB-20 ("the player's own reference *is* the licence") --- this case is about *unforced* decomposition specifically, not about ruling out on-demand minting altogether.

**(ii) The room that is just a mess.** A room holding `OBJECT#BirdCage` (empty), a pile of books, three bottles of lemonade, sheet music, and a mop --- five objects, zero relational edges between any of them. **The harder half, because "no pattern" is not actually available as an answer.** "A complete mess" is itself a legible pattern, and a description pass could recognize it. **The line that resolves this is AB-19's existing description/mechanism split, not a new rule:** "a mess" is squarely **description-recognition** --- no consequence rides on it, nothing downstream reasons about the birdcage-books-lemonade-sheet-music-mop set *as* anything --- and AB-19 already holds that description-recognition "stays pure projection under AB-9's guardrail." AB-9's guardrail is explicit that description **selects among levels that already exist and must never create one.** So the actual discriminator was never "is there a nameable pattern" (always yes) but **"does naming the pattern require minting graph structure"** --- a root, parts, ports, any new edge. Here there is nothing to mint even if the system wanted to: no two of the five objects share a relation, unlike [C8](#c8-the-flashlight-that-vanished-when-someone-looked-at-it)'s flashlight (a real interior) or [C15](#c15-the-microphone-the-wire-and-the-speaker-two-rooms-away)'s intercom (a real closed loop). "A mess" can be narrated freely as a read-side judgment over the existing member set, precisely because nothing about it needs a new node to be true.

**Verdict.** Both halves satisfy the bullet, but for different reasons, and the difference is the finding worth keeping. The table has **no candidate pattern at all** to trigger on. The messy room **has** a candidate pattern --- and the reason it still doesn't mint anything is not absence of pattern but AB-9's mint-vs-describe line, exercised here for the first time against a case with **zero relational content**, sharper than [C8](#c8-the-flashlight-that-vanished-when-someone-looked-at-it) (which at least has an interior to argue about). Together they bound the concept from both directions the bullet asked for: nothing-to-recognize, and something-recognizable-that-still-shouldn't-mint.

**Annotations.** Read-side only, both halves --- no write-side content in either. (i): no trigger (neither AB-14 mode fires); all five axes empty. (ii): Recognition, description only (AB-19); exercises AB-9's guardrail directly, with zero relational edges to mint from even under the mechanism reading.

**Rows grounded.** AB-14 (i: no candidate trigger; ii: fires as description only), AB-9 (ii: the guardrail's second exercise, and its first against a zero-edge case), AB-19 (ii: description/mechanism split applied, not re-derived), AB-20 (i: the on-demand-reference scope note), H3 clause 3 (i: legal-but-unchosen decomposition, the concept this bullet exists to bound), and the [Recommended order](AGENT.abstractionLayers.planning.md#recommended-order) Phase 0 bullet this case closes.

### Parks deliberately not mined

The other four parks in [The dependency is asymmetric](AGENT.abstractionLayers.planning.md#the-dependency-is-asymmetric-representation-unblocks-reasoning)'s right-hand column were considered and excluded, so a later reader does not re-check them: **BD-24** / iteration 6 and **C3** / `MultipleCommands` are *demand*-blocked (no concrete case currently demands either), **BD-18** / backtrack channel is *architecture*-blocked and is a sibling initiative to schedule against rather than absorb, and iteration 2's remaining fallback steps are prompt and calibration work. None would move on a representation change, so none yields a corpus case.

