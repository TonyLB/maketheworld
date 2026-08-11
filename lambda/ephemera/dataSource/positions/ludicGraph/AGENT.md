# EphemeraPositionGraph (play manipulation model)

Host-bound in-memory model for play manipulation `positionGraph` truth. Sole positions-lane primitive for membership node and relational edge simulation.

**Status:** P4 authority documentation complete. Initiative shipped; task plan retired (git history).

## Data / class seam

Type vocabulary (five-type contrast): [`../AGENT.concepts.md`](../AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope).

**This module** owns the host-bound manipulation **class** --- `EphemeraPositionGraph` --- with immutable simulation API. Canonical JSON lives in `@tonylb/mtw-interfaces`; gateway read envelope in `@tonylb/mtw-gateways`; authored blueprint in `@tonylb/mtw-wml`.

### Relational edge names

| Name | Layer | Role |
| --- | --- | --- |
| **`EphemeraPositionRelationalEdgeData`** | `mtw-interfaces` JSON | Stored/wire envelope (`tag: 'Relational'`, ...) on `positionGraph.edges` |
| **`HostRelationalEdge`** | `baseClasses.ts` | Parsed in-memory view (`from`, `to`, `kind`, optional `relationLabel`) --- class API, legality, kernel simulation |
| **`HostRelationalEdgeKind`** | `mtw-interfaces` | Enum of allowed kinds |

## Module map

| File | Role |
| --- | --- |
| `index.ts` | **`EphemeraPositionGraph` class** (immutable instance methods) + module-level factories (`fromRoomMeta`, `fromCharacterMeta`, `seedFromActiveCharacters`) + node builders |
| `baseClasses.ts` | **`HostRelationalEdge`** parsed in-memory view; relational parse/match/serialize helpers |
| `index.test.ts` | Unit tests |

## Public API

### Construction / serialization

```typescript
class EphemeraPositionGraph {
  readonly hostId: EphemeraMembershipHostId

  static empty(hostId: EphemeraMembershipHostId): EphemeraPositionGraph
  static fromJSON(data: EphemeraPositionGraphData): EphemeraPositionGraph
  static fromFieldPayload(hostId: EphemeraMembershipHostId, payload: EphemeraPositionGraphFieldPayload): EphemeraPositionGraph
  static fromPlayEnvelope(hostId: EphemeraMembershipHostId, envelope: PlayPositionGraph): EphemeraPositionGraph

  toJSON(): EphemeraPositionGraphData
  toStored(): EphemeraPositionGraphFieldPayload
  toPlayEnvelope(): PlayPositionGraph
  clone(): EphemeraPositionGraph
  equals(other: EphemeraPositionGraph): boolean
}
```

Factory helpers on module boundary (not class methods): `fromRoomMeta`, `fromCharacterMeta`, `seedFromActiveCharacters`.

Host alignment: `applyMembershipEffect` / `applyRelationalPatch` assert `effect.hostId` / `patch.hostId === this.hostId`.

### Membership nodes

- Getters: `characterIds`, `objectIds` (`Set`)
- Mutators (immutable, return new instance): `addCharacter`, `removeCharacter`, `addObject`, `removeObject` (idempotent add returns `this`; **`removeObject`** also prunes incident **Relational** and **Exit** edges on the same host that reference the removed `OBJECT#`, including edge-only references when the node is already absent)

**Node model --- storage is already heterogeneous; the split is accessor-level (confirmed through conversation 2026-07-24).** There is no separate `objectIds`/`characterIds` *storage*: `index.ts` holds one tag-discriminated `_nodes: EphemeraPositionGraphNode[]` array (`tag: 'Character' | 'Object'`), and `characterIds`/`objectIds` are **derived getters** that filter it by tag. So the membership/presence layer ("what nodes are on this host") is already thing-generic internally. The typed accessor/mutator *surface* (`addObject`/`addCharacter`, etc.) persists **above** that unified storage, and is load-bearing exactly where objects and characters genuinely differ: **Relational edges and play-only (Exit) edges are object-only.** A blunt collapse to a single `thingIds`/`addThing` surface would erase the type information those object-only operations depend on and just relocate the branching to every relational call site --- don't do it. Where a caller is genuinely kind-indifferent (a presence/catalog scan of "what's here to look at"), add an **additive** union getter over `_nodes` (name it graph-locally, e.g. `nodeIds`/`memberIds` --- **not** `thingIds`, since `EphemeraThingId` includes `Feature`, which is not a graph node; see [Known limitation (deferred)](#known-limitation-deferred)), rather than replacing the typed getters.

**Membership instructions already unify across object+character (BD-36, shipped); relations do not.** `KernelTransferMembershipStep.entityIds` is `ReadonlySet<EphemeraObjectId | EphemeraCharacterId>` and character navigate/connect/disconnect route through the same `commitStepSequence` as object take/drop --- one coherent membership-instruction structure spans both today, sitting *above* the still-split accessors. The open cross-cutting-unification work is therefore two distinct axes, not one: **(1)** relations across object+character (the character-relation widening below), and **(2)** getting Features onto the graph at all (below).

### Relational edges

- `relationalEdges` getter returns **`HostRelationalEdge[]`** (Exit-tolerant parse from raw `edges`)
- `addRelationalEdge`, `removeRelationalEdge`, `bothObjectsOnGraph`, `nodeHasRelationalEdge`
- Module helpers in `baseClasses.ts`: `edgesMatch`, `toStoredRelationalEdge`, `extractRelationalEdgesFromStored`, `nodeHasRelationalEdge`, `edgeReferencesObjectId`

Stored JSON remains **`EphemeraPositionRelationalEdgeData`** on `positionGraph.edges`.

### Kernel simulation (no Dynamo)

- `applyMembershipEffect(effect: HostEffect)` matching kernel `applyEffectToGraph`
- `applyRelationalPatch(patch: HostRelationalPatch)` mirroring kernel validate/apply semantics

Multi-host simulation (Phase C): caller holds **`EphemeraPositionGraph[]`** and upserts by `graph.hostId`.

## Import boundaries

| Consumer | Import | Rule |
| --- | --- | --- |
| `manipulation/kernel/applyStepSequenceCore.ts` (via `commitStepSequence`) | class + simulation methods | Sole writer |
| `manipulation/kernel/` `MultiKeyUpdate` reducer | `graphFromMeta` / `fromRoomMeta` / `fromCharacterMeta`, `toStored()` | Dynamo read/write boundary |
| `manipulation/relational/` | `fromPlayEnvelope`, `edgesMatch` | Coordinator observation |
| `evaluateRelationalLegality`, `compileRelationalFromSkeleton` | read-only class methods | Actions lane; no persist |
| `internalCache.Positions` | wrapper `get` / `set` | Ephemera read/write boundary; `fromPlayEnvelope` / `toPlayEnvelope` inside [`positionsCache.ts`](../../../internalCache/positionsCache.ts) |
| Gateways | via `fromPlayEnvelope` / `toPlayEnvelope` only | No duplicated projection |

Class does **not** own: adjacency rows, Dynamo transact, cache memo, stream facts, WML asset merge.

Production reads stay on `internalCache.Positions.get` per workspace gateways rule.

## Known limitation (deferred)

**Same-host incident edges only:** `removeObject` prunes play-only (Exit) edges on **the host graph where the removal runs** only --- Relational edges are a separate contract (below), not silently pruned. Membership adjacency indexes **node** placement (`getMembershipContainers`), not **edge-only** references on other hosts. A different host may still store an Exit edge mentioning an `OBJECT#` after removal if that host was not updated in the removal transaction (for example a stale room Exit edge after take-hold). **Deferred:** post-clear sweep of Coyote `gameRooms` graphs for edges referencing destroyed ids, or a reverse edge-reference index. See [`../../objects/AGENT.md`](../../objects/AGENT.md) **Coyote bulk clear**.

**Relational edges are assert-and-throw, not silently pruned (BD-33/BD-35):** `removeObject`/`removeCharacter` check that no Relational edge still references the node being removed, and throw `RelationalEdgeStillReferencedError` if one does. Callers are responsible for emitting an explicit `dissolveRelation`/`DissolveRelationStep` first --- via the Synthesize executor's `isolatedFromRelations`, or a hand-swept `boundaryEdgeOutcomes` call, depending on the caller's shape. There is deliberately **no** silent-strip variant to fall back on: a residual relational edge is a caller bug, and failing loudly is the point.

**Character-relation widening, deferred (BD-36):** `removeCharacter`'s assert-and-throw is **vacuously satisfied today** --- `HostRelationalEdge` (Relational edge) endpoints are `EphemeraObjectId`-typed only, so a character node can never be referenced by one. Widening `HostRelationalEdge`'s endpoints (and `computeCarryClosure`/`boundaryEdgeOutcomes`) to admit `EphemeraCharacterId` is the tracked extension point this assert anchors --- e.g. a "character `Under` a table" relation --- explicitly deferred until a KR-write path to author character relations exists (none does yet), per "expand as concrete cases demand." Not scheduled; a future consumer of this widening should start here, not re-derive the need for it. **Characters need only *widening*, not extension:** the node already sits in `_nodes` as a first-class tag-discriminated node, so a relational edge could reference a character id the moment the endpoint type widens --- this assert is the placeholder already installed for that day.

**No root concept --- and a rooted graph already exists next door (revisit trigger):** `EphemeraPositionGraph` is host-bound and unrooted; nothing on it distinguishes a "primary" node. But [`CarryClosureFragment`](expandValidate/interactionUnderTransfer.ts) --- what `computeCarryClosure` returns --- is exactly `{ rootId, members, edges }`, which is *a rooted position graph* in all but name. It exists as a separate shape only because this class has no root to lend it.

**If `positionGraph` ever gains a root concept, `CarryClosureFragment` should collapse into it rather than persist as parallel duplication.** This note is the load-bearing half of that trigger: the fragment's own definition carries the reciprocal note, but the person who needs to know is whoever adds a root *here*, and they will not be reading `interactionUnderTransfer.ts`. Deliberately pinned in both places.

One constraint travels with the shape: **`rootId` is recorded, never derived.** `computeCarryClosure` takes it from its `startId` argument, because the BFS guards with `closureSet.has(...)` and therefore absorbs a doubly-reachable object via whichever edge it happened to traverse first --- the traversal *tree* is order-dependent, while the induced edge set is not. Any future root concept must be an input, not something read back off the edges.

**Features are not graph nodes yet, and are deliberately more static than Objects (confirmed through conversation 2026-07-24):** the node `tag` union is `'Character' | 'Object'` only --- Features participate in *neither* membership nor relations today. Bringing them onto the graph is a **structural extension** (a new `'Feature'` tag), not the type *widening* characters need. And when it happens, a Feature node should participate in only a **subset** of the instruction structure: Features are never the **subject** of a relation and are never **membership-moved** --- they are deliberately static, more like the *walls* of a room than its contents (look-at-able, and possibly a relation *target*, but not `transferMembership`-able and not a relation subject). So do not assume a Feature node inherits Object-node capabilities; it is a narrower participant by design. (This is why `EphemeraThingId`'s inclusion of `Feature` at the catalog/Identify layer does **not** imply a graph-level `thingIds` --- the two universes differ precisely here.)

## Documentation

| Doc | Role |
| --- | --- |
| [`../manipulation/AGENT.implementation.md`](../manipulation/AGENT.implementation.md) | Kernel spec; links here as shared primitive |
| [`../AGENT.concepts.md`](../AGENT.concepts.md) | Graph roles, type boundary vocabulary |
| [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) | Gateway read surfaces |
