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
2. **[Decided / contract]** **Fact ownership** (render vs affordances) and **coupled thread** deferral are **normative** in the contract; **`RoomUpdate`** merge / retirement still **TBD** (client path).
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
| **Fact ownership** | **[Resolved]** See **Fact ownership (agreed)** in contract; **`RoomUpdate`** evolution **TBD**. |
| **Uncoupled default** | **[Resolved]** Internal signals that publish **only** affordances (no render-channel **`PerceptionMessage`** from these kicks): **`mtw.ephemera.objects` `Objects Changed`** (Phase 2) and **`RoomUpdate`** bus triggers (character roster refresh). **`mtw.ephemera.state` `State Changed`** does **not** publish affordances; it participates **only** in the **render** path (passive render fan-out / room-render **`PerceptionMessage`**). |
| **Coupled thread template** | **[Deferred]** No v1 state machine; optional pattern in contract only until product needs paired delivery. |
| **Journeys** | **[Resolved]** No planned journey requires **strict** cross-channel coupling (the client must work with either channel alone). **Navigation** to a new room context **intends** both channels when practical; norms in [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) **Navigation intent and user journeys (agreed)**. First-arrival presentation (affordances before render): **client** staging preferred; server does **not** by default withhold affordances for that reason. |
| **Objects + perception** | **[Phase B]** **[`AGENT.objectHandling.plan.md`](../objects/AGENT.objectHandling.plan.md) Phase 2** attaches (subscribe **`mtw.ephemera.objects`**, affordance **`PublishMessage`**, etc.). |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]` (capital **X**). Mark each line as you go.

**Phase A --- decisions and contract hardening**

- [X] Document **navigation intent**, **Journeys** (no strict coupling; dual-channel intent on navigation; client-first first-arrival staging) in [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md); resolve **Journeys** row in **Decisions to resolve** here.
- [X] Resolve **wire shape** and **correlation** rows in **Decisions to resolve**; update [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) with normative text (remove or narrow **TBD** bullets).
- [X] Document **coupled thread** deferral in [`perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) and contract (optional pattern only for v1).
- [X] Add interface / **`PublishMessage`** type notes in **`mtw-interfaces`** (**`roomChannel`**, **`resolvedPerceptionRoomChannel`**) and lambda **`messageBus`** / dataSource **`AGENT.md`**.

**Phase B --- server**

- [ ] Adjust publishers (**`publishMessage`**, **`perceptionMessage`**, **`mtw.ephemera.perception` `receiveEvents`**) so **render** and **affordances** match the contract.
- [ ] Wire **`Objects Changed`** / affordance path per object plan **Phase 2** once channel design is fixed.
- [ ] Unit tests: perception orchestration, publish helpers, and any new guards (pattern from existing **`dataSource/perception/`** tests).

**Phase C --- client**

- [ ] Extend **`getMessagesByRoom`** (or successor) so **both** channels participate in **one** header composition model (no silent drop of **`RoomUpdate`** / affordance messages).
- [ ] Update **`VirtualMessageList`** / **`RoomDescription`** (or split components) for **two-slot** composition and placeholders.
- [ ] Tests: selectors and message list behavior (`charcoal-client` testing patterns).

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

## Links

| Doc / code | Role |
| --- | --- |
| [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) | Durable contract (room channels + norms) |
| [`perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) | Perception DataSource steady-state |
| [`objects/AGENT.objectHandling.plan.md`](../objects/AGENT.objectHandling.plan.md) | Objects DataSource and Phase 2 |
| [`charcoal-client/src/components/Message/AGENT.md`](../../../../../charcoal-client/src/components/Message/AGENT.md) | Header UX intent |

---

## Decisions log

| Topic | Decision |
| --- | --- |
| Plan location | **`taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md`** tracks execution; contract file holds **agreed** norms. |
| Filename | **`multiChannel`** (not `mutliChannel`) for search and consistency. |
| **State Changed vs affordances** | **`State Changed`** drives **render** only (no affordance-channel **`PublishMessage`**). |
| **Journeys** | No strict coupling required; navigation **intends** both channels when practical; first-arrival staging **client-first** (see contract). |

---

## When this task plan can retire

After **Phases A--D**: normative behavior lives in **`AGENT.multiChannel.contract.md`**, relevant **`AGENT.md`** files, and interfaces. Archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../../AGENT.md).
