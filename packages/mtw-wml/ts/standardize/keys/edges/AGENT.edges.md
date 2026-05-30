# Edges (Area topology)

## Overview

Edges model **Area `positionGraph.edges`**: stable **`uuid`** identity with **two editable endpoint references** (`From` / `To`) and a **literal payload** (`Forward` / `Back`). This is **not** the room-local [`ExitFacetList`](../facets/exit.ts) pattern (one ref + string description).

## Contrast with facets

| | Facets | Edges (D27) |
| --- | --- | --- |
| **Identity key** | Target `StandardReference` | Stable `uuid` on `<Exit uuid=(...)>` |
| **Endpoint edits** | Cannot retarget facet reference on merge | `From` / `To` support **Replace** (Parent-style wire) |
| **List merge** | `sameKey` = reference | `sameKey` = `uuid` within one Area |
| **Factory** | `facetClassFactory` | `edgeClassFactory` in [`edgeFactory.ts`](./edgeFactory.ts) |

## v1 member: Exit edge

JSON shape (tagged union ready):

```typescript
{
  tag: 'Exit',
  uuid: string,
  from: StandardEditableData<StandardReferenceData>,
  to: StandardEditableData<StandardReferenceData>,
  payload: { forward?: StandardEditableData<string>, back?: StandardEditableData<string> }
}
```

WML (D29):

```xml
<Exit uuid=(highwayToTown)>
    <From>ROOM#highway</From>
    <To>ROOM#townCenter</To>
    <Forward>east</Forward>
    <Back>west</Back>
</Exit>
```

## Key modules

- [`dataTypes/exitEdge.ts`](./dataTypes/exitEdge.ts) -- serialization types
- [`endpointReference.ts`](./endpointReference.ts) -- editable `From` / `To` (`standardEditableFactory`, Parent-style)
- [`exitEdgePayload.ts`](./exitEdgePayload.ts) -- `Forward` / `Back` via `StandardLiteral`
- [`edgeFactory.ts`](./edgeFactory.ts) -- `StandardExitEdge` item class
- [`edgeListFactory.ts`](./edgeListFactory.ts) -- `ExitEdgeList`, uuid-keyed merge/diff
- [`exitEdge.ts`](./exitEdge.ts) -- concrete exports

## StandardArea consumer

[`StandardArea`](../../components/area.ts) ingests `<Exit>` after participant node refs. Asset-mode validation (**D29**):

- Reject `to=` attribute (legacy room shape)
- Require `uuid`, `<From>`, `<To>`
- Reject bare String body (legacy description)

See [`AGENT.areaTopologyExits.planning.md`](../../../../../taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md) for D4/D7 follow-on slices.

## Related docs

- [`../facets/AGENT.facets.md`](../facets/AGENT.facets.md) -- facet pattern (do not overload for edges)
- [`../../components/AGENT.implementation.md`](../../components/AGENT.implementation.md) -- **StandardArea**
