# mtw.ephemera.renderOrchestration

## Status

This directory is the **canonical implementation** for the `mtw.ephemera.renderOrchestration` DataSource: subscription, ingress, `orchestrateRenderRequest`, intake, `findRender`, and `generateRoomPreview`. Long-form planning for other v2 themes (wiring breadth, room-scale work) lives in [`AGENT.planning.md`](AGENT.planning.md) in this folder.

**Passive orchestration** (single-item **`Render Requested`**) has completed the **pass-through migration:** outcomes are published only on **`mtw.ephemera.renderOrchestration`** via `streamEvent` (see `publishedEvents.ts`, `sendRenderOrchestrationPublish`). There is no `roomStateRender` registration, `conversation.sendMessage`, or legacy `RenderReady` / `RenderInvalidate` / `RenderError` bus materialization on that path.

**Contract doc:** the cross-cutting [pass-through contract](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md) may still be marked draft or refined over time; it remains the right place for **semantics** (outbounds, durability split, uncertainties). This `AGENT.md` describes **how the code behaves today**.

**Not implied roadmap items:** we do **not** treat **replay** or an **external** (e.g. EventBridge) contract as planned follow-ups for this module. If those ever become product requirements, they would be explicit new decisions, not the completion criteria for work already shipped here.

## Getting Started

1. **Contract** --- Skim the [pass-through contract](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md) for the **six orchestration outbounds**, **Limited refinement** (payload shapes), and **uncertainties** that are still open at the product level. This file covers **implementation** and passive-path wiring.
2. **Consumer side** --- Read [`../renderCache/AGENT.md`](../renderCache/AGENT.md) so you know how **`mtw.ephemera.renderCache`** subscribes and where the durable **`CACHE#...`** write happens (**`Render Generated`** handler).
3. **Domain cache** --- [`../../renderCache/AGENT.md`](../../renderCache/AGENT.md) for cache rows, exact match, and `internalCache` (orchestration reads through these helpers).
4. **Code path** --- Passive pipeline: [`orchestrationHandler.ts`](orchestrationHandler.ts) (`orchestrateRenderRequest`) -> [`findRender.ts`](findRender.ts) -> [`generateRoomPreview.ts`](generateRoomPreview.ts). State-driven fan-out: [`fanOutStateChangedToPassiveRenders.ts`](fanOutStateChangedToPassiveRenders.ts). Outbound types and publish helpers: [`publishedEvents.ts`](publishedEvents.ts), `sendRenderOrchestrationPublish` / `publishRenderOrchestrationStreamEvent` (see [`index.ts`](index.ts) wiring).
5. **Tests** --- Run from [`lambda/ephemera/`](../../): `npm test`. Start with [`passThroughContract.scaffold.test.ts`](passThroughContract.scaffold.test.ts), [`orchestrationHandler.test.ts`](orchestrationHandler.test.ts), [`findRender.test.ts`](findRender.test.ts), [`generateRoomPreview.test.ts`](generateRoomPreview.test.ts); cross-layer: [`../passThroughOrchestrationToCache.integration.test.ts`](../passThroughOrchestrationToCache.integration.test.ts).
6. **Broader planning** --- [`AGENT.planning.md`](AGENT.planning.md) in this directory for v2 tasks (e.g. wiring tables) that are **not** the same as the pass-through doc.
7. **DataSource pattern** --- [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (**publishedEvents.ts** for **`busOnly`** outbounds).

## Why this layer exists

Orchestration keeps **policy and multi-step lifecycle sequencing** out of neighboring packages:

- **`renderCache`** (domain) stays cache types and persistence helpers; the **`mtw.ephemera.renderCache`** DataSource emits correlated **`Render Pertains`** / **`Cache Updated`** (see [`../renderCache/AGENT.md`](../renderCache/AGENT.md)).
- **`state`** owns world-state storage and invariants (`Meta::Room`, etc.).
- **`perception`** will own delivery correlation and fan-in (future).

## What passive orchestration does today

1. Subscribes to internal `api.ephemera` streaming envelopes with header type **`Render Requested`**.
2. Maps ingress to **`RenderRequested`** and runs **`orchestrateRenderRequest`** (`orchestrationHandler.ts`): intake (`requestIntake.ts`), optional **`Orchestration Error`** from `intakeErrors.ts`, then **`findRender`**, then **`generateRoomPreview`** on cache miss when policy allows.
3. Publishes **six outbound** payload types on **`mtw.ephemera.renderOrchestration`** (union in [`publishedEvents.ts`](publishedEvents.ts)): **`Current Cache Valid`**, **`Exact Match Found`**, **`Generation Started`**, **`Render Generated`**, **`Orchestration Error`**, **`Generation Deferred`**.

**Not orchestration-owned:** durable **`CACHE#...`** writes or the final correlated **`Render Pertains`** signal. On generation success, orchestration emits **`Render Generated`** with full content; **`mtw.ephemera.renderCache`** subscribes, performs the single **`putCacheRecord`**, then emits **`Render Pertains`** and **`Cache Updated`** (see [pass-through contract](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md)).

**Removed (historical):** authoring **preview** ingress (`Render Preview Requested`) and preview-only conversation types.

Wiring: `app.ts` side-effect imports `./dataSource/renderOrchestration` (`index.ts`).

## Handoff to `mtw.ephemera.renderCache`

- Orchestration **does not** call the renderCache DataSource directly and **does not** enqueue **`Put Cache Record`** for passive generation completion.
- **`renderCache`** **subscribes** to orchestration stream events on the same `receiveEvents` path as `api.ephemera` (message bus streaming), via [`../renderCache/subscribedEvents.ts`](../renderCache/subscribedEvents.ts) and [`../renderCache/handleRenderOrchestrationInbound.ts`](../renderCache/handleRenderOrchestrationInbound.ts).

## Pass-through durability rule

Same constraint as **Handoff** above, for grep and contract links: passive generation success must **not** use **`publishPutCacheRecord`**, **`sendPutCacheRecord`**, or **`defaultPublishPutCacheRecord`** in orchestration; **`mtw.ephemera.renderCache`** performs the single Dynamo write when handling **`Render Generated`**.

Canonical semantics: [AGENT.passThrough.contract.planning.md](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md).

## Passive state fan-out (`S = A union P`)

When room **state** changes, **`fanOutStateChangedToPassiveRenders.ts`** fans out one **`orchestrateRenderRequest`** per perspective in the resolve set **S** (audience perspectives **A** union meta-pointer perspectives **P**). Pointer-only keys use **`allowGeneration: false`** and cheap paths only. Set algebra and product rules: **State-driven fan-out** in the contract doc.

## Single-flight generation

After fast-path checks (pointer, exact match, policy gates), concurrent callers for the **same** logical generation (stable cohort key: `EPHEMERA_ROOM_RENDER_GENERATION_CATEGORY` + `computeRenderGenerationArgumentHash` in [`renderGenerationArgumentHash.ts`](renderGenerationArgumentHash.ts)) are coalesced with **`singleFlight`** (**coalesce** mode) from [`singleFlightRenderGeneration.ts`](singleFlightRenderGeneration.ts): one leader runs **`computation()`** (LLM + **`Generation Started`** + **`Render Generated`**); followers **`retrieval()`** waits for the durable row via **`getExactMatch`** and does **not** republish **`Render Generated`**.

**Library limits:** `singleFlight` does not guarantee exactly-once side effects inside **`computation`** (e.g. duplicate **`Generation Started`** on leader expiry / self-promote). **Perception** owns subscriber dedupe for terminal outputs (contract uncertainty 6). See [`packages/mtw-lambda-patterns/ts/singleFlight`](../../../../../packages/mtw-lambda-patterns/ts/singleFlight).

## Stream emission (passive path)

| Source | Outbound |
| --- | --- |
| `intakeErrors.ts` (intake failure before `findRender`) | **`Orchestration Error`** |
| `findRender.ts` pointer branch valid | **`Current Cache Valid`** |
| `findRender.ts` exact match | **`Exact Match Found`** |
| `findRender.ts` miss, `allowGeneration === false` | **`Generation Deferred`** |
| `generateRoomPreview.ts` bad / missing context | **`Orchestration Error`** (`CONTEXT_REQUIRED`, etc.) |
| `generateRoomPreview.ts` LLM / generation failure | **`Orchestration Error`** |
| `generateRoomPreview.ts` slow path (leader) | **`Generation Started`**, then **`Render Generated`** or **`Orchestration Error`** |

**`publishPutCacheRecord` / `sendPutCacheRecord`:** must **not** appear on passive **generation success** in `generateRoomPreview.ts`; durable write is **`renderCache`** on **`Render Generated`** only.

**Other callers:** [`materializeRoomStateRender`](../../../conversations/conversationTypes/roomStateRender/materialize.ts) may still serve conversation-backed flows outside this passive handler; it is not used from `orchestrationHandler.ts` for passive outcomes.

## Stream skeleton sequencing

Order used for the pass-through slice (keeps contract tests and implementation aligned):

1. Land **skipped** contract tests for orchestration **`streamEvent`** shapes and **`renderCache`** subscription expectations (per [Encoding the contract in unit tests](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests)).
2. Wire orchestration **`streamEvent`** emissions and **un-skip** producer tests.
3. Implement **`renderCache`** subscription handlers and remove duplicate **`Put Cache Record`** from orchestration on generation success; add thin integration test [`passThroughOrchestrationToCache.integration.test.ts`](../passThroughOrchestrationToCache.integration.test.ts).

## Tests and verification

**Primary tests:** [`orchestrationHandler.test.ts`](orchestrationHandler.test.ts), [`findRender.test.ts`](findRender.test.ts), [`generateRoomPreview.test.ts`](generateRoomPreview.test.ts), [`passThroughContract.scaffold.test.ts`](passThroughContract.scaffold.test.ts). **Cross-layer:** [`passThroughOrchestrationToCache.integration.test.ts`](../passThroughOrchestrationToCache.integration.test.ts) (`orchestrateRenderRequest` + renderCache subscriber).

**Hygiene (grep):** Under `dataSource/renderOrchestration/`, passive generation success must not call `publishPutCacheRecord` / `sendPutCacheRecord` / `defaultPublishPutCacheRecord` from `generateRoomPreview.ts`. Passive orchestration paths should not use `getRoomStateRenderHandle`, `sendMessage`, or `materializeRoomStateRender` for outcomes (see `orchestrationHandler.ts`, `findRender.ts`, `generateRoomPreview.ts`, `intakeErrors.ts`).

From [`lambda/ephemera/`](../../): `npm test` (Jest).

## Key concepts

- **Perspective**: asset stack and `computePerspectiveKey` for cache matching.
- **Rooms first (v2)**: event shapes use **`componentId`** so the same lifecycle can extend beyond rooms later.
- **Outgoing types:** [`publishedEvents.ts`](publishedEvents.ts) (**`publisherStrategy: 'busOnly'`**); **`mtw-interfaces`** not required for this internal handoff (see [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md)).

## Design intent

- Keep **multi-step orchestration** out of `state` and **durable readiness** ownership in **`renderCache`** (DataSource), not duplicated on the orchestration stream as the final subscriber contract.

## Parallel tracks (governance)

**Canonical track:** `orchestrateRenderRequest`, intake, `findRender`, `generateRoomPreview` in this package. Do **not** add a second orchestration stack elsewhere for the same concerns.

**Tests:** Exercise passive orchestration via **`sendRenderRequested`** (see `subscribedEvents.ts`) and assert `StreamingEvent` shapes for **`mtw.ephemera.renderOrchestration`**. Do not reintroduce **`Render Preview Requested`**.

## Current constraints

- **In-process / internal bus:** passive orchestration is consumed inside Ephemera via the existing streaming / message-bus path; there is **no** separate public EventBridge contract for this DataSource today, and none is assumed.
- **`replayable: false`:** matches current usage (no replay pipeline for this stream). Turning on replay later would be a **new** design if product needs it, not an unfinished obligation of this migration.

## Related docs

- [`AGENT.planning.md`](AGENT.planning.md) --- v2 tasks (Task 7, wiring tables).
- [Pass-through contract (draft)](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md).
- [`../renderCache/AGENT.md`](../renderCache/AGENT.md) --- **`mtw.ephemera.renderCache`** DataSource (subscription, **`Render Pertains`** / **`Cache Updated`**).
- [`../../renderCache/AGENT.md`](../../renderCache/AGENT.md) --- domain cache schema and primitives.
- [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) --- DataSource patterns.
- [`../../messageBus/AGENT.md`](../../messageBus/AGENT.md), [`../../perception/AGENT.md`](../../perception/AGENT.md).
