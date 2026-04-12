# Room UI: multi-channel delivery (render vs affordances)

**Status:** Active --- **planning / decisions open**. Normative **direction** lives in [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) (**Room UI delivery channels**). This file tracks **unknowns**, **alignment work**, and **verification** until the initiative completes or is superseded.

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

1. **Decide** wire shapes, naming, and **`messageId` / correlation** rules for **room-render** vs **room-affordances** (may retain evolution from current types or introduce distinct **`PublishMessage`** display protocols).
2. **Decide** **single source of truth** per fact (e.g. whether exits and characters live **only** on affordances after migration, and what remains in WML for render).
3. **Specify** **uncoupled** vs **coupled** perception flows: when affordances may ship independently vs when a **PerceptionThread** must **gate** affordances until render reaches at least **Generating**, and when **terminal** requires both channels (including **failure** and **timeout** semantics).
4. **Implement** server publishers, perception subscriptions/handlers, and client composition so the **sticky room header** reflects **both** channels without dropping updates.
5. **Land** **`Objects Changed`** (or successor affordance delta) on the **affordances** cadence where product agrees, without forcing full room render unless summary derivation requires it.

---

## Non-goals (until explicitly pulled in)

- Final **client polish** copy for placeholders (dirt-simple placeholders acceptable for first slice).
- **EventBridge** / cross-lambda wire contracts for these channels unless product requires them.
- **Replay** of player-visible history for the new shapes (follow **presentation** / delta DB rules separately).

---

## Decisions to resolve

Track here until promoted to **`AGENT.multiChannel.contract.md`** or package **`AGENT.md`** files.

| Topic | Notes |
| --- | --- |
| **Wire protocol** | Distinct **`DisplayProtocol`** values vs composed payload vs evolution of **`PerceptionMessage`** + metadata. |
| **Correlation keys** | Room id, per-channel **`messageId`**, epoch / version for staleness, pairing across channels. |
| **Fact ownership** | Remove duplication between WML room schema and affordance payload; migration ordering. |
| **Uncoupled default** | Which internal events publish **only** affordances (e.g. **`Objects Changed`**, **`RoomUpdate`** triggers). |
| **Coupled thread template** | Exact state machine: start conditions, **Generating** barrier, terminal join, error paths, **timeout**. |
| **Journeys** | Which user actions use **coupled** vs **uncoupled** (room look, move, asset refresh, passive ticks). |
| **Objects + perception** | How **[`AGENT.objectHandling.plan.md`](../objects/AGENT.objectHandling.plan.md) Phase 2** attaches (subscribe on **`mtw.ephemera.objects`**, translate to affordance publish, vs other). |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]` (capital **X**). Mark each line as you go.

**Phase A --- decisions and contract hardening**

- [ ] Resolve **wire shape** and **correlation** rows in **Decisions to resolve**; update [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) with normative text (remove or narrow **TBD** bullets).
- [ ] Document **coupled thread** template in [`perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) or contract (or both) once agreed.
- [ ] Add interface / **`PublishMessage`** type notes in **`mtw-interfaces`** or lambda **`messageBus`** docs as needed.

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
| Phase A: decisions promoted to normative docs | Not started |
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

---

## When this task plan can retire

After **Phases A--D**: normative behavior lives in **`AGENT.multiChannel.contract.md`**, relevant **`AGENT.md`** files, and interfaces. Archive or delete this plan per [`taskPlanning/AGENT.md`](../../../../../AGENT.md).
