*Status: **Shipped** --- bus-only **`mtw.ephemera.objects`**; room-only **`Meta::Room.objects`**; **`mtw.ephemera.perception`** subscribes to **`Objects Changed`** and emits affordance **`PerceptionMessage`** per multi-channel norms ([`publishRoomAffordancePerceptionMessages.ts`](../perception/publishRoomAffordancePerceptionMessages.ts)).*

## Overview

This package owns **runtime object lists** for rooms: stored on ephemera **`Meta::Room`** as **`objects?: EphemeraMetaRoomObject[]`** (optional; missing treated as empty when patching). Each row is **`uuid`** + **`shortName`** + **`stableKey`** (Coyote machine-correlation slug; distinct from human-facing **`shortName`**; uniqueness for Acme-created keys is Coyote-wide --- see [`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md) and **`mtw.ephemera.actions`**), with optional trope fields **`tropeAffinities`** / **`tropeAffinitiesFailed`** from Acme enrich (see [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), trope shapes in [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)). It uses a dedicated **`dataSourceKey`** (**`mtw.ephemera.objects`**) in **symmetry** with **`mtw.ephemera.state`**: a **semantic domain** for object membership, **not** named as a sub-feature of a room aggregate, even though v1 stores the field on **`Meta::Room`**. Long term, object lists may attach to **other** ephemera kinds; v1 does **not** encode "objects are only a room concern" in the **`dataSourceKey`**.

**Co-location on `Meta::Room`** is an **implementation** choice (atomicity, read efficiency, cache keying); domain boundaries and invalidation are documented here and in [`AGENT.multiChannel.contract.md`](../AGENT.multiChannel.contract.md).

## Bus events

| Header `type` | Where | Role |
| --- | --- | --- |
| **`Objects Change`** | **`api.ephemera`** ingress (internal) | Imperative command; parallels **`State Change`**. Payload: **`componentId`** (room, v1) and **`{ add, remove }`**. |
| **`Objects Changed`** | **`mtw.ephemera.objects`** outbound | After successful persist; parallels **`State Changed`**. Typed payload: **`priorObjects`** / **`newObjects`** ([`events.ts`](events.ts)). |

Future headers on this DataSource (if any) stay **object-domain** specific; **presence / characters** remain outside unless product merges those semantics.

## Ingress and API

**Ingress:** Internal **`api.ephemera`** header **`Objects Change`** --- **`sendObjectsChange`** in [`../apiEphemera.ts`](../apiEphemera.ts). Payload **`ObjectsChangeCommand`** in [`../localApiEvents.ts`](../localApiEvents.ts): **`add`** is **`EphemeraMetaRoomObject[]`**, **`remove`** is **`OBJECT#...` ids**.

**Correlation:** **No** **`requestId`** / **`ReturnValue`** on ingress (internal-only; unlike **`State Change`**). **Authorization:** none for v1; only **internal** callers.

**Merge semantics:** **Remove** --- drop every stored row whose **`uuid`** is in **`remove`**. **Add** --- for each entry in order, strip existing rows with the same **`uuid`**, then append (upsert + move-to-end; last duplicate **`uuid`** in **`add`** wins). **No** max list length in v1.

**Persist:** [`mergePersistMetaRoomObjects.ts`](mergePersistMetaRoomObjects.ts) --- **`mergeMetaRoomObjects`**, **`ephemeraDB.optimisticUpdate`** with **`updateKeys: ['objects']`**, then **`internalCache.ComponentEphemeraMeta.invalidate(roomId)`**. Non-room **`componentId`**: reject / no-op (room-only v1).

**Handler + outbound:** [`handleApiObjectsChange.ts`](handleApiObjectsChange.ts). On success, **`streamEvent`** on **`mtw.ephemera.objects`** with **`Objects Changed`**.

**Coyote Acme orders (enriched catalog lines):** When **`mtw.ephemera.actions`** publishes **`Acme Order`** ([`../actions/publishedEvents.ts`](../actions/publishedEvents.ts)), [`handleAcmeOrderAddObjects`](handleApiObjectsChange.ts) merges **`orders`** into the character's current room **`Meta::Room.objects`**, passing through **`stableKey`** (Coyote correlation key after deterministic finalize upstream), **`shortName`**, and trope fields **`tropeAffinities`** / **`tropeAffinitiesFailed`** per published line (same semantic fields as **`EphemeraMetaRoomObject`** other than **`uuid`**, assigned at merge time). General **`Objects Change`** **`add`** remains **`EphemeraMetaRoomObject[]`**; each entry must include a non-empty **`stableKey`**; callers may omit optional trope fields.

**Registration:** [`index.ts`](index.ts) --- **`EphemeraDataSource`**, **`publisherStrategy: 'busOnly'`**, **`replayable: false`** (no EventBridge-visible replay contract for this DataSource in v1; same posture as **`mtw.ephemera.state`**).

## Ordering vs `mtw.ephemera.state`

**Intent:** **`objects`** runs **before** **`state`** in shared **`Meta::Room`** workflows so rules can treat object changes as **inputs** to derived state (e.g. an object toggles illumination and marks follow), not the reverse.

1. **`app.ts`:** side-effect import **`./dataSource/objects`** **above** **`./dataSource/state`** so **`subscribe()`** registration is objects first, state second.
2. **Callers** that emit both for one room in one interaction should send **`Objects Change`** before **`State Change`** when both land in the same lambda invocation.

This does **not** couple the two DataSources automatically; it is **ordering policy** for predictable composition.

## Player-visible delivery (affordances)

**`mtw.ephemera.perception`** subscribes to **`Objects Changed`** and calls **`publishRoomAffordancePerceptionMessages`** --- **one** **`PublishMessage` per character**, **`ComponentStackMerge.get(characterId, roomId)`**, **`metaData.roomChannel: 'affordances'`** ([`../perception/AGENT.md`](../perception/AGENT.md) **Server publish sites (multi-channel)**; contract **Phase B server migration**).

## Ephemera wire WML (producers)

**Not** asset / blueprint authoring: **`mtw-wml`** **`standardizeMode: 'ephemeraWire'`** allows **`<Object uuid=(id)><ShortName>label</ShortName></Object>`** under **`Room`**. **`uuid`** is canonical **`OBJECT#...`** in memory and **`StandardRoom.objects`** / **`toJSON`**; **`Objects Change`** **`add`** uses full **`EphemeraMetaRoomObject`** rows (WML authoring supplies **`uuid`** + **`shortName`** and must arrange a **`stableKey`** consistent with wire rules; server flows such as Acme enrich may add **`tropeAffinities`** / **`tropeAffinitiesFailed`**); **`remove`** uses **`OBJECT#...` ids**. Normative detail: [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md).

## Follow-ups (not part of v1 scope)

- **`renderOrchestration`:** May subscribe to **`Objects Changed`** (or ingress) if object lists affect render keys or passive fan-out --- **not** required for the shipped objects/perception slice; add when product needs it.
- **Non-room `componentId`**, additional **`Meta::*`** shapes, **replay** / external contract for **`mtw.ephemera.objects`**, **authorization**, **client correlation** --- future task plans or product decisions.

## Normative decisions (summary)

| Topic | Decision |
| --- | --- |
| **`dataSourceKey`** | **`mtw.ephemera.objects`** --- parallel to **`mtw.ephemera.state`**, not nested under a room-aggregate key. |
| **v1 storage** | **`objects`** on **`Meta::Room`** only; room **`componentId`** only until a follow-on extends kind. |
| **Field shape** | **`objects`:** **`EphemeraMetaRoomObject[]`** --- required **`uuid`**, **`shortName`**, **`stableKey`** ([**`EphemeraMetaRoomObject`**](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)); optional **`tropeAffinities`** and optional **`tropeAffinitiesFailed`** when trope scoring is unavailable for that row. |
| **Ingress payload** | **`Objects Change`:** **`add: EphemeraMetaRoomObject[]`**, **`remove: OBJECT#...[]`** with **`componentId`** ([`localApiEvents.ts`](../localApiEvents.ts)). |
| **Bus helper** | **`sendObjectsChange`** (parallels **`sendStateChange`**). |
| **Outbound header** | **`Objects Changed`** (Title Case, past tense; matches **`State Changed`**). |

## Verification

From [`lambda/ephemera/AGENT.testing.md`](../../AGENT.testing.md):

```bash
cd lambda/ephemera
npm run test -- --watchAll=false
# Scope when iterating:
# npm run test dataSource/objects
```

**Regression checks:**

- Tests under **`lambda/ephemera/dataSource/objects/`** and **`mergePersistMetaRoomObjects` / `handleApiObjectsChange`** pass.
- **`mtw.ephemera.objects`** appears in **[`app.ts`](../../app.ts)** side-effect imports and as the DataSource **`dataSourceKey`** in [`index.ts`](index.ts).
- **[`app.ts`](../../app.ts):** **`./dataSource/objects`** import **above** **`./dataSource/state`**.

## Related documentation

| Doc | Role |
| --- | --- |
| [`../AGENT.md`](../AGENT.md) | dataSource directory index |
| [`../AGENT.multiChannel.contract.md`](../AGENT.multiChannel.contract.md) | Shared **`Meta::Room`** row vs DataSource domains; affordance channel norms |
| [`../perception/AGENT.md`](../perception/AGENT.md) | Perception delivery; **Server publish sites (multi-channel)** |
| [`../state/AGENT.md`](../state/AGENT.md) | Symmetry: **`mtw.ephemera.state`** |
| [`../../internalCache/componentEphemeraMeta.AGENT.md`](../../internalCache/componentEphemeraMeta.AGENT.md) | **`Meta::Room`** cache; invalidation after writes |
| [`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md) | Coyote hypothesis / plan-outcome prompts consume **`Meta::Room.objects`** via staged-object snapshot (trope-first text in **`## Current staged objects by room`**) |
| [`../actions/`](../actions/) ([**`AGENT.md`**](../actions/AGENT.md), `parseCommand.ts`, `publishedEvents.ts`, `enrich/acmeOrder/interpretAndFinalize.ts`, [`index.ts`](../actions/index.ts)) | Normative **`stableKey`** contract (**`actions/AGENT.md`**); two-step Acme parse (**intent** + **enrich**); Coyote-wide occupancy (**`collectCoyoteOccupiedStableKeys`**) + deterministic finalize (**`finalizeStableKeysDeterministic`**) before **`Acme Order`**; **`AcmeOrderPublishedPayload.orders`**, confidence combine rule |
