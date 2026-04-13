# Room UI: multi-channel delivery (render vs affordances)

**Status:** Active --- **Phase A** (types + normative docs) **done**; **Phase B/C** (lambda emitters, client selectors) **not** started. Normative **direction** lives in [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) (**Room UI delivery channels**). This file tracks **remaining work** and **verification** until the initiative completes or is superseded.

**Framework:** Executable task plan per [`taskPlanning/AGENT.md`](../../../../../AGENT.md) (status, **Getting Started**, **Progress**, **Recommended order** checkboxes, **Verification**).

---

## Purpose

Align **server publication**, **`mtw.ephemera.perception`** threading, and **client header composition** with two **logical** player-visible channels for room context:

1. **Room-render** --- summary / render-backed presentation (expensive path).
2. **Room-affordances** --- structured facts that should refresh cheaply (exits, characters present, **objects** as the runtime model grows).

Today the codebase still **overlaps** these concerns (for example **`PerceptionMessage`** WML vs **`RoomUpdate`**), and the main client grouping path does not fully merge **`RoomUpdate`** into the sticky header. This plan drives the **migration** and records **open decisions** until steady-state docs absorb the results.

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
2. **[Decided / contract]** **Fact ownership** (render vs affordances) and **coupled thread** deferral are **normative** in the contract; **server** adds affordance **`PerceptionMessage`** for roster in **Phase B** (see **Phase B server (agreed norms)**). **Retire** **`displayProtocol: 'RoomUpdate'`** on the server **after Phase C** when the client no longer depends on it (see **Decisions to resolve** and **Outstanding decisions and questions**). **Client** aggregation is **Phase C**.
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
| **Correlation keys** | **[Resolved]** Separate **`messageId`** per channel; no shared render thread id for affordances. |
| **Fact ownership** | **[Resolved]** See **Fact ownership (agreed)** in contract. **Server Phase B:** add roster refresh on **`PerceptionMessage`** + **`roomChannel: 'affordances'`** (alongside existing paths as needed). **Server `RoomUpdate` retirement:** **after Phase C** (see **Outstanding decisions and questions**). **Render vs affordance WML overlap (Phase B execution):** **accept temporary duplication**; we are moving off **`ComponentRender`** during the multi-channel shift, so Phase B **does not** implement render-channel de-duplication (long-term contract norm may be reconciled when the render pipeline is settled --- see **Outstanding decisions and questions**). |
| **Uncoupled default** | **[Resolved]** Internal signals that publish **only** affordances (no render-channel **`PerceptionMessage`** from these kicks): **`mtw.ephemera.objects` `Objects Changed`** (Phase 2) and **`RoomUpdate`** bus triggers (character roster refresh). **`mtw.ephemera.state` `State Changed`** does **not** publish affordances; it participates **only** in the **render** path (passive render fan-out / room-render **`PerceptionMessage`**). |
| **Coupled thread template** | **[Deferred]** No v1 state machine; optional pattern in contract only until product needs paired delivery. |
| **Journeys** | **[Resolved]** No planned journey requires **strict** cross-channel coupling (the client must work with either channel alone). **Navigation** to a new room context **intends** both channels when practical; norms in [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) **Navigation intent and user journeys (agreed)**. First-arrival presentation (affordances before render): **client** staging preferred; server does **not** by default withhold affordances for that reason. |
| **Objects + perception** | **[Resolved / Phase B execution]** **`mtw.ephemera.perception`** subscribes to **`mtw.ephemera.objects` `Objects Changed`** and emits affordance **`PublishMessage`**; see **Phase B server (agreed norms)** and **[`AGENT.objectHandling.plan.md`](../objects/AGENT.objectHandling.plan.md)** Phase 2. |
| **Phase B correlation** | **[Resolved]** Phase B work is **explicitly constrained** **not** to invent a **coupled** perception thread (no new paired render+affordance fan-in state machine for **`Objects Changed`** or roster affordance kicks). Uncorrelated **`PublishMessage`** per channel norms only. |
| **Affordance `ComponentStackMerge` (viewer-specific merge)** | **[Resolved / Option B]** Room-wide affordance publishes (e.g. **`Objects Changed`**, roster refresh) resolve **`wmlContent`** by calling **`internalCache.ComponentStackMerge.get(characterId, roomId)` once per target character**, so merged **exits** / **shortName** reflect **that** character's asset union (not a single **`ANONYMOUS`** merge shared to everyone). See **WML composition (recipe)** for the **implementation request** (call-site comments + cache docs) about a **future** cache-key migration. |

---

## Phase B server (agreed norms)

Treat **Recommended order** **Phase B --- server** checkboxes as **one slice** (publishers + **`Objects Changed`** wiring + unit tests).

| Topic | Decision |
| --- | --- |
| **`RoomUpdate` migration (server)** | **Phase B:** Roster refresh **also** (or primarily) on **`PerceptionMessage`** with **`metaData.roomChannel: 'affordances'`** (and **`messageId`** in the affordance namespace). **Do not** retire **`displayProtocol: 'RoomUpdate'`** in Phase B; **retire server `RoomUpdate` after Phase C** when the client consumes affordance roster in the sticky header (see **Recommended order** Phase C). |
| **WML overlap (Phase B slice)** | **Deferred for this slice:** accept **temporary** overlap between render and affordance **`wmlContent`** while the render path moves off **`ComponentRender`**. **Do not** block Phase B on a render-channel de-duplication recipe. Long-term contract text and **render-only** shape are **outstanding** (see **Outstanding decisions and questions**). |
| **Coupled threads** | **Out of scope:** Phase B must **not** add a **coupled** perception thread tying affordance publishes to render orchestration (e.g. for **`Objects Changed`** or roster migration). |
| **`Objects Changed` targeting** | **Everyone in the target room:** use **`PublishMessage`** **`targets`** that resolve to **all characters in `ROOM#...`** (same room-target semantics as existing room-scoped delivery, e.g. **`targets: [roomId]`** through **`publishMessage`**). **Body:** per **Option B**, use **`ComponentStackMerge.get(recipientCharacterId, roomId)`** for **each** recipient's affordance payload (or one publish per character with that character's **`wmlContent`**), not a single shared merge for the whole room. |
| **`roomChannel` on new emits** | **Explicit render:** new server **`PublishMessage`** for the render channel sets **`metaData.roomChannel: 'render'`** (do not rely on omission for new code; **`undefined`** remains **legacy** semantics). |
| **Subscription site** | Handle **`Objects Changed`** inside **`mtw.ephemera.perception`** (extend **`subscribedEvents`** / **`receiveEvents`** per DataSource pattern). |
| **Unit tests (Phase B server)** | Assert **`roomChannel`** on sampled **`PublishMessage`s**; affordance **`messageId`** **not** equal to render thread **`messageId`**; **`Objects Changed`** produces an affordance **`PublishMessage`** with expected shape and **explicit** **`roomChannel: 'affordances'`**; cover **`publishMessage`** / orchestration helpers as needed. |

### WML composition (recipe)

**Affordance channel (Phase B):** **`wmlContent`** is **full room WML** with **`ephemeraWire`** when **`Object`** / ephemera-only tags apply. **Structural** affordance data: **`internalCache.ComponentStackMerge`** ([`lambda/ephemera/internalCache/componentStackMerge.ts`](../../../../../lambda/ephemera/internalCache/componentStackMerge.ts)); docs in [`lambda/ephemera/internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md) and [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md).

**Room-wide affordances and `ComponentStackMerge` (Option B):** For kicks that fan out to **every character in `ROOM#...`**, call **`ComponentStackMerge.get(characterId, roomId)` once per target** so asset-stack merge matches **each** viewer. **Do not** use **`ANONYMOUS`** for that path unless a later decision explicitly changes this.

**Implementation request (future cache keys):** At **Phase B affordance publish call-sites**, add a **short comment** stating that a **future migration** of **`ComponentStackMerge`** cache identity from **`(characterId, roomId)`** to **`(componentId, perspectiveKey)`** (or the project's equivalent) would be **justified** to align with render / perception **`perspectiveKey`** usage. **Also** add the same note to **[`lambda/ephemera/internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md)** (**Component stack merge** bullet) and/or the **[`componentStackMerge.ts`](../../../../../lambda/ephemera/internalCache/componentStackMerge.ts)** module or **`ComponentStackMergeData`** docblock when Phase B lands, so the cache layer records the intent alongside **`generateComponentStackMergeCacheKey`**.

**Render channel de-duplication (this plan):** **Not** required in Phase B; **temporary overlap** with affordance bodies is acceptable while render moves off **`ComponentRender`**.

**Render-only WML (deferred):** What the **render** channel should contain once it **does not** repeat affordance-owned facts (exits, roster, objects, features, etc.) is **deferred** until we **return to `ComponentRender`** or replace it with a **`renderCache`**-backed path. Revisit **`mtw-wml`** / export modes then; record the chosen approach in **`AGENT.md`** next to that pipeline when implemented.

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]` (capital **X**). Mark each line as you go.

**Phase A --- decisions and contract hardening**

- [X] Document **navigation intent**, **Journeys** (no strict coupling; dual-channel intent on navigation; client-first first-arrival staging) in [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md); resolve **Journeys** row in **Decisions to resolve** here.
- [X] Resolve **wire shape** and **correlation** rows in **Decisions to resolve**; update [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) with normative text (remove or narrow **TBD** bullets).
- [X] Document **coupled thread** deferral in [`perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) and contract (optional pattern only for v1).
- [X] Add interface / **`PublishMessage`** type notes in **`mtw-interfaces`** (**`roomChannel`**, **`resolvedPerceptionRoomChannel`**) and lambda **`messageBus`** / dataSource **`AGENT.md`**.

**Phase B --- server** (one slice: **Phase B server (agreed norms)**; lines below ship together)

- [ ] Adjust publishers (**`publishMessage`**, **`perceptionMessage`**, **`mtw.ephemera.perception` `receiveEvents`**) so **render** and **affordances** match the contract (**explicit `roomChannel: 'render'`**, add affordance **`PerceptionMessage`** for roster refresh). **Do not** retire **`RoomUpdate`** here; **do not** implement render-channel WML de-duplication; **do not** introduce **coupled** perception threads for this slice.
- [ ] Wire **`Objects Changed`** via **`mtw.ephemera.perception`** subscription (object plan **Phase 2**); affordance **`PublishMessage`** to **all characters in the target room**, with **`wmlContent`** from **`ComponentStackMerge.get` per recipient** (Option B) and **call-site** / **cache** notes per **WML composition (recipe)**.
- [ ] Unit tests: **`roomChannel`** + **`messageId`** separation + **`Objects Changed`** affordance shape (see **Phase B server (agreed norms)**); perception orchestration and publish helpers (pattern from existing **`dataSource/perception/`** tests).

**Phase C --- client**

- [ ] Extend **`getMessagesByRoom`** (or successor) so **both** channels participate in **one** header composition model (no silent drop of **`RoomUpdate`** / affordance messages).
- [ ] Update **`VirtualMessageList`** / **`RoomDescription`** (or split components) for **two-slot** composition and placeholders.
- [ ] Tests: selectors and message list behavior (`charcoal-client` testing patterns).
- [ ] **After** client consumes affordance **`PerceptionMessage`** for roster in the sticky header: **retire** server **`displayProtocol: 'RoomUpdate'`** (or thin to zero emits); confirm no remaining server dependency.

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
| Phase B: server alignment | Not started |
| Phase C: client alignment | Not started |
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

- Room look / move / header refresh: header shows **consistent** summary + affordances; no stuck placeholders beyond agreed timeouts.
- **Objects** mutation: affordance channel updates without **required** full room regen unless contract says otherwise.

---

## Outstanding decisions and questions (durable)

Items below stay open until a later milestone; they are **not** blockers for Phase B as narrowed in **Phase B server (agreed norms)**.

| Topic | Notes |
| --- | --- |
| **Contract vs plan (WML de-duplication)** | [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) still states a **norm** that render **`wmlContent`** should **not** repeat affordance-owned facts. **This plan** defers enforcing that on the server until the **render pipeline** is reworked. Reconcile contract text or add an explicit **interim** clause when ready. |
| **Render-only WML recipe** | **Deferred:** define how render-channel bodies omit exits / roster / objects / features (filtered export, alternate mode, post-process) when **`ComponentRender`** is revisited or replaced by **`renderCache`**-driven materialization. Document next to the chosen pipeline in **`AGENT.md`**. |
| **`ComponentStackMerge` invalidation** | **Follow-on:** room-scoped **`invalidate`** (or equivalent) so affordance publishers do not serve stale merged WML after **`Meta::Room`** writes when **`ComponentEphemeraMeta`** was invalidated; see [`lambda/ephemera/internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md). |
| **Server `RoomUpdate` end state** | **After Phase C:** remove or gate **`RoomUpdate`** emits; verify **charcoal-client** and any other consumers. |
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
| **Phase B server** | Add affordance **`PerceptionMessage`** for roster; **`Objects Changed`** via **`mtw.ephemera.perception`**; **explicit `roomChannel: 'render'`** on new render emits; **no** render WML de-dupe in this slice; **no** coupled threads; **`RoomUpdate`** retirement **after Phase C**; **`ComponentStackMerge` Option B** (per-target **`get`**) + cache/call-site notes for future **`(componentId, perspectiveKey)`** keys; tests per **Phase B server (agreed norms)**. |
| **WML recipe (affordance)** | **`ComponentStackMerge`** + **`ephemeraWire`** for affordance bodies (shipped / documented in **`internalCache`**). |
| **WML recipe (render-only)** | **Deferred** until **`ComponentRender`** return or **`renderCache`** replacement; see **Outstanding decisions and questions**. |
| **Temporary overlap** | Phase B **accepts** duplicate facts across channels until render pipeline migration. |
| **Affordance merge per viewer (Option B)** | **`ComponentStackMerge.get(characterId, roomId)` per target** for room-wide affordance **`wmlContent`**; **not** **`ANONYMOUS`**. **Implementation request:** comment at publish call-sites + note in **`internalCache/AGENT.md`** / **`componentStackMerge.ts`** that **`(componentId, perspectiveKey)`** cache keys are a **justified future migration**. |

---

## When this task plan can retire

After **Phases A--D**: normative behavior lives in **`AGENT.multiChannel.contract.md`**, relevant **`AGENT.md`** files, and interfaces. Archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../../AGENT.md).
