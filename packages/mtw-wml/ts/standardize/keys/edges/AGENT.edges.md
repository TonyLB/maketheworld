# Edges (Area topology)

## Overview

Edges model **Area `positionGraph.edges`**: stable **`uuid`** identity with **two editable endpoint references** (`From` / `To`) and a **literal payload** (`Forward` / `Back`). This is **not** the room-local [`ExitFacetList`](../facets/exit.ts) pattern (one ref + string description).

## Topology invariants

Steady-state names for Area topology design rules. Use these in docs, comments, and user-facing copy.

| Steady-state name | Meaning (summary) |
| --- | --- |
| **Bidirectional topology** | Every Area exit edge is traversable in both directions; `Forward` from the From room, `Back` from the To room. |
| **Edge list pattern** | `positionGraph.edges` is a uuid-keyed list of `{ uuid, from?, to?, payload }` items parallel to facets but not using `facetClassFactory`. |
| **Area exit endpoint tags** | Area `<Exit>` uses `<From>` / `<To>` child tags (ComponentUUID or legalKey string bodies), not `from=` / `to=` attributes; rejects legacy `to=` under Area. |
| **Edge uuid identity** | Merge/diff/edit identity is the edge `uuid` within one Area, not the `(from, to)` pair. |
| **Participant endpoint rule** | When **both** endpoints are resolved, at least one must match a ref in `positionGraph.nodes` for the edge to participate in topology semantics (portal: one inside, one outside is allowed). |
| **Incomplete edge** | An edge with missing and/or unset `From` and/or `To` (may still carry `uuid` and labels). Valid in asset storage; ignored by semantic projection until complete. |
| **Position graph shape** | `StandardArea.positionGraph` is `{ nodes, edges }`; Exit is the first edge union member. |
| **Room wire projection** | Runtime `StandardRoom.exits` is synthesized from Area edges, not stored on the room blueprint row. |

## Contrast with facets

| | Facets | Edge list pattern |
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
  from?: StandardEditableData<StandardReferenceData>,
  to?: StandardEditableData<StandardReferenceData>,
  payload: { forward?: StandardEditableData<string>, back?: StandardEditableData<string> }
}
```

WML (area exit endpoint tags):

```xml
<Exit uuid=(highwayToTown)>
    <From>highway</From>
    <To>townCenter</To>
    <Forward>east</Forward>
    <Back>west</Back>
</Exit>
```

In-asset authoring typically uses **legalKey** bodies (`highway`); emit prefers legal key when the reference has one, otherwise `ROOM#...`. Parse accepts either form.

### Endpoint field states

| State | JSON | WML | `reference()` |
| --- | --- | --- | --- |
| **Absent / unset** | `from` / `to` property omitted | `<From>` / `<To>` tag omitted | `undefined` |
| **Empty tag** | (not stored) | `<From />` or `<To />` with no String body | Normalized to **absent** on Standardize parse |
| **Plain value** | `StandardReferenceData` (legalKey object or universal string) | `<From>highway</From>` in-asset; `ROOM#highway` when key unknown | `StandardReference` |
| **Edit envelope** | `{ tag: 'Remove' \| 'Replace', ... }` | `<Remove><From>...</From></Remove>` etc. | Per existing Replace rules |

Incomplete edges (uuid-only or one-sided) omit unset endpoint tags on emit.

```xml
<Exit uuid=(edge-a1b2c3d4) />
```

```xml
<Exit uuid=(highwayToTown)>
    <From>highway</From>
    <Forward>east</Forward>
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

[`StandardArea`](../../components/area.ts) ingests `<Exit>` after participant node refs. Asset-mode structural validation:

- **Area exit endpoint tags:** Reject `to=` attribute (legacy room shape); require `uuid`; `<From>` / `<To>` optional when incomplete; reject bare String body (legacy description)
- **Storage:** Incomplete edges and fully resolved edges that violate the **participant endpoint rule** are **valid** in `StandardArea` ingest, merge, and JSON --- they are not standardize hard errors.
- **Participant endpoint rule (warnings / lint):** When **both** endpoints resolve, at least one must match a participant in **`positionGraph.nodes`** (`sameKey`); portal edges (one inside, one outside) allowed. Use [`edgeSatisfiesParticipantRule`](../../components/areaTopologyValidation.ts) and [`findEdgesViolatingParticipantRule`](../../components/areaTopologyValidation.ts) for UI warnings or optional strict lint (`assertEdgeSatisfiesParticipantRule`). Incomplete edges do not violate this rule.

**`referencedKeys()`:** **`From`** / **`To`** endpoints emit **`referenceType: 'Edge'`** (subset cascade -> Room **`Stub`**). See [`standardForm.subset.test.ts`](../../integration/standardForm.subset.test.ts).

## Incomplete edges and projection

[`projectRoomExits`](../../projection/projectRoomExits.ts) is the **semantic filter boundary** for navigable room exits. It emits an `ExitFacet` only when:

1. The room matches a **resolved** `From` or `To` endpoint, **and**
2. The peer ref and label (`Forward` / `Back`) satisfy existing projection rules.

All other edges --- uuid-only stubs, one-sided edges, orphan edges (both endpoints resolved but neither in `positionGraph.nodes`), missing labels, non-`ROOM#` peers --- produce **zero facets** with no throw. Storage and authoring may hold incomplete data until the author finishes the edge.

## Authoring vs runtime

| Layer | Room **`exits`** |
| --- | --- |
| **Asset blueprint** | **Never stored.** Room-local **`<Exit to=`** is forbidden on asset **`StandardForm`** (constructor throw + **`validate()`**). |
| **ephemeraWire wire** | **`StandardRoom.exits`** may carry legacy **`ExitFacetList`** on composed forms (affordance publish, nav). |
| **Runtime projection** | Live navigable exits are synthesized from merged **Area** **`positionGraph.edges`**, not from per-asset room blueprint rows. |

## Room wire projection

At ephemeraWire, room **`ExitFacetList`** is synthesized from merged Area edges via [`projectRoomExits`](../../projection/projectRoomExits.ts) (tests: [`projectRoomExits.test.ts`](../../projection/projectRoomExits.test.ts)). Gateways pull assembly: [`componentTopology`](../../../../../../packages/mtw-gateways/ts/assets/components/componentTopology/) via **`createComponentTopologyCacheHandler`** on Ephemera **`internalCache`** (see [`packages/mtw-gateways/AGENT.md`](../../../../../../packages/mtw-gateways/AGENT.md), [`lambda/ephemera/internalCache/AGENT.md`](../../../../../../lambda/ephemera/internalCache/AGENT.md)).

## Future edge members

**Position graph shape / Edge list pattern:** `positionGraph.edges` is a **tagged union**; **Exit** is the first member only. Additional edge kinds add a new `tag`, payload module, and item class via [`edgeClassFactory`](./edgeFactory.ts) / [`edgeListClassFactory`](./edgeListFactory.ts) --- same list merge-by-`uuid` habit within one Area.

### Endpoint wrapper (planned abstraction)

v1 implements Parent-style endpoint slots in [`endpointReference.ts`](./endpointReference.ts) as **Exit-specific** names (`createExitEndpointClasses`, inner class `StandardExitEndpoint`, exports `StandardExitFromEndpoint` / `StandardExitToEndpoint`). That wrapper is **not** a second reference type: the plain value inside is still `StandardReferenceData`; `reference()` / `referenceFromExitEndpoint()` unwrap to `StandardReference` for graph/subset/inverse use.

**When adding edge type #2:** if the new member also uses **area exit endpoint tags** (editable `<From>` / `<To>` string bodies with Replace/merge rules), extract the shared wrapper before duplicating:

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
