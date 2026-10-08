# Positions --- concepts and vocabulary

This file records **mental models and vocabulary** for `mtw.ephemera.positions` --- what positions **mean** in the game world. Rules: [`AGENT.contract.md`](AGENT.contract.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md).

**New to this area? Read [`AGENT.ludicNetwork.md`](AGENT.ludicNetwork.md) first.** It walks the ludic network once, with one running example. This file is the reference it points into.

---

## Core vocabulary

| Term | Meaning |
| --- | --- |
| **Ludic graph** | One host's shard of the world: `{ rootId, nodes, edges, ports }` --- the host's own node as **root**, its member **nodes** (components, plus presence nodes), typed **relational edges** between them, and the **crossing ports** through which the outside reaches in. Every host kind stores the same shape, the same node/edge pattern as Area `ludicGraph` in WML |
| **Host** | A component that stores a `ludicGraph`: Room, Character, Object, Feature, Area. That a kind can host says nothing about where it sits in a containment ladder |
| **Graph role** | Which question a graph instance answers and **who may mutate it** --- see [Graph roles](#graph-roles-shared-shape-different-authority). Same shape, different authority boundary |
| **Scale** | Which host's graph a statement is made in. The same object is a member at its container's scale and a root at its own; truth may differ between scales and both be correct ([Wholes, parts, and ports](#wholes-parts-and-ports)) |
| **Port / crossing port** | A single-use boundary slot a host publishes; a relation crossing the boundary is stored as **legs** in each graph meeting at a crossing port, addressed as `{ owner, port }`. See [Wholes, parts, and ports](#wholes-parts-and-ports) |
| **Presence node / cover** | One node per way a hosted thing is present in a host (at least one per host), carrying `fromHostId` and a `cover` --- the subset of the thing's own nodes present there. See [Presence as a cover](#presence-as-a-cover) |
| **`ludicCache`** | A derived, attention-scoped read structure folding several shards into one graph from one host's viewpoint; a hit returns a handle, never a subgraph. See [`ludicCache`](#ludiccache-the-attention-scoped-read-structure) |
| **Authored graph** | Blueprint / asset truth merged at participation order (WML `StandardArea.ludicGraph`) |
| **Play graph** | Ephemera runtime state: who is in which room **now**, object placement in play, relations between things |
| **Projection** | A **read model** derived from a graph for one consumer (exits for nav, roster for affordance WML). Projections are filters, not the graph |
| **Positions lane** | `mtw.ephemera.positions` --- ephemera authority for **play-time** position truth and the mutations that maintain it |
| **Character presence** | At play time, which **room** a character occupies and who shares that room --- distinct from Area **authored** participation or exit topology |
| **Room membership** | The play-time fact that a character is **in** a room (and appears on that room's roster): a **Character node** in that room's `ludicGraph`, with a reverse **adjacency** row. Roster display hydrates at read time |
| **Eviction ladder** (`RoomStack`) | Character-local **`{ asset, room }` frames** used to resolve **legal in-play placement** under current asset access. See [Eviction ladder](#eviction-ladder) |
| **Room asset stack** | Which assets **participate in composing** a room's WML at render time (participation order on `Meta::Room`). Answers a **render merge** question --- not where the character **is**, and not the eviction ladder |
| **`EphemeraLudicGraph`** | The host-bound, immutable in-memory model of one ludic graph; the sole ephemera primitive for simulating membership and relational change |

---

## Graph roles (shared shape, different authority)

The `{ nodes, edges }` pattern recurs across the system. **Graph** names a truth **shape**, not a single scope-of-authority boundary. Instances differ by **which question they answer** and **who writes them**.

| Graph role | Question | Authoritative writer | Steady-state example |
| --- | --- | --- | --- |
| **Authored blueprint** | What did we **design**? | Assets / WML merge | Area `ludicGraph` (Exit edges, macro layout) |
| **Play manipulation** | Where is everyone **now**? | `mtw.ephemera.positions` | `Meta::<Kind>.ludicGraph` (any host kind) + adjacency index |
| **Materialized presentation** | What does this **consumer** see at this perspective? | Consumer-specific materialization (e.g. affordanceCache) | `Affordance::` row `topology.exits` |
| **Ephemeral presentation** | What is the **wire-ready** view at read time? | Ephemera compose (cross-cache) | Hydrated roster in `AffordanceRoomDeliverable` |

**Invariant:** membership truth does not define exits; exit truth does not imply roster membership. Consumers that need several views compose **separate projections** --- see [Three play-time questions](#three-play-time-questions) and [`internalCache/AGENT.md`](../../internalCache/AGENT.md).

### Type boundary (storage vs gateway read envelope)

Five names, five roles --- same `{ nodes, edges }` shape, different **authority** and **layer**:

| Type | Layer | Role |
| --- | --- | --- |
| **`EphemeraLudicGraphFieldPayload`** | Dynamo `Meta::*.ludicGraph` attribute | Stored attribute; `hostId` omitted (the row's `EphemeraId` is authoritative) |
| **`EphemeraLudicGraphData`** | `@tonylb/mtw-interfaces` | Manipulation JSON, with `hostId` |
| **`EphemeraLudicGraph`** | ephemera positions | Host-bound manipulation **class**; immutable simulation API |
| **`PlayLudicGraph`** | `@tonylb/mtw-gateways` | Topology-only **authored** projection; **not** a read envelope |
| **`StandardLudicGraph`** | `@tonylb/mtw-wml` | Authored blueprint (asset merge authority) |

**Live state travels only as the stored payload.** A stored attribute is hydrated into the manipulation class, simulated, and written back as a stored attribute; the cache memoizes that same stored payload. The authored projection cannot express runtime-minted structure --- ports, the root designation, non-character nodes --- so routing live state *through* it silently drops that structure. An authoring-shaped type on the operational read path is a defect, not a design.

Roster **display** (`DisplayName`, `SessionIds`, ...) is hydrated at read time from character records, never stored on the graph: the graph holds topology ids only.

#### WML convergence

Relational edge **wire types** stay aligned between the stored play edge (`EphemeraLudicRelationalEdgeData`) and WML's `Relational` tag members. **Authority** stays separate: WML `StandardLudicGraph` owns the authored blueprint and seed/snapshot import; `EphemeraLudicGraph` owns live play mutation. Adapters are the seam, and the seam is **opt-in, not a transit layer**: a caller that wants the authored shape projects into it explicitly, and nothing on the read or memo path routes live state through it. Classes and Dynamo write paths do not merge.

**Cross-links:** gateway handler scope --- [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md); authored exit topology --- [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md); compose paths --- [`../../internalCache/AGENT.md`](../../internalCache/AGENT.md). Normative scope: [`AGENT.contract.md`](AGENT.contract.md#scope-of-authority-manipulation-vs-presentation).

---

## World model

What is stored and what it means. Read this before [Process](#process).

### Room play graph + adjacency reverse index

**The stance:** the room play graph and its reverse adjacency index are the **sole authority** for play membership. The legacy projections --- `Meta::Room.activeCharacters` and `Meta::Character.RoomId` --- are neither written nor read as truth. Anything that needs "who is in this room" derives it from the graph; anything that needs "what room is this character in" reads adjacency. Nothing reconstructs membership from a stored projection, and nothing writes one back.

This is why several contract rules look redundant but are not: forward reads return empty topology rather than fall back to `activeCharacters`, reverse reads consult adjacency rather than a stored `RoomId`, and roster *display* fields hydrate at read time rather than persist alongside membership. Each is the same stance applied at a different surface.

- Each room hosts `Meta::Room.ludicGraph` --- character and object **nodes**, plus in-host **relational edges**. `HostRelationalEdgeKind` has four values: the hosting kinds `On`, `In`, `PartOf`, and the peer kind `Custom` (see *Hosting kind / peer kind* under [Wholes, parts, and ports](#wholes-parts-and-ports)). A presence binding is a node, never an edge kind ([Presence as a cover](#presence-as-a-cover)).
- Each character and each placed object has **adjacency rows** (`CHARACTER#` / `OBJECT#` PK, `POSITION#<host>` SK) pointing at its host(s).

**Room is the worked example, not the only host.** The same forward-graph shape is stored on every host kind as `Meta::<Kind>.ludicGraph`, through one shared serde --- see [Host storage](AGENT.contract.md#host-storage-one-shared-serde-one-documented-exception). **This says nothing about which kinds are levels in a part-of ladder**: that a kind can host a graph is an inventory fact, not a structure claim (see the room-boundary warning under [Wholes, parts, and ports](#wholes-parts-and-ports)).

A character appears in **at most one** room graph at steady state; duplicate membership (drift) is **visible** in the adjacency rows and repaired by an end-state move. Objects follow the same steady-state rule; multi-room object adjacency is drift.

**WML's authoring layer has a narrower two-lists question of its own.** `StandardRoom` derives object membership from its `ludicGraph`, but still carries an authored character reference list independent of the graph's `CHARACTER#` nodes. Whether that authored/runtime asymmetry is intentional is open.

### Object room placement (nodes only)

Improvisational `OBJECT#` placement is **positions-owned** play manipulation:

- **Existence** (improvisation pair + `Meta::Object`) lives on the objects lane ([`../objects/AGENT.md`](../objects/AGENT.md#improvisation-storage)).
- **Where** the object is in play: an `Object` node on its host's `ludicGraph`, plus an `OBJECT#` adjacency row.
- **Spawn** creates existence on the objects lane, then places the object as a second, separate step. **Place, remove and drift repair** are administrative moves; each publishes `Object Moved`.
- **In-host relations** are relational steps committed through the kernel; each publishes `Object Relation Changed`. Containment (`in`, `on`) is not a relational step but a move into the container's own graph ([Object-hosted graph](#object-hosted-graph)).

### Character inventory graph

Held objects are **positions-owned** play manipulation on the character host: an optional `Meta::Character.ludicGraph` of the same shared shape, holding `Object` nodes, with a `POSITION#CHARACTER#...` adjacency row for each. A held object's membership host is the character, so a reverse read of the object may return a `CHARACTER#` host. An `In` on a character means possession.

Take, drop and give are one world-effect: a move of an object between a **host pair**, with no verb and no acting character at execute time --- `takeHold` is `(ROOM# -> CHARACTER#)`, `drop` the reverse, `give` `(CHARACTER# -> CHARACTER#)`. See [Intent vs. world-effect](#intent-vs-world-effect).

### Object-hosted graph

An `Object` can itself host a `ludicGraph` of the same shared shape (`Meta::Object.ludicGraph`, empty when absent). `put cup on table` is a move of the cup into the table's graph plus the cup's own `On` edge to the table's root; `put cup in box` is the same with `In`. `PartOf` has no player phrase: parts come from authored structure or reasoning. `Object Moved`'s endpoints are any host kind, so an object placed on another object reads back an `OBJECT#` host.

### Three play-time questions

Area **topology**, **room membership**, and the **eviction ladder** answer different questions (instances of [graph roles](#graph-roles-shared-shape-different-authority)):

| Question | Domain | Play expression |
| --- | --- | --- |
| Which **exits** exist from this room at this perspective? | Area authored graph -> exit **projection** | Navigable affordances (`topology.exits`) |
| Which **room** is this character in; who is on the roster? | Play-time **membership** | `ludicGraph` nodes, adjacency index; roster hydrated at read time |
| **Where can this character legally be placed** given their asset access? | **Eviction ladder** (`RoomStack`) | Trim frames to accessible assets; top surviving frame -> proposed room; a move when the endpoint differs (connect: from nowhere; asset loss: from an illegal room) |

Exit topology does **not** imply roster membership. Membership does **not** define exits. The ladder is **not** roster membership --- it is **character-local evidence** for resolving a legal membership endpoint.

### Fractal ludic graphs (container scale and edges)

The same **node + edge** pattern recurs at every scale:

```text
Area.ludicGraph (authored)       Room.ludicGraph (play)          Object / Character ludicGraph (play)
  rooms, macro edges        ->     characters, objects      ->     hosted things
  Exit, bearing, ...               peer edges (Custom)             containment edges (On, In, PartOf)
```

**Area scale** relates rooms and region participants; Exit edges project to **navigable affordances**. Other edge kinds may express **non-traversable** spatial facts ("north of" without a door). **Container scale** is the character inventory graph and the object-hosted graph above. What a level *is* --- a whole with its own graph --- is stated in [Wholes, parts, and ports](#wholes-parts-and-ports), which is the shape object-scale work is built against.

### Abstraction Fractal

The organizing principle for composition above and below the human-convenience scale of objects: **the same relation at every level, with no privileged one.** Things are Objects at some scale, related by part-of, up and down. [Wholes, parts, and ports](#wholes-parts-and-ports) is the shape that realizes it.

**There is no `AbstractionFractal` type, entity, or record.** The name is the principle, not a thing in the world or in the schema. The name reads like a noun while asserting that **there is nothing distinctive at any level to type** --- and minting the type would falsify the claim the name exists to make.

**What the name commits to.** *Fractal* claims self-similarity across scale, carried by two properties: **composition is not a tree** (one part can have two wholes, neither containing the other) and **no level is privileged** (a chain can run four deep with every interior term being both a part of what contains it and a whole of what it contains).

**Three departures from the metaphor:**

| Departure | Nature |
| --- | --- |
| **A DAG, not a tree** | Permanent. One part, two wholes, neither containing the other, is a requirement --- so traversal is a DAG walk, not tree recursion |
| **Finite depth, with a base case** | A real fractal recurses infinitely; this one bottoms out at leaf objects. The bottom is uniform: a plain lantern and a rope are present by the same mechanism --- a binding per host, with the lantern's cover simply every node it has |
| **Earned below the room, aspirational above it** | The host-id type admits all five kinds, but **Room/Area containment is a structure of different provenance** (authored asset-stack merge, not play-time graph mutation), so the room is still a privileged level. **A wide host union is not an earned ladder** |

**The third departure carries a visibility hazard.** Encapsulation makes the room/area seam **less visible without making it less real**, and a name asserting uniformity makes it harder still to see. **Do not read quiet as resolution at that seam.**

**What would retire the name:** composition, functional-state aggregate, and multi-host extent turning out to be **three genuinely unlike things** rather than one substrate with distinct relation kinds above it. The name assumes one substrate; it is falsifiable on that.

### Minted, not found

An abstraction is a **cognitive tool, not an objective feature of the world.** The facts under it are objective --- this toy is red, the fork is to the left of the plate --- and the **grouping over them is minted**, because someone judged it useful. A nursery full of toys does not contain an *all red toys* abstraction until something mints one.

**Found and minted, as a pair.** Recognition *finds* things: the rope is tied in a loop, and the player meant something by tying it. Those are **evidence**. The abstraction built on them is **minted** --- a graph write, with an identity, changing what can be referenced and acted on. Evidence **licenses** a mint; it does not constitute one. Same shape as [Intent vs. world-effect](#intent-vs-world-effect): the intent is read off the player, the effect is the system's own act.

- **Convergence is an obligation, not an accident.** One abstraction reachable from a blocking path and from a background one has to produce the same component. Found things converge for free; minted ones have to be made to.
- **No grouping is compelled.** Whether a whole is decomposed, and whether it is ever reabsorbed, are the modeller's choices. A rule that *compels* a grouping owes its own justification.

**There is no `Abstraction` supertype.** As with [Abstraction Fractal](#abstraction-fractal), the name is the principle.

**What licenses a mint is not modelled.** Composition licenses on parts, an arrangement on edges, a derived member set on a predicate --- and *useful right now* is not a licensing condition anywhere. Nothing here authorizes a recognition path to write.

### Wholes, parts, and ports

**Three shape claims**, and nothing else --- no record format, identifier scheme, or hosting model:

1. **A host's members are nodes in its own graph, and a member may itself be a host.** Relations among them are edges in that graph. Any thing can therefore be *both* a graph (as a host) and a node in another graph (as a member) --- `EphemeraLudicGraph` is the recursive type, and "the same relation at every level" is a property of the data.
2. **Boundary crossings are mediated by an explicit binding the interior owns** --- a **port** --- not by direct addressing of interior nodes from outside. **"Owns" is about the *binding*, not about every value recorded on it:** a port exists only because its interior minted it, but some of its fields describe the exterior relationship (which host it faces, above all), and those defer to the exterior reference where one exists. Reading an authority claim out of an ownership claim is the error to avoid.
3. **Every `ludicGraph` has the same internal structure, whatever kind of host it belongs to.** Exactly **one** root node, **present in the graph's own node list** and so usable as an endpoint like any other node, with the graph designating which node it is (`rootId`, an input, never derived from edges; a host-bound graph is rooted at its own host). **A root node is not a privileged kind of node:** the same object is the root of its own graph and an ordinary member of its container's --- *whole and part are roles, not kinds*. There is no root-node type, and no rule gives roots different behaviour.

**Clause 3 constrains graphs that exist and mints none.** It does **not** say which things are hosts, and it does **not** put Room, Area or Feature into the part-of ladder --- **a uniform graph interior is not a uniform containment ladder.**

| Term | Means |
| --- | --- |
| **Whole** | **A way of referring to something while discussing its parts** --- not a type, not a category, and not a thing anything can be a member of. It denotes nothing that "host with a root node" does not already denote |
| **Part** | A node in a host's graph joined to the root by a **`PartOf`** edge --- `niche -PartOf-> wall`, member to root. The counterpart term, used when discussing the thing that contains it |
| **Contents** | A node joined to the root by an **`In`** edge (`crystalBall -In-> kitchen`). **`In` and `PartOf` are non-exclusive**: a box's lid is a part, its crystal ball is contents, and a thing may be **both**. **The distinction lives on the edge, never on the node** --- typing the node would contradict *whole and part are roles, not kinds* |
| **Hosting kind / peer kind** | **The** partition of relation kinds. A **hosting kind** --- `On`, `In`, `PartOf` --- puts the subordinate node in **its host's own graph**: a cup on a tray is a node in the tray's `ludicGraph`, and the tray is a node in the room's. A **peer kind** --- `Custom` --- leaves both endpoints in the same graph and hosts nothing (moving a table does not carry the boots under it). `On` versus `In` differs in **apprehension** (*`On` admits nested things to referent search always, `In` sometimes*) --- an attention property of `ludicCache`, not a structural one. **Consequence:** nothing *travels* with a moved thing; what it hosts is in its own shard and moves with it. *Containment* names the phenomenon (a containment subgraph is a star, below); where a sentence means a specific pair of kinds, it names them rather than reaching for a collective noun |
| *(both, of one object)* | **Whole and part are roles relative to a level, not kinds of object.** The same thing is a part of what contains it and a whole of what it contains, **simultaneously and at every level** --- a string is a part of a machine and a whole of its spans. A rule that gives parts and wholes different behaviour assigns two behaviours to one object. **Do not type either word**; a *room-or-whole* fork is the same mistake |
| **Port** | A **single-use** boundary slot on a host, allocated by that host. **The supertype of a crossing port and a presence binding** (a node, addressed from outside in port form): a port address names one or the other, never a third thing |
| **Crossing port** | The only kind of port record (`EphemeraLudicGraph.ports`). Its interior fan agrees on kind and label **with the single exterior edge crossing into it**. Two connections to the same host are two crossing ports |
| **Egress / ingress** | A port's two ends --- the host it exits to, and its presence on that host's side. *Egress* is also used for a host's whole `ports` list, not one port's exit end --- a two-senses ambiguity |
| **Coarsening** | Failed addressing resolves to the **last successfully addressed host** rather than dangling. `OBJECT#BAG#4d1f0ac` with no live port `4d1f0ac` reads as `OBJECT#BAG`: "tied to the bag's strap" degrades to "tied to the bag" |
| **Scale-relative truth** | The model may give **different** answers at different levels with **both correct** --- the coarse one is not an approximation of the fine one. Answers must be *consistent*, never the same |

**A port address is a structured value, `{ owner, port }`.** Its string notation uses a second `#` --- `OBJECT#ROPE#ab6129d` --- and the port id is a compact **opaque token**, not an ordinal and not a name (the address-form rules are in the [contract](AGENT.contract.md#port-records-field-scope-and-the-conflict-rule)). A port id is **not** a name for the interior node behind it (the part is an ordinary nominal id, and the port merely has an edge to it); **not** a reusable public interface; **not** a fan-out point (one interior edge, one exterior referrer); and **not** evidence about the interior, since **allocation is a property of the boundary**.

**A port is a scale boundary: the legs crossing it are one relation, not two.** A relation whose endpoints land in different hosts is chopped into legs at each hop, and every leg shares one `edgeId` (the `edgeId`/`chainId` split is in [`AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md)), so the legs cannot disagree: `OBJECT#STRING -[tied to]-> OBJECT#TABLE#7c2e91b` outside, `port 7c2e91b -[tied to]-> OBJECT#CUP` inside. One fact, relayed. A **different**, independently-authored relation may also terminate at the same port; it is a distinct `edgeId` and owes no label agreement with the crossing's legs.

**Where a port record's halves live.** A port is stored **interior-side only** --- the host's own graph carries its egress list --- **but the record mixes facts of two scopes.** Its existence, id, lifecycle and kind are the interior's; which host it faces and how that relationship is labelled are the exterior's, held here as denormalized copies. So the interior is authoritative **within its own scope**, not across the board; the conflict rule is in the [contract](AGENT.contract.md#port-records-field-scope-and-the-conflict-rule). The exterior needs no port record of its own, because **a port-address reference already names both the host and the port**.

**Why the shape is worth fixing before the details.** The payoff is **encapsulation, not traversal**: a host's ports are its published interface and what it hosts is the implementation, so **interior repartitioning stops being externally breaking** --- across levels and across time. A thing can decompose or reabsorb without any external reference knowing what scale it was at.

**The room-boundary warning, which travels with this entry.** Encapsulation means external code cannot see what scale a thing is at, which is exactly what would let a real level asymmetry go unremarked. **The host-id type admits all five kinds, and the room boundary is still a seam of different provenance** --- authored asset-stack merge, not play-time graph mutation. The claims above are earned for object interiors and **aspirational for the ladder above the room**.

**Not modelled, and not to be inferred from this entry:** the write side of scale change (`divide` / `merge`); **whether Room or Area belong in the part-of ladder at all** (Feature does: `FEATURE#Niche -PartOf-> FEATURE#Wall`, which does not generalize to Room or Area); and whether an *authored* port may carry a human-facing name.

**Containment runs root-to-part, and that is a constructor discipline, not a structural claim.** Within one graph every containment edge is **incident to the root**, so the containment subgraph is a **star**; multi-level nesting is **nested graphs** --- shards inside shards --- not node-to-node containment edges. The type does not forbid a node-to-node containment edge and nothing asserts the star at runtime; if a use case for several levels in one graph arrives, **the discipline is dropped rather than defended.** That is cheap because moving a whole never traverses to discover what travels --- **mint the whole, move the whole, dissolve the whole** works on a multi-level graph unchanged. **Two things rest on the star and must be re-checked if it goes:** `PartOf` cycle detection (unrepresentable, hence unchecked) and any reader that assumes a containment edge's `to` is the root.

**An unstated membership relation is `In`.** This qualifies the star rather than contradicting it: every containment *edge* is root-incident, and a *node* need not have one.

1. **In `ludicGraph`:** a node that is a member of a host and has not been designated `PartOf` or `On` is `In` that host. The explicit edge states *how*; its absence does not withhold *that*. Character hosts are included (possession).
2. **In `ludicCache`:** a node named in the `cover` of the presence node fronting root R, with no `On`/`PartOf` edge to R, is `In` R --- excluding the root (in every bucket by definition) and presence nodes (which *are* the index), counting only consolidated presence nodes, and yielding nothing for a bucket that was not pulled (silence, not a negative).

**The arrow runs one way:** membership is total and given (`nodeIds` in `ludicGraph`, the presence node's `cover` in `ludicCache`); these clauses read the hosting relation's *kind* off that record when no edge states it, never membership off edges.

**Edge direction: a relation kind is a predicate on its *subject*.** `from` is what the relation is asserted *about*, `to` is what it is asserted *against*: `glass -On-> tray` is "the glass is on the tray", `boots -Custom('under')-> table`, `rope -Custom('tied to')-> tree`. **Containment obeys the same rule** --- `crystalBall -In-> kitchen`, `niche -PartOf-> wall`, **member to root**. *Root-to-part* is right about **incidence** (every containment edge touches the root, which is what makes the subgraph a star and cycles unrepresentable), not about **direction**; reading it as direction produces `kitchen -PartOf-> crystalBall`, "the kitchen is part of the crystal ball".

**What would re-open these claims.** Not a preference or a cheaper-looking alternative: **a corpus case a clause cannot represent**, or a demonstration that encapsulation fails where it was bought --- an interior repartitioning that still breaks external references. Either lifts a clause **by name**; none is eroded by exception.

### Presence as a cover

**Presence answers one question: is the thing, or some of it, here?** Each thing records its own presence bindings, one per way it is present in a host, the same way whatever role it plays; where its nodes are follows from those bindings' covers, never the reverse. A moonbase computer system with a terminal in the lab *is* present in the lab, through a binding whose cover holds the terminal. Whether it should *answer* "what is here" in the lab is a different question --- [apprehension](#ludiccache-the-attention-scoped-read-structure), an attention concern --- and presence does not answer it.

**The formulation, in four claims:**

1. **Presence is a cover of a whole's graph, indexed by the whole's *presence bindings*** --- the distinguishable ways it is present, **not** the set of hosts it is present in. For each binding, presence names a subset of the whole's nodes: the part of the whole that is *there*. **The index is finer than the host set**: one host may hold **two** bindings into the same whole, and those are **two buckets**. A grappling hook gun that is part of a contraption spanning two rooms has one host --- the contraption --- and two disjoint buckets, inherited from the contraption's two. Binding arity is **inherited** from the parent and the host set is not, so indexing by host discards exactly the distinctions that make the case work.
2. **The cover ranges over *nodes only*.** Edges are not bucket members, so **an edge may span two buckets, and must be able to** --- a thread whose spans connect across rooms is how a route through those rooms stays recoverable.
3. **Buckets may overlap**, and their **union is every node** --- *totality*. **The root is in every bucket** unconditionally: the root **is** the whole, so its membership is definitional.
4. **Totality's domain is *hosted* wholes.** A whole with no hosts has an empty cover and is **outside** the invariant, not in violation of it. Disconnected characters are hostless wholes.

**The cover is stored, one bucket per presence node.** A presence binding is a graph node carrying `fromHostId` (a shard locator) and its `cover` --- `Full`, or an enumerated list of `{ host, presence }` entries --- and that field **is** the bucket, authoritative rather than derived. The invariants above are what stored covers are **graded against**: checked, not recomputed (normative form: the contract's [presence-nodes section](AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path)).

**Aggregating every bucket reconstitutes every *node* --- not the graph.** Edges come from the graph, which is what is stored. **An aggregation built as a per-bucket edge union silently drops every edge that spans two buckets**, and those are required. The aggregate of the buckets is the node set; the graph is that node set plus its edges.

**Totality is maintained by construction**, and that is a strength: a binding is minted by the same move that places the thing, and covers every node unless it enumerates, so **no fiction can produce a node in no bucket**. *By construction* is a claim about a **constructor discipline**, true exactly to the extent the discipline is complete --- so the check verifies **write paths**, never the world. The known shortfall is **nested** wholes: a whole straddling two hosts obliges partitioning its parts, and *their* parts, to the depth of the composition, and a constructor that stops at the top level leaves a well-formed outer cover over unaligned inner ones.

**Three guards against reclassification.** A node found in no bucket is **never** grounds for deciding its tag does not bear presence, **never** grounds for deciding its whole is hostless, and **never** excused by the node also being a member of some **other** whole's graph (totality is stated per graph). Each would convert an observed violation into a retroactive domain exclusion --- and when the only remaining failure mode is a constructor bug, a checker that excuses failures is what hides constructor bugs. **Hostlessness is read from the whole's own presence nodes**, never inferred from a bucket computation that came back empty.

**Why location resolution terminates.** Where a thing is, in room terms, is found by walking its bindings up through its hosts, each of which has bindings of its own. **The base case is the room:** rooms are never *members* of any graph, so the walk bottoms out. The rule is the same at every step, whether the thing at that step is being discussed as a whole or as a part. This holds only while the room boundary stays a seam of different provenance ([Wholes, parts, and ports](#wholes-parts-and-ports)); if rooms ever enter the part-of ladder, this argument needs rebuilding.

| Term | Means |
| --- | --- |
| **Cover** | The whole family of buckets for one whole: stored, one bucket per presence node, as that node's `cover` field, and graded against totality, root-in-every-bucket, and nodes-only |
| **Bucket** | The subset of a whole's nodes present at one **presence binding** --- the presence node's `cover`, resolved to a node set (`Full` means every node of the whole). **Keyed by the binding, not by the host**: the host is a property of a bucket, not its key. **Do not index a cover by host** --- it silently merges disjoint buckets rather than failing |
| **Presence binding** | One distinguishable way a whole is present --- what the cover is indexed by. Realized as a presence node; *the index is finer than the host set* is the semantics, *a binding is a node* is the mechanism |
| **Presence node** | A graph node (tag `'Presence'`), never a port record, carrying `cover` and `fromHostId`. It is addressable from outside its host as a `PRESENCE#`-tagged port-form terminal. An edge landing on a presence binding is a terminal, never a crossing, and denotes the part of the object present via that binding |
| **Totality** | The invariant that the buckets' union is every node, over hosted wholes |
| **Aggregation** | Recombining every bucket to recover the node set. **Overlap dedupes**; it is not an error |

**Not modelled:** what sub-graph a bucket *induces*, and what becomes of an edge with one endpoint outside it (a **reduction** convention, not a cover question).

**What would re-open this entry.** A corpus case the cover cannot express --- **not** a case violating totality, since by construction none exists. The live target is the **constructor**: a nested straddling whole whose inner covers no stated discipline can build.

### `ludicCache`: the attention-scoped read structure

**What it is.** `ludicGraph` is sharded one graph per host, and a question like *"which thing does the player mean by 'the cup'?"* asked in a room may need to see into the box on the table. `ludicCache` is **several shards folded into one graph from one host's point of view**, so that reference-location does not walk shards at request time. It is a **read structure**: derived from `ludicGraph` and the attention ledger, never written by a verb, droppable at any time.

**Five commitments, each ruling something out:**

1. **Scope: common ground.** The cache holds what the scene has established --- reference-location above all. It does **not** serve description (a lossy read-side rule over the graph, cached nowhere) or consequence-reasoning (which asks *what is true*; the cache does not hold truth).
2. **Depth is attention-scoped, not exhaustive.** A box nobody has opened contributes one handle; its contents stay in the box's own shard. Once the box is looked into, its contents are promoted into the room's cache and the box's entry degrades to a pointer. **Unbounded size is the failure this prevents**, so a fold that drops nothing is rejected.
3. **A hit returns a handle, never a subgraph.** Reference-location resolves a word to an **address**; acting on it means traversing `ludicGraph` from there. That is what makes folding across ports safe under [encapsulation](#wholes-parts-and-ports): the caller never receives a crossed-port structure.
4. **Fast path, never the sole path.** A miss falls through to the graph walk, which may resolve, improvise, or refuse on narrative grounds. **A cache miss is never an answer of "no"**, so a cache error costs *slow*, never *wrong* --- which licenses lazy invalidation.
5. **Derived, never authoritative.** Materialized from (`ludicGraph`, attention ledger); the ledger folds in under order-independent laws, so a partially ordered ledger produces the same cache.

**How it is built.** Each host being folded in is **cut** into buckets along its presence nodes: an edge with one end outside the bucket is severed, and a transient **stub port** stands in for the missing end. Pieces are then **composed at crossing ports, never at nodes**: a leg ending at a port and the leg starting there collapse into one edge, because a port is not a referent and composing across it destroys nothing, while composing across a node would destroy something a player could name. Each composed edge records the crossings and bindings that justify it --- the evidence of crossing that encapsulation requires the cache to keep. Folded presence nodes are consolidated and carry an **enumerated** cover; `Full` cannot appear in the cache, because "every node of the host" has no referent in a merge.

**Where it sits.** It reads the structure in [Wholes, parts, and ports](#wholes-parts-and-ports) and slices along the axis in [Presence as a cover](#presence-as-a-cover); it consumes both and changes neither.

**Apprehension** --- whether a thing answers "what is here" at a host's scale --- belongs to the cache, not to the graph, and is not modelled. It cannot be read off structure: a rope and a moonbase computer system with parts scattered across a base have **identical presence topology** and need **different** room-scale answers --- you see a rope from any room it passes through, and from a terminal you see *a terminal*, not a computer system. So apprehension will have to be declared, and must not be folded into presence, which both things satisfy equally. The `On`/`In` difference in referent search is an apprehension property of the same kind.

**What would re-open this entry.** Commitment 3 proving unholdable against a real consumer (a hit that must return structure), or a bucket that cannot be stated from the hosted thing's own graph plus its own bindings, which would mean presence is not binding-indexed and the fold's premise fails.

### Authored vs play graphs

- An **Area graph** may list a Character as an Area **participant** (authored scope) --- distinct from **runtime presence** in a room graph.
- **Play mutations** (connect, navigate, pick up, place) update **play graphs**; **projections** feed perception, affordance WML, navigation, and LLM context.

### Map Position facets (x/y)

WML **Position** facets on maps are a **separate** authoring idiom ([`AGENT.facets.md`](../../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md)). The model draws no relationship between them and room graphs.

---

## Process

How the world model is mutated and presented.

### Manipulation layering (membership transfer)

Every graph mutation is an ordered **step sequence**, committed through one kernel entrypoint. Rules: [`AGENT.contract.md`](AGENT.contract.md#manipulation-persist-layering); tiers: [Manipulation tier discipline](AGENT.contract.md#manipulation-tier-discipline).

```text
Route ingress          verb-specific args, trusted ids (attempt, navigate, connect, repair, ...)
        |
        v
Plan                   per-route: diff against live state, build an abstract op, compile it once
        |
        v
Kernel step sequence   transfer | establish / dissolve relation | capture | presence binding
        |
        v
Commit                 lock footprint -> one transactWrite -> re-validate live -> stream facts
        |
        v
Present                post-commit narration and transcript publishing
```

**Invariant:** the kernel does **not** discover prior hosts from the reverse index --- planning always happens upstream.

| Term | Meaning |
| --- | --- |
| **Manipulation kernel** | Graph-grounded persist executor: accept an explicit step sequence, lock the affected hosts, re-validate against freshly-fetched graphs, transact, dual-write adjacency, stream facts |
| **Step sequence** | The ordered instruction list the kernel executes. Order is meaningful and never resorted --- a dissolve step mutates the graph before a following transfer step reads it |
| **Host-local relational patch** | Add/remove **edges** on a fixed host's `ludicGraph` without changing membership host |
| **Membership host transfer** | A move of one entity between hosts (any host kind); projected to bus facts as `froms[]` / `to` |
| **Cross-snapshot recheck** | Re-deriving a plan against a later snapshot than the one that selected it (a dry run before commit; the reducer at commit). A safety property, not duplicated work |

### Two kernels: mutation and presentation

There are exactly **two** kernels, and they filter the *same* step list.

| Kernel | Filters | Runs |
| --- | --- | --- |
| **Mutation** | mutation + capture steps | in the walk, inside the transaction |
| **Presentation** | describe + narrate steps | after commit |

The presentation kernel has **two branches**: **describe** (a rendered description of a thing) and **narrate** (a world line about something that happened). Both publish into the player's transcript; they differ in where their state comes from --- see [Positional vs. terminal binding](#positional-vs-terminal-binding).

**"Presentation", not "perception".** **Perception** is the broad experience category --- *and the name of a data source* (`mtw.ephemera.perception`). **Presentation** is specifically publishing something into the transcript: a **step-kind category**, parallel to mutation. Calling this kernel "perception" claims a data source's territory and implies narration should route through it *terminally* --- the opposite of the binding rule below.

### Positional vs. terminal binding

The single most important distinction in narration:

- A **narrate** step is **positionally bound**: it resolves its audience against graph state *at its own position in the walk*. A leave line reflects the room the character was still standing in.
- A **describe** step is **terminally bound**: it resolves against **final committed state**. A description reflects the world as it ended up.

**This is not an ordering rule.** Both branches publish after the commit. It is about *where the state came from*: describe reads the post-commit graphs; narrate reads a roster **captured mid-walk** by a capture step. Restating it as "narration publishes earlier" loses the point, and collapsing the two into one discipline, in either direction, reintroduces the bug the capture channel exists to remove. Normative form: [Narration and presentation](AGENT.contract.md#narration-and-presentation).

| Term | Meaning |
| --- | --- |
| **Capture** | A read-only walk step that snapshots one host's roster mid-transaction, under a capture id. Carries no write payload |
| **Captured roster** | The plain list of character ids a capture recorded. **Load-bearing** --- it *is* the narration audience, not a diagnostic |
| **Beat** | The moment a mutation commits. Capture happens at the beat, delivery at flush |

### Presence and perspective are orthogonal

**Presence** answers *who was where, when*. **Perspective** answers *whether the actor receives their own event, and in what wording*.

Positional binding is a presence tool and answers nothing about perspective. All narration is third person to each audience; there is no actor/observer copy split. Second-person copy ("you leave the tavern") is a perspective question --- an actor / not-actor referent kind --- and is not modelled. A targeting idiom that adds the mover to a departure room's audience looks like a perspective mechanism and is not: it patches presence. Perspective is not solved with the presence tool.

### Abstract op and compiled step (two levels)

Kernel plans are **compiled from abstract operations**, never hand-built at a call site.

```text
Call site          "a Move happened: this entity, these froms, this to" (+ narration ingredients)
    |
    v
Compiler           expands into [capture*, dissolve*, transfer, establish*, presence pair, capture, narrate*] + slots
    |
    v
Kernel step list   one shared step list, filtered by each kernel
```

An **abstract op** names *what happened in the world*. A **compiler** expands it into the kernel-ready sequence. Only the compiler knows that a move brackets leave-then-arrive, so that invariant lives in **one place** instead of being re-derived at every call site; the compiled plan flows as a value from plan to commit to presentation, compiled once.

- **Narration carries ingredients, not prose.** An op supplies a name, a copy-kind selector, an exit name; the presentation kernel assembles the string at flush. Copy can then react to what the mutation actually *did*, not only to what compile-time intent expected.
- **The compiler holds shape forwards.** The alternative reasons **backwards** from endpoint data to an event shape (what kind of move was this? which verb was that?). Holding the shape forward from a named op means that inference is never written.

### Intent vs. world-effect

**Intents stay distinct where the player's meaning differs; execution unifies where the world-effect is the same.**

Taking hold and dropping are two intents: different utterances, different Plan-stage legality errors ("you're not carrying that" vs. "you're already holding that"). They are **one** world-effect --- move an object between two hosts --- and so one execution path, distinguished only by which host is which.

**Execution carries no verb**: the move is a host pair, so `give` needs no new module, no new event shape, and no new discriminant. The act's wording is not read back off the delta either --- it belongs to whatever created the action, which alone knows which act the player meant.

### Representation choice: union vs class (escalation trigger)

A closed union of plain data (a `kind`-discriminated type, dispatched by one `switch`) and a class hierarchy invert the same cost: a union makes adding **operations** cheap and adding **types** expensive; a class hierarchy the reverse (the expression problem). Default to a union; escalate to a class hierarchy only when all three hold at once:

1. multiple distinct operations switch over the union from **separate files** (not just one dispatcher), **and**
2. the number of member types is churning faster than the number of operations, so "add a type" means hunting down every switch, **and**
3. a per-type **module** can't already absorb the internal complexity --- a module named for the type gives the same locality a method would, without paying the switch cost. This condition usually settles it.

Narration specifications are the worked case: one dispatcher, a stable member count, and the union discriminated on narration **family** rather than direction, since the families share no field. Plain data also survives structural comparison in tests, which class instances do not --- a test-shape cost, separate from the trigger.

### Eviction ladder

When the world is built from **layered assets** (canon plus temporary or personal overlays), a character can occupy rooms that exist only while certain assets remain accessible. `Meta::Character.RoomStack` answers one question under that constraint:

**Where can this character legally be placed in play, given their current asset access?**

**Shape:** an ordered stack of frames `{ asset, room }` from root outward. The outermost frame aligns with **current** presence at the deepest active asset layer; inner frames are **fallback presences** still valid when outer layers are stripped away.

**Purpose:** not a travel diary. The stack is maintained in **trim-ready shape** so resolution is always: filter to accessible assets, read the top frame, move when the endpoint must change.

#### Three roles (one storage shape)

| Role | Question | Typical ingress |
| --- | --- | --- |
| **Resolve legal placement** | After trim, what room is legal? | Connect (place **from nowhere**); asset visibility loss (move **from a room they can no longer occupy**) |
| **Maintain stack on intentional moves** | While placing at the target room, keep frames aligned for future resolution | Navigate (extend / rewrite-tail / fork, in the same transaction as membership) |
| **Bookkeeping-only trim** | Did asset access change without changing the legal room? | Asset trim when the top frame still matches current membership (no `Character Moved`) |

**Resolution triggers** share the same mechanics (trim, top frame, move when the endpoint changes) and differ in **starting membership state**:

| Trigger | Starting state | Outcome when legal room differs |
| --- | --- | --- |
| **Connect** | Out of play --- purged from graph and adjacency; ladder **retained** on disconnect | Place at resolved room (`froms: []` -> `to`) |
| **Asset visibility** | In play at a room that may be invalid after asset loss | Relocate to resolved room (`froms: [illegal...]` -> `to`) |

**Disconnect asymmetry:** disconnect **purges** play membership (graph nodes, adjacency) but **preserves** `RoomStack`. That stack is the retained answer to "where can they legally go when they return?" --- connect resolves from it without reconstructing history.

**Navigate maintenance** (compare the destination's **asset chain** to the current ladder):

| Operation | When | Effect on ladder |
| --- | --- | --- |
| **Extend rung** | Destination chain **continues** the current chain (adds a further asset layer) | Push a new outer frame |
| **Rewrite tail rung** | Same chain prefix and same deepest asset; different room (lateral move within the layer) | Replace the outer frame's room only |
| **Fork** | Destination chain **diverges** from the current branch (sibling asset at some depth) | Truncate the abandoned branch; set the new tail frame |

Example (asset visibility): while a limited-time event overlay is active, middle rungs look like inert bookkeeping. When the event assets deactivate, trim removes the overlay rungs in one pass and lands the character on the last still-valid inner presence (suburbs in canon, not a vanished circus tent).

**Relationship to room membership:** membership is **where the character is now** (roster, `Character Moved`). The ladder is **how a legal endpoint is computed** when membership is missing (connect) or points at an inaccessible layer (asset loss). A trim that fixes only the ladder is not a membership change; a resolution that changes the endpoint is a real move.

### Plan-evaluate loop

The **plan-evaluate loop** is planning whose termination condition is a sandbox evaluation of a proposed plan: **evaluate clean -> run the plan; evaluate irretrievably broken -> discard that candidate (perhaps one among several); evaluate repairable -> fold the repair into the next iteration, which proposes a plan that pre-cleans the defect, and re-evaluate.** Routes today run it to one iteration at most: a player attempt is dry-run once and a repairable verdict refuses it, and an administrative move pre-computes its repair and never re-evaluates.

**Not the backtrack channel.** The backtrack channel re-enters an **earlier pipeline stage**, upstream of where a failure was detected; this loop iterates **within** one stage. Same fault-recovery pattern, two scopes, and neither blocks the other.

**Cheapness.** The evaluator is pure over a graph map fetched once, so the loop is one fetch plus N pure evaluations; only the final commit re-fetches under lock. [Footprint-widening](#footprint-widening-exception) is the one case that costs more.

**Two constraints any harness must satisfy:** (i) **termination** --- repairs are monotone, as a stated rule the repair policies obey rather than an accident a later repair can break; and (ii) **tier** --- the harness is a plan-tier loop calling an evaluator and a repair policy, not an orchestrator, which keeps the [tier discipline](AGENT.contract.md#manipulation-tier-discipline) intact.

### Footprint-widening exception

The [plan-evaluate loop](#plan-evaluate-loop)'s cheapness comes from evaluating over a graph map already in hand. A repair that **widens the footprint** --- touches a host outside that map --- needs graphs the snapshot does not have, and re-fetches under the same discipline the relational reachability fetch already follows for this shape of problem. It is an existing precedent to reuse, not a new mechanism.

### Repair-authority axis

A `repairable` verdict names which kind of repair it is: **mechanical** (invisible to the player --- a dissolve already classified as one the move entails, left unemitted) or **world-changing** (moving the lamp that was resting on the book).

**Which repairs a route may authorize on its own is not modelled**, and neither is when a `repairable` verdict should escalate to a player-facing Consult instead of folding into the next loop iteration. Treating a world-changing repair as an ordinary in-loop repair silently widens what the player asked for; where that line falls is a world-model call about what an action *means*, so a repair policy is written as a deliberate answer to it. This axis is not a gate on the loop: a loop can carry only the repairs it can justify (mechanical ones), and each escalation is its own later feature. A departure with no destination asking whether it may refuse to leave is the same question applied to departures.

---

## Maintaining this file

Present tense, current model only: no dates, no slice or plan-row provenance, no source paths, no status of unbuilt work, no strikethrough. Something the model does not cover is stated as a present-tense boundary ("not modelled"), and the open question itself lives in `taskPlanning/`. Rules go to [`AGENT.contract.md`](AGENT.contract.md); file and function names to [`AGENT.implementation.md`](AGENT.implementation.md); history to git.

**A refactor that changes no behaviour but seems to need an edit here is the signal that the text being edited belongs in another file** --- move it there instead of updating it in place. When a mental model changes, rewrite its entry and check the matching section of [`AGENT.ludicNetwork.md`](AGENT.ludicNetwork.md) in the same change; that file is the present-tense walkthrough of this one and goes stale the same way.

## Navigation

- Primer: [`AGENT.ludicNetwork.md`](AGENT.ludicNetwork.md). Rules: [`AGENT.contract.md`](AGENT.contract.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md), [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md), [`ludicGraph/AGENT.md`](ludicGraph/AGENT.md).
- Cross-area topology authoring (Area `ludicGraph`, Exit edges): [`AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md). Operator design for play-time relational mutations: [`../../diegeticLogic/AGENT.md`](../../diegeticLogic/AGENT.md).
- Open questions about this model: [`AGENT.abstractionLayers.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md) and [`AGENT.presence.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.presence.planning.md).
