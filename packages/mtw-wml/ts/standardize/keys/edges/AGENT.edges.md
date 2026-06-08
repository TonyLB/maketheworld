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

[`StandardArea`](../../components/area.ts) ingests `<Exit>` after participant node refs. Asset-mode validation:

- **D29:** Reject `to=` attribute (legacy room shape); require `uuid`, `<From>`, `<To>`; reject bare String body (legacy description)
- **D4:** At least one of **`From`** / **`To`** must match a participant in **`positionGraph.nodes`** (`sameKey`); portal edges (one inside, one outside) allowed. Enforced on **`fromSchema`**, **`merge`**, and **`fromJSON`** when local nodes are present.

**`referencedKeys()`:** **`From`** / **`To`** endpoints emit **`referenceType: 'Edge'`** (subset cascade -> Room **`Stub`**). See [`standardForm.subset.test.ts`](../../integration/standardForm.subset.test.ts).

## Authoring vs runtime

| Layer | Room **`exits`** |
| --- | --- |
| **Asset blueprint** | **Never stored.** Room-local **`<Exit to=`** is forbidden on asset **`StandardForm`** (constructor throw + **`validate()`**). |
| **ephemeraWire wire** | **`StandardRoom.exits`** may carry legacy **`ExitFacetList`** on composed forms (affordance publish, nav). |
| **Runtime projection** | Live navigable exits are synthesized from merged **Area** **`positionGraph.edges`**, not from per-asset room blueprint rows. |

## Runtime projection (D16)

At ephemeraWire, room **`ExitFacetList`** is synthesized from merged Area edges via [`projectRoomExits`](../../projection/projectRoomExits.ts) (tests: [`projectRoomExits.test.ts`](../../projection/projectRoomExits.test.ts)). Gateways pull assembly: [`componentTopology`](../../../../../../packages/mtw-gateways/ts/assets/components/componentTopology/) via **`createComponentTopologyCacheHandler`** on Ephemera **`internalCache`** (see [`packages/mtw-gateways/AGENT.md`](../../../../../../packages/mtw-gateways/AGENT.md), [`lambda/ephemera/internalCache/AGENT.md`](../../../../../../lambda/ephemera/internalCache/AGENT.md)).

## Future edge members

**D3 / D27:** `positionGraph.edges` is a **tagged union**; **Exit** is the first member only. Additional edge kinds add a new `tag`, payload module, and item class via [`edgeClassFactory`](./edgeFactory.ts) / [`edgeListClassFactory`](./edgeListFactory.ts) --- same list merge-by-`uuid` habit within one Area.

### Endpoint wrapper (planned abstraction)

v1 implements Parent-style endpoint slots in [`endpointReference.ts`](./endpointReference.ts) as **Exit-specific** names (`createExitEndpointClasses`, inner class `StandardExitEndpoint`, exports `StandardExitFromEndpoint` / `StandardExitToEndpoint`). That wrapper is **not** a second reference type: the plain value inside is still `StandardReferenceData`; `reference()` / `referenceFromExitEndpoint()` unwrap to `StandardReference` for graph/subset/inverse use.

**When adding edge type #2:** if the new member also uses **D29-style** editable endpoint refs (`<From>` / `<To>` string bodies with Replace/merge rules), extract the shared wrapper before duplicating:

| Layer | v1 (Exit-only names) | Target (shared) |
| --- | --- | --- |
| Factory | `createExitEndpointClasses(tagName)` | `createEdgeEndpointClasses(tagName)` (or equivalent) |
| Class | `StandardExitEndpoint` | **`StandardEdgeEndpoint`** --- shared editable Parent-style wrapper around `StandardReferenceData` |
| Exit exports | `StandardExitFromEndpoint`, `StandardExitToEndpoint` | Thin aliases or typed exports of `StandardEdgeEndpoint` for `From` / `To` |
| Helper | `referenceFromExitEndpoint` | **`referenceFromEdgeEndpoint`** (Exit may re-export for backward compatibility) |

No subclass hierarchy is required if the factory + shared class suffice; **`StandardExitEndpoint` may remain a type alias** for `StandardEdgeEndpoint` rather than a distinct subclass, unless Exit-specific validation or schema behavior diverges.

**When endpoint wire differs** (non-`From`/`To` tags, non-reference payload, different merge rules): do **not** force-fit `StandardEdgeEndpoint`; only reuse **edge list / uuid-keyed item** infrastructure.

### List typing note

v1 [`StandardPositionGraph`](../../components/positionGraph.ts) holds **`ExitEdgeList`** only. A second union member implies a heterogeneous **`EdgeList`** (discriminated by item `tag`) or a parallel list type --- detail deferred until the second shape is designed; do not overload [`ExitEdgeList`](./exitEdge.ts) with mixed tags.

## Related docs

- [`../facets/AGENT.facets.md`](../facets/AGENT.facets.md) -- facet pattern (do not overload for edges)
- [`../../components/AGENT.implementation.md`](../../components/AGENT.implementation.md) -- **StandardArea**
