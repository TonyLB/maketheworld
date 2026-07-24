# EphemeraPositionGraph (play manipulation model)

Host-bound in-memory model for play manipulation `positionGraph` truth. Sole positions-lane primitive for membership node and relational edge simulation (EPG-5 legacy delete complete).

**Status:** P4 authority documentation complete. Initiative shipped; task plan retired (git history).

## Data / class seam

Type vocabulary (five-type contrast): [`../AGENT.concepts.md`](../AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope).

**This module** owns the host-bound manipulation **class** --- `EphemeraPositionGraph` --- with immutable simulation API. Canonical JSON lives in `@tonylb/mtw-interfaces`; gateway read envelope in `@tonylb/mtw-gateways`; authored blueprint in `@tonylb/mtw-wml`.

### Relational edge names (EPG-3)

| Name | Layer | Role |
| --- | --- | --- |
| **`EphemeraPositionRelationalEdgeData`** | `mtw-interfaces` JSON | Stored/wire envelope (`tag: 'Relational'`, ...) on `positionGraph.edges` |
| **`HostRelationalEdge`** | `baseClasses.ts` | Parsed in-memory view (`from`, `to`, `kind`, optional `relationLabel`) --- class API, legality, kernel simulation |
| **`HostRelationalEdgeKind`** | `mtw-interfaces` | Enum of allowed kinds |

## Module map

| File | Role |
| --- | --- |
| `index.ts` | **`EphemeraPositionGraph` class** (immutable instance methods) + module-level factories (`fromRoomMeta`, `fromCharacterMeta`, `seedFromActiveCharacters`) + node builders |
| `baseClasses.ts` | **`HostRelationalEdge`** parsed in-memory view (EPG-3); relational parse/match/serialize helpers |
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

Factory helpers on module boundary (EPG-6, not class methods): `fromRoomMeta`, `fromCharacterMeta`, `seedFromActiveCharacters`.

Host alignment: `applyMembershipEffect` / `applyRelationalPatch` assert `effect.hostId` / `patch.hostId === this.hostId`.

### Membership nodes

- Getters: `characterIds`, `objectIds` (`Set`)
- Mutators (immutable, return new instance): `addCharacter`, `removeCharacter`, `addObject`, `removeObject` (idempotent add returns `this`; **`removeObject`** also prunes incident **Relational** and **Exit** edges on the same host that reference the removed `OBJECT#`, including edge-only references when the node is already absent)

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
| `manipulation/kernel/applyStepSequenceCore.ts` (via `commitStepSequence`) | class + simulation methods | Primary writer (`applyHostEffects`/`applyHostRelationalPatch` retired 2026-07-23) |
| Transact reducers (`*TransactItems.ts`) | `fromRoomMeta` / `fromCharacterMeta`, `toStored()` | Dynamo read/write boundary |
| `planHostRelationalPatch` | `fromPlayEnvelope`, `edgesMatch` | Planner observation |
| `evaluateRelationalLegality`, `compileRelationalFromSkeleton` | read-only class methods | Actions lane; no persist |
| `internalCache.Positions` | wrapper `get` / `set` | Ephemera read/write boundary; `fromPlayEnvelope` / `toPlayEnvelope` inside [`positionsCache.ts`](../../../../internalCache/positionsCache.ts) |
| Gateways | via `fromPlayEnvelope` / `toPlayEnvelope` only | EPG-4 --- no duplicated projection |

Class does **not** own: adjacency rows, Dynamo transact, cache memo, stream facts, WML asset merge.

Production reads stay on `internalCache.Positions.get` per workspace gateways rule.

## Known limitation (deferred)

**Same-host incident edges only:** `removeObject` prunes play-only (Exit) edges on **the host graph where the removal runs** only --- Relational edges are a separate contract (below), not silently pruned. Membership adjacency indexes **node** placement (`getMembershipContainers`), not **edge-only** references on other hosts. A different host may still store an Exit edge mentioning an `OBJECT#` after removal if that host was not updated in the removal transaction (for example a stale room Exit edge after take-hold). **Deferred:** post-clear sweep of Coyote `gameRooms` graphs for edges referencing destroyed ids, or a reverse edge-reference index. See [`../../objects/AGENT.md`](../../objects/AGENT.md) **Coyote bulk clear**.

**Relational edges are assert-and-throw, not silently pruned (BD-33/BD-35, shipped 2026-07-23):** `removeObject`/`removeCharacter` check no Relational edge still references the node being removed and throw `RelationalEdgeStillReferencedError` if one does --- callers are responsible for emitting an explicit `dissolveRelation`/`DissolveRelationStep` first (via the Synthesize executor's `isolatedFromRelations` or a hand-swept `boundaryEdgeOutcomes` call, per the caller's shape). The plain pre-assert-and-throw silent-strip methods this superseded (originally also named `removeObject`/`applyMembershipEffect`) were deleted (2026-07-23, once `applyHostEffects` --- their last caller --- retired); `removeObjectAsserted`/`removeCharacterAsserted` then took back the plain `removeObject`/`removeCharacter` names the same day, being the only implementations left.

**Character-relation widening, deferred (BD-36):** `removeCharacter`'s assert-and-throw is **vacuously satisfied today** --- `HostRelationalEdge` (Relational edge) endpoints are `EphemeraObjectId`-typed only, so a character node can never be referenced by one. Widening `HostRelationalEdge`'s endpoints (and `computeCarryClosure`/`boundaryEdgeOutcomes`) to admit `EphemeraCharacterId` is the tracked extension point this assert anchors --- e.g. a "character `Under` a table" relation --- explicitly deferred until a KR-write path to author character relations exists (none does yet), per "expand as concrete cases demand." Not scheduled; a future consumer of this widening should start here, not re-derive the need for it.

## Documentation

| Doc | Role |
| --- | --- |
| [`../manipulation/AGENT.implementation.md`](../manipulation/AGENT.implementation.md) | Kernel spec; links here as shared primitive |
| [`../AGENT.concepts.md`](../AGENT.concepts.md) | Graph roles, type boundary vocabulary |
| [`../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) | Gateway read surfaces |
