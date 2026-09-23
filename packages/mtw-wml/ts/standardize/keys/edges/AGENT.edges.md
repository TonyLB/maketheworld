# Edges (Area topology)

## Overview

Edges model **Area `ludicGraph.edges`**: stable **`uuid`** identity with **two editable endpoint references** (`From` / `To`) and a **literal payload** (`Forward` / `Back`). This is **not** the room-local [`ExitFacetList`](../facets/exit.ts) pattern (one ref + string description).

## Topology invariants

Steady-state names for Area topology design rules. Use these in docs, comments, and user-facing copy.

| Steady-state name | Meaning (summary) |
| --- | --- |
| **Bidirectional topology** | Every Area exit edge is traversable in both directions; `Forward` from the From room, `Back` from the To room. |
| **Edge list pattern** | `ludicGraph.edges` is a uuid-keyed list of `{ uuid, from?, to?, payload }` items parallel to facets but not using `facetClassFactory`. |
| **Area exit endpoint tags** | Area `<Exit>` uses `<From>` / `<To>` child tags (ComponentUUID or legalKey string bodies), not `from=` / `to=` attributes; rejects legacy `to=` under Area. |
| **Edge uuid identity** | Merge/diff/edit identity is the edge `uuid` within one Area, not the `(from, to)` pair. |
| **Participant endpoint rule** | When **both** endpoints are resolved, at least one must match a ref in `ludicGraph.nodes` for the edge to participate in topology semantics (portal: one inside, one outside is allowed). |
| **Incomplete edge** | An edge with missing and/or unset `From` and/or `To` (may still carry `uuid` and labels). Valid in asset storage; ignored by semantic projection until complete. |
| **Ludic graph shape** | `StandardArea.ludicGraph` is `{ nodes, edges }`; Exit is the first edge union member. |
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
| **Edit envelope** | `{ tag: 'Remove' \| 'Replace', ... }` | `<Remove><From>...</From></Remove>` etc. | **`references()`** / **`referencesFromExitEndpoint`**: Remove **match**, Replace **match + payload** (graph / subset / cache `assureComponents` coverage). **`reference()`** / **`referenceFromExitEndpoint`**: effective plain unwrap only (Plain; Replace **payload**; Remove -> `undefined`) for projection and UI. |

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
- **Participant endpoint rule (warnings / lint):** When **both** endpoints resolve, at least one must match a participant in **`ludicGraph.nodes`** (`sameKey`); portal edges (one inside, one outside) allowed. Use [`edgeSatisfiesParticipantRule`](../../components/areaTopologyValidation.ts) and [`findEdgesViolatingParticipantRule`](../../components/areaTopologyValidation.ts) for UI warnings or optional strict lint (`assertEdgeSatisfiesParticipantRule`). Incomplete edges do not violate this rule.

**`referencedKeys()`:** **`From`** / **`To`** endpoints emit **`referenceType: 'Edge'`** (subset cascade -> Room **`Stub`**). See [`standardForm.subset.test.ts`](../../integration/standardForm.subset.test.ts).

## Incomplete edges and projection

[`projectRoomExits`](../../projection/projectRoomExits.ts) is the **semantic filter boundary** for navigable room exits. It emits an `ExitFacet` only when:

1. The room matches a **resolved** `From` or `To` endpoint, **and**
2. The peer ref and label (`Forward` / `Back`) satisfy existing projection rules.

All other edges --- uuid-only stubs, one-sided edges, orphan edges (both endpoints resolved but neither in `ludicGraph.nodes`), missing labels, non-`ROOM#` peers --- produce **zero facets** with no throw. Storage and authoring may hold incomplete data until the author finishes the edge.

## Authoring vs runtime

| Layer | Room **`exits`** |
| --- | --- |
| **Asset blueprint** | **Never stored.** Room-local **`<Exit to=`** is forbidden on asset **`StandardForm`** (constructor throw + **`validate()`**). |
| **ephemeraWire wire** | **`StandardRoom.exits`** may carry legacy **`ExitFacetList`** on composed forms (affordance publish, nav). |
| **Runtime projection** | Live navigable exits are synthesized from merged **Area** **`ludicGraph.edges`**, not from per-asset room blueprint rows. Play **room membership** (who is in which room) is a separate manipulation-truth graph owned by [`mtw.ephemera.positions`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#graph-roles-shared-shape-different-authority). |

## Room wire projection

At ephemeraWire, room **`ExitFacetList`** is synthesized from merged Area edges via [`projectRoomExits`](../../projection/projectRoomExits.ts) (tests: [`projectRoomExits.test.ts`](../../projection/projectRoomExits.test.ts)). Gateways pull assembly: [`componentTopology`](../../../../../../packages/mtw-gateways/ts/assets/components/componentTopology/) via **`createComponentTopologyCacheHandler`** on Ephemera **`internalCache`** (see [`packages/mtw-gateways/AGENT.md`](../../../../../../packages/mtw-gateways/AGENT.md), [`lambda/ephemera/internalCache/AGENT.md`](../../../../../../lambda/ephemera/internalCache/AGENT.md)).

## The heterogeneous edge list (shipped)

**`StandardLudicGraph.edges` is `LudicEdgeList`** ([`ludicEdge.ts`](./ludicEdge.ts), data types in [`dataTypes/ludicEdge.ts`](./dataTypes/ludicEdge.ts)) --- a single list over three kind classes, aligned field-for-field to ephemera's relational edges. `kind` is the sole discriminant; **no `category` field restates it**:

| Class | Kinds | Meaning |
| --- | --- | --- |
| **Topology** | `Navigation`, `Bearing` | Relates **places** (Area scale): `from`/`to`, per-direction labels. `Navigation` is today's `<Exit>`; `Bearing` is a non-traversable spatial fact ("north of" without a door). |
| **Membership** | `In`, `On`, `PartOf` | Puts the subordinate node in the superior's own graph --- a cup `On` a tray is a node in the **tray's** `ludicGraph`, and the tray is a node in the room's. |
| **Peer** | `Under`, `Against`, `Custom` (+ `relationLabel` on `Custom`) | Leaves both endpoints in one graph and hosts nothing. |

**`Navigation` is the only kind with a WML surface tag and an author path.** `StandardLudicNavigationEdge` **wraps `StandardExitEdge` internally** and translates only the outer discriminant (`tag: 'Exit'` stored -> `kind: 'Navigation'`); it reuses `StandardExitEdge`'s Replace/Remove-editable endpoints, `uuid` identity, and `<Exit>` schema parsing verbatim --- nothing about v1's Exit behavior below changed. `ExitEdgeList`/`StandardExitEdge` are **untouched and unwidened**; `LudicEdgeList` is a sibling type, not a modification of them.

**Bearing and every Membership/Peer kind are typed and unit-exercised (round-trip tested) but have no WML surface tag or author path yet** --- per the lift rule (take the type contract now, defer the behavior; see [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md#6-lifting-a-shape-into-wml)). Their endpoints are plain `StandardLudicTerminalData` (a bare component reference, a port-qualified `{owner, port}` address, or a bare `{presence}` self-reference --- mirroring `EphemeraLudicTerminalId`), not the Exit-specific editable wrapper, since there is no schema tag driving Replace/Remove edits on them yet.

**Identity (LG-10): the authored `uuid` on `Navigation` *is* the `edgeId`.** Not two schemes --- one slot that was never filled. `edgeId` is an optional stable label a relation may carry, endpoint-independent, consulted by nothing that mints one automatically; `Navigation`'s `uuid` fills that same slot (merge/diff/edit identity within one Area, surviving endpoint `Replace`). Other kinds carry `edgeId`/`chainId` as optional base fields with structural (`kind` + endpoints + label) `sameKey`, since nothing mints an author identity for them yet. `chainId` stays orthogonal to `edgeId`: one route realizing a relationship, consulted by `edgesMatch` ahead of structure --- the legs of a relation crossing a port boundary share a `chainId`, and `edgeId`/`chainId` sit on the shared edge base (not scoped to any one kind), so a portal decomposed into two `Navigation` legs sharing a `chainId` is exactly as valid as it is for a Membership/Peer edge, though nothing mints one today.

## Future edge members

**Ludic graph shape / Edge list pattern:** `ludicGraph.edges` is a **tagged union** over the three classes above. A fourth kind adds a new `kind` value, payload shape, and typeguard branch inside `dataTypes/ludicEdge.ts` / `ludicEdge.ts` --- same list-merge habit within one Area for any kind that gets a `uuid`-identified WML surface tag.

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

### List typing note (resolved --- see above)

**Shipped.** [`StandardLudicGraph`](../../components/ludicGraph.ts) holds the heterogeneous `LudicEdgeList` described in [The heterogeneous edge list (shipped)](#the-heterogeneous-edge-list-shipped) above, not `ExitEdgeList` alone. The identity-scheme question this note used to leave open (does a heterogeneous list assume `uuid` covers both authoring identity and play identity) is answered there too: the authored `uuid` on `Navigation` **is** the `edgeId`, one slot rather than two schemes.

Play-time **Relational** edges ([`EphemeraLudicRelationalEdgeData`](../../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)) are the source this WML shape aligns to. Their kind vocabulary (`HostRelationalEdgeKind`) partitions in **two** classes, not three (spec: [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#wholes-parts-and-ports), AB-54; `Present` was retired from this enum at presenceNodes Slice 3, PN-14 --- presence moved to its own node type, not an edge kind):

| Class | Kinds | Meaning |
| --- | --- | --- |
| **Hosting** | `On`, `In`, `PartOf` | Puts the subordinate node in the superior's own graph --- a cup `On` a tray is a node in the **tray's** `ludicGraph`, and the tray is a node in the room's |
| **Peer** | `Under`, `Against`, `Custom` | Leaves both endpoints in one graph and hosts nothing |

WML's own `LudicEdgeList` above adds a **third** class, **Topology** (`Navigation`/`Bearing`), that `HostRelationalEdgeKind` does not have --- Area-scale place relations have no play-time relational-edge analogue; they're the layer `<Exit>` already modelled before this alignment.

**`On` is not an authorable relation, and host graphs are not only rooms.** Because `On` is a hosting kind, it is reached as a **containment argument on a rehost operation** rather than by establishing an edge --- there is no operation that "establishes `On`". Hosting also makes **objects** hosts with their own `ludicGraph`, so any future member covering these kinds must not assume a room-scoped graph or an author-declared `On` edge.

**Cross-linked here 2026-09-11, both directions, after a design-doc contradiction reached the opposite conclusion from this paragraph with confidence.** The invariant that decides what a "port" is allowed to do on the play-time (`positions/`) side: the legs of one crossing share an `edgeId`, so they cannot carry different `kind`s or labels. See [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#wholes-parts-and-ports) for the corrected illustration and [`taskPlanning/.../AGENT.abstractionLayers.planning.md`](../../../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md#getting-started) for the design plan that owns port/crossing vocabulary --- its `Getting Started` now reads this paragraph before either.

## Related docs

- [`../facets/AGENT.facets.md`](../facets/AGENT.facets.md) -- facet pattern (do not overload for edges)
- [`../../components/AGENT.implementation.md`](../../components/AGENT.implementation.md) -- **StandardArea**
- [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#wholes-parts-and-ports) -- play-time ports, crossings and the `edgeId`/`chainId` split's consequence for them
- [`taskPlanning/.../AGENT.abstractionLayers.planning.md`](../../../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md) -- the design plan that owns port/crossing vocabulary on the play-time side
