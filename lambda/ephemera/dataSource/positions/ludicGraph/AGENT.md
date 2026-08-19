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
| `index.ts` | **`EphemeraLudicGraph` class** (immutable instance methods) + module-level factories (`fromRoomMeta`, `fromCharacterMeta`, `seedFromActiveCharacters`) + node builders |
| `baseClasses.ts` | **`HostRelationalEdge`** parsed in-memory view; relational parse/match/serialize helpers |
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
}
```

Factory helpers on module boundary (not class methods): `fromRoomMeta`, `fromCharacterMeta`, `fromObjectMeta`, `fromFeatureMeta`, `fromAreaMeta`, `seedFromActiveCharacters`. `fromCharacterMeta`/`fromObjectMeta`/`fromFeatureMeta`/`fromAreaMeta` are thin, host-named wrappers over one shared `fromPlainHostMeta` body --- a direct `ludicGraph` field read with a trivial empty default, no reconstruction source. `fromRoomMeta` is the one exception, layering the `seedFromActiveCharacters` fallback on the same decode. Rule: [Host storage: one shared serde, one documented exception](../AGENT.contract.md#host-storage-one-shared-serde-one-documented-exception). `hostDataCategory`/`graphFromMeta` dispatch `Meta::Room` / `Meta::Character` / `Meta::Object` / `Meta::Feature` / `Meta::Area`.

Host alignment: `applyMembershipEffect` / `applyRelationalPatch` assert `effect.hostId` / `patch.hostId === this.hostId`.

### Membership nodes

- Getters: `characterIds`, `objectIds`, `nodeIds` (`Set`, kind-indifferent; LP4)
- Mutators (immutable, return new instance): `addCharacter`, `removeCharacter`, `addObject`, `removeObject` (idempotent add returns `this`; **`removeObject`** also prunes incident **Relational** and **Exit** edges on the same host that reference the removed `OBJECT#`, including edge-only references when the node is already absent)

**Node model --- storage is already heterogeneous; the split is accessor-level (confirmed through conversation 2026-07-24).** There is no separate `objectIds`/`characterIds` *storage*: `index.ts` holds one tag-discriminated `_nodes: EphemeraLudicGraphNode[]` array (`tag: 'Character' | 'Object'`), and `characterIds`/`objectIds` are **derived getters** that filter it by tag. So the membership/presence layer ("what nodes are on this host") is already thing-generic internally. The typed accessor/mutator *surface* (`addObject`/`addCharacter`, etc.) persists **above** that unified storage, and is load-bearing exactly where objects and characters genuinely differ: **Relational edges and play-only (Exit) edges are object-only.** A blunt collapse to a single `thingIds`/`addThing` surface would erase the type information those object-only operations depend on and just relocate the branching to every relational call site --- don't do it. Where a caller is genuinely kind-indifferent (a presence/catalog scan of "what's here to look at"), there is now an **additive** union getter over `_nodes`: **`nodeIds`** (built in LP4, for `bothObjectsOnGraph`'s edge-terminal presence check --- not `thingIds`, since `EphemeraThingId` includes `Feature`, which is not a graph node; see [Known limitation (deferred)](#known-limitation-deferred)), alongside rather than replacing the typed getters.

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

**Character-relation widening, deferred (BD-36):** `removeCharacter`'s assert-and-throw is **still vacuously satisfied today, though the type-level gap it names has closed.** LP4 widened `HostRelationalEdge`/`EphemeraLudicRelationalEdgeData` endpoints to `EphemeraLudicTerminalPrimitive`, which does admit `EphemeraCharacterId` --- but no production ingress path authors a character-relation edge yet, and `computeCarryClosure`/`boundaryEdgeOutcomes` (`expandValidate/interactionUnderTransfer.ts`) are still Object-only internally (`isEphemeraObjectId` guards at their boundary, unchanged by LP4a's collapse --- LP4a made the closure a real `EphemeraLudicGraph`, but its member set is still populated Object-only). **LP4h checked and did not retire this narrow** (2026-08-19): its scope turned out to be `applyTransferSet`'s transfer-set parameter alone (`Object | Character`, dispatching to `removeCharacter`/`addCharacter` for the character subset), and it filters back down to an Object-only set before calling `boundaryEdgeOutcomes` --- `interactionUnderTransfer.ts` itself is untouched. Nor is LP4g's scope a match; its bullets cover the kernel's step terminals and `findHostOf`, not this file. **This narrow is currently unowned** --- the exact gap this plan's own vocabulary warns about. So the remaining widening is **behavioral, not typal**: a KR-write path to author character relations, and `computeCarryClosure`/`boundaryEdgeOutcomes` admitting non-Object closure members. Per "expand as concrete cases demand," not scheduled. A future consumer of this widening should start here, not re-derive the need for it.

**Root concept shipped (LP4a), and the former parallel duplication collapsed into it.** `EphemeraLudicGraph` carries `rootId` --- concepts clause 3's designated root node, present in `nodes` like any other. A host-bound graph (`empty`, `seedFromActiveCharacters`, `fromRoomMeta`/`fromCharacterMeta`/`fromObjectMeta`/`fromFeatureMeta`/`fromAreaMeta`, `fromPlayEnvelope`) is always rooted at its own host (`rootId === hostId`) --- the one true value for a host's own interior graph, not a read-boundary default.

[`computeCarryClosure`](expandValidate/interactionUnderTransfer.ts) --- what used to return the standalone `CarryClosureFragment` shape (`{ rootId, members, edges }`, "a rooted ludic graph in all but name") --- now returns an actual `EphemeraLudicGraph`, built with `hostId = rootId = startId` (the object being moved), `nodes` the absorbed members, `edges` the closure's internal edges. Downstream readers use `.rootId`, `.objectIds`, `.relationalEdges` --- the class's own accessors --- rather than a bespoke shape. `CarryClosureFragment` no longer exists.

One constraint travels with the shape and did not change: **`rootId` is recorded, never derived.** `computeCarryClosure` takes it from its `startId` argument, because the BFS guards with `closureSet.has(...)` and therefore absorbs a doubly-reachable object via whichever edge it happened to traverse first --- the traversal *tree* is order-dependent, while the induced edge set is not.

**Features are not graph nodes yet, and are deliberately more static than Objects (confirmed through conversation 2026-07-24):** the node `tag` union is `'Character' | 'Object'` only --- Features participate in *neither* membership nor relations today. Bringing them onto the graph is a **structural extension** (a new `'Feature'` tag), not the type *widening* characters need. And when it happens, a Feature node should participate in only a **subset** of the instruction structure: Features are never the **subject** of a relation and are never **membership-moved** --- they are deliberately static, more like the *walls* of a room than its contents (look-at-able, and possibly a relation *target*, but not `transferMembership`-able and not a relation subject). So do not assume a Feature node inherits Object-node capabilities; it is a narrower participant by design. (This is why `EphemeraThingId`'s inclusion of `Feature` at the catalog/Identify layer does **not** imply a graph-level `thingIds` --- the two universes differ precisely here.)

## Documentation

| Doc | Role |
| --- | --- |
| [`../manipulation/AGENT.implementation.md`](../manipulation/AGENT.implementation.md) | Kernel spec; links here as shared primitive |
| [`../AGENT.concepts.md`](../AGENT.concepts.md) | Graph roles, type boundary vocabulary |
| [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) | Gateway read surfaces |
