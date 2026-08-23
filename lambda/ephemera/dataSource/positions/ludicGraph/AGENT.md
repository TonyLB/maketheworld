# EphemeraLudicGraph (play manipulation model)

Host-bound in-memory model for play manipulation `ludicGraph` truth. Sole positions-lane primitive for membership node and relational edge simulation.

**Status:** P4 authority documentation complete. Initiative shipped; task plan retired (git history).

## Data / class seam

Type vocabulary (five-type contrast): [`../AGENT.concepts.md`](../AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope).

**This module** owns the host-bound manipulation **class** --- `EphemeraLudicGraph` --- with immutable simulation API. Canonical JSON lives in `@tonylb/mtw-interfaces`; gateway read envelope in `@tonylb/mtw-gateways`; authored blueprint in `@tonylb/mtw-wml`.

### Relational edge names

| Name | Layer | Role |
| --- | --- | --- |
| **`EphemeraLudicRelationalEdgeData`** | `mtw-interfaces` JSON | Stored/wire envelope (`tag: 'Relational'`, ...) on `ludicGraph.edges`. `from`/`to` are `EphemeraLudicTerminalPrimitive` (LP4: any legal host kind, not only Object) |
| **`HostRelationalEdge`** | `baseClasses.ts` | Parsed in-memory view (`from`, `to`, `kind`, optional `relationLabel`) --- class API, legality, kernel simulation. **Duplicated** (not consolidated) in `manipulation/types.ts`, widened in lockstep --- a pre-existing split, not new to LP4 |
| **`HostRelationalEdgeKind`** | `mtw-interfaces` | Enum of allowed kinds |

## Module map

| File | Role |
| --- | --- |
| `index.ts` | **`EphemeraLudicGraph` class** (immutable instance methods) + module-level factories (`fromRoomMeta`, `fromCharacterMeta`, `seedFromActiveCharacters`) + node builders, including `nodeFromId` (LP4i: dispatches an arbitrary `EphemeraLudicTerminalPrimitive` to its correctly-tagged node) |
| `baseClasses.ts` | **`HostRelationalEdge`** parsed in-memory view; relational parse/match/serialize helpers |
| `healLudicGraphStructure.ts` | LP4i's self-heal: idempotent, dry-run-capable repair for `ludicGraph` structural staleness, scoped to `rootId`/root-node and `ports` (LP4d: defaults a missing/malformed `ports` to `[]`, LD-17's interim posture (b)) defaulting only. Never called from a read boundary --- only from the `Ludic Graph Stale Structure Finding` consumer (`positions/index.ts`) or an explicit manual invocation |
| `index.test.ts` | Unit tests |

## Public API

### Construction / serialization

```typescript
class EphemeraLudicGraph {
  readonly hostId: EphemeraMembershipHostId
  readonly rootId: EphemeraLudicTerminalId // designated root node (LP4a); recorded, never derived

  static empty(hostId: EphemeraMembershipHostId): EphemeraLudicGraph
  static fromJSON(data: EphemeraLudicGraphData): EphemeraLudicGraph
  static fromFieldPayload(hostId: EphemeraMembershipHostId, payload: EphemeraLudicGraphFieldPayload): EphemeraLudicGraph
  static fromPlayEnvelope(hostId: EphemeraMembershipHostId, envelope: PlayLudicGraph): EphemeraLudicGraph

  toJSON(): EphemeraLudicGraphData
  toStored(): EphemeraLudicGraphFieldPayload
  toPlayEnvelope(): PlayLudicGraph
  clone(): EphemeraLudicGraph
  equals(other: EphemeraLudicGraph): boolean

  get ports(): EphemeraLudicGraphPort[] // egress list (premise 12, LP4d); required, possibly empty; inert until a producer exists
                                        // entries carry `kind` (LP6/PR-11) --- a presence binding iff 'Present', so the
                                        // binding count is a filter on `kind`, never ports.length --- plus the exterior
                                        // `Custom` label, required non-empty when kind is 'Custom'
}
```

Factory helpers on module boundary (not class methods): `fromRoomMeta`, `fromCharacterMeta`, `fromObjectMeta`, `fromFeatureMeta`, `fromAreaMeta`, `seedFromActiveCharacters`. `fromCharacterMeta`/`fromObjectMeta`/`fromFeatureMeta`/`fromAreaMeta` are thin, host-named wrappers over one shared `fromPlainHostMeta` body --- a direct `ludicGraph` field read with a trivial empty default, no reconstruction source. `fromRoomMeta` is the one exception, layering the `seedFromActiveCharacters` fallback on the same decode. Rule: [Host storage: one shared serde, one documented exception](../AGENT.contract.md#host-storage-one-shared-serde-one-documented-exception). `hostDataCategory`/`graphFromMeta` dispatch `Meta::Room` / `Meta::Character` / `Meta::Object` / `Meta::Feature` / `Meta::Area`.

Host alignment: `applyMembershipEffect` / `applyRelationalPatch` assert `effect.hostId` / `patch.hostId === this.hostId`.

### Membership nodes

- Getters: `characterIds`, `objectIds`, `nodeIds` (`Set`, kind-indifferent; LP4)
- Mutators (immutable, return new instance): `addCharacter`, `removeCharacter`, `addObject`, `removeObject` (idempotent add returns `this`; **`removeObject`** also prunes incident **Relational** and **Exit** edges on the same host that reference the removed `OBJECT#`, including edge-only references when the node is already absent)

**Node model --- storage is already heterogeneous; the split is accessor-level (confirmed through conversation 2026-07-24).** There is no separate `objectIds`/`characterIds` *storage*: `index.ts` holds one tag-discriminated `_nodes: EphemeraLudicGraphNode[]` array (`tag: 'Character' | 'Object' | 'Room' | 'Feature' | 'Area'`, the full terminal-kind set since LP4b), and `characterIds`/`objectIds` are **derived getters** that filter it by tag. So the membership/presence layer ("what nodes are on this host") is already thing-generic internally. The typed accessor/mutator *surface* (`addObject`/`addCharacter`, etc.) persists **above** that unified storage, and is load-bearing exactly where objects and characters genuinely differ: **Relational edges and play-only (Exit) edges are object-only.** A blunt collapse to a single `thingIds`/`addThing` surface would erase the type information those object-only operations depend on and just relocate the branching to every relational call site --- don't do it. Where a caller is genuinely kind-indifferent (a presence/catalog scan of "what's here to look at"), there is now an **additive** union getter over `_nodes`: **`nodeIds`** (built in LP4, for `bothObjectsOnGraph`'s edge-terminal presence check --- not `thingIds`, since `nodeIds` also admits Room/Area, which `EphemeraThingId` (a catalog/Identify-layer type, not a graph-node type) does not; see [Known limitation (deferred)](#known-limitation-deferred)), alongside rather than replacing the typed getters.

**Membership instructions already unify across object+character (BD-36, shipped); relations do not.** `KernelTransferMembershipStep.entityIds` is `ReadonlySet<EphemeraObjectId | EphemeraCharacterId>` and character navigate/connect/disconnect route through the same `commitStepSequence` as object take/drop --- one coherent membership-instruction structure spans both today, sitting *above* the still-split accessors. The open cross-cutting-unification work is therefore two distinct axes, not one: **(1)** relations across object+character (the character-relation widening below), and **(2)** getting Features onto the graph at all (below).

### Relational edges

- `relationalEdges` getter returns **`HostRelationalEdge[]`** (Exit-tolerant parse from raw `edges`)
- `addRelationalEdge`, `removeRelationalEdge`, `bothObjectsOnGraph`, `nodeHasRelationalEdge`
- Module helpers in `baseClasses.ts`: `edgesMatch`, `toStoredRelationalEdge`, `extractRelationalEdgesFromStored`, `nodeHasRelationalEdge`, `edgeReferencesObjectId`

Stored JSON remains **`EphemeraLudicRelationalEdgeData`** on `ludicGraph.edges`.

### Kernel simulation (no Dynamo)

- `applyMembershipEffect(effect: HostEffect)` matching kernel `applyEffectToGraph`
- `applyRelationalPatch(patch: HostRelationalPatch)` mirroring kernel validate/apply semantics

Multi-host simulation (Phase C): caller holds **`EphemeraLudicGraph[]`** and upserts by `graph.hostId`.

## Import boundaries

| Consumer | Import | Rule |
| --- | --- | --- |
| `manipulation/kernel/applyStepSequenceCore.ts` (via `commitStepSequence`) | class + simulation methods | Sole writer |
| `manipulation/kernel/` `MultiKeyUpdate` reducer | `graphFromMeta` / `fromRoomMeta` / `fromCharacterMeta`, `toStored()` | Dynamo read/write boundary |
| `manipulation/relational/` | `fromPlayEnvelope`, `edgesMatch` | Coordinator observation |
| `evaluateRelationalLegality`, `compileRelationalFromSkeleton` | read-only class methods | Actions lane; no persist |
| `internalCache.Positions` | wrapper `get` / `set` | Ephemera read/write boundary; `fromPlayEnvelope` / `toPlayEnvelope` inside [`ludicGraphCache.ts`](../../../internalCache/ludicGraphCache.ts) |
| Gateways | via `fromPlayEnvelope` / `toPlayEnvelope` only | No duplicated projection |

Class does **not** own: adjacency rows, Dynamo transact, cache memo, stream facts, WML asset merge.

Production reads stay on `internalCache.Positions.get` per workspace gateways rule.

## Known limitation (deferred)

**Same-host incident edges only:** `removeObject` prunes play-only (Exit) edges on **the host graph where the removal runs** only --- Relational edges are a separate contract (below), not silently pruned. Membership adjacency indexes **node** placement (`getMembershipContainers`), not **edge-only** references on other hosts. A different host may still store an Exit edge mentioning an `OBJECT#` after removal if that host was not updated in the removal transaction (for example a stale room Exit edge after take-hold). **Deferred:** post-clear sweep of Coyote `gameRooms` graphs for edges referencing destroyed ids, or a reverse edge-reference index. See [`../../objects/AGENT.md`](../../objects/AGENT.md) **Coyote bulk clear**.

**Relational edges are assert-and-throw, not silently pruned (BD-33/BD-35):** `removeObject`/`removeCharacter` check that no Relational edge still references the node being removed, and throw `RelationalEdgeStillReferencedError` if one does. Callers are responsible for emitting an explicit `dissolveRelation`/`DissolveRelationStep` first --- via the Synthesize executor's `isolatedFromRelations`, or a hand-swept `boundaryEdgeOutcomes` call, depending on the caller's shape. There is deliberately **no** silent-strip variant to fall back on: a residual relational edge is a caller bug, and failing loudly is the point.

**Character-relation widening, partially closed (BD-36/LP4g):** `removeCharacter`'s assert-and-throw is **still vacuously satisfied today, though the type-level gap it names has closed further.** LP4 widened `HostRelationalEdge`/`EphemeraLudicRelationalEdgeData` endpoints to `EphemeraLudicTerminalPrimitive`; **LP4g (2026-08-19) widened the mutation kernel's own step terminals to match** --- `ExecutorEstablishRelationStep`/`ExecutorDissolveRelationStep`'s `subjectId`/`targetId`, both `findHostOf` copies (now checking `graph.nodeIds`, not `graph.objectIds`), the `getCurrentHost` callback chain, and `buildRelationalFact` (renamed from `buildObjectRelationalFact`)/`ObjectRelationChangedPublishedPayload` --- and deleted the five throw-on-non-Object narrows LP4 had left at the authoritative kernel-step builders. **What LP4g did not reach, confirmed by its own bullets (the kernel's step terminals and `findHostOf`, not this file):** `computeCarryClosure`/`boundaryEdgeOutcomes` (`expandValidate/interactionUnderTransfer.ts`) are still Object-only internally (`isEphemeraObjectId` guards at their boundary, unchanged by LP4a's collapse --- LP4a made the closure a real `EphemeraLudicGraph`, but its member set is still populated Object-only), and LP4h's scope turned out to be `applyTransferSet`'s transfer-set parameter alone, filtering back down to an Object-only set before calling `boundaryEdgeOutcomes`. **This narrow remains unowned.** A new narrow was also found and recorded while landing LP4g, not silently widened or silently left: `perception/objectManipulationPresentationLegAdapters.ts` builds the presentation fan-in's `relationalFact` leg straight off `ObjectRelationChangedPublishedPayload`'s (now widened) `subjectId`/`targetId`, but the leg types stay `EphemeraObjectId`-only throughout the narration/presentation-fan-in stack (`objectManipulationPresentationFanIn.ts`) --- so the adapter now filters a non-Object subject/target to `[]`, mirroring the file's existing character-hosted-narration precedent, rather than widening that separate stack in this slice. So the remaining widening is **behavioral, not typal, and now narrower in scope**: a KR-write path to author character (or Room/Feature/Area) relations, `computeCarryClosure`/`boundaryEdgeOutcomes` admitting non-Object closure members, and presentation-leg narration for a non-Object relational subject. Per "expand as concrete cases demand," not scheduled. A future consumer of this widening should start here, not re-derive the need for it.

**Root concept shipped (LP4a), and the former parallel duplication collapsed into it.** `EphemeraLudicGraph` carries `rootId` --- concepts clause 3's designated root node, present in `nodes` like any other. A host-bound graph (`empty`, `seedFromActiveCharacters`, `fromRoomMeta`/`fromCharacterMeta`/`fromObjectMeta`/`fromFeatureMeta`/`fromAreaMeta`, `fromPlayEnvelope`) is always rooted at its own host (`rootId === hostId`) --- the one true value for a host's own interior graph, not a read-boundary default.

**Correction, LP4i (2026-08-20): "present in `nodes` like any other" above was aspirational, not shipped, until this slice.** LP4a designated `rootId` but never added a node for it --- every host-bound factory produced a `rootId` with no backing entry in `nodes`, which is exactly the referential-integrity gap clause 3 requires closed. Fixed by routing every fresh-construction factory through the new `nodeFromId` dispatcher (`empty`, `seedFromActiveCharacters`, `fromPlainHostMeta`'s default, `fromPlayEnvelope`), and `fromPlayEnvelope` additionally filters the root's own id out of the extracted Character/Object lists to avoid double-adding it for an Object- or Character-hosted graph, whose root shares the projected tag with ordinary members. **`fromFieldPayload` itself is deliberately untouched** --- it is the read boundary, and a payload missing its root node now fails `isEphemeraLudicGraphFieldPayload` (`ephemeraMeta.ts`) loudly rather than being silently patched on read; repair for an existing stale stored row is [`healLudicGraphStructure.ts`](healLudicGraphStructure.ts)'s job, triggered by the `ludicGraphStaleStructureSweep` diagnostics finding, never by a read.

[`computeCarryClosure`](expandValidate/interactionUnderTransfer.ts) --- what used to return the standalone `CarryClosureFragment` shape (`{ rootId, members, edges }`, "a rooted ludic graph in all but name") --- now returns an actual `EphemeraLudicGraph`, built with `hostId = rootId = startId` (the object being moved), `nodes` the absorbed members, `edges` the closure's internal edges. Downstream readers use `.rootId`, `.objectIds`, `.relationalEdges` --- the class's own accessors --- rather than a bespoke shape. `CarryClosureFragment` no longer exists.

One constraint travels with the shape and did not change: **`rootId` is recorded, never derived.** `computeCarryClosure` takes it from its `startId` argument, because the BFS guards with `closureSet.has(...)` and therefore absorbs a doubly-reachable object via whichever edge it happened to traverse first --- the traversal *tree* is order-dependent, while the induced edge set is not.

**Feature (and Area) landed as node tags in LP4b, type-level only and deliberately inert --- no factory or production path constructs one yet, matching LP4/LP2's own "nothing downstream wired up" precedent.** `EphemeraLudicGraphNode`'s `tag` union is now the full terminal-kind set (`Character | Object | Room | Feature | Area`), closing the referential-integrity gap LP4 named: terminal kinds (`EphemeraLudicTerminalPrimitive`) already admitted Feature/Area, so an edge or a future port `owner` could already name one with no node in `nodes` to back it.

**Feature remains deliberately more static than Object, and this is a participation-subset limitation, not a not-a-node-at-all one (confirmed through conversation 2026-07-24, re-scoped 2026-08-19 for containment):** a Feature node is never **membership-moved**, and is never the **subject** of the four *non-containment* relation kinds (`On`/`Under`/`Against`/`Custom`) --- deliberately static, more like the *walls* of a room than its contents (look-at-able, and possibly a relation *target*, but not `transferMembership`-able). **That "never a subject" reading does not extend to containment.** `FEATURE#Niche -PartOf-> FEATURE#Wall` (LD-8, decided 2026-08-15) puts a Feature in the `from`/subject position legitimately --- **direction corrected 2026-08-20 (LD-16): containment runs member -> root**, so the *niche* is the subject asserting it is part of the wall, not the wall asserting it is part of the niche. The case and the exception it forces are unchanged; only which Feature sits at `from` moved --- the original rule was argued in 2026-07-24's vocabulary, before containment kinds existed (`In`/`PartOf` decided 2026-08-09), and reads as a contradiction only if inherited unchanged into the later one. So: no non-containment subject, no membership move, but containment subject is fine. Do not assume a Feature node otherwise inherits Object-node capabilities; it is a narrower participant by design. (This is also why `EphemeraThingId`'s inclusion of `Feature` at the catalog/Identify layer does **not** imply a graph-level `thingIds` --- the two universes differ regardless, see the Node model paragraph above.)

## Documentation

| Doc | Role |
| --- | --- |
| [`../manipulation/AGENT.implementation.md`](../manipulation/AGENT.implementation.md) | Kernel spec; links here as shared primitive |
| [`../AGENT.concepts.md`](../AGENT.concepts.md) | Graph roles, type boundary vocabulary |
| [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) | Gateway read surfaces |
