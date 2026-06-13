# Multi-channel room UI --- contract

This file records **falsifiable rules** for room-render vs room-affordances player delivery. Mental models: [`AGENT.multiChannel.concepts.md`](AGENT.multiChannel.concepts.md). Narrative transcript sort time: [`AGENT.narrativeTranscript.concepts.md`](AGENT.narrativeTranscript.concepts.md). Code map: [`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md) **Server publish sites (multi-channel)**.

**Status:** Durable design contract (evolving). **Not** a task checklist. **Index:** [`AGENT.md`](AGENT.md), [`dataSource/AGENT.md`](dataSource/AGENT.md). **Task planning:** [`taskPlanning/AGENT.md`](../../taskPlanning/AGENT.md).

---

## Room UI delivery channels (normative)

### Two logical channels

1. **Room-render channel** --- **Summary-oriented** content that is **render-backed** (or otherwise tied to **`ComponentRender`** / orchestration): the **expensive** path that should **not** be the only way to reflect small runtime changes.
2. **Room-affordances channel** --- **Structured** facts that should be refreshable on a **cheaper cadence**: e.g. **exits**, **characters present**, and **runtime objects** (as modeled on **`Meta::Room`** and related ephemera). **Exits** are **Area-topology-projected** via **`projectRoomExits`** / **`ComponentTopology`** hydrate --- not room blueprint rows. **Shipped (M4):** orchestration via **`mtw.ephemera.affordanceOrchestration`** + **`affordanceCache`** + perception terminal publish ([`dataSource/affordanceOrchestration/AGENT.md`](dataSource/affordanceOrchestration/AGENT.md), [`dataSource/affordanceCache/AGENT.md`](dataSource/affordanceCache/AGENT.md)).

These are **logically distinct**: they **may** use different internal triggers, different perception handling, and different client composition rules.

### Cadence and independence

- Each channel **may** be published **independently** and on its **own cadence** in response to the internal events that own that data.
- **Neither** channel is assumed to **block** the other at the protocol level **by default**; the **client** is expected to **compose** one header UX from **both** when both apply, and to tolerate **one channel arriving before the other** (placeholders or last-known-good per channel until data arrives). **Cross-channel shared staleness / revision keys** are **not** required for correctness while render truth stays in **state** and affordance truth in **objects / presence / exits**, and product accepts **brief skew** and **eventual** server-side cascade (e.g. objects -> **state** -> render). Fine-grained **placeholder** and **first-arrival** staging norms live under **Navigation intent and user journeys (agreed)** below.

### Navigation intent and user journeys (agreed)

- **No strict coupling required:** No user journey currently planned requires **protocol-level** coupling where the client **cannot** treat one channel as usable without the other. The client must be able to show something coherent per channel in isolation (last-known-good, placeholders, or channel-specific rules), even when the **preferred** experience is both channels together.
- **Navigation intent (dual channel):** When a character **enters a new room context** (for example **move** / **arrival** / first **look** at that room), the **system intent** is to deliver **both** room-render and room-affordances updates **when practical**. This is **product intent**, not a hard delivery guarantee: **Cadence and independence** still applies (independent publishes, skew, no shared revision keys).
- **First arrival / ordering (presentation):** Affordances may arrive before render completes; showing a **full** affordance slice next to an **empty** or not-yet-generating render slice can feel wrong. **Default:** address that in **client** composition (for example defer updating the **virtual** sticky header until room-render has at least a **Generating**-class signal, while still accepting affordance rows on the wire). **Do not** rely on the server **by default** to withhold affordance **`PublishMessage`** until render has shipped unless product explicitly revisits that policy. **Refinement (Phase C, agreed):** see [Phase C client composition (agreed)](#phase-c-client-composition-agreed) --- **withhold** affordance-sourced composed-header material until render catch-up (including **Generating**), **10 second** timeout then show affordances, and **existing** sidebar error UX on **render** failure.
- **Optional server-side pairing** remains a **hypothetical** future pattern only; see [Coupled delivery (optional pattern)](#coupled-delivery-optional-pattern).

### Coupled delivery (optional pattern)

**Current product stance:** No planned journey requires **paired** delivery semantics. The client is not expected to block on **both** channels for correctness.

**Hypothetical future flows** might still require **paired** semantics (for example: do not treat affordances as **terminal** until **render** has at least reached a **Generating**-class signal, or require **both** channels **terminal** before closing a perception thread). That would be a **PerceptionThread template** / fan-in concern, **not** a global rule for every update. Specific state machines, **failure**, and **timeout** behavior remain **TBD** unless product pulls them in.

### Current codebase (fact, not target)

Today, **`PerceptionMessage`** room WML can still embed **overlapping** facts on some paths (e.g. imperative **`perceptionMessage`** via **`ComponentRender`**). **Correlated terminal** **`Render Pertains`** for room threads emits **prose-only** render-channel WML from **`renderCache`** ([`dataSource/perception/roomRenderWmlFromCacheRecord.ts`](dataSource/perception/roomRenderWmlFromCacheRecord.ts)); roster refresh is **affordance** **`PerceptionMessage`** (**`roomChannel: 'affordances'`**). **Phase C (client)** stops using wire **`RoomUpdate`** for the sticky-header / grouping path, keeps **`RoomUpdate`** **off** visible transcript rows, and composes **render** + **affordance** **`PerceptionMessage`** per [Phase C client composition (agreed)](#phase-c-client-composition-agreed) (no mandated purge of stored **`RoomUpdate`** rows). The ephemera lambda **no longer emits** wire **`displayProtocol: 'RoomUpdate'`** (see **Phase B server migration**). Steady-state **server publish** map: [`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md) **Server publish sites (multi-channel)**.

### Normative consequence for new features

When adding **player-visible** room updates, **name** which **channel** owns the change (**render** vs **affordances**) and **which DataSource or module** publishes it. If a change could fit **either** channel, record the choice in this file or in the relevant **`AGENT.md`** next to the publishing code so we do not reintroduce **implicit** coupling.

### `MessageId` and correlated render vs affordances (agreed)

- **Separate `messageId` namespaces by channel:** **Room-render** and **room-affordances** **`PublishMessage`** rows use **different** **`messageId`** values. **Do not** reuse a render thread **`messageId`** for affordance payloads (and vice versa).
- **Room-render** may keep today's **correlated** behavior: **`renderOrchestration`** / **`renderCache`** / **`mtw.ephemera.perception`** paths that issue a **Generating**-class placeholder and later **overwrite** on the **same** **`messageId`** (see [`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md)).
- **Room-affordances** is **outside** that replace pipeline: a logical affordance update uses **its own** **`messageId`** space (**no** **Generating** -> terminal **replace** on that id tied to render orchestration). For **perspective-specific** affordance bodies (e.g. **`AffordanceRoomDeliverable`**), compose **once per `(roomId, perspectiveKey)`**; expect **one** **`PublishMessage` per delivery target** (**`CHARACTER#`**, **`SESSION#`**, etc.), each with its **own** **`messageId`**. **New affordance emits:** set **`messageId`** to a **new UUID** on every publish (wire form **`MESSAGE#${uuid}`**, same as the **`publishMessage`** fallback when **`payload.messageId`** is omitted --- see [`publishMessage/index.ts`](publishMessage/index.ts)). **Do not** reuse render thread ids or **`OrchestrateMessages`** offsets for affordance rows.
- **Server stream:** **Multiple** rows for the same logical affordance refresh are **acceptable**; the product does **not** require the server to collapse republishes into a **single** row.

### `PublishMessage` envelope for both channels (agreed)

- **Single display protocol:** **Room-render** and **room-affordances** both use **`DisplayProtocol: 'PerceptionMessage'`** (same top-level wire shape as today's room headers and descriptions).
- **Discriminator in `metaData`:** **`PerceptionRoomMetaData.roomChannel`**: **`'render' | 'affordances'`**; **`undefined`** is treated as **`render`** (legacy rows). See **`@tonylb/mtw-interfaces`** **`resolvedPerceptionRoomChannel`**. **New server code** sets **`roomChannel` explicitly:** **`'render'`** for the render channel and **`'affordances'`** for affordances (do not rely on omission for new emits).
- **Affordances body:** **`wmlContent`** carries **full room WML** (a **`Room`** subtree, same *shape habit* as render), not a fragment-only delta. With **`<Object>`** and other ephemera-only tags, producers use **`mtw-wml`** **`standardizeMode: 'ephemeraWire'`** when building or validating that string. **Room-render** is usually **render-backed** **`ComponentRender`** -> **`schemaToWML`** (typically **`asset`** mode unless a path opts into **`ephemeraWire`** with **`<Render>`** for resolved header prose; see **Implementation-level aggregation**); **Render Pertains** terminal room-thread emits are the exception (see **De-duplication** bullet below).
- **De-duplication (norm vs Phase B):** **Norm (target end state):** room-render **`wmlContent`** **should** eventually **not** repeat structured facts owned by **room-affordances** (exits, characters present, objects, features). The **affordance** channel carries those facts; the **render** channel carries **render-backed** presentation. **Phase B:** the server **need not** enforce that separation yet --- **temporary overlap** between render and affordance bodies is acceptable while the render path moves off **`ComponentRender`** (see **Phase B server migration (agreed)** below). The **concrete recipe** (schema filtering, export mode, or post-process) is an implementation choice recorded next to perception / **`ComponentRender`** when render is reworked. **Render Pertains (room threads, terminal only):** [`dataSource/perception/roomRenderWmlFromCacheRecord.ts`](dataSource/perception/roomRenderWmlFromCacheRecord.ts) builds render-channel **`wmlContent`** from **`cacheRecord.renderedContent`** only; **`ComponentRender`** is not used on that path.

### Phase B server migration (agreed)

- **`RoomUpdate`:** **Target end state:** migrate **character roster refresh** from **`displayProtocol: 'RoomUpdate'`** to **`PerceptionMessage`** with **`metaData.roomChannel: 'affordances'`**, then **retire or thin** **`RoomUpdate`** on the server. **Phase B (task plan):** add affordance **`PerceptionMessage`** alongside existing **`RoomUpdate`**; **do not** retire **`RoomUpdate`** until **after Phase C** when the client consumes affordance rows in the sticky header. **Shipped (post Phase C):** the ephemera lambda no longer emits wire **`displayProtocol: 'RoomUpdate'`**; internal bus **`type: 'RoomUpdate'`** enqueues **`Affordances Requested`** via **`mtw.ephemera.affordanceOrchestration`** (reason: **`roster`**). **Shipped (M4):** orchestration -> **`affordanceCache`** -> **`Affordances Pertain`** -> **`handleAffordancesPertain`** emits affordance **`PublishMessage`**. The **`RoomUpdate`** shape remains in **`@tonylb/mtw-interfaces`** for historical message rows.
- **`mtw.ephemera.objects` `Objects Changed`:** **`mtw.ephemera.affordanceOrchestration`** subscribes and fans out to **`orchestrateAffordanceRequest`** (reason: **`objects`**). **Shipped terminal shape:** **`displayProtocol: 'PerceptionMessage'`**, explicit **`metaData.roomChannel: 'affordances'`**, **one `PublishMessage` per character** with **`targets: [characterId]`**, **`wmlContent`** from **`AffordanceRoomDeliverable.get(roomId, perspectiveKey)`** (one compose per perspective), and a **new** **`messageId`** per delivery row (**`MESSAGE#${uuid}`**) via [`dataSource/perception/handleAffordancesPertain.ts`](dataSource/perception/handleAffordancesPertain.ts).
- **Unit tests:** Assert orchestration ingress for roster/objects triggers; affordance **`PublishMessage`** shape tests on **`Affordances Pertain`** path. See [`dataSource/affordanceOrchestration/AGENT.md`](dataSource/affordanceOrchestration/AGENT.md) and [`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md).

### Sticky header: virtual aggregation on the client (agreed)

- The **sticky room header** is a **virtual** view: the client **aggregates** **multiple** incoming **`presentation`** rows (**`PerceptionMessage`** headers for the same room section, **discriminated** by **`metaData`** into **render** vs **affordances**) into **one** composed header for display.
- **Transcript placement** continues to follow the **room-section** grouping model and **narrative transcript** sort semantics ([`AGENT.narrativeTranscript.concepts.md`](AGENT.narrativeTranscript.concepts.md)) --- not "one raw row equals one header pixel-for-pixel."
- **Republishes** and duplicate logical updates: **collapse / dedupe toward the virtual header** is a **client aggregation** responsibility (extend selectors such as [`charcoal-client/src/slices/messages/selectors.ts`](../../charcoal-client/src/slices/messages/selectors.ts) and header UI); avoiding double rows in the **raw** WebSocket stream is **not** a hard server requirement.

### Phase C client composition (agreed)

Product and implementation norms for **charcoal-client** Phase C are defined in this subsection. **Wire protocol** norms elsewhere in this file are unchanged.

1. **Layout (objects in header text):** Preserve **exits** and **characters** presentation as today. Add **runtime objects** to the **text area** of the room **summary / description** (below existing copy): if there is **at least one** object, a **`Contents:`** line, then **`shortName`** text---**one** object: **only** that label; **two or more:** English list with **commas** and **and** before the last item. **Zero** objects: **omit** the **`Contents:`** block. **Future consideration:** the list is **English-specific**; later work may use a **less language-centered** presentation (e.g. chips or i18n joiners). The sticky **`RoomHeader`** shell (**[`VirtualMessageList`](../../charcoal-client/src/components/Message/VirtualMessageList.tsx)** + **[`RoomDescription`](../../charcoal-client/src/components/Message/RoomDescription.tsx)** **`header`**) dictates layout; **small** UI improvisations are acceptable.
2. **Cross-channel structural merge:** Merge **whole** parsed **`StandardForm`** values with **`StandardForm.merge`**---**do not** extract **`StandardRoom`** (or other subparts) solely to merge. **Render** as **base**, **affordances** as **incoming** (e.g. **`render.merge(affordances)`**), so facts from **both** channels appear.
3. **Canonical channel for objects:** **Affordances** are the **long-term canonical** source for **objects**; **render** may still duplicate **`<Object>`** until server-side de-dupe matches the **De-duplication (norm vs Phase B)** norm under **`PublishMessage` envelope for both channels** above. Until then, **do not** prefer dropping affordance objects on the client; use **`StandardForm.merge`** as in (2).
4. **Transcript anchor:** The **first render-channel** room header **`PerceptionMessage`** for the section **anchors** transcript / room-section position, **including** the **Generating...** intermediate on the render **`messageId`**. **Affordance** header rows **do not** re-anchor the section.
5. **Staleness and placeholders:** **Last-known-good** per channel when data exists. **No** affordance-specific **Loading** / **Updating** row; **only** the render channel uses the existing **Generating...** intermediate. **Render** errors use the **existing** client **sidebar** (or equivalent) error pattern, not new affordance-only error chrome.
6. **First arrival / withhold:** Until render has emitted a header for that section (**Generating** counts), **do not display** affordance-sourced material in the **composed** sticky header (withhold; not a dimmed duplicate). **Timeout: 10 seconds**; then **fail silently** and **show** last-known-good affordance-sourced material (normal presentation; no dedicated affordance error state).
7. **Multiple affordance rows:** When choosing one affordance snapshot for the virtual header, prefer the row with the **latest** **`CreatedTime`** (per selector aggregation for the viewer / room section).
8. **`RoomUpdate`:** The **client** **does not** use **`displayProtocol: 'RoomUpdate'`** for the sticky header / room grouping path; **`RoomUpdate`** must **not** appear as a **visible** transcript row (**roster** aligns to affordance **`PerceptionMessage`**). **No** Phase C mandate to purge persisted **`RoomUpdate`** rows; the ephemera lambda **no longer emits** wire **`RoomUpdate`**; maintainer **manually purges** Dynamo / Dexie when ready.
9. **Visual system:** Follow the sticky **`RoomHeader`** shell (**`VirtualMessageList`** + **`RoomDescription`** **`header`**) and **charcoal-client** / **Material** conventions for **two-slot** layout (render vs affordances) and **dividers**; **small** improvisations are acceptable.
10. **Accessibility:** A **comprehensive** accessibility pass is **explicitly out of scope** for this Phase C slice (deferred; not forgotten).

---

## Implementation-level aggregation (example: `Meta::Room`)

Ephemera already stores **multiple concerns** on one **`Meta::Room`** item (`EphemeraId: ROOM#...`, `DataCategory: 'Meta::Room'`): e.g. `activeCharacters`, `state` (marks), cache pointer fields, and **`objects`** (runtime **`OBJECT#...`** + **`shortName`** rows; see [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../packages/mtw-interfaces/ts/ephemeraMeta.ts)).

**Ephemera wire WML (producers):** When a service builds **room** WML that includes **runtime objects** (for example for **`PerceptionMessage`**, wire transfer, or other ephemera payloads), use **`mtw-wml`** with **`standardizeMode: 'ephemeraWire'`** and **`<Object uuid=(id)><ShortName>label</ShortName></Object>`** children under **`Room`**. Canonical handles in **`StandardRoom.objects`** and in schema are **`OBJECT#...`**; WML serialization prints bare **`uuid=(id)`** again. **`Object`** is **not** a **`StandardComponent`**. **`<Render>`** (ephemera-only resolved **DisplayName** / **Summary** / **Description** under **`Room`**): **`StandardRoom.render`** stores **`SituationRoomFacetPayloadType`**; **asset** mode rejects **`Render`** like **`Object`**. Normative package docs: [`packages/mtw-wml/ts/standardize/AGENT.md`](../../packages/mtw-wml/ts/standardize/AGENT.md) and [`packages/mtw-wml/ts/AGENT.md`](../../packages/mtw-wml/ts/AGENT.md) (**Standardize** / **`standardizeMode`**).

**Contract:** **Co-location on one row is an implementation choice** for **atomicity, read efficiency, and cache keying** (`ComponentEphemeraMeta`), **not** a claim that there is only one **semantic** domain. **Domain boundaries** remain defined by **which DataSource (or module) owns writes and outbounds** for each field or field group.

**Invalidation:** Any successful write to `Meta::Room` must respect the **invalidation contract** for [`internalCache/componentEphemeraMeta.AGENT.md`](internalCache/componentEphemeraMeta.AGENT.md) (call **`invalidate(roomId)`** after success unless a narrower rule is explicitly documented).

---

## Norms for new work (until refined)

1. **Name the cadence class** for each new outbound or client-visible update (fast meta vs render-backed vs control-only).
2. **Name the owning DataSource** (or module) for **writes** and **primary** outbound events, even when storage is **`Meta::Room`**.
3. **Do not** introduce a new perception entry path without stating how it relates to [Delivery paths (correlated vs imperative)](dataSource/perception/AGENT.md#delivery-paths-correlated-vs-imperative).
4. Prefer **typed** bus events (`header.type`) over **opaque** "room updated" blobs unless a **composed** snapshot is explicitly the product requirement.
5. When **two domains** must move together for baseline UX, document whether **one** kick **chains** internally, **parallel** publishes are acceptable, or **perception** must **batch** (and what **failure** means).

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`AGENT.multiChannel.concepts.md`](AGENT.multiChannel.concepts.md) | Mental models |
| [`AGENT.narrativeTranscript.concepts.md`](AGENT.narrativeTranscript.concepts.md) | Fictional transcript `CreatedTime` |
| [`dataSource/AGENT.md`](dataSource/AGENT.md) | DataSource directory index |
| [`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md) | Correlated vs imperative delivery |
| [`dataSource/state/AGENT.md`](dataSource/state/AGENT.md) | `Meta::Room.state` ownership |
| [`dataSource/renderOrchestration/AGENT.md`](dataSource/renderOrchestration/AGENT.md) | Resolve, generation, outbounds |
| [`dataSource/renderCache/AGENT.md`](dataSource/renderCache/AGENT.md) | Durable cache, `Render Pertains` |
| [`dataSource/affordanceOrchestration/AGENT.md`](dataSource/affordanceOrchestration/AGENT.md) | Affordance ingress |
| [`dataSource/affordanceCache/AGENT.md`](dataSource/affordanceCache/AGENT.md) | Affordance cache rows |
| [`internalCache/AGENT.md`](internalCache/AGENT.md) | Topology, deliverable compose |
| [`dataSource/objects/AGENT.md`](dataSource/objects/AGENT.md) | `mtw.ephemera.objects` |
| [`taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md`](../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md) | Pass-through semantics |

---

## Open decisions (inventory)

Track resolutions here or in linked **`AGENT.md`** files next to code. Mark **[X]** when the decision is **normative** in this file or linked package docs; keep **[ ]** for unresolved items.

### Wire shapes and correlation (status)

- [X] **Affordances payload vocabulary (runtime objects):** Use **`mtw-wml`** with **`standardizeMode: 'ephemeraWire'`** and **`<Object>`** under **`Room`** for ephemera wire WML (canonical **`OBJECT#...`** handles). **`Object`** is **ephemera-only**; asset pipeline rejects it. See **Implementation-level aggregation (`Meta::Room`)** above and [`packages/mtw-wml/ts/standardize/AGENT.md`](../../packages/mtw-wml/ts/standardize/AGENT.md).
- [X] **Room-render payload vocabulary (baseline):** **Correlated terminal** **`Render Pertains`** for room threads builds render-channel **`wmlContent`** from **`renderCache`** via [`dataSource/perception/roomRenderWmlFromCacheRecord.ts`](dataSource/perception/roomRenderWmlFromCacheRecord.ts) (prose-only; no **`ComponentRender`** on that terminal path). Imperative room render paths may still use **`ComponentRender`** (including legacy **`mergeRoomExitsToJSON`** for blueprint exit concat on the **render** channel only --- not affordances or nav). Placeholders in [`dataSource/perception/orchestrate.ts`](dataSource/perception/orchestrate.ts) use local **Example**-based helpers, not **`ComponentRender`**. **`mtw-wml`** **`ephemeraWire`** **`<Render>`** under **`Room`** applies to resolved prose shapes. Full **render-channel** de-duplication vs affordances everywhere (beyond **Render Pertains** + agreed placeholders) remains **TBD** per **De-duplication (norm vs Phase B)**. See [`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md) **Server publish sites (multi-channel)** and **Implementation-level aggregation**; [`packages/mtw-wml/ts/standardize/AGENT.md`](../../packages/mtw-wml/ts/standardize/AGENT.md).
- [X] **Affordance topology hydrate + nav:** **`ensureAffordanceTopology`** + **`internalCache.ComponentTopology.get`** materialize **`ProjectedRoomTopology.exits`** on **`Affordance::`** rows. **`AffordanceRoomDeliverable.get`** composes terminal affordance WML (not bus ingress). Nav ([`dataSource/actions/roomExitTargetsForCharacter.ts`](dataSource/actions/roomExitTargetsForCharacter.ts)) reads the same slice synchronously --- no **`PublishMessage`**. See [`dataSource/affordanceCache/AGENT.md`](dataSource/affordanceCache/AGENT.md), [`internalCache/AGENT.md`](internalCache/AGENT.md) (**Area topology and affordance exits**).
- [X] **Cross-channel correlation and staleness keys:** **No** shared **revision / staleness** key across **room-render** and **room-affordances** is **required** for semantic correctness under current rules: channels are **semantically independent**, **brief skew** between them is **acceptable**, and **eventual** cascade (e.g. objects published, then **state**, then render refresh) is an allowed product shape. **Per-channel** ordering still uses **`CreatedTime`**, **`messageId`**, and existing client **`presentation`** rules as applicable.
- [X] **`PublishMessage` envelope:** Both channels use **`DisplayProtocol: 'PerceptionMessage'`**; **`PerceptionRoomMetaData.roomChannel`** discriminates **room-render** vs **room-affordances**. **Affordances** **`wmlContent`** is **full room WML** (parse with **`ephemeraWire`** when **`<Object>`** / ephemera-only tags appear). See **Room UI** subsection **`PublishMessage` envelope for both channels** above.
- [X] **`messageId` rules (per channel):** **Isolated** **`messageId`** space: affordances **never** share a render thread **`messageId`**. Render keeps **correlated** **Generating** -> terminal **overwrite** where applicable; affordances publish on **their own** ids (**single** publish per logical affordance update, **not** part of render's replace pipeline). See **Room UI** subsection **`MessageId` and correlated render vs affordances** above.
- [X] **Sticky header / client aggregation:** Virtual header from **aggregating** multiple incoming **`presentation`** kinds for the same room section; **additional affordance message type** folded into that composition; **republish handling** on the **client**, not a requirement for a single server row. See **Room UI** subsection **Sticky header: virtual aggregation on the client** above.

### Fact ownership (agreed)

- **Room-render channel** owns **render-backed** presentation: **ShortName**, **assets**, **DisplayName / Summary / Description** via **`<Render>`** / **`ComponentRender`** pipeline (see **Implementation-level aggregation** above).
- **Room-affordances channel** owns structured facts: **exits** (from Area **`positionGraph.edges`** projection), **characters** present, **objects**, **features**.
- **Situation / Lens / Guidance** are **not** forwarded for this UI slice.
- **`RoomUpdate`:** **Server** added affordance **`PerceptionMessage`** in **Phase B** (see **Phase B server migration (agreed)** above). **Phase C client** stops using **`RoomUpdate`** for the sticky-header path and keeps it **off** visible rows (**[Phase C client composition (agreed)](#phase-c-client-composition-agreed)**), without mandating storage purge; **server** wire **`RoomUpdate`** emission is **retired** (internal bus hook still drives affordance publishes only).

### Coupled PerceptionThread template (deferral)

- [X] **Deferred until product needs paired delivery:** There is **no** normative **PerceptionThread** state machine for multi-channel in **v1**, and **no** planned user journey **requires** strict cross-channel pairing. **Generating**-barrier, **terminal** join across channels, **failure**, and **timeout** for **paired** affordances + render are **TBD** for hypothetical flows; the optional pattern stays under [Coupled delivery (optional pattern)](#coupled-delivery-optional-pattern) only.

### Client implementation (types vs selectors)

- [X] **Types:** **`PerceptionRoomMetaData.roomChannel`** + default semantics in **`@tonylb/mtw-interfaces`** (**Phase A**).
- [X] **Phase C composition norms (agreed):** Layout (single object = label; multi = Oxford list; **`Contents:`** only if objects exist; English + future less-language-centered note), full **`StandardForm.merge`** (no extract; render base, affordances incoming), sticky **`RoomHeader`** shell + small UI OK, **10 s** withhold timeout, transcript anchor, staleness, render error UX, affordance **`CreatedTime`** tie-break, **`RoomUpdate`** never visible + unused for header path (no purge mandate), Material alignment, a11y deferral --- see [Phase C client composition (agreed)](#phase-c-client-composition-agreed).
- [ ] **Selectors / UI implementation:** **`getMessagesByRoom`** / **`VirtualMessageList`** (or successors) implement those norms (**Phase C** code).

### Other inventory

- [ ] **Cadence taxonomy:** fixed enum of channel/cadence names vs per-feature description only.
- [X] **Baseline contract (intent):** **Navigation intent** for enter / look / move is normative in [Navigation intent and user journeys (agreed)](#navigation-intent-and-user-journeys-agreed) (dual channel when practical; no strict coupling; client-first staging for first arrival). Formal **minimum delivery** matrices per action (**timeouts**, **failure**) remain **TBD** if product requires them.
- [ ] **Long-term split or merge:** how `mtw.ephemera.state` and `mtw.ephemera.objects` evolve as non-room kinds appear; whether subscriber docs stay **per-DataSource** or gain a composed **room** story for clients.

---

## Maintenance

When behavior or contracts **change**, update this file **or** a linked package `AGENT.md` and add a **one-line** pointer here so the decision layer stays **grep-friendly** (`multi-cadence`, `baseline`, `Meta::Room`).

### Multi-channel verification (regression)

- **Lambda:** `cd lambda/ephemera && npm run test -- --watchAll=false` (see [`AGENT.testing.md`](AGENT.testing.md)).
- **Client:** `cd charcoal-client && npm test`.
- **Manual:** Room look / move / header refresh --- composed header stays consistent; render **Generating** behaves as before; affordance material **withheld** from the composed header until render catch-up or **10 s** timeout; **`RoomUpdate`** never visible as a transcript row; objects mutation shows **`Contents:`** when non-empty; **`StandardForm.merge`** (**render** base, **affordances** incoming).
