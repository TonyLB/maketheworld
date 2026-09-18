# Ludic networks --- an orientation

**Read this first, before any other document in this directory or in `taskPlanning/.../positions/`.** It states the *current* shape of the play-time world model in one pass, with one running example, so that the mental-model entries in [`AGENT.concepts.md`](AGENT.concepts.md), the rules in [`AGENT.contract.md`](AGENT.contract.md), and the design plans can be read as detail rather than as history to be reassembled.

**What this file is not.** It is not normative --- rules live in [`AGENT.contract.md`](AGENT.contract.md). It is not a record of how the design got here --- that is what the concepts entries and the plans' discussion files preserve, deliberately. It is not exhaustive: where a section says *see X*, X is the authority and this file is the map. And it is written in the present tense with **no dates, no strikethrough and no corrections-in-place** --- see [Maintaining this file](#maintaining-this-file) at the end for why, and for what to do when the shape changes.

---

## The picture in one paragraph

The world is a set of **components** --- rooms, characters, objects, features, areas --- and every component that holds other things **hosts its own small graph** (`ludicGraph`) describing what is in it and how those things relate. There is no single world graph; the world is **sharded**, one graph per host, and a graph never contains another graph inline. A component reaches *into* another component's interior only through an **external address** the interior publishes --- a **port** --- so a relation that spans two hosts is stored as **legs**, one per graph, meeting at a port. A thing may be a node in **several** hosts' graphs at once (a spring inside a box, and also part of a contraption's mechanism), so containment is a **DAG, not a tree**. Orthogonal to all of that, every hosted thing records its own **presence** --- one **presence node** per host it is in, each carrying a **cover** stating which of the thing's own nodes are *there* --- and this is the index the read-side **`ludicCache`** is built from when it stitches several shards into one attention-scoped view.

Five ideas, then: **sharding**, **external addressing**, **multi-hosting**, **presence as a cover**, and **the cache**. Each has a section below, and the same example runs through all of them.

---

## The running example

```text
ROOM#Lab ------------------------------------------ ROOM#Hall
 |                                                    |
 |-- OBJECT#Box                                       |
 |     |-- OBJECT#Cup                                 |
 |     '-- OBJECT#Spring   <---- also part of ----.   |
 |                                                 |  |
 |-- OBJECT#Contraption --- mechanism: OBJECT#Spring  |
 |                                                    |
 |-- OBJECT#Hook                                      |
 |                                                    |
 '-- OBJECT#Rope (end A in the Lab) ...... (end B in the Hall)
        OBJECT#Rope's own parts: OBJECT#RopeEndA, OBJECT#RopeEndB
```

- The **Lab** holds a box, a contraption, a hook, and one end of a rope.
- The **box** holds a cup and a spring.
- The **contraption** is an abstraction --- a whole whose mechanism includes *the same* spring that sits in the box.
- The **rope** lies across two rooms: end A in the Lab, end B in the Hall. It is one object with two parts.
- A player has tied the rope to the hook (`Hook -TiedTo-> Rope`, both in the Lab) and, reaching into the box, tied the rope to the cup (`Rope -TiedTo-> Cup`, crossing the box's boundary).

Every id below is a real tag from `EphemeraId` (`ROOM#`, `OBJECT#`, `CHARACTER#`, `FEATURE#`, `AREA#`, `PRESENCE#`); the names after the tag are illustrative.

---

## 1. Sharding: every host has its own graph

**Every membership host stores one `ludicGraph`** as the `ludicGraph` attribute of its `Meta::<Kind>` row --- Room, Character, Object, Feature and Area alike, through one shared serde. The stored shape is [`EphemeraLudicGraphFieldPayload`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts):

```text
{
  rootId: <this host's own id>,           // designated root; recorded, never derived
  nodes:  [ ...component nodes, ...presence nodes ],
  edges:  [ ...relational edges ],         // in-host relations, each with from/to/kind
  ports:  [ ...crossing ports ],           // the egress list: where the outside reaches in
}
```

Three things to hold onto:

1. **The host is a node in its own graph, as the root.** `OBJECT#Box`'s graph has a node `OBJECT#Box` and `rootId: 'OBJECT#Box'`. The root is an ordinary node --- it can be a relation endpoint --- and it is the same object that appears as an ordinary *member* node in `ROOM#Lab`'s graph. *Whole* and *part* are roles relative to a level, not kinds of thing.
2. **Membership is the node list.** `OBJECT#Cup` is in the box because `OBJECT#Cup` is a node in `OBJECT#Box`'s graph --- not because of any edge. A reverse index (the **adjacency** rows, `(EphemeraId: OBJECT#Cup, DataCategory: POSITION#OBJECT#Box)`) exists **iff** that node does, and answers "what hosts is X in?" without scanning graphs.
3. **Edges say *how* a member relates, never *whether* it is there.** Relation kinds split in two. **Hosting kinds** --- `On`, `In`, `PartOf` --- describe a member's relation to the host it lives in (the subordinate is in *its host's* graph). **Peer kinds** --- `Under`, `Against`, `Custom` (with a free-text `relationLabel`) --- relate two members of one graph and host nothing. A member with no hosting edge stated is `In` its host by default. Edge direction reads as English about the subject: `OBJECT#Spring -PartOf-> OBJECT#Contraption`, `OBJECT#Cup -In-> OBJECT#Box`.

So the example's Lab and Box graphs are:

```text
ROOM#Lab.ludicGraph                       OBJECT#Box.ludicGraph
  rootId: ROOM#Lab                          rootId: OBJECT#Box
  nodes:  ROOM#Lab, OBJECT#Box,             nodes:  OBJECT#Box, OBJECT#Cup, OBJECT#Spring
          OBJECT#Contraption, OBJECT#Hook,  edges:  (none needed: Cup and Spring are In by default)
          OBJECT#Rope                       ports:  (see section 2)
  edges:  OBJECT#Hook -TiedTo-> OBJECT#Rope
```

The Lab's graph does **not** know the cup exists. Depth comes from graphs nesting --- the box's interior is the box's own shard --- never from one graph containing another.

Every graph has the same internal structure regardless of host kind. That says nothing about *which* kinds sit above which in a containment ladder: rooms are hosts, but the room boundary is authored (asset merge), not a play-time graph mutation, and rooms are never members of another play graph. Two scoping facts follow: a **character** is hosted by a room and only a room; a **feature** is static (never moved, never the subject of a peer relation) but may be `PartOf` another feature.

Where this is normative: [`AGENT.contract.md` --- Host storage](AGENT.contract.md#host-storage-one-shared-serde-one-documented-exception), [Graph apply](AGENT.contract.md#graph-apply-end-state), [Membership persistence API](AGENT.contract.md#membership-persistence-api). Mental model: [`AGENT.concepts.md` --- Wholes, parts, and ports](AGENT.concepts.md#wholes-parts-and-ports). Class API: [`ludicGraph/AGENT.md`](ludicGraph/AGENT.md).

---

## 2. External addressing: ports and legs

A graph may only name nodes in its own shard --- except through a **port-qualified terminal**. A relational edge's `from`/`to` is an [`EphemeraLudicTerminalId`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts): either a bare component id, or a **port address**

```text
{ owner: <host id>, port: <port id> }
```

meaning *"the thing behind port `<port id>` of `<host id>`."* This is a structured value, not a string --- there is no `OBJECT#Box#abc` string form in storage. The address names a **boundary slot the interior published**, never an interior node directly: the outside cannot say `OBJECT#Cup`, only "whatever the box put behind this port."

There are two kinds of thing a port address can name, distinguished by the port id alone:

| Port id looks like | Names | Backed by |
| --- | --- | --- |
| bare uuid (`'8f3a…'`) | a **crossing port** --- a relation passing through the host's boundary | a record in the owner's `ports` list |
| `PRESENCE#<uuid>` | a **presence binding** --- one way the owner is present somewhere (section 4) | a presence node in the owner's `nodes` |

### Crossing ports: one relation, several legs

When the player ties the rope (in the Lab) to the cup (in the box), the relation crosses the box's boundary. It is stored as **two legs meeting at a crossing port minted on the box**:

```text
ROOM#Lab.ludicGraph                             OBJECT#Box.ludicGraph
  edges: OBJECT#Rope -TiedTo-> {owner: OBJECT#Box, port: 8f3a}
                                                  ports: { portId: 8f3a, fromHostId: ROOM#Lab, kind: Custom,
                                                           exteriorRelationLabel: 'TiedTo' }
                                                  edges: {owner: OBJECT#Box, port: 8f3a} -TiedTo-> OBJECT#Cup
```

- **One fact, relayed.** Both legs carry the same `kind` and label; a crossing never changes what the relation *is* from one side to the other. The pair is a **chain**; each stored edge is a **leg**. Identity adheres to the chain (`chainId`, when minted, is stamped on every leg); hosting and the mutation site adhere to the leg. A relation crossing *n* boundaries is *n+1* legs and *n* crossing ports, built one hop at a time.
- **A port is single-use.** One interior edge, one exterior referrer. Two relations into the same box are two ports. A port id is not a name for the interior node behind it and not a reusable interface.
- **The port record is stored interior-side only**, but mixes two scopes: its existence, id and `kind` are the interior's; `fromHostId` and the exterior label are denormalised copies of the exterior's edge, and the exterior governs if they disagree.
- **What this buys is encapsulation, not traversal.** The box can reorganise its interior --- split the cup into cup-and-handle, say --- without the Lab's edge changing, because the Lab only ever named the port.
- **Coarsening.** If a port address no longer resolves (the port is gone), a reader falls back to the owner: "tied to the box's port" degrades to "tied to the box" rather than dangling.

Where this is normative: [`AGENT.contract.md` --- Port records](AGENT.contract.md#port-records-field-scope-and-the-conflict-rule). The leg/chain identity split is stated with the authoring-side edges in [`AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md). Producer: `buildCrossingLegs` (actions lane, `synthesize/`).

---

## 3. Multi-hosting: containment is a DAG

The spring is **inside the box** and **part of the contraption**. Both are hosting relations, so `OBJECT#Spring` is a node in **two** graphs:

```text
OBJECT#Box.ludicGraph                    OBJECT#Contraption.ludicGraph
  nodes: …, OBJECT#Spring                  nodes: OBJECT#Contraption, OBJECT#Spring, …
  (Spring is In the box by default)        edges: OBJECT#Spring -PartOf-> OBJECT#Contraption
```

Nothing is severed or duplicated here: *the spring is in the box* and *the spring is part of the contraption* are two independently complete facts, each stored where its host is. `getMembershipContainers(OBJECT#Spring)` returns both hosts. The spring's own graph (its interior, if it has parts) is one shard regardless of how many hosts hold it.

Consequences worth carrying:

- **Traversal is a DAG walk, not tree recursion.** A reader following "what is in the Lab" reaches the spring twice (via the box, via the contraption) and must dedupe, not error.
- **Moving a thing is a membership change, not a subtree copy.** Taking the spring out of the box removes its node from the box's graph and leaves the contraption's untouched --- unless a rule says the relation must dissolve, which is a legality question for the move, not a structural one.
- **`In` and `PartOf` are non-exclusive** and typed on the edge, not the node. The spring is not a different kind of object for being a part; the *same* object is a whole of its own interior and a part of two containers.
- **Abstractions are minted, not found.** The contraption exists as a component because someone (the modeller, a recognition path) judged the grouping useful and wrote it. Nothing compels a grouping.

Mental model: [`AGENT.concepts.md` --- Abstraction Fractal](AGENT.concepts.md#abstraction-fractal) (why "DAG, not tree" is permanent) and [Minted, not found](AGENT.concepts.md#minted-not-found).

---

## 4. Presence: a cover, indexed by binding

Sections 1--3 answer *what is in each host*. Presence answers the converse from the hosted thing's side: **where am I, and which of my parts are there?** It is stored on the *hosted* thing, and it is the axis along which the cache (section 5) slices the world.

**Every hosted thing carries *at least* one presence node per host it is in**, as a node in its own graph. Usually exactly one --- but a thing inside a whole that is itself present in a host two distinguishable ways **inherits that arity**: a grappling-hook gun that is part of a contraption straddling two rooms has *one* host (the contraption) and *two* bindings into it, one per bucket of the contraption's own cover. That is why presence is indexed by binding rather than by host:

```text
{ tag: 'Presence', universalKey: 'PRESENCE#<uuid>', fromHostId: <the host>, cover: <see below> }
```

- **`fromHostId`** is a shard locator: which host's graph to read to find this thing as a member.
- **`cover`** is the **bucket** --- which of this thing's own nodes are present at this host. Either `{ tag: 'Full' }` (all of them) or `{ tag: 'Enumerated', members: [{ host, presence }, …] }`, each member naming one of this thing's nodes *and which of that node's own bindings* is meant.

The rope makes the point. It is a node in the Lab's graph and in the Hall's graph, so its own graph holds two presence nodes:

```text
OBJECT#Rope.ludicGraph
  rootId: OBJECT#Rope
  nodes:  OBJECT#Rope, OBJECT#RopeEndA, OBJECT#RopeEndB,
          { Presence, PRESENCE#p1, fromHostId: ROOM#Lab,  cover: [EndA] }   // bucket 1
          { Presence, PRESENCE#p2, fromHostId: ROOM#Hall, cover: [EndB] }   // bucket 2
  edges:  OBJECT#RopeEndA -PartOf-> OBJECT#Rope
          OBJECT#RopeEndB -PartOf-> OBJECT#Rope
          OBJECT#RopeEndA -Custom('spliced to')-> OBJECT#RopeEndB
```

The **formulation**, in the terms the design uses:

| Term | Meaning, on the rope |
| --- | --- |
| **Presence binding** | One distinguishable way the rope is present. Realised as a presence node. There are two, and they are indexed **by binding, not by host** --- one host could hold two bindings into the same thing, and those are two buckets |
| **Bucket** | The nodes present at one binding: `{Rope, EndA}` in the Lab, `{Rope, EndB}` in the Hall. **The root is in every bucket**, definitionally |
| **Cover** | The family of buckets. **Totality:** their union is every node of the rope. Buckets may overlap |
| **Cross-bucket edge** | `EndA -spliced to-> EndB` spans both buckets. Edges are never bucket members; a cover ranges over **nodes only**. A per-bucket edge union would silently lose this edge, and it is exactly the edge that makes the rope's route recoverable |

**Addressing a binding from outside.** The Lab's edge `OBJECT#Hook -TiedTo-> OBJECT#Rope` names the rope as a whole. To say *the part of the rope that is here*, an edge lands on the binding: `OBJECT#Hook -TiedTo-> {owner: OBJECT#Rope, port: 'PRESENCE#p1'}`. That terminal **is** the referent (the Lab-side extent of the rope), not a pointer to be walked, and an edge landing there is a terminal, never a crossing.

**Two senses of "present", and this is the membership sense.** Whether the rope *is* in the Lab (membership --- derived from where its parts are) is a different question from whether the rope *answers "what is here"* at room scale (apprehensibility --- declared, and not part of this structure). A moonbase computer with terminals in five rooms is present in all five; what you *see* from a terminal is a terminal.

**What is built and what is not.** The presence-node record, its single write path (one binding minted per rehost, removed on departure --- so the shipped emitters produce arity 1; inherited arity above one is representable but not yet written by anything), the cover field, the `PRESENCE#` addressing, and the cache's reading of it are all shipped. **No writer yet computes an enumerated cover** --- every binding is minted `{ tag: 'Full' }`, which is correct for every single-hosted thing and is the rope's *target* shape, not its current one. Descent (a part's own bindings following its whole's) is likewise unbuilt; no current caller needs it.

Where this is normative: [`AGENT.contract.md` --- Presence nodes](AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path). Mental model, with the reasoning: [`AGENT.concepts.md` --- Presence as a cover](AGENT.concepts.md#presence-as-a-cover). Build status: [`AGENT.implementation.md` --- `ludicGraph/`](AGENT.implementation.md#ludicgraph-play-manipulation-model).

---

## 5. The cache: stitching shards along the presence axis

Everything above is **truth**, mutated through the kernel. `ludicCache` is a **derived, droppable read structure**: several shards folded into one graph, from one host's point of view, so that "the cup" can be resolved to an address without walking Lab -> Box at request time.

**What it is for** (proposal P6's five clauses, restated):

1. **Scope:** what the scene has established as common ground --- reference-location first of all. Not consequence-reasoning, not description.
2. **Depth is attention-scoped, not exhaustive.** A box nobody has opened contributes a handle; once opened, its contents are promoted into the room's cache.
3. **A hit returns a handle, never a subgraph.** Acting on the answer means traversing `ludicGraph` from that address. This is why flattening across ports is safe: the cache never *returns* structure.
4. **Fast path, never the sole path.** A miss falls through to the graph walk. A miss is never "no."
5. **Derived, never authoritative.** Materialised from `ludicGraph` plus the attention ledger; can be thrown away.

**How it is built.** For each host being folded in, its graph is **cut** into buckets along its presence nodes (`subGraphFromNodes`, `nodesFromPresenceBinding`): an edge with one end outside the bucket is severed, and a transient **stub port** stands in for the missing end. The pieces are then **composed at crossing ports** --- a leg ending at `{owner: Box, port: 8f3a}` and the leg starting there collapse into one edge `OBJECT#Rope -TiedTo-> OBJECT#Cup` --- and **never at nodes**: a port is not a referent, so composing across it destroys nothing; a node is, so composing across it would.

The result is [`EphemeraLudicCacheData`](ludicCache/types.ts):

```text
{
  hostId: ROOM#Lab,
  nodes:  [ component nodes + shortName (+ embedding),
            presence nodes with cover: Enumerated only, plus consolidated: boolean ],
  edges:  [ relational edges + supportedBy: [ [ {port, presenceBucketIds}, … ], … ] ]
}
```

`supportedBy` records **which crossings and bindings justify each composed edge** --- OR over routes, AND over the hops in a route --- so a reader can tell that `Rope -TiedTo-> Cup` came through the box's port and depends on the cup's binding there. That is the evidence-of-crossing the encapsulation rule requires the cache to keep. A same-host edge's `supportedBy` is `[]`: it depends on no crossing.

Presence in the cache: a folded presence node carries `consolidated: true` and an **enumerated** cover (`Full` is illegal there --- "every node of the host" has no referent in a merge). If a host consolidates one of its bindings it consolidates all of them. A cover entry naming a node absent from the cache is corruption; an edge landing on a presence node absent from the cache is legal (the binding exists and was not pulled in).

**Status.** The cache is a **Prototype** with a named rollback trigger: *a bucket cannot be stated from the hosted thing's own graph plus its bindings.* The pairwise pieces (cut, compose, fold presence nodes, integrity guard) are shipped under [`ludicCache/`](ludicCache/); the **whole-cache rebuild seeded at a host, its first consumer, and persistence are in flight** under [`AGENT.ludicCacheRebuild.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.ludicCacheRebuild.planning.md). Nothing reads the cache in production yet.

---

## Vocabulary at a glance

| Term | One line | Authority |
| --- | --- | --- |
| **Component** | A room, character, object, feature or area --- anything with an `EphemeraId` that can be a graph node | [`ephemeraMeta.ts`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) |
| **Host** | A component that stores a `ludicGraph`; all five kinds do | [Host storage](AGENT.contract.md#host-storage-one-shared-serde-one-documented-exception) |
| **`ludicGraph`** | One host's shard: `{ rootId, nodes, edges, ports }` | [`ludicGraph/AGENT.md`](ludicGraph/AGENT.md) |
| **Root** | The host's own node in its own graph; recorded, never derived | [Wholes, parts, and ports](AGENT.concepts.md#wholes-parts-and-ports) |
| **Whole / part** | Roles, not kinds: a thing is a whole of its interior and a part of its containers, at once | same |
| **Membership** | X is in H iff X is a node in H's graph; mirrored by an adjacency row | [Graph apply](AGENT.contract.md#graph-apply-end-state) |
| **Hosting kind / peer kind** | `On`/`In`/`PartOf` put the subject in its host's graph; `Under`/`Against`/`Custom` relate two members | [Relation kind enum](AGENT.contract.md#relation-kind-enum-bd-2) |
| **Terminal** | An edge endpoint: bare component id, or a port address `{ owner, port }` | [`ephemeraMeta.ts`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) |
| **Port** | A single-use boundary slot a host publishes; either a crossing port or a presence binding | [Wholes, parts, and ports](AGENT.concepts.md#wholes-parts-and-ports) |
| **Crossing port** | The record in `ports` where a relation passes through the boundary; interior-side, two scopes of field | [Port records](AGENT.contract.md#port-records-field-scope-and-the-conflict-rule) |
| **Leg / chain** | A relation across boundaries is stored as legs, one per graph; the chain is their shared identity | [`AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) |
| **Coarsening** | An unresolvable port address reads as its owner | [Wholes, parts, and ports](AGENT.concepts.md#wholes-parts-and-ports) |
| **Presence node** | `{ tag: 'Presence', PRESENCE#…, fromHostId, cover }` in the hosted thing's graph; one per binding, and a host may hold more than one binding into the same thing | [Presence nodes](AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path) |
| **Binding / bucket / cover / totality** | One way of being present / its node subset / the family of buckets / their union is every node | [Presence as a cover](AGENT.concepts.md#presence-as-a-cover) |
| **Apprehension scale** | Whether a thing answers "what is here" at a host's scale; declared, not derived, not yet modelled | same |
| **`ludicCache`** | Derived, attention-scoped, cross-shard read structure; hits return handles | [`ludicCache/types.ts`](ludicCache/types.ts), [rebuild plan](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.ludicCacheRebuild.planning.md) |
| **Stub port** | Transient crossing port minted by a cut, never persisted, id-prefixed `STUB-` | [`presenceSubGraph.ts`](ludicGraph/presenceSubGraph.ts) |
| **`supportedBy`** | A cache edge's record of the crossings and bindings that justify it | [`ludicCache/types.ts`](ludicCache/types.ts) |

---

## Where to go next

- **For the rules** that code must obey today: [`AGENT.contract.md`](AGENT.contract.md). Sections cited above are the ones that touch the network; the rest of that file is the mutation kernel, narration and the eviction ladder, which sit *on* this structure rather than *in* it.
- **For the reasoning and the open edges** behind each idea, with its history preserved on purpose: [`AGENT.concepts.md`](AGENT.concepts.md) --- [Wholes, parts, and ports](AGENT.concepts.md#wholes-parts-and-ports), [Presence as a cover](AGENT.concepts.md#presence-as-a-cover), [Abstraction Fractal](AGENT.concepts.md#abstraction-fractal). Those entries are written as ledgers; read them *after* this file and they are commentary, before it and they are a puzzle.
- **For the types**: [`ephemeraMeta.ts`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), terminal and port block onward. The parsed shape is the stored shape.
- **For the class and code map**: [`ludicGraph/AGENT.md`](ludicGraph/AGENT.md), [`AGENT.implementation.md`](AGENT.implementation.md).
- **For what is still being decided**: the design plans under `taskPlanning/lambda/ephemera/dataSource/positions/` --- [`AGENT.abstractionLayers.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md) (the parent; its locked frame is sections 1--2 here), [`AGENT.presence.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.presence.planning.md) (section 4), [`AGENT.edgeAbstractions.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.edgeAbstractions.planning.md) (what one edge means at another scale), and [`AGENT.ludicCacheRebuild.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.ludicCacheRebuild.planning.md) (section 5). Each has its own Getting Started; start there, not at their decision tables.

---

## Maintaining this file

This file exists because the durable docs and plans preserve their history in place --- struck claims, dated corrections, retired vocabulary --- which is right for them and wrong for a first read. So this file follows the opposite rule:

- **Present tense, current shape only.** No dates, no strikethrough, no "corrected on". When a section here stops being true, **rewrite the paragraph**; the record of what it used to say belongs in the concepts entry or the plan that changed it, and in git.
- **Say plainly what is unbuilt** ("no writer yet computes an enumerated cover"), so that a reader can tell target from shipped without a status legend.
- **One running example.** New sections extend it rather than introducing a second world.
- **Map, not authority.** If this file and a contract clause disagree, the contract is right and this file has a bug --- fix it here.

When a plan graduates a mechanism into `AGENT.contract.md` or flips a concepts entry from Target to Shipped, check the matching section here in the same change.
