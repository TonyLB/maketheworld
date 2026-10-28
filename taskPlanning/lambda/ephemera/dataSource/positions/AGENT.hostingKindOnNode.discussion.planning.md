# Hosting kind: what the containment type has to say

**Companion to [`AGENT.hostingKindOnNode.planning.md`](AGENT.hostingKindOnNode.planning.md), opened 2026-10-28.** That plan decides *where* the hosting kind lives (on the membership, not on an edge). This file asks *what* the kind should express. Today the set is `On`, `In`, `PartOf`, and it was assembled ad hoc, mostly from prepositions. Moving the kind onto the membership fixes its stored shape, so this is the moment to work out the relations the kind actually has to represent.

This is a discussion record. Conclusions go to the plan as edits to HK-1 through HK-4 (or as new rows). Durable rules go to `positions/AGENT.concepts.md` and `AGENT.contract.md` once they ship. Follows [`taskPlanning/AGENT.md`](../../../../AGENT.md).

---

## What the kind does today

An inventory taken 2026-10-28 by grepping non-test code in `lambda/ephemera` for `'On'`, `'In'` and `'PartOf'`.

**Writers:**

| Writer | Writes | From |
| --- | --- | --- |
| Containment template ([`matchContainmentTemplate.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/matchContainmentTemplate.ts)) | `On`, `In` | the prepositions `on`, `onto` and `on top of`; `in`, `inside` and `into` |
| Spread template ([`matchSpreadTemplate.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/matchSpreadTemplate.ts)) | `On`, `In` | the same prepositions, plus `over` and `across`, which both map to `On` |
| Containment population ([`containmentPopulationSteps.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts)) | `In`, `PartOf` | the child's entity type: Objects get `In`; Rooms and Features get `PartOf` |
| Move ops (`positionKernelOp.ts`, `buildObjectMoveOp.ts`, `planObjectMoveTransfer.ts`) | one of the three | passed through from the above |

No player phrase writes `PartOf` (concepts: "parts come from authored structure or reasoning").

**Readers:**

| Reader | Distinction it reads |
| --- | --- |
| [`interactionUnderTransfer.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts) | **none**: all three are "hosting", so the member is in its host's shard |
| [`connectedToLegality.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/connectedToLegality.ts) | **`PartOf` or not**: a part of a whole may be a `ConnectedTo` endpoint inside that whole |
| `fixedContainmentDriftSweep/classification.ts` (diagnostics) | **`PartOf` or not** |
| The relational route (`attemptCandidates.ts`, `compileAttemptsFromSkeleton.ts`) | **none**: it refuses all three as `establishRelation`/`dissolveRelation` targets |
| Narration prepositions (`attemptCandidates.ts`, the `on`/`in`/`at` choice) | `On` vs `In`, but **taken from the plan step, not from stored data** |
| Qualifier `containedBy` (`off` and `on` mean `On`; `out of` and `in` mean `In`) | **none yet**: the judge (`containedByFailure` in `attemptCandidates.ts`) says "the relation is not read" |
| Apprehension ("`On` admits nested things to referent search always, `In` sometimes") | stated in concepts as `On` vs `In`; **not modelled** |
| Possession ("an `In` on a character means possession") | stated in concepts; no code reads it separately |

**Finding.** Only the line between `PartOf` and everything else is read from stored data. `On` vs `In` is written and stored, but nothing reads it yet. Two consumers are designed to read it (apprehension and qualifiers), and so far each has only a sentence or a parsed value. That is why the set feels ad hoc: it was picked from the prepositions players type, not from the questions consumers ask. This doesn't mean `On` vs `In` should go. Forward demand is real (apprehension, qualifiers, boundary challenges like "open the box first"). It does mean the set hasn't yet been tested against what consumers actually need.

## What hosting means without any kind

Being a member is already a lot. A member lives in its host's shard, and **travels with the host when the host moves**. A peer relation doesn't: "moving a table does not carry the boots under it" (concepts, *Hosting kind / peer kind*). So the test for *hosting vs peer* is travel, and every hosting kind passes it. The kind never has to say *whether* something travels, only *how* the member is placed on or in its host.

Below, the first question is whether that's the right line. If it is, things like a tag tied to a suitcase or a coat on a hook on a moving cart are hosting, whatever words are used for them.

## The questions a kind might answer

Here are the questions a consumer asks about one membership, kept separate so we can see which ones one closed set is being asked to answer.

1. **Composition: is the member part of what the host *is*?** This is `PartOf` today. It affects `ConnectedTo` legality and the way a thing is named ("the box's lid"). Removing a part is a different act (detach, break) from taking something out. Rooms in Areas and Features in Rooms are composition too. It touches the shelved "separability and merger" item in [`AGENT.objectManipulationIterations.planning.md`](../actions/AGENT.objectManipulationIterations.planning.md).
2. **Exposure: can someone outside the host see and reach the member?** `On` is exposed. `In` is enclosed, and access depends on the host's state (a lid, a door). Apprehension, qualifiers and boundary challenges would read this. It may be a property of a *region* of the host (a box has an inside and a top) rather than of the member.
3. **Attachment: what does separating the member take?** The options are free (lift it off), fastened (untie, unhook), or integral (break it off). Today "tied to" is a `Custom` peer edge whose move-time challenge is an untie. That's right when you move the tag. It's wrong when you move the suitcase: a peer edge can't say the tag comes along.
4. **Spatial phrase: how is the member described?** on, in, hanging from, draped over, leaning against, worn, held. This is mostly for narration. It could be an open label (like `Custom`'s `relationLabel`) rather than part of the closed set.
5. **Character hosts.** Held, worn and carried are all `In` today. "Drop" and having your hands free care about the difference. A held rope end is the case the spread corpus most needs: one end's binding hosted by the character, the other hosted by the pole it's tied to.

## Three framings

- **A. One closed set, extended by need** (`On`, `In`, `PartOf`, and later things like `AttachedTo` or `Worn`). Easy to author and read. Each consumer switches on every kind, and the set grows one preposition at a time, which is how it got here.
- **B. Separate fields for each question** (composition, exposure, attachment), plus an open phrase for narration. Each consumer reads only the field it cares about. It allows combinations nothing in the fiction calls for, and it's harder to author directly.
- **C. A closed set as the vocabulary, mapped by one total function onto the fields.** Authors and planners write `On` or `PartOf`, and consumers read fields such as `exposure(kind)`, never the kind itself. A new kind is one new row in the mapping, with no change to any consumer.

I lean toward **C**. It keeps authoring and the planner's output simple, and it keeps consumers out of per-kind branching. It's only a lean: the case list below should test it, and B is still possible if a real case needs a combination the set can't name.

## How this bears on the plan's decisions

- **HK-1 (one kind or a set).** The case to test is a box's internal divider. It's part of the box (composition) *and* enclosed (exposure), in one host. Under the edge model that would be two edges, `PartOf` and `In`. Under framing B or C it's one membership with two field values. If that holds up, HK-1's "set" option was really a question about separate fields, and we can answer it without allowing a set of kinds.
- **HK-2 (per member or per binding).** *(The rope-and-box half of this bullet was withdrawn; see the record, 2026-10-28.)* The fields may not all belong at the same level. Composition looks per member: a part is a part of that host wherever it shows up. Exposure and attachment look per binding: a rope with one end tied and one free, or one stretch inside a box and one outside. If so, HK-2's answer may be "both, by field", not a choice between them.
- **HK-3 (field shape)** follows from the framing.
- **HK-4 (what the cache carries).** Apprehension reads exposure. Whatever the cache carries has to answer the exposure question for every host it combines.

## Cases to work through

Each case is listed with the question it tests.

| # | Case | Tests |
| --- | --- | --- |
| 1 | Cup on a table; cup in a box | baseline: exposure only |
| 2 | Box lid vs box divider | composition with exposed vs enclosed (HK-1) |
| 3 | Spring `In` a box and `PartOf` a contraption | the primer's cross-host case: two memberships, not two kinds |
| 4 | Niche in a wall; Room in an Area | authored composition; whether "Room `PartOf` Area" means the same composition as "lid `PartOf` box" |
| 5 | Hat worn vs hat held vs hat in a backpack | character-host flavours; the backpack is its own host |
| 6 | Luggage tag tied to a suitcase: move the suitcase, then take the tag | attachment as hosting with a separation precondition, vs a `Custom` peer |
| 7 | Rope tied to a pole; the player holds the other end and walks into the next room | attachment per binding; held per binding; the spread corpus's lead case |
| 8 | Rope trailing out of a closed box | **two hosts, not one host with two kinds**: one stretch `In` the box, one `In` the room (see the record, 2026-10-28) |
| 9 | Cloth draped over a chair | `over` mapped to `On` today; partial cover; the spatial phrase |
| 10 | Boots under a table | stays a peer relation? confirms the travel test |
| 11 | Coat on a hook on a cart that's wheeled away | hanging as hosting; travels through two levels of host |

## Open questions for this discussion

1. Is **travel with the host** the line between hosting and peer? If so, the kind never carries it.
2. Which questions do consumers actually need answered: composition, exposure, attachment, the spatial phrase, or others not listed?
3. Framing A, B or C?
4. Is attachment a hosting relation with a separation precondition, or does it stay a peer relation (cases 6 and 7)?
5. Does each field live at the same level (member or binding)?
6. Are held, worn and carried different kinds on a character host, or something else?
7. Does a plain room member need a kind at all, or is "in the room" just membership? This bears on HK-3's retirement of the "no edge means `In`" default.

## Discussion record

**2026-10-28: opened.** The user asked to think through what abstract relations the containment type needs before settling HK-1 to HK-4. The sections above are the opening draft: an inventory of the kind's readers and writers, the questions it might answer, and a list of cases. Nothing here is settled.

**2026-10-28: requirements from future use (the user).** Every kind contributes meaning to reasoning, not only to deterministic gates. Two examples: a fireball fills the room, so does dynamite *in* a box catch, and does dynamite *on* the box? And does a large item fit *in* a breadbox, or only *on* one? `In` vs `On` also sets up accessibility: things on a closed box can be seen and handled, and things in it probably can't until it's opened. The user leans toward framing C.

Three refinements were proposed in reply, none settled yet:

- **The kind names a region of the host:** its surface, its interior, or (for `PartOf`) its structure. Fit, exposure and access are worked out from that region together with the host's own properties (open or closed, material, interior size, surface size), so the kind is necessary for those answers but not sufficient.
- **Exposure depends on where the source is.** A character inside a wardrobe can reach what's in it, not what's on it. A fire inside the box reverses the fireball case. A room's contents count as accessible only because the observer is usually inside the room.
- **Exposure is per channel.** A glass case blocks reaching in but not seeing in. A mesh cage blocks large hands but not flame. So the barrier's permeability belongs to the host, per channel, and the kind only says which side of the barrier a member is on.

**2026-10-28: the rope-out-of-a-box case withdrawn as an HK-2 example (the user).** The proposed example was a rope trailing out of a closed box, with one stretch `In` the box and one `On` it. The user pointed out that the outside stretch is in the *room*, not on the box. A stretch "on the box" is detail that matters to physics, not to the story. So the case has two memberships in two hosts, the same shape as the spring that is `In` a box and `PartOf` a contraption, and it says nothing about HK-2. No case has yet shown one member with two different kinds in one host at a story-level grain. The plan's HK-2 row has the same weakness: its "one `On` the table, one hanging `In` a slot of it" example is physics detail too. So HK-2 (a), one kind per member, stands unless the corpus produces a story-level case.

**2026-10-28: `PartOf` is a different kind of relation (the user).** The user's reading is that `PartOf` points to containment where the host is an *abstraction*, not a physical container. A hinge or a lid is not in or on a box the way its contents are; they are part of a more detailed reading of what the box is. This is the abstraction-layers granularity point again (the rope did not change, the useful granularity did; Object, Room and Feature are already abstractions). Proposed consequences, none settled yet:

- **Two families, not three peers.** *Placement* (`In`, `On`, and any later regions) says where a distinct thing sits relative to its host. *Composition* (`PartOf`) says the member helps make up the host. Under HK-1 (a), a member's one membership in a host belongs to exactly one family. That retracts the earlier "`PartOf` is the structure region" refinement: composition is not a region.
- **The box divider is no longer an HK-1 case.** It is `PartOf` only. Where it sits inside the box (enclosed, inner) is detail of the box's own decomposition, carried by topology among the parts. That is the `ConnectedTo` vocabulary, which is already legal only between parts of one whole (`connectedToLegality.ts`). `PartOf` plus `ConnectedTo` describes the detailed reading; `In` and `On` describe placement.
- **The travel test only fits placement.** Contents travel with their host. A whole whose parts are spread across physical hosts (the contraption, with its spring in a box) has no single move. The test for composition is constitution: describing, damaging or apprehending the whole involves its parts. So open question 1 is answered for placement only.
- **Each family answers different questions.** Placement answers exposure, fit and access, by region. Composition answers resolution: by default the parts are apprehended *as* the whole (a box, not a lid and a hinge), and they come forward when attention narrows. That is the concepts doc's terminal-on-a-moonbase apprehension case. In the fireball case a part shares the whole's exposure: a burning lid is a burning box.
- **The hard edge is the move from one family to the other.** A removable lid is `PartOf` the box while closed. Lifted off, it is a thing `On` the table. Moving between composition and placement is the shelved "separability and merger" item, and the attachment question (open question 4) may belong there rather than to the placement kinds.

**2026-10-28: `PartOf` is overloaded; fungible detail is not composition (the user).** A span of rope is detail of the rope abstraction in a fundamentally different way from how a lid and a hinge are parts of a box. Because a thing can now be present in several hosts, there may be a use for *fungible* detail objects, which belong to an abstraction differently from distinct parts. Points raised in reply:

- **This question has been asked before.** It was [AB-16](AGENT.abstractionLayers.planning.md) (homogeneous extent vs heterogeneous separable parts), retired 2026-08-06 on the grounds that the position model, as it stood then, drew no distinction between the two. That retirement predates presence bindings, so it was scoped to a mechanism that has since been replaced. The question itself was not settled.
- **The shipped design already draws the distinction, but only in code.** `extend` (`manipulation/membership/extendSteps.ts`) does not create `PartOf` members. It splits the object's presence binding in place and adds a `ConnectedTo` between the two bindings. A spread rug or a rope carried onward is one object with several bindings, and a take or drop names the stretch it means through the referent's view. So fungible detail already has a home: the binding/presence structure, not a hosting kind. The overload is in the docs. The primer's worked example models rope ends as `RopeEndA -PartOf-> Rope`, which is the composition shape.
- **Proposed split:**
  - `PartOf` is for **distinct parts** only: individuated, nameable, keeping their identity (lid, hinge, niche, a Room in an Area).
  - **Fungible detail** is the whole's own bindings, individuated only by where they sit (rope stretches; sand partly in the bucket and partly on the floor). It is not a membership kind at all.
  - `ConnectedTo` already accepts both as endpoints (the whole, its bindings, or its parts), so topology stays shared.
- **Rope ends are the borderline case.** There are exactly two of them, they are nameable, and you tie *an end*, yet they cannot be separated from the rope. Either the ends are distinct parts, or "has an end" is a property of a binding. Which one is a case for the corpus.

**2026-10-28: bindings alone lose expressive power (the user).** If fungible sections exist only as presence bindings, then a section cannot carry its own **state or makeup** (you cannot paint one stretch of a rope), and it probably cannot be **detailed further**. We may never need either, but that is not certain. Points raised in reply, none settled yet:

- **Bindings are the wrong home for material state, and this is structural.** A binding is a *positional* region of the object. A painted stretch is a *material* region. The two boundaries are independent: pull the rope through a doorway and the red stretch moves from one binding to another, and a later join or contraction would merge it with unpainted rope. The rope's extent therefore has two independent partitions, *where* (bindings) and *what* (sections). The previous entry's "fungible detail is not a membership kind at all" is withdrawn as too strong. It holds for position only.
- **A section could be a second composition kind, minted when something distinguishes it.** A stretch stays fungible until something material sets it apart (paint, a knot, a fray, a cut). Then it becomes a detail object related to the whole as a *region of* it, not as a *component* the way a lid is. It can be detailed further, as any whole can. The abstraction layers' reabsorption criterion carries over: when nothing distinguishes the section any more, it folds back in. Its position would come from the bindings that cover it, which may be more than one. How that is represented is open, and it is intricate, which is acceptable for an intricate case.
- **Cases to add to the corpus:** paint one stretch of a rope; tie a knot in the middle; cut the rope (a section becomes a separate object, the counterpart of lifting off a lid); dip one end in water; and a painted stretch carried through a doorway.
- **What this plan has to decide now: only that it does not shut the door.** Under framing C, composition is a family that can gain a second kind as one new row in the mapping. If the stored field is a closed set that can grow, and nothing assumes composition is a single value, deferring the section question writes no assumption into a stored shape. By the lift rule, it may then wait for forward demand.

**2026-10-28: `PartOf` and `SectionOf` as two modes of composition (the user).** Composition has two kinds. `PartOf` is a distinct component; `SectionOf` is a stretch of a homogeneous extent. Rope ends become `SectionOf` items with clear meaning, and keeping them coherent is the reasoner's job: the LLM must not put the end of a rope in the middle of the span. That ordering is semantic, not structurally enforced. The user's direction; details still open:

- **An end is a section set apart by its position along the rope, not by its material.** So "something distinguishes it" includes being at the end. An end is minted when it is first addressed ("tie the end to the pole"), not created with every rope.
- **The structure can record order without enforcing it.** `ConnectedTo` between sections (end to middle to end) states the order the reasoner chose. The kernel checks only that both endpoints belong to the whole. Consequence for the code: [`connectedToLegality.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/connectedToLegality.ts)'s `isPart` reads `PartOf` only, so it must accept any composition kind. Under framing C that is a read of the kind's family, not a list of kinds.
- **A section's position probably comes from the cover.** A section is a member of the whole's own graph, and a binding's cover names which members sit at that binding. So "end A is at the pole and end B is in the player's hand" would be two bindings whose covers name different sections. This still has to be checked against the cover rules in `AGENT.contract.md`.
- **"Tie the rope to the pole" gets a precise subject.** The `Custom('tied to')` edge would run from an end section to the pole, while a reader at room scale still sees "the rope is tied to the pole" through port coarsening.
- **The primer's rope example needs rewriting.** `RopeEndA -PartOf-> Rope` becomes `SectionOf`, in the plan's docs slice.

**2026-10-28: minting and dissolving detail is out of scope (the user).** "An end is minted when it is first addressed" depends on a capability that is not part of the hosting-kind question. The system will need to mint and dissolve detail items when commands direct attention or action at parts that are implied but not yet represented. Scope as it stands:

- **This plan's only obligation is representation.** The kinds must be able to describe a detail once it exists, and nothing in the stored shape may assume that a whole's details exist from the start or last forever.
- **The lifecycle has a design home already.** The abstraction-layers plan covers it: [AB-14](AGENT.abstractionLayers.planning.md) for on-demand minting and recognition, [AB-17](AGENT.abstractionLayers.planning.md) for reabsorption. Those phases have not started.
- **Part of the mechanism exists.** The objects lane already spawns improvised free-standing objects into a host (`spawnOneImprovisationObject` calling `executeComponentCreation`; see `objects/AGENT.md`). Minting a detail would plausibly be that same spawn into the whole's own graph, with a composition kind. Dissolving (reabsorption) has no mechanism.
- **The main caller will be the planner.** "Tie the end to the pole", with no end yet represented, is the planning fallback's problem: it has to decide that the referent is an implied detail and ask for it to be minted.

**2026-10-28: a candidate closed set of five (the user).**

- `On`: physical placement on a thing. On a character it means things worn, or a coating such as paint.
- `In`: physical containment only. Nothing is ever `In` a character, because a character's body is not examined as a container.
- `Held`: character hosts only.
- `PartOf`: a distinct part of an abstraction.
- `SectionOf`: a fungible stretch of an abstraction.

Under framing C these group into placement (`On`, `In`, `Held`) and composition (`PartOf`, `SectionOf`).

Checked against the case list:

| Case | Reading under the five |
| --- | --- |
| 1 | cup `On` the table; cup `In` the box |
| 2 | lid and divider both `PartOf` the box |
| 3 | spring `In` the box and `PartOf` the contraption, in two hosts |
| 4 | niche `PartOf` the wall; Room `PartOf` the Area; Feature `PartOf` the Room |
| 5 | hat worn is `On` the character; hat held is `Held`; hat in a backpack is `In` the backpack, which is itself `On` the character (worn) or `Held` |
| 7 | the held end's binding is `Held` by the character; the ends are `SectionOf` the rope; the tie is still open (see below) |
| 8 | one stretch `In` the box, one `In` the room |
| 9 | cloth `On` the chair |
| 10 | boots under the table: a peer relation, not a hosting kind |
| 11 | coat `On` the hook; hook `PartOf` the cart. Hanging is `On`, because it is exposed and supported |

**One gap: attachment (case 6, and the tie in case 7).** A proposal: attachment needs no sixth kind. Its two halves are different questions. *Travel* comes from hosting: a tag `On` a suitcase moves with the suitcase. *Separation* comes from a fastening: taking the tag off needs an untie. If the fastening can be stated as a peer relation from the member to its own host's root inside the host's graph (`tag -Custom('tied to')-> suitcase`), the existing boundary-challenge mechanism already turns it into an untie. Whether a peer edge may target the root has not been checked.

**Rules the set implies:**

- Each kind is legal only on certain hosts: `Held` only on characters, `In` never on characters, and composition kinds never on characters, as far as any case has gone.
- The concepts sentence "an `In` on a character means possession" is retired.
- HK-6's heal must turn a stored `In` on a character into `Held`. This is a mapping, not a straight copy of the kind.

**2026-10-28: securing as an edge (the user).** Being *secured* to a host is a separate fact from being placed on or in it, and it may be better represented as an edge. One reason: later edges could then target that securing edge, to justify it by some object or some other edge ("secured by this nail", "held shut because the latch is engaged"). Points raised in reply, none settled yet:

- **An edge fits.** Securing relates two things, and the second need not be the host. A tag is secured to its own host (the suitcase's root). The rope end in case 7 is secured to a sibling in the same room (the pole). Placement says where the member is; securing says what holding it there takes. That is the line this plan draws: membership on the node, relations on edges.
- **A closed kind or a `Custom` label?** Deterministic consumers need to recognise securing without knowing the verb. Examples are the boundary challenge (unsecure it before taking it) and travel (a secured thing must come along or block). That argues for a closed peer kind, possibly carrying a manner label the way `Custom` does (tied, nailed, glued). Still open, and still unchecked: whether a peer edge may target the graph's root.
- **Edge-as-terminal is currently unlicensed, and this would be a new consumer.** [`AGENT.edgeAbstractions.planning.md`](AGENT.edgeAbstractions.planning.md) marks *edges as terminals* unlicensed because its only consumers were port-to-port summary edges (retired) and coarse-to-fine justification (`JustifiedBy`, shelved because nothing has to detect staleness). Mechanical justification ("why is this secured") is neither of those, so it reopens the question on new demand. It is not a re-hearing of the old consumers. Its corpus already has a `Clamp -[Secures]-> Cord` case.
- **Three shapes for the justification:**
  - (a) **Edge as terminal:** `nail -Secures-> <edge>`. This adds a terminal arm. Edge identity also has to survive the cache, which merges legs that compose to the same edge into one record. And `edgeId`, today "an optional label and nothing more", would have to be required on securing edges.
  - (b) **A justification field on the securing edge itself:** `securedBy: (node | edgeId)[]`. This is a reference from the edge outward, so it adds no new terminal arm. Node-to-edge reference by `edgeId` has shipped precedent (an Arrangement holding a list of `edgeId`s).
  - (c) **The fastener as a node:** many justifiers are already things (a nail, a string, a knot that is a `SectionOf` the rope). Node-to-node edges then cover them, and "secured" may be derivable from them. That leaves edge-justified securing (an engaged latch) as the one case (c) does not reach.
- **What not to foreclose now:** the hosting-kind change does not touch this, since the edges that remain are exactly where securing would live. If securing edges must be targetable later, requiring an `edgeId` on that kind is cheap whenever the kind is introduced.
- **Cases to add:** a tag tied to a suitcase; a picture nailed to a wall; a lid held shut by a latch; a rope end tied to a pole; a crate strapped to a cart, where the strap is its own object.

**2026-10-28: `SecuredTo`, a node-to-node edge with a manner (the user).** Edge targeting was a later possibility, not the point. The shape is a `SecuredTo` edge between nodes, carrying a manner property:

- A plate glued to a table is `On` the table (its hosting kind) and `SecuredTo (glued)` the table. It cannot be moved, but it is not *part of* the table as an abstraction.
- A rope end has a `SecuredTo (tied)` edge to the pole.

How the justification shapes (a)–(c) above would work is deferred. Points raised in reply:

- **Placement, securing and composition separate cleanly.** Unglue the plate and it is an ordinary thing `On` the table. Removing a `PartOf` member is detaching or breaking it, which is the separability question.
- **The member-to-root case looks reachable today, but this is not tested.** The boundary filter in `expandBoundaryChallenges.ts` (`boundaryActionsInGraph`) exempts only the mover's *hosting-kind* edge to the root. A peer edge from the plate to the table's root would therefore already reach the boundary-challenge path ("unglue it first"). I found nothing that forbids such an edge.
- **The rope end and the pole are not siblings in one graph.** Under `SectionOf`, the end is a member of the rope's own graph, and the pole is a member of the room's graph. The tie is therefore a crossing edge (the existing `buildCrossingLegs` machinery, stamping one kind and label on every leg and on the port). At room scale it composes into "the rope is `SecuredTo (tied)` the pole". So `SecuredTo` has to be a legal crossing-port kind. In the plan, Slice 3's narrowing of stored edge and port kinds should read as "the peer and topology kinds", not as the hard-coded pair `Custom | ConnectedTo`.
- **Probable side benefit (to check): `Custom` can stop meaning "blocks a move".** As far as I can tell from the classifier, every `Custom` edge defers to a challenge today, so `boots -Custom('under')-> table` would ask the player to dissolve "under" before the boots move. With securing as its own closed kind, the challenge could key on `SecuredTo`, and other peer relations could dissolve freely on a move.

**2026-10-28: the side benefit confirmed (the user).** `SecuredTo` gives a clean way to say "you can't just take the whole rope, it's secured to the pole", even though there are unboundedly many ways a thing can be secured. Deterministic code cares only about the *fact*, which is the dynamic topology. The *manner* stays an open label. Reasoning reads it: which act unsecures it (untie, unglue, pry), and whether that act is feasible. This mirrors `Custom`'s `relationLabel`, and the closed-lexicon rule: a closed kind where the set can be enumerated, an open label where the phrasing can't.

**2026-10-28: unsecured relations still have consequences (the user).** We should keep some ability to raise challenges, at least through LLM interpretation, on edges that are *not* `SecuredTo`. Example: a rake leans against a box, and someone moves the box. The system eventually has to work out that the rake does not merely lose its link; it falls over. That **withdraws "other peer relations could dissolve freely"** from the earlier side-benefit entry. Points raised in reply:

- **Two different things happen when a related thing moves:**
  - A **precondition**: the move cannot happen until something is done. Unsecure it first.
  - A **consequence**: the move happens and something else changes as a result. The rake falls; the boots under the table are revealed.
  
  `SecuredTo` is the deterministic precondition: code can raise it without reading the manner. Every other peer relation touching the moved thing goes to reasoning. Reasoning decides whether there is a consequence (a fall, a reveal, a slip), or a challenge after all, for instance a planner choosing "move the rake first" when the player's intent calls for care. Under the Coyote rule the result is dictated by genre, not by chance.
- **Today's mechanism is closer to this than the side-benefit entry implied.** Every `Custom` edge already gets a facilitating dissolve, and the Coyote evaluator judges that dissolve (commandAttemptPhase slice 3). What is missing is the *consequence* half: an outcome language in which "the rake falls" changes the rake's state or placement. That is the iterations ladder's "effects that travel along relations" row. So `SecuredTo` would split today's single path into a deterministic precondition plus the existing reasoning path, which would then gain consequences.
- **Open: does deterministic code need to know which peer relations are load-bearing?** One possibility is a closed support kind (a rake leaning on a box, a book propped against books), so that only those edges are routed to reasoning. The default for now is that every unsecured peer edge touching a moved thing goes to reasoning, and the cost gets measured once a decision depends on it.
- **Scope:** this belongs to the outcome and effects work and to the spread corpus's world-semantics half (dragging a rope, things falling), not to this plan.

**2026-10-28: consequences are a scaling concern, and that is acceptable (the user).** The tablecloth scene in *Ghostbusters* ("the flowers are still standing", after yanking the cloth from under a set table) is a reminder that "will this action have consequences?" is likely to be a major scaling concern for the reasoning engine. A representation that can get complicated is not alarming, because reality is complicated that way. Points raised in reply:

- **Travel with the host is a default, not a law.** The dishes are `On` the cloth, so the structural answer to a yank is that they come along. That is the *carry* reading. A yank is not a carry, and reasoning may override the default with the outcome: the dishes stay, or they crash. So consequence reasoning applies to hosting relations as well as to peer edges. The kernel supplies the default; the reasoner can overrule it. In Coyote terms the tablecloth trick is a classic trope, so whether it succeeds is genre-dictated.
- **What the representation contributes to scaling is bounding, not computing.** It supplies the candidate set for consequence reasoning: everything reachable from the moved thing through hosting and peer edges, ordered by closeness. Reasoning then prunes that set. Abstraction is the other lever: a set table read as *one* place-setting abstraction is one thing to reason about, not twenty dishes. That is the abstraction-layers initiative's founding motivation.
