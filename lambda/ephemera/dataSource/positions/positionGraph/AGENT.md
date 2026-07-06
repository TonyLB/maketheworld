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
- Mutators (immutable, return new instance): `addCharacter`, `removeCharacter`, `addObject`, `removeObject` (idempotent add returns `this`)

### Relational edges

- `relationalEdges` getter returns **`HostRelationalEdge[]`** (Exit-tolerant parse from raw `edges`)
- `addRelationalEdge`, `removeRelationalEdge`, `bothObjectsOnGraph`, `nodeHasRelationalEdge`
- Module helpers in `baseClasses.ts`: `edgesMatch`, `toStoredRelationalEdge`, `extractRelationalEdgesFromStored`, `nodeHasRelationalEdge`

Stored JSON remains **`EphemeraPositionRelationalEdgeData`** on `positionGraph.edges`.

### Kernel simulation (no Dynamo)

- `applyMembershipEffect(effect: HostEffect)` matching kernel `applyEffectToGraph`
- `applyRelationalPatch(patch: HostRelationalPatch)` mirroring kernel validate/apply semantics

Multi-host simulation (Phase C): caller holds **`EphemeraPositionGraph[]`** and upserts by `graph.hostId`.

## Import boundaries

| Consumer | Import | Rule |
| --- | --- | --- |
| `applyHostEffects`, `applyHostRelationalPatch` | class + simulation methods | Primary writers |
| Transact reducers (`*TransactItems.ts`) | `fromRoomMeta` / `fromCharacterMeta`, `toStored()` | Dynamo read/write boundary |
| `planHostRelationalPatch` | `fromPlayEnvelope`, `edgesMatch` | Planner observation |
| `evaluateRelationalLegality`, `compileRelational` | read-only class methods | Actions lane; no persist |
| `internalCache.Positions` | wrapper `get` / `set` | Ephemera read/write boundary; `fromPlayEnvelope` / `toPlayEnvelope` inside [`positionsCache.ts`](../../../../internalCache/positionsCache.ts) |
| Gateways | via `fromPlayEnvelope` / `toPlayEnvelope` only | EPG-4 --- no duplicated projection |

Class does **not** own: adjacency rows, Dynamo transact, cache memo, stream facts, WML asset merge.

Production reads stay on `internalCache.Positions.get` per workspace gateways rule.

## Documentation

| Doc | Role |
| --- | --- |
| [`../manipulation/AGENT.implementation.md`](../manipulation/AGENT.implementation.md) | Kernel spec; links here as shared primitive |
| [`../AGENT.concepts.md`](../AGENT.concepts.md) | Graph roles, type boundary vocabulary |
| [`../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) | Gateway read surfaces |
