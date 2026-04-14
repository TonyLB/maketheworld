# Room UI: multi-channel delivery (render vs affordances)

**Status:** Active --- **Phase A** and **Phase B (server)** **done**; **Phase C** (charcoal-client virtual header, merge, withhold, **`RoomUpdate`** non-visible) **done**; **Phase D** (closeout) and **server `RoomUpdate` retirement** **not** done. Normative **direction** lives in [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) (**Room UI delivery channels**). This file tracks **remaining work** and **verification** until the initiative completes or is superseded.

**Framework:** Executable task plan per [`taskPlanning/AGENT.md`](../../../../../AGENT.md) (status, **Getting Started**, **Progress**, **Recommended order** checkboxes, **Verification**).

---

## Purpose

Align **server publication**, **`mtw.ephemera.perception`** threading, and **client header composition** with two **logical** player-visible channels for room context:

1. **Room-render** --- summary / render-backed presentation (expensive path).
2. **Room-affordances** --- structured facts that should refresh cheaply (exits, characters present, **objects** as the runtime model grows).

Today the codebase still **overlaps** these concerns (for example **`PerceptionMessage`** WML vs **`RoomUpdate`**). **Phase C** stops using **`RoomUpdate`** for the **sticky header / room grouping path** (roster and related facts come from affordance **`PerceptionMessage`** only), keeps **`RoomUpdate`** **off** any **visible** transcript row (it has **not** been shown before; it must **not** appear now), and implements the **virtual** sticky header per **Phase C client (agreed norms)** and [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) **Phase C client composition (agreed)**. **Phase C** does **not** require stripping **`RoomUpdate`** from persisted stores; server emission will end, then histories can be **manually purged** (Dynamo, Dexie). This plan drives the **migration** and records **open decisions** until steady-state docs absorb the results.

---

## Getting Started

Read in order (or skim **Decisions to resolve** first if resuming):

1. [`taskPlanning/AGENT.md`](../../../../../AGENT.md) --- checkbox and durability conventions.
2. [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) --- **Room UI delivery channels** (agreed direction).
3. [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) --- correlated vs imperative delivery, fan-in.
4. [`charcoal-client/src/slices/messages/selectors.ts`](../../../../../charcoal-client/src/slices/messages/selectors.ts) and [`charcoal-client/src/components/Message/VirtualMessageList.tsx`](../../../../../charcoal-client/src/components/Message/VirtualMessageList.tsx) --- header grouping and **`RoomUpdate`** handling gap.
5. [`taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md`](../objects/AGENT.objectHandling.plan.md) --- **`mtw.ephemera.objects`**, **Phase 2** perception wiring.

---

## Goals

1. **[Decided / contract]** Wire shape: **`PerceptionMessage`** + **`metaData.roomChannel`** (`'render' | 'affordances'`); separate **`messageId`** spaces; norms in [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md).
2. **[Decided / contract]** **Fact ownership** (render vs affordances) and **coupled thread** deferral are **normative** in the contract; **server** adds affordance **`PerceptionMessage`** for roster in **Phase B** (see **Phase B server (agreed norms)**). **Phase C client (agreed norms)** and contract **Phase C client composition (agreed)** fix virtual-header layout, full **`StandardForm.merge`** (render base, affordances incoming), **`RoomUpdate`** never visible and unused for the header path, **10 s** withhold timeout, and related UX. **Retire** server **`displayProtocol: 'RoomUpdate'`** **after** that client ships (see **Outstanding decisions and questions**).
3. **[Phase B/C]** **Coupled** perception flows: full **PerceptionThread** state machine for paired delivery remains **deferred** unless product requests it.
4. **[Phase B/C]** **Implement** server publishers, perception subscriptions/handlers, and client composition so the **sticky room header** reflects **both** channels without dropping updates.
5. **[Phase B]** **Land** **`Objects Changed`** (or successor affordance delta) on the **affordances** cadence where product agrees, without forcing full room render unless summary derivation requires it.

---

## Non-goals (until explicitly pulled in)

- Final **client polish** copy for placeholders (dirt-simple placeholders acceptable for first slice).
- **EventBridge** / cross-lambda wire contracts for these channels unless product requires them.
- **Replay** of player-visible history for the new shapes (follow **presentation** / delta DB rules separately).

---

## Decisions to resolve

Promoted norms live in **`AGENT.multiChannel.contract.md`**. Remaining rows are **execution** or **product** follow-ups.

| Topic | Status / notes |
| --- | --- |
| **Wire protocol** | **[Resolved]** Both channels use **`PerceptionMessage`**; **`PerceptionRoomMetaData.roomChannel`** discriminates. |
| **Correlation keys** | **[Resolved]** Separate **`messageId`** per channel; no shared render thread id for affordances. **Affordance** **`PublishMessage`:** **`messageId`** = **new UUID** each time (**`MESSAGE#${uuid}`**, same pattern as [`publishMessage`](../../../../../lambda/ephemera/publishMessage/index.ts) when omitting **`payload.messageId`**); not **`OrchestrateMessages`**-scoped render ids. |
| **Fact ownership** | **[Resolved]** See **Fact ownership (agreed)** in contract. **Server Phase B:** add roster refresh on **`PerceptionMessage`** + **`roomChannel: 'affordances'`** (alongside existing paths as needed). **Server `RoomUpdate` retirement:** **after Phase C** (see **Outstanding decisions and questions**). **Render vs affordance WML overlap (Phase B execution):** **accept temporary duplication**; we are moving off **`ComponentRender`** during the multi-channel shift, so Phase B **does not** implement render-channel de-duplication (long-term contract norm may be reconciled when the render pipeline is settled --- see **Outstanding decisions and questions**). |
| **Uncoupled default** | **[Resolved]** Internal signals that publish **only** affordances (no render-channel **`PerceptionMessage`** from these kicks): **`mtw.ephemera.objects` `Objects Changed`** (Phase 2; **one affordance `PublishMessage` per character** in room) and **`RoomUpdate`** bus triggers (character roster refresh; Phase B adds parallel affordance **`PerceptionMessage`**, also **per character**). **`mtw.ephemera.state` `State Changed`** does **not** publish affordances; it participates **only** in the **render** path (passive render fan-out / room-render **`PerceptionMessage`**). |
| **Coupled thread template** | **[Deferred]** No v1 state machine; optional pattern in contract only until product needs paired delivery. |
| **Journeys** | **[Resolved]** No planned journey requires **strict** cross-channel coupling (the client must work with either channel alone). **Navigation** to a new room context **intends** both channels when practical; norms in [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) **Navigation intent and user journeys (agreed)**. First-arrival presentation (affordances before render): **client** staging preferred; server does **not** by default withhold affordances for that reason. |
| **Objects + perception** | **[Resolved / Phase B execution]** **`mtw.ephemera.perception`** subscribes to **`mtw.ephemera.objects` `Objects Changed`** and emits affordance **`PublishMessage`**; see **Phase B server (agreed norms)** and **[`AGENT.objectHandling.plan.md`](../objects/AGENT.objectHandling.plan.md)** Phase 2. |
| **Phase B correlation** | **[Resolved]** Phase B work is **explicitly constrained** **not** to invent a **coupled** perception thread (no new paired render+affordance fan-in state machine for **`Objects Changed`** or roster affordance kicks). Uncorrelated **`PublishMessage`** per channel norms only. New affordance emits use **one bus `PublishMessage` per recipient character** (see **Phase B server** table and **Publisher inventory**). |
| **Affordance `ComponentStackMerge` (viewer-specific merge)** | **[Resolved / Option B]** Room-wide affordance publishes (e.g. **`Objects Changed`**, roster refresh) resolve **`wmlContent`** by calling **`internalCache.ComponentStackMerge.get(characterId, roomId)` once per target**, then emit **`PublishMessage`** with **`targets: [characterId]`** (one message per character), not a single shared body for the room. **Do not** use **`ANONYMOUS`** for that path unless a later decision explicitly changes this. See **WML composition (recipe)** for the **implementation request** (call-site comments + cache docs) about a **future** cache-key migration. |
| **Phase C client composition** | **[Resolved]** Layout (single object = label; multi = Oxford list), full **`StandardForm.merge`** (no extract), merge order, **`Contents:`** when objects exist, English + future less-language-centered note, sticky **`RoomHeader`** shell + small UI OK, **10 s** withhold timeout, transcript anchor, staleness, **`RoomUpdate`** never visible + unused for header path (no purge mandate), affordance tie-break, accessibility scope: see **Phase C client (agreed norms)** below; durable copy in [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) **Phase C client composition (agreed)**. |

---

## Phase B server (agreed norms)

Treat **Recommended order** **Phase B --- server** checkboxes as **one slice** (publishers + **`Objects Changed`** wiring + unit tests).

| Topic | Decision |
| --- | --- |
| **`RoomUpdate` migration (server)** | **Phase B:** Roster refresh **also** (or primarily) on **`PerceptionMessage`** with **`metaData.roomChannel: 'affordances'`** and a **new** **`messageId`** per row (**`MESSAGE#${uuid}`**). **Do not** retire **`displayProtocol: 'RoomUpdate'`** in Phase B; **retire server `RoomUpdate` after Phase C** when the client consumes affordance roster in the sticky header (see **Recommended order** Phase C). |
| **WML overlap (Phase B slice)** | **Deferred for this slice:** accept **temporary** overlap between render and affordance **`wmlContent`** while the render path moves off **`ComponentRender`**. **Do not** block Phase B on a render-channel de-duplication recipe. Long-term contract text and **render-only** shape are **outstanding** (see **Outstanding decisions and questions**). |
| **Coupled threads** | **Out of scope:** Phase B must **not** add a **coupled** perception thread tying affordance publishes to render orchestration (e.g. for **`Objects Changed`** or roster migration). |
| **`Objects Changed` targeting** | **Everyone in the target room** receives an update via **one `PublishMessage` per occupant:** **`targets: [characterId]`** (single-character target list) and **`wmlContent`** from **`ComponentStackMerge.get(characterId, roomId)`** (Option B). **Do not** issue one room-scoped row with identical WML for all viewers. (Roster affordance **`PerceptionMessage`** in Phase B follows the same per-character rule.) |
| **`roomChannel` on new emits** | **Explicit render:** new server **`PublishMessage`** for the render channel sets **`metaData.roomChannel: 'render'`** (do not rely on omission for new code; **`undefined`** remains **legacy** semantics). |
| **Subscription site** | Handle **`Objects Changed`** inside **`mtw.ephemera.perception`** (extend **`subscribedEvents`** / **`receiveEvents`** per DataSource pattern). |
| **Unit tests (Phase B server)** | Assert **`roomChannel`** on sampled **`PublishMessage`s**; affordance **`messageId`** **not** equal to render thread **`messageId`**, and **distinct** UUID-based ids across per-character affordance rows; **`Objects Changed`** produces an affordance **`PublishMessage`** with expected shape and **explicit** **`roomChannel: 'affordances'`**; cover **`publishMessage`** / orchestration helpers as needed. |

### WML composition (recipe)

**Affordance channel (Phase B):** **`wmlContent`** is **full room WML** with **`ephemeraWire`** when **`Object`** / ephemera-only tags apply. **Structural** affordance data: **`internalCache.ComponentStackMerge`** ([`lambda/ephemera/internalCache/componentStackMerge.ts`](../../../../../lambda/ephemera/internalCache/componentStackMerge.ts)); docs in [`lambda/ephemera/internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md) and [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md).

**Room-wide affordances and `ComponentStackMerge` (Option B):** For kicks that fan out to **every character in `ROOM#...`**, call **`ComponentStackMerge.get(characterId, roomId)` once per target** and send **one `PublishMessage` per character** (**`targets: [characterId]`**) so asset-stack merge matches **each** viewer. **Do not** use **`ANONYMOUS`** for that path unless a later decision explicitly changes this.

**Implementation request (future cache keys):** At **Phase B affordance publish call-sites**, add a **short comment** stating that a **future migration** of **`ComponentStackMerge`** cache identity from **`(characterId, roomId)`** to **`(componentId, perspectiveKey)`** (or the project's equivalent) would be **justified** to align with render / perception **`perspectiveKey`** usage. **Also** add the same note to **[`lambda/ephemera/internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md)** (**Component stack merge** bullet) and/or the **[`componentStackMerge.ts`](../../../../../lambda/ephemera/internalCache/componentStackMerge.ts)** module or **`ComponentStackMergeData`** docblock when Phase B lands, so the cache layer records the intent alongside **`generateComponentStackMergeCacheKey`**.

**Render channel de-duplication (norm vs this plan):** The **contract** states that render **`wmlContent` should eventually not repeat** affordance-owned facts. **Phase B** **need not** enforce that on the server; **temporary overlap** with affordance bodies is acceptable while render moves off **`ComponentRender`** (see **`AGENT.multiChannel.contract.md`** **De-duplication (norm vs Phase B)**).

**Render-only WML (deferred):** What the **render** channel should contain once it **does not** repeat affordance-owned facts (exits, roster, objects, features, etc.) is **deferred** until we **return to `ComponentRender`** or replace it with a **`renderCache`**-backed path. Revisit **`mtw-wml`** / export modes then; record the chosen approach in **`AGENT.md`** next to that pipeline when implemented.

### Publisher inventory (code archaeology, ephemera lambda)

**Bus registration** ([`lambda/ephemera/messageBus/index.ts`](../../../../../lambda/ephemera/messageBus/index.ts)): Incoming **`PublishMessage`** is handled by **`publishMessage`** ([`lambda/ephemera/publishMessage/index.ts`](../../../../../lambda/ephemera/publishMessage/index.ts)). Incoming **`Perception`** (perception requests) is handled by **`perceptionMessage`** ([`lambda/ephemera/perception/index.ts`](../../../../../lambda/ephemera/perception/index.ts)).

**`publishMessage` (delta DB + websocket):** For each payload, **`PublishMessageTargetResolver`** expands **`ROOM#...`** (and **`!ROOM#...`** exclusions) using **`internalCache.RoomCharacterList`** into **`CHARACTER#...`** targets, then resolves characters to **`CONNECTION#...`** for websocket send. **`isPerceptionPublishMessage`:** persists **`wmlContent`** / **`metaData`** with **`MessageId`** = **`payload.messageId`** or **`MESSAGE#${uuidv4()}`** if omitted. **Affordance** producers should **always** pass an explicit **new** **`messageId`** per row (contract: UUID / **`MESSAGE#...`**); do not rely on omission for affordances. **`publishMessage`** itself does not inject **`roomChannel`**; room **`PerceptionMessage`** payloads from **`perceptionMessage`** / **`mtw.ephemera.perception`** carry **`metaData.roomChannel`** (**`'render'`** or **`'affordances'`**). Other branches: **`WorldMessage`**, **`CharacterMessage`**, **`RoomUpdate`**.

**`perceptionMessage` (imperative API):** **`isPerceptionAssetMessage`:** loads asset rooms, calls **`kickRoomHeaderBroadcastForRoom`** (no direct **`PublishMessage`** here --- kicks render / perception thread registration). **`isPerceptionRoomMessage`:** for each character in the room (or a single **`payload.characterId`**), **`ComponentRender.get`**, then **`messageBus.send({ type: 'PublishMessage', displayProtocol: 'PerceptionMessage', targets: [characterId], ... })`** --- already **per character**; room-style emits set **`metaData.roomChannel: 'render'`**. **`isPerceptionComponentMessage`:** character targets may **`sendCharacterPerceptionRequested`** (bus to perception DataSource); features use **`ComponentRender`** + **`PublishMessage`** to **`[characterId]`**; knowledge path gated by **`KNOWLEDGE_PERCEPTION_ENABLED`**. **`sendRoomGeneratingHeader`:** one **`PublishMessage`** with **`targets: characterIds`** (multi-character) and **`metaData.roomChannel: 'render'`** (affordance paths stay **one message per character** via **`publishRoomAffordancePerceptionMessages`**).

**`mtw.ephemera.perception` `receiveEvents`** ([`lambda/ephemera/dataSource/perception/index.ts`](../../../../../lambda/ephemera/dataSource/perception/index.ts)): **`isCharacterPerceptionRequestedCommand`** → **`handleCharacterPerceptionRequested`** ([`characterPerception.ts`](../../../../../lambda/ephemera/dataSource/perception/characterPerception.ts)) → **`PublishMessage`** **`PerceptionMessage`** to **`targets: [characterId]`** (Meta::Character WML, not room merge). **`isPerceptionThreadRegisterCommand`** → **`internalCache.PerceptionThreads.register`**. Otherwise → **`orchestrateRoomDescriptionStreams`** ([`orchestrate.ts`](../../../../../lambda/ephemera/dataSource/perception/orchestrate.ts)).

**`orchestrateRoomDescriptionStreams`:** Dispatches on render-cache / render-orchestration payloads. **`handleRenderPertains`:** terminal **room description** --- **`PublishMessage`** **`PerceptionMessage`** **`targets: [characterId]`**, **`displayMode: 'full'`**, shared **`messageId`** with thread; **room header broadcast** and **characterMove** headers --- **`ComponentRender.get(..., { header: true })`** per target; if all WML strings match, **one** **`PublishMessage`** with **`targets`** = full character list **else** **loop** with **`targets: [targets[i]]`** per distinct body. **`handleGenerationStarted` / `handleOrchestrationErrorOrDeferred`:** generating / error placeholder **`PublishMessage`**; room-header and character-move branches often use **`targets: registration.targets`** (multi-character) when placeholders are identical. Room-style **`PublishMessage`** rows from this pipeline set **`metaData.roomChannel: 'render'`**. **`Objects Changed`** is handled in **`receiveEvents`** (subscription on **`mtw.ephemera.objects`**) and calls **`publishRoomAffordancePerceptionMessages`** (**affordance** channel, not orchestration).

**Roster refresh:** **`roomUpdateMessage`** ([`lambda/ephemera/roomUpdate/index.ts`](../../../../../lambda/ephemera/roomUpdate/index.ts)) still sends **`displayProtocol: 'RoomUpdate'`** with **`targets: [roomId]`** (expanded to characters inside **`publishMessage`**). **`moveCharacter`**, **`disconnectMessage`**, etc. also send **`type: 'RoomUpdate'`** on the bus. **Phase B** adds **affordance** **`PerceptionMessage`** (**one per character**, **`publishRoomAffordancePerceptionMessages`**) alongside **`RoomUpdate`** without removing it.

**Related non-`PerceptionMessage` `PublishMessage`:** **`characterMoveDelivery.ts`** (**`WorldMessage`**). **`executeAction`**, **`moveCharacter`**, **`disconnectMessage`** --- **`WorldMessage`** to room / exclusion targets.

**`mtw.ephemera` (asset / EventBridge) `receiveEvents`** ([`lambda/ephemera/dataSource/index.ts`](../../../../../lambda/ephemera/dataSource/index.ts)):** **`Component Updated`** for a room → **`kickRoomHeaderBroadcastForRoom`** (render kick, not a direct **`PublishMessage`**).

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]` (capital **X**). Mark each line as you go.

**Phase A --- decisions and contract hardening**

- [X] Document **navigation intent**, **Journeys** (no strict coupling; dual-channel intent on navigation; client-first first-arrival staging) in [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md); resolve **Journeys** row in **Decisions to resolve** here.
- [X] Resolve **wire shape** and **correlation** rows in **Decisions to resolve**; update [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) with normative text (remove or narrow **TBD** bullets).
- [X] Document **coupled thread** deferral in [`perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) and contract (optional pattern only for v1).
- [X] Add interface / **`PublishMessage`** type notes in **`mtw-interfaces`** (**`roomChannel`**, **`resolvedPerceptionRoomChannel`**) and lambda **`messageBus`** / dataSource **`AGENT.md`**.

**Phase B --- server** (one slice: **Phase B server (agreed norms)**; lines below ship together)

- [X] Adjust publishers (**`publishMessage`**, **`perceptionMessage`**, **`mtw.ephemera.perception` `receiveEvents`**) so **render** and **affordances** match the contract (**explicit `roomChannel: 'render'`**, add affordance **`PerceptionMessage`** for roster refresh: **one `PublishMessage` per character** with **`ComponentStackMerge.get`** / **`roomChannel: 'affordances'`**). **Do not** retire **`RoomUpdate`** here; **norm:** render should eventually de-dupe vs affordances --- **Phase B need not enforce**; **do not** introduce **coupled** perception threads for this slice. See **Publisher inventory** for current emit sites.
- [X] Wire **`Objects Changed`** via **`mtw.ephemera.perception`** subscription (object plan **Phase 2**); **one affordance `PublishMessage` per character** in the target room (**`targets: [characterId]`**), **`wmlContent`** from **`ComponentStackMerge.get(characterId, roomId)`** (Option B), explicit **`roomChannel: 'affordances'`**, plus **call-site** / **cache** notes per **WML composition (recipe)**.
- [X] Unit tests: **`roomChannel`** + **`messageId`** separation + **`Objects Changed`** affordance shape (see **Phase B server (agreed norms)**); perception orchestration and publish helpers (pattern from existing **`dataSource/perception/`** tests).

## Phase C client (agreed norms)

Durable duplicate: [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) **Phase C client composition (agreed)**.

| Topic | Decision |
| --- | --- |
| **Layout (objects in header text)** | Keep **exits** and **characters** as today. Add **runtime objects** to the **text area** of the room **summary / description** (below existing copy): when there is **at least one** object, a **`Contents:`** line, then object **`shortName`** text---**one** object: **only** that label (no **and**); **two or more:** English list with **commas** and **and** before the last item (Oxford-style). **Zero** objects: **omit** the **`Contents:`** block entirely. **Future consideration:** this list is **English-specific**; later work may prefer a **less language-centered** presentation (e.g. chips, icons-only, or i18n-aware joiners). |
| **Cross-channel merge (structural)** | When **render** and **affordances** each supply parsed room-shaped **`StandardForm`** values, merge **whole** **`StandardForm`** instances with **`StandardForm.merge`**---**do not** extract **`StandardRoom`** (or other subparts) solely to merge. **Order:** **render** as **base**, **affordances** as **incoming** (**`render.merge(affordances)`**). |
| **Room header presentation** | The existing **sticky room header** layout (**[`VirtualMessageList`](../../../../../charcoal-client/src/components/Message/VirtualMessageList.tsx)** + **[`RoomDescription`](../../../../../charcoal-client/src/components/Message/RoomDescription.tsx)** **`header`** mode; product name **`RoomHeader`** in [`Message/AGENT.md`](../../../../../charcoal-client/src/components/Message/AGENT.md)) **already** dictates structure for this UI. Follow it for the composed header and **Contents** line; **small** layout or **Material** / **MUI** improvisations are acceptable where needed. |
| **Objects: canonical channel** | **Affordances** are the **canonical** source for **objects** over time; **render** may still carry overlapping **`<Object>`** until server de-dupe lands. **Until then**, rely on **`StandardForm.merge`** as above (no client-side preference to drop affordance objects). |
| **Transcript anchor** | The **first room-render** channel **`PerceptionMessage`** header row for that room section **anchors** transcript / room-section position---including the **Generating...** intermediate (same **`messageId`** replace pipeline as today). Affordance rows **do not** re-anchor the section. |
| **Staleness and placeholders** | **Last-known-good** is **always** shown per channel when available. **Do not** add a separate **Loading** / **Updating** affordance placeholder; affordances have **no** Generating-style row. **Render** keeps **only** the existing **Generating...** intermediate behavior for the render channel. |
| **First arrival / render catch-up (withhold)** | **Do not display** affordance-sourced header material in the **composed** sticky header until render has **caught up** (operational definition: render channel has produced a header row for that section, including **Generating**). Affordance rows may still exist on the wire / in state; they are **withheld** from the visible composed header until then (not dimmed duplicate chrome). **Timeout:** **10 seconds** after withhold starts; if render still has not caught up, **fail silently** and **then show** last-known-good affordance-sourced material (normal presentation; no dedicated affordance error state). On **render error**, use the **existing** client **sidebar** (or equivalent) **error** presentation---same as other render failures today---not a new affordance-specific error chrome. |
| **Multiple affordance rows** | When collapsing affordance **`PublishMessage`** history for the virtual header, the **winning** affordance snapshot is the one with the **latest** **`CreatedTime`** (per character / room section aggregation rules in selectors). |
| **`RoomUpdate` on the client** | **`RoomUpdate`** must **not** appear as a **visible** message row in the UI (it has **not** been visible before; keep it that way). **Selectors / presentation** do **not** surface it in the transcript list; **virtual header / grouping** do **not** use it---**roster** comes from affordance **`PerceptionMessage`** only. **No** Phase C mandate to purge **`RoomUpdate`** from persisted stores; server will stop publishing; maintainer **manually purges** when ready. |
| **Visual system** | Follow the existing **sticky `RoomHeader`** layout (**`VirtualMessageList`** + **`RoomDescription`** **`header`**); **Material** / **MUI** as today. **Two-slot** composition (render vs affordances), **dividers**, and **Contents** fit that shell; **small** improvisations are fine. Affordance **withholding** is **omission** from the composed header until render catch-up or **10 s** timeout. |
| **Accessibility** | **Out of scope** for this Phase C implementation slice; a **comprehensive** a11y pass is **deferred** (recorded explicitly so it is not forgotten). |

**Phase C --- client**

- [X] Extend **`getMessagesByRoom`** (or successor) so **both** **`roomChannel`** values participate in **one** virtual header model; **stop using** **`RoomUpdate`** for grouping / sticky header; ensure **`RoomUpdate`** is **never** a **visible** transcript row (affordance **`PerceptionMessage`** only for roster-aligned facts; **no** storage purge requirement).
- [X] Update **`VirtualMessageList`** / **`RoomDescription`** (sticky **`RoomHeader`** shell) for **two-slot** composition per **Phase C client (agreed norms)** (full **`StandardForm.merge`**, render base / affordances incoming; **Contents:** only when objects non-empty; **10 s** withhold timeout).
- [X] Tests: selectors and message list behavior (`charcoal-client` testing patterns).
- [ ] **After** the client ships the above: **retire** server **`displayProtocol: 'RoomUpdate'`** (or thin to zero emits); confirm no remaining consumer dependency. **Next:** audit emits in [`lambda/ephemera/roomUpdate/index.ts`](../../../../../lambda/ephemera/roomUpdate/index.ts), [`lambda/ephemera/moveCharacter/index.ts`](../../../../../lambda/ephemera/moveCharacter/index.ts), [`lambda/ephemera/disconnectMessage/index.ts`](../../../../../lambda/ephemera/disconnectMessage/index.ts), and [`lambda/ephemera/publishMessage/index.ts`](../../../../../lambda/ephemera/publishMessage/index.ts) (`isRoomUpdatePublishMessage`).

**Phase D --- closeout**

- [ ] Update **Progress** and **Recommended order** in this file; move steady-state narrative into **`AGENT.md`** files next to code; archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../../AGENT.md).

---

## Progress

| Milestone | Status |
| --- | --- |
| Direction documented in multi-channel contract | Done |
| Task plan (this file) | Done |
| Phase A: decisions promoted to normative docs | Done |
| Navigation intent + Journeys (contract + plan) | Done |
| Phase B: server alignment | Done |
| Phase C: client alignment | Done (charcoal-client: dual-channel header, merge, withhold, **`RoomUpdate`** hidden) |
| Server **`RoomUpdate` retirement** | Not started (follow **Phase C** last checkbox) |
| Phase D: closeout | Not started |

---

## Verification

**Ephemera lambda** (from [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md)):

```bash
cd lambda/ephemera
npm run test -- --watchAll=false
```

**Charcoal client** (when client work lands):

```bash
cd charcoal-client
npm test
```

**Manual / integration checks** (refine when wire shapes exist):

- Room look / move / header refresh: header shows **consistent** summary + affordances; render **Generating** behaves as today; affordance material **withheld** from composed header until render catch-up or **10 s** timeout; **`RoomUpdate`** never visible as a row.
- **Objects** mutation: **`Contents:`** when non-empty (single object = label only); full **`StandardForm.merge`** (**render** base, **affordances** incoming); affordance channel may update without **required** full room regen unless contract says otherwise.

---

## Outstanding decisions and questions (durable)

Items below stay open until a later milestone; they are **not** blockers for Phase B as narrowed in **Phase B server (agreed norms)**.

| Topic | Notes |
| --- | --- |
| **Contract vs plan (WML de-duplication)** | **Aligned:** the contract now states a **norm** (render should eventually not repeat affordance-owned facts) and explicitly that **Phase B need not enforce** it on the server. **Render-only recipe** remains deferred until **`ComponentRender`** / **`renderCache`** work. |
| **Render-only WML recipe** | **Deferred:** define how render-channel bodies omit exits / roster / objects / features (filtered export, alternate mode, post-process) when **`ComponentRender`** is revisited or replaced by **`renderCache`**-driven materialization. Document next to the chosen pipeline in **`AGENT.md`**. |
| **`ComponentStackMerge` invalidation** | **Shipped:** **`ComponentStackMergeData.invalidate(roomId)`** ([`componentStackMerge.ts`](../../../../../lambda/ephemera/internalCache/componentStackMerge.ts)) clears merge cache for that room; called beside **`ComponentEphemeraMeta.invalidate`** on **`Meta::Room`** / roster paths (see [`internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md)). |
| **Server `RoomUpdate` end state** | **After** charcoal-client Phase C (**never** visible row, unused for header path): remove or gate server **`RoomUpdate`** emits; verify consumers. Historical **`RoomUpdate`** rows may remain in stores until **manual** Dynamo / Dexie purge. |
| **Coupled delivery (optional)** | Product has **not** requested paired render+affordance threads; if that changes, treat as a **new** initiative (contract **Coupled delivery (optional pattern)**). |
| **`ComponentStackMerge` cache key evolution** | **Future (not Phase B):** migrate cache identity from **`(characterId, roomId)`** toward **`(componentId, perspectiveKey)`** when render and perception keying are ready; **Phase B** only documents the justification at call-sites and in **`internalCache`** docs (see **WML composition (recipe)**). |

---

## Links

| Doc / code | Role |
| --- | --- |
| [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) | Durable contract (room channels + norms) |
| [`perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) | Perception DataSource steady-state |
| [`objects/AGENT.objectHandling.plan.md`](../objects/AGENT.objectHandling.plan.md) | Objects DataSource and Phase 2 |
| [`lambda/ephemera/internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md) | Steady-state **Component stack merge** + cache patterns |
| [`lambda/ephemera/internalCache/componentStackMerge.ts`](../../../../../lambda/ephemera/internalCache/componentStackMerge.ts) | **`ComponentStackMergeData`** implementation |
| [`charcoal-client/src/components/Message/AGENT.md`](../../../../../charcoal-client/src/components/Message/AGENT.md) | Header UX intent |

---

## Decisions log

| Topic | Decision |
| --- | --- |
| Plan location | **`taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md`** tracks execution; contract file holds **agreed** norms. |
| Filename | **`multiChannel`** (not `mutliChannel`) for search and consistency. |
| **State Changed vs affordances** | **`State Changed`** drives **render** only (no affordance-channel **`PublishMessage`**). |
| **Journeys** | No strict coupling required; navigation **intends** both channels when practical; first-arrival staging **client-first** (see contract). |
| **Phase B server** | Add affordance **`PerceptionMessage`** for roster (**one `PublishMessage` per character**); **`Objects Changed`** via **`mtw.ephemera.perception`** (same per-character rule); **explicit `roomChannel: 'render'`** on new render emits; **norm:** render should eventually de-dupe vs affordances --- **Phase B need not enforce**; **no** coupled threads; **`RoomUpdate`** retirement **after Phase C**; **`ComponentStackMerge` Option B** + **`invalidate(roomId)`** wired; cache/call-site notes for future **`(componentId, perspectiveKey)`** keys; tests per **Phase B server (agreed norms)**. |
| **WML recipe (affordance)** | **`ComponentStackMerge`** + **`ephemeraWire`** for affordance bodies (shipped / documented in **`internalCache`**). |
| **WML recipe (render-only)** | **Deferred** until **`ComponentRender`** return or **`renderCache`** replacement; see **Outstanding decisions and questions**. |
| **Temporary overlap** | Phase B **accepts** duplicate facts across channels until render pipeline migration. **Phase C client** merges **whole** **`StandardForm`** values (**render** base, **affordances** incoming; **no** extract-to-**`StandardRoom`** merge); affordances are **canonical** for objects long-term. |
| **Phase C client (summary)** | See **Phase C client (agreed norms)** and contract **Phase C client composition (agreed)**. |
| **Affordance merge per viewer (Option B)** | **`ComponentStackMerge.get(characterId, roomId)` per target** for room-wide affordance **`wmlContent`**; **not** **`ANONYMOUS`**. **Implementation request:** comment at publish call-sites + note in **`internalCache/AGENT.md`** / **`componentStackMerge.ts`** that **`(componentId, perspectiveKey)`** cache keys are a **justified future migration**. |
| **Affordance `messageId`** | **New UUID** every affordance **`PublishMessage`** (**`MESSAGE#${uuid}`**, [`publishMessage`](../../../../../lambda/ephemera/publishMessage/index.ts)); not render thread ids or **`OrchestrateMessages`** offsets. |

---

## When this task plan can retire

After **Phases A--D**: normative behavior lives in **`AGENT.multiChannel.contract.md`**, relevant **`AGENT.md`** files, and interfaces. Archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../../AGENT.md).
