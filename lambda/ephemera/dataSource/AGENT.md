# Ephemera DataSource layer - Agent Navigation Guide

**Status:** ACTIVE. This directory implements the [`EphemeraDataSource`](abstract.ts) pattern ([`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)) for **internal bus** integration, asset-event consumption, and ephemera-domain streaming. It is the **index** for DataSource packages under `lambda/ephemera/dataSource/` and for **cross-cutting contracts** that span those packages.

**Parent lambda:** [`../AGENT.md`](../AGENT.md) (WebSocket, perception product, transition context). For event topology beyond DataSources, see [`../AGENT.event.md`](../AGENT.event.md).

---

## Cross-cutting contracts (start here for multi-domain work)

| Doc | Role |
| --- | --- |
| [**AGENT.multiChannel.concepts.md**](../AGENT.multiChannel.concepts.md) | Multi-channel mental models (render vs affordances) |
| [**AGENT.multiChannel.contract.md**](../AGENT.multiChannel.contract.md) | Multi-channel norms: wire shape, `messageId`, Phase B/C |
| [**AGENT.narrativeTranscript.concepts.md**](../AGENT.narrativeTranscript.concepts.md) | Fictional transcript **`CreatedTime`**, delivery looseness vs fan-in correlation |
| Multi-channel room UI (initiative complete) | Norms: [`AGENT.multiChannel.contract.md`](../AGENT.multiChannel.contract.md); server publish map: [`perception/AGENT.md`](perception/AGENT.md) **Server publish sites (multi-channel)** |
| Cross-cutting concepts index | [`../AGENT.concepts.md`](../AGENT.concepts.md) |

**Wire note:** **`PublishPerceptionMessage`** ([`messageBus/baseClasses.ts`](../messageBus/baseClasses.ts)) uses **`PerceptionMessageMetaData`**; room rows distinguish channels with **`metaData.roomChannel`** per the multi-channel contract. **Where emits happen (ephemera lambda):** [`perception/AGENT.md` **Server publish sites (multi-channel)**](perception/AGENT.md#server-publish-sites-multi-channel) (durable inventory). The task plan **Publisher inventory** section was the working copy and is **superseded** by that subsection for steady-state truth.

Task-planning drafts (dispose after tasks land) live under [`taskPlanning/lambda/ephemera/`](../../../taskPlanning/lambda/ephemera/); the pass-through narrative is in [`AGENT.passThrough.contract.planning.md`](../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md).

---

## Shared primitives (this folder root)

| File | Role |
| --- | --- |
| [`abstract.ts`](abstract.ts) | `EphemeraDataSource` --- `ephemeraDB`, SNS, `messageBus`, `EphemeraId` primary key |
| [`apiEphemera.ts`](apiEphemera.ts) | **`api.ephemera`** streaming helpers (`sendStateChange`, `sendObjectsChange`, `sendPutThinkingSchedule`, `sendPutThinkingJobCreate`, `sendPutThinkingJobError`, cache primitives, etc.) and envelope guards |
| [`localApiEvents.ts`](localApiEvents.ts) | Payload types for **`api.ephemera`** commands shared across packages |
| [`subscribedEvents.ts`](subscribedEvents.ts) | Guards for **`mtw.assets`** envelopes consumed by the main ephemera DataSource ([`index.ts`](index.ts)) |
| [`index.ts`](index.ts) | **`mtw.ephemera`** DataSource --- assets subscription, `processComponentUpdated`, etc. |

**Ingress convention:** Many flows use **`dataSourceKey: 'api.ephemera'`** on the internal bus for lambda-invoked commands (not necessarily API Gateway). Package-local `localApiEvents.ts` files document additional **`api.ephemera`** header types.

**Diagnostics boundary note (steady state):**
- **`mtw.ephemera`** (this [`index.ts`](index.ts)) does **not** subscribe to `Ephemera RenderCache Finding`.
- **`mtw.ephemera.renderCache`** subscribes and performs lazy catalog invalidation (P7) via [`renderCache/handleRenderCacheFinding.ts`](renderCache/handleRenderCacheFinding.ts).
- Assets **`mtw.assets`** no longer reseeds on this finding.

---

## DataSource instances (by `dataSourceKey`)

Side-effect **`import './dataSource/...'`** from [`../app.ts`](../app.ts) registers subscriptions. Each row links to package **`AGENT.md`** where present.

| Key | Directory | Notes |
| --- | --- | --- |
| **`mtw.ephemera`** | [`./`](./) ([`index.ts`](index.ts)) | Subscribes to **`mtw.assets`**; blueprint / component reconciliation |
| **`mtw.ephemera.renderCache`** | [`renderCache/`](renderCache/) | Durable **`CACHE#...`** rows, invalidation, diagnostics heal, **`Render Pertains`**, orchestration handoff --- [`renderCache/AGENT.md`](renderCache/AGENT.md) |
| **`mtw.ephemera.renderOrchestration`** | [`renderOrchestration/`](renderOrchestration/) | **`findRender`**, generation, six outbound types --- [`renderOrchestration/AGENT.md`](renderOrchestration/AGENT.md) |
| **`mtw.ephemera.perception`** | [`perception/`](perception/) | Audience fan-in, **`PublishMessage`** --- [`perception/AGENT.md`](perception/AGENT.md) |
| **`mtw.ephemera.positions`** | [`positions/`](positions/) ([`positions/AGENT.md`](positions/AGENT.md)) | Positions in play; slice 0: `mtw.connections.characters` presence --- concepts, contract, implementation siblings |
| **`mtw.ephemera.affordanceOrchestration`** | [`affordanceOrchestration/`](affordanceOrchestration/) | Affordance orchestration, **`Affordances Requested`** --- [`affordanceOrchestration/AGENT.md`](affordanceOrchestration/AGENT.md) |
| **`mtw.ephemera.affordanceCache`** | [`affordanceCache/`](affordanceCache/) | Affordance cache rows, **`Affordances Pertain`** --- [`affordanceCache/AGENT.md`](affordanceCache/AGENT.md) |
| **`mtw.ephemera.state`** | [`state/`](state/) | **`Meta::Room.state`** marks merge, **`State Changed`** --- [`state/AGENT.md`](state/AGENT.md) |
| **`mtw.ephemera.objects`** | [`objects/`](objects/) | **`Meta::Room.objects`** (**`EphemeraMetaRoomObject[]`**: **`uuid`**, **`shortName`**, optional **`stableKey`** machine correlation key (legacy rows may omit), optional trope fields **`tropeAffinities`** / **`tropeAffinitiesFailed`**) merge, **`Objects Changed`**, affordance fan-out --- [`objects/AGENT.md`](objects/AGENT.md) |
| **`mtw.ephemera.actions`** | [`actions/`](actions/) ([`actions/index.ts`](actions/index.ts)) | **`Parse Requested`** ingress; **`Acme Order`** (**`stableKey`** per line after deterministic finalize), **`Character Navigate`** (stream; execution in positions), **`Await RoadRunner`**, harnesses --- normative **`stableKey`** contract [**`actions/AGENT.md`**](actions/AGENT.md); [`publishedEvents.ts`](actions/publishedEvents.ts), [`parseCommand.ts`](actions/parseCommand.ts) |
| **`mtw.ephemera.coyoteGame`** | [`coyoteGame/`](coyoteGame/) | **`Objects Changed`** (Coyote + adds) and **`mtw.ephemera.actions` `Await RoadRunner`**; hypothesis and outcome pipelines + harness --- [`coyoteGame/AGENT.md`](coyoteGame/AGENT.md), [`coyoteGame/generators/pipelines/hypothesis/AGENT.md`](coyoteGame/generators/pipelines/hypothesis/AGENT.md), [`coyoteGame/generators/pipelines/outcome/AGENT.md`](coyoteGame/generators/pipelines/outcome/AGENT.md) |
| **`mtw.ephemera.thinking.results`** | [`thinking/results/`](thinking/results/) | Subscribe-only: internal **`Thinking Result`** published by **`mtw.ephemera.coyoteGame`**; persists **`JOB#`** adjacency + **`TASK#`/`Meta::Result`** --- [`thinking/AGENT.md`](thinking/AGENT.md) |
| **`mtw.ephemera.thinking.scheduling`** | [`thinking/scheduling/`](thinking/scheduling/) | **`api.ephemera`** schedule/job commands; **`Job Completed`** replayable egress on streamKey **`global`** --- [`thinking/AGENT.md`](thinking/AGENT.md) |

**Virtual / cross-cutting:** **`api.ephemera`** is not a `DataSource` class but the **`dataSourceKey`** for internal command envelopes consumed by multiple subscribers above.

**Cross-cutting (not a DataSource):** [`connectionsCharacterRegistered/`](connectionsCharacterRegistered/) --- shared EventBridge guards and [`handleCharacterRegisteredOrientation`](connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts) for `mtw.connections` / `Character Registered` session orientation (subscribed by render + affordance orchestration).

**Navigation note:** Parse-based character navigation and UI exit clicks emit **`Character Navigate`** from **`mtw.ephemera.actions`** (via **`Parse Requested`** or **`Action Assessed`**); execution is owned by **`mtw.ephemera.positions`**. Legacy home still uses imperative **`MoveCharacter`**. Asset visibility repair (**`CheckLocation`**) and connect use the positions membership API. Aggregate position projection from connections presence is owned by **`mtw.ephemera.positions`**.

---

## Cache and storage touchpoints

- **`Meta::Room`** and related ephemera meta: read-through [`../internalCache/componentEphemeraMeta.ts`](../internalCache/componentEphemeraMeta.ts) --- [`../internalCache/componentEphemeraMeta.AGENT.md`](../internalCache/componentEphemeraMeta.AGENT.md).
- Render cache rows and queries: documented in [`renderCache/AGENT.md`](renderCache/AGENT.md).

---

## Testing

From [`lambda/ephemera/`](../): `npm test`. Integration: [`passThroughOrchestrationToCache.integration.test.ts`](passThroughOrchestrationToCache.integration.test.ts), [`passThroughAffordanceOrchestrationToCache.integration.test.ts`](passThroughAffordanceOrchestrationToCache.integration.test.ts), [`characterRegisteredOrientation.integration.test.ts`](characterRegisteredOrientation.integration.test.ts) (`Character Registered` -> `CHARACTER#` render + affordance).

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) | **`busOnly`**, **`publishedEvents.ts`**, serialization boundaries |
| [`../internalCache/AGENT.md`](../internalCache/AGENT.md) | Per-invocation caches, **`PerceptionThreads`**, **`ComponentEphemeraMeta`** |
| [`../perception/AGENT.md`](../perception/AGENT.md) | Imperative perception handler (outside DataSource tree) |
