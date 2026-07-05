# EphemeraPositionGraph (play manipulation model)

Host-bound in-memory model for play manipulation `positionGraph` truth. Consolidates primitives currently in [`membership/positionGraphMerge.ts`](../membership/positionGraphMerge.ts) and [`manipulation/relational/relationalEdges.ts`](../manipulation/relational/relationalEdges.ts) (legacy modules deleted in P2).

**Status:** P0 stub (implementation map only). Class + unit tests land in **P1**; full authority text in **P4**. Task plan: [`AGENT.ephemeraPositionGraph.planning.md`](../../../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.ephemeraPositionGraph.planning.md).

## Data / class seam

| Type | Layer | Role |
| --- | --- | --- |
| **`EphemeraPositionGraphData`** | `@tonylb/mtw-interfaces` | Host-bound manipulation JSON (`hostId` + nodes + edges) |
| **`EphemeraPositionGraphFieldPayload`** | `@tonylb/mtw-interfaces` | Dynamo `Meta::*.positionGraph` attribute (`Omit<Data, 'hostId'>`) |
| **`PlayPositionGraph`** | `@tonylb/mtw-gateways` | Gateway read envelope (topology-only alias of `StandardPositionGraphData`) |
| **`StandardPositionGraph`** | `@tonylb/mtw-wml` | Authored blueprint (Exit-only; asset merge) |
| **`EphemeraPositionGraph`** | this module (P1) | Host-bound manipulation **class** |

Mental model: [`../AGENT.concepts.md`](../AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope).

## Planned module map (P1)

| File | Role |
| --- | --- |
| `EphemeraPositionGraph.ts` | Class (immutable instance methods) |
| `types.ts` | **`HostRelationalEdge`** parsed in-memory view (EPG-3) |
| `index.ts` | Public exports |
| `EphemeraPositionGraph.test.ts` | Unit tests (port from `positionGraphMerge.test.ts` + relational cases) |

## Planned public API (sketch)

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

Host alignment: `applyHostEffect` / `applyRelationalPatch` assert `effect.hostId` / `patch.hostId === this.hostId`.

### Membership nodes

- Getters: `characterIds`, `objectIds`
- Mutators (immutable, return new instance): `addCharacter`, `removeCharacter`, `addObject`, `removeObject` (idempotent add)

### Relational edges

- `relationalEdges` getter returns **`HostRelationalEdge[]`** (Exit-tolerant parse from raw `edges`)
- `addRelationalEdge`, `removeRelationalEdge`, `edgesMatch`, `bothObjectsOnGraph`, `nodeHasRelationalEdge`

Stored JSON remains **`EphemeraPositionRelationalEdgeData`** on `positionGraph.edges`.

### Kernel simulation (no Dynamo)

- `applyMembershipEffect(effect: HostEffect)` or narrow helpers matching kernel `applyEffectToGraph`
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
| [`../manipulation/AGENT.implementation.md`](../manipulation/AGENT.implementation.md) | Kernel spec; will link here as shared primitive (P4) |
| [`../AGENT.concepts.md`](../AGENT.concepts.md) | Graph roles, type boundary vocabulary |
| [`../../../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.ephemeraPositionGraph.planning.md`](../../../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.ephemeraPositionGraph.planning.md) | Initiative ordering and verification |
| [`../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) | Gateway read surfaces |
