# EphemeraPositionGraph (play manipulation model)

Host-bound in-memory model for play manipulation `positionGraph` truth. Sole positions-lane primitive for membership node and relational edge simulation (EPG-5 legacy delete complete).

**Status:** P2 positions lane complete. Full authority text in **P4**. Task plan: [`AGENT.ephemeraPositionGraph.planning.md`](../../../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.ephemeraPositionGraph.planning.md).

## Data / class seam

| Type | Layer | Role |
| --- | --- | --- |
| **`EphemeraPositionGraphData`** | `@tonylb/mtw-interfaces` | Host-bound manipulation JSON (`hostId` + nodes + edges) |
| **`EphemeraPositionGraphFieldPayload`** | `@tonylb/mtw-interfaces` | Dynamo `Meta::*.positionGraph` attribute (`Omit<Data, 'hostId'>`) |
| **`PlayPositionGraph`** | `@tonylb/mtw-gateways` | Gateway read envelope (topology-only alias of `StandardPositionGraphData`) |
| **`StandardPositionGraph`** | `@tonylb/mtw-wml` | Authored blueprint (Exit-only; asset merge) |
| **`EphemeraPositionGraph`** | this module | Host-bound manipulation **class** |

Mental model: [`../AGENT.concepts.md`](../AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope).

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

| Consumer | Rule |
| --- | --- |
| Positions kernel / planners / transact reducers | Primary --- simulate on `EphemeraPositionGraph` / `EphemeraPositionGraph[]` (P2) |
| Actions legality / observation | Read-only import for graph observation (P3 dedup) |
| Gateways | Read projection only --- `fromPlayEnvelope` / `toPlayEnvelope` delegate to gateway `project.ts` (EPG-4) |
| Class does **not** own | Adjacency rows, Dynamo transact, cache memo, stream facts, WML asset merge |

Production reads stay on `internalCache.Positions.get` per workspace gateways rule.

## Documentation

| Doc | Role |
| --- | --- |
| [`../manipulation/AGENT.implementation.md`](../manipulation/AGENT.implementation.md) | Kernel spec; links here as shared primitive |
| [`../AGENT.concepts.md`](../AGENT.concepts.md) | Graph roles, type boundary vocabulary |
| [`../../../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.ephemeraPositionGraph.planning.md`](../../../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.ephemeraPositionGraph.planning.md) | Initiative ordering and verification |
| [`../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) | Gateway read surfaces |
