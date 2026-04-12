# mtw.ephemera.perception

**Status:** Bus-only, non-replayable `EphemeraDataSource`. Subscribes to **`api.ephemera`** ingress **`Character Perception Requested`** and **`Perception Thread Registered`**, and to **`mtw.ephemera.renderCache`** **`Render Pertains`** plus selected **`mtw.ephemera.renderOrchestration`** outbounds (**`Generation Started`**, **`Orchestration Error`**, **`Generation Deferred`**) for **room description** and **room header broadcast** fan-in (see [`subscribedEvents.ts`](subscribedEvents.ts)). Character path: **`streamKey`** = viewed character id (`CHARACTER#...`); thread registration: **`streamKey`** = **`componentId`**. `receiveEvents` handles Character via `Meta::Character` and **`PublishMessage`** (`characterPerception.ts`); thread registration calls **`internalCache.PerceptionThreads.register(cmd)`** with a **`threadKind`**-discriminated **`PerceptionThreadRegisterCommand`** (initial thread body derived inside **`register`**; multiple rows may share the same **`componentId` + `perspectiveKey`**); stream payloads are handled in [`orchestrate.ts`](orchestrate.ts) (**`PublishMessage`**, correlated **`messageId`**). No outbound `mtw.ephemera.perception` stream events yet.

**Fan-in aggregation:** In-memory state on **`internalCache.PerceptionThreads`** ([`perceptionThreads.ts`](../../internalCache/perceptionThreads.ts): **`register`** appends a row per composite key, **`list`** / **`update`** / **`remove(registrationId)`**, synthetic **`registrationId`** when omitted; no cross-thread dedupe; [`InternalCache.clear()`](../../internalCache/index.ts) only, no **`flush()`**). **`threadKind`** includes **`stub`**, **`roomDescription`**, and **`roomHeaderBroadcast`** (same **`componentId` + `perspectiveKey`** bucket; separate rows). Room examine (step 4) and room header refresh (step 5): [`AGENT.perceptionRefactor.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.perceptionRefactor.planning.md) **Recommended order**. Entry kicks: **`parse/executeAction`** (description) vs [`kickRoomHeaderBroadcast.ts`](kickRoomHeaderBroadcast.ts) from [`dataSource/index.ts`](../index.ts) (room component update) and imperative [`perceptionMessage`](../../perception/index.ts) (asset-linked rooms), each pairing **`sendPerceptionThreadRegistered`** with passive **`Render Requested`** (**`targets`**) through **`renderOrchestration`**.

**Task plan:** [`AGENT.perceptionRefactor.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.perceptionRefactor.planning.md) under `taskPlanning/lambda/ephemera/dataSource/perception/`.

**Related:** Imperative [`perceptionMessage`](../../perception/index.ts) bridges the Character branch through `sendCharacterPerceptionRequested` into this DataSource.

---

## Data domain and purpose

Ephemera combines **audience-driven** product rules (who should see what, when, and how, including "tree falls in a forest" deferral) with **internal** pipelines that materialize world and render state. Those concerns split into two mental frameworks:

- **Audience-focused:** the *meaning* of work is tied to **expected feedback patterns** (messages, WebSocket updates, timeline vs in-place behavior).
- **Internal-focused:** the *meaning* of work is tied to **specific data domains** (`state`, `renderOrchestration`, `renderCache`, and others). Those domains are **mostly agnostic** to the audience story their outputs will eventually serve.

**`mtw.ephemera.perception` is the bridge** between the internal-focused framework and the audience-focused one. It is where **audience expectations** are recorded (when needed), where **internal** events are **interpreted** against those expectations, and where **`PublishMessage`** (and related client delivery) is decided.

Internal DataSources can keep **minimal routing identity** (what they need for their own work) without threading full audience intent through every layer; perception **correlates** stream and ingress signals to **registered** expectations and **dispatches** accordingly.

### Correlated (async) pattern

Many flows need a **feedback loop**: something is requested, work runs asynchronously, and **intermediate** and **terminal** outcomes must map back to **who** asked and **how** updates should appear (for example correlating a final render with an earlier "Generating" placeholder via client protocols such as `MessageId`).

Rough shape:

1. **Register** the audience expectation (who, what component or perspective, what kind of delivery thread; e.g. full room description).
2. **Notify** internal systems (e.g. `renderOrchestration`) that fresh material is needed. That call stays **internal-focused**: it does not need to carry the full audience "why."
3. **`renderOrchestration`** / **`renderCache`** produce **intermediate** and **final** signals (and cache updates) on their own terms.
4. **Perception** subscribes (or consumes equivalent bus events), **correlates** those signals to the earlier registration using routing identity (e.g. `componentId` + `perspectiveKey`, plus in-bucket state such as `cacheId` when it appears), and **dispatches** `PublishMessage` according to the thread type (placeholders, overwrites, deduped terminals, etc.).

**Example (room description):** A client issues something like "look room." Perception registers "this viewer, this room, wants full description," kicks render work without encoding that narrative in orchestration, then correlates "Generating" and final render events back to that registration and sends the right sequence of client messages.

### Immediate pattern

Some audience responses can be satisfied **with data already on hand**. Those paths **do not** require registration, subscription to render streams, or full **correlation** machinery **today**. They still belong in the **same** perception domain so that **implementation stays one place** when a product slice **graduates** from "always on hand" to "must generate, cache, and correlate" (for example character descriptions if they later become dynamic render-backed content).

### Why both patterns live here

Keeping **immediate** and **correlated** behavior under **`mtw.ephemera.perception`** avoids splitting "simple" and "hard" delivery into separate subsystems that would have to merge as features evolve. The **task plan** and **Obligations** in [`AGENT.perceptionRefactor.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.perceptionRefactor.planning.md) describe the correlated fan-in work in flight; this document states the **enduring** domain boundary regardless of which pattern a given code path uses today.
