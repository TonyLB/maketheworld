# Ephemera-only `<Render>` tag (`mtw-wml`)

**Status:** Active --- **Phase 1--3 done** ( **`mtw-wml`** **`AGENT.md`**, **`standardize/AGENT.md`**, **`AGENT.multiChannel.contract.md`** updated); next is **Phase 4** (optional **lambda** emit + **`RoomDescription`** read path) or **closeout**. Adds an **ephemera wire** child of **`Room`** that carries **resolved** **DisplayName**, **Summary**, and **Description** without **Situation**, **Example**, **Lens**, or **Guidance** authoring shapes. Aligns with [**room-render** vs **room-affordances**](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) and [**fact ownership**](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) (render channel prose vs pipeline-only constructs).

**Framework:** Executable task plan per [`taskPlanning/AGENT.md`](../../AGENT.md) (status, **Getting Started**, **Progress**, **Recommended order** checkboxes, **Verification**).

---

## Purpose

Today, **room-render** **`PerceptionMessage`** WML often arrives as **`ComponentRender`** output that still resembles **asset** shapes (**Situation** facets, **Example** references). Product intent is to ship **player-visible** prose (**DisplayName**, **Summary**, **Description**) on the **render** channel without implying a particular **Situation** branch or **Example** ref.

This plan introduces **`<Render>`** as an **`ephemeraWire`**-only tag under **`Room`**, parallel in spirit to **`<Object>`** (see [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md)): **asset** mode **rejects** it; **ephemeraWire** accepts it and standardizes it into **`StandardRoom`** data the client can consume.

**ShortName** and **assets** on **`Room`** remain separate facts (see contract); this plan focuses on the **`<Render>`** subtree for the **three** render-tree / literal fields.

---

## Wire shape (v1 target)

Normative **WML** shape (exact names and optionality to be confirmed in implementation):

- Parent: **`Room`** only (same containment rule as **`Object`**).
- Single **`<Render>`** child (or merge rules if multiple --- default **at most one**).
- Children: **`DisplayName`**, **`Summary`**, **`Description`** in line with existing schema literal / render-tree patterns used elsewhere under **Situation** facets (reuse **print** / **parse** conventions where possible).

**Forbidden in asset mode:** **`Render`** must not appear in blueprint/asset pipelines; **`standardizeMode: 'ephemeraWire'`** only.

---

## Getting Started

Read in order:

1. [`taskPlanning/AGENT.md`](../../AGENT.md) --- task plan conventions.
2. **`Object`** implementation pattern: [`packages/mtw-base/ts/schema/components.ts`](../../../packages/mtw-base/ts/schema/components.ts) (**`SchemaObjectTag`**), [`packages/mtw-wml/ts/schema/converters/components.ts`](../../../packages/mtw-wml/ts/schema/converters/components.ts) (**`Object`** map), [`packages/mtw-wml/ts/standardize/components/room.ts`](../../../packages/mtw-wml/ts/standardize/components/room.ts) (**`ephemeraWire`** branch).
3. [`packages/mtw-wml/ts/standardize/wmlStandardizeMode.ts`](../../../packages/mtw-wml/ts/standardize/wmlStandardizeMode.ts) --- **`WmlStandardizeMode`**.
4. [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) --- **`PublishMessage`**, **render** vs **affordances**, **`metaData`** discriminator.
5. [`charcoal-client/src/components/Message/RoomDescription.tsx`](../../../charcoal-client/src/components/Message/RoomDescription.tsx) --- today prefers **Situation** then **Example** for name/summary/description.

---

## Goals

1. **Schema:** **`SchemaRenderTag`** (or agreed name) in **`mtw-base`**; **`isSchemaRender`** guard.
2. **Parse / print:** **`mtw-wml`** **`components.ts`** converter entries (**initialize** / **finalize** / **print**) for **`Render`** under **`Room`**; validate child set (**DisplayName** / **Summary** / **Description**).
3. **Standardize:** **`StandardRoom`** consumes **`Render`** only when **`standardizeMode === 'ephemeraWire'`**; map into fields the client can read (either new **`StandardRoom`** payload fields **or** internal mapping into a **single** logical facet equivalent to **`SituationRoomFacetPayload`** for **`RoomDescription`** without serializing **Situation** on the wire).
4. **Asset mode:** **`Render`** under **`Room`** is an error (unconsumed or explicit throw), consistent with **`Object`**.
5. **Tests:** **`mtw-wml`** round-trip, **asset** rejection, **`ephemeraWire`** acceptance; align with [`packages/mtw-wml/ts/standardize/index.test.ts`](../../../packages/mtw-wml/ts/standardize/index.test.ts) patterns for **`Object`**.
6. **Docs:** [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) and [`packages/mtw-wml/ts/AGENT.md`](../../../packages/mtw-wml/ts/AGENT.md) --- document **`Render`** next to **`Object`**.

---

## Non-goals (v1)

- **Migrating** all **`ComponentRender`** / perception emitters to emit **`Render`** immediately (follow-on in ephemera lambda / client).
- Changing **affordances** WML (**`<Object>`**, exits, characters, features) beyond any **shared** **`Room`** plumbing touched for **`Render`**.
- **`ShortName`** and **`assets`** on **`Room`** wire shape (may remain as today or a follow-on task plan).
- Removing **Situation** / **Example** from **asset** authoring or from **internal** renderer paths.

---

## Decisions to resolve

| Topic | Notes |
| --- | --- |
| **Tag name** | **`Render`** vs **`RoomRender`** or **`EphemeraRender`** (default **Render**). |
| **Child optionality** | All three required vs **Summary** / **Description** optional empty. |
| **Collision with Situation/Example on same wire** | Forbid mixing on **one** **`Room`** in **ephemeraWire**, or define precedence (**Render** wins for header prose). |
| **Client read path** | Prefer **`RoomDescription`** reading **`Render`**-backed fields before **Situation** / **Example** when present. |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]` (capital **X**). Mark each line as you go.

**Phase 1 --- schema and converters**

- [X] Add **`SchemaRenderTag`** / **`isSchemaRender`** in **`mtw-base`**; export from schema index as needed.
- [X] Add **`Render`** entries in [`packages/mtw-wml/ts/schema/converters/components.ts`](../../../packages/mtw-wml/ts/schema/converters/components.ts) (parse, print, validation).
- [X] Unit tests for schema round-trip and illegal placements (outside **`Room`**).

**Phase 2 --- StandardRoom and standardize**

- [X] Extend **`StandardRoomPayload`** / **`fromSchema`** / **`toSchema`** to consume **`Render`** in **`ephemeraWire`** only; map **DisplayName / Summary / Description** into stable **`StandardRoom`** data (JSON field **`render`**: **`SituationRoomFacetPayloadType`** --- literal **`displayName`**, render-tree **`summary`** / **`description`**; see [`packages/mtw-wml/ts/standardize/components/dataTypes/room.ts`](../../../packages/mtw-wml/ts/standardize/components/dataTypes/room.ts) and [`packages/mtw-wml/ts/standardize/components/room.ts`](../../../packages/mtw-wml/ts/standardize/components/room.ts)).
- [X] Ensure **asset** mode does not accept **`Render`** (unconsumed tag error, same pattern as **`Object`**).
- [X] Tests mirroring **`Object`** coverage in [`standardize/index.test.ts`](../../../packages/mtw-wml/ts/standardize/index.test.ts) under **`describe('standardizeMode')`** (parse, round-trip, asset rejection, duplicate **`Render`**, whitespace **DisplayName**, merge with affordance form).

**Phase 3 --- documentation and cross-links**

- [X] Update [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) (**Ephemera-only tags**) --- **`Render`** paragraph is present next to **`Object`**.
- [X] Pointer in [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) under **Implementation-level aggregation** (and **`Open decisions`** / **Fact ownership** cross-links) for **`Render`** and **`StandardRoom.render`**.
- [X] **`Render`** note next to **`Object`** in [`packages/mtw-wml/ts/AGENT.md`](../../../packages/mtw-wml/ts/AGENT.md) (Goal 6).

**Phase 4 --- downstream (optional follow-on)**

- [ ] Ephemera lambda: emit **`Render`** in **room-render** **`PerceptionMessage`** **`wmlContent`** when wiring render channel migration.
- [ ] `charcoal-client`: **`RoomDescription`** prefers **`Render`**-derived prose when **`parsedWML`** includes it.

**Closeout**

- [ ] Update **Progress** and **Recommended order**; archive or delete this plan per [`taskPlanning/AGENT.md`](../../AGENT.md).

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan (this file) | Done |
| Phase 1: schema + converters | Done |
| Phase 2: StandardRoom + tests | Done |
| Phase 3: docs + contract pointer | Done |
| Phase 4: ephemera + client | Not started |

---

## Verification

```bash
cd packages/mtw-base
npm test
```

```bash
cd packages/mtw-wml
npm test
```

Scope while iterating (Phase 2 **`Render`** slice; regex matches test names):

```bash
cd packages/mtw-wml
npx jest ts/standardize/index.test.ts -t "Render under Room|merges ephemeraWire render|whitespace-only inside Room"
```

Broader **`Render`** substring also matches unrelated tests whose titles contain **render** (maps, features, etc.); prefer the pattern above for this plan.

---

## Links

| Doc / code | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../AGENT.md) | Task plan framework |
| [`AGENT.multiChannel.contract.md`](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) | Room channels and **render** facts |
| [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) | **`standardizeMode`**, **`Object`**, ephemera wire |
| [`charcoal-client/src/components/Message/RoomDescription.tsx`](../../../charcoal-client/src/components/Message/RoomDescription.tsx) | Header display extraction |

---

## Decisions log

| Topic | Decision |
| --- | --- |
| Plan path | **`taskPlanning/packages/mtw-wml/AGENT.renderTag.plan.md`** |
| Wire shape | **`Render`** with **DisplayName**, **Summary**, **Description** under **`Room`**, **`ephemeraWire`** only |
| Phase 1 schema rules | **DisplayName** then **Summary** then **Description** in strict order; **DisplayName** non-empty after trim; **Summary** / **Description** may be empty; **`defaultSchemaTag`** includes **`Render`** |
| Phase 2 StandardRoom mapping | JSON **`render`** uses **`SituationRoomFacetPayloadType`** (same as situation-room facet payload); **`schema`** / **`nestedSchema`** re-emit **`<Render>`** via **`renderPayloadToSchemaNode`** |

---

## When this task plan can retire

After Phases 1--3 (and any Phase 4 work you fold into this initiative): **`Render`** is documented in **`mtw-wml`** / **`mtw-base`** and cited from the multi-channel contract or ephemera docs as needed. Archive or delete per [`taskPlanning/AGENT.md`](../../AGENT.md).
