# mtw.ephemera.perception

**Status:** Bus-only, non-replayable `EphemeraDataSource`. Subscribes to **`api.ephemera`** ingress **`Character Perception Requested`** and **`Perception Thread Registered`**, and to **`mtw.ephemera.renderCache`** **`Render Pertains`** plus selected **`mtw.ephemera.renderOrchestration`** outbounds (**`Generation Started`**, **`Orchestration Error`**, **`Generation Deferred`**) for **room description**, **room header broadcast**, and **`characterMove`** fan-in (see [`subscribedEvents.ts`](subscribedEvents.ts)). Character path: **`streamKey`** = viewed character id (`CHARACTER#...`); thread registration: **`streamKey`** = **`componentId`**. `receiveEvents` handles Character via `Meta::Character` and **`PublishMessage`** (`characterPerception.ts`); thread registration calls **`internalCache.PerceptionThreads.register(cmd)`** with a **`threadKind`**-discriminated **`PerceptionThreadRegisterCommand`** (initial thread body derived inside **`register`**; multiple rows may share the same **`componentId` + `perspectiveKey`**); stream payloads are handled in [`orchestrate.ts`](orchestrate.ts) (**`PublishMessage`**, correlated **`messageId`**). No outbound `mtw.ephemera.perception` stream events yet.

**Fan-in aggregation:** In-memory state on **`internalCache.PerceptionThreads`** ([`perceptionThreads.ts`](../../internalCache/perceptionThreads.ts): **`register`** appends a row per composite key, **`list`** / **`update`** / **`remove(registrationId)`**, synthetic **`registrationId`** when omitted; no cross-thread dedupe; [`InternalCache.clear()`](../../internalCache/index.ts) only, no **`flush()`**). **`threadKind`** includes **`stub`**, **`roomDescription`**, **`roomHeaderBroadcast`**, and **`characterMove`** (same **`componentId` + `perspectiveKey`** bucket; separate rows). Correlated flows (room examine, room header refresh, character move header) are **shipped**. **Which entry points use fan-in versus imperative [`perceptionMessage`](../../perception/index.ts)** is documented in [Delivery paths (correlated vs imperative)](#delivery-paths-correlated-vs-imperative). **Policy**, **normative decisions**, and **obligations** are in [Normative decisions and obligations](#normative-decisions-and-obligations). **`characterMove`** rows carry **`messageGroupId`** (root), **`leaveMessageGroupId`**, **`arriveMessageGroupId`**, optional **`leaveWorldMessage` / `arriveWorldMessage`**, and **`headerTargets`** (defaults to the mover when omitted). Leave/Arrive **`WorldMessage`** sends from transact callbacks use [`characterMoveDelivery.ts`](characterMoveDelivery.ts) with **`OrchestrateMessages`** ordering: **`before`** = leave group, root = room header placeholder/terminal, **`after`** = arrive group.

**Entry kicks:** **`parse/executeAction`** (room description) and [`kickRoomHeaderBroadcast.ts`](kickRoomHeaderBroadcast.ts) / [`dataSource/index.ts`](../index.ts) / imperative [`perceptionMessage`](../../perception/index.ts) pair **`sendPerceptionThreadRegistered`** with passive **`Render Requested`** (**`targets`**) through **`renderOrchestration`**. **[`moveCharacter`](../../moveCharacter/index.ts)** calls **`internalCache.PerceptionThreads.register`** **directly** (synchronously, before transact) when the arrival room has a **non-empty** **`perspectiveKey`** --- not only **`sendPerceptionThreadRegistered`**, so the row exists before success callbacks that emit Leave/Arrive.

**Development notes:** Steady-state **delivery map**: [Delivery paths (correlated vs imperative)](#delivery-paths-correlated-vs-imperative). **Follow-on design** (default publish, particularizing registration): [`AGENT.development.md`](AGENT.development.md) (test commands there too).

**Related:** Imperative [`perceptionMessage`](../../perception/index.ts) bridges the Character branch through `sendCharacterPerceptionRequested` into this DataSource.

## Multi-channel room UI (render vs affordances)

Normative contract: [`AGENT.multiChannel.contract.md`](../AGENT.multiChannel.contract.md) (**Navigation intent and user journeys (agreed)** for coupling vs navigation intent).

**Room-render** and **room-affordances** share **`DisplayProtocol: 'PerceptionMessage'`** and discriminate with **`metaData.roomChannel`** on **`PerceptionRoomMetaData`** (`@tonylb/mtw-interfaces`). **Correlated** render (**Generating** / terminal overwrite on the same **`messageId`**) applies to the **render** channel only; **room-affordances** **`PublishMessage`** rows sit **outside** that replace pipeline.

**Journeys:** No planned journey requires strict cross-channel pairing; navigation **intends** both channels when practical. First-arrival staging (affordances before render) is a **client** composition concern by default, not server withholding of affordances.

**Phase B (server):** Migrate **`RoomUpdate`** roster to affordance **`PerceptionMessage`**; **`mtw.ephemera.objects` `Objects Changed`** handled here (**subscribe** on this DataSource); **de-duplicate** render vs affordance WML per contract; **explicit `roomChannel`** on new emits. See [`AGENT.multiChannel.contract.md`](../AGENT.multiChannel.contract.md) **Phase B server migration** and [task plan **Phase B server (agreed norms)**](../../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md#phase-b-server-agreed-norms).

**Structural room WML (affordances):** Merged room **`StandardForm`** without **`RenderCache`**, **`Examples`**, or **`StandardRoomData.render`** (exits, characters present, merged **shortName**, **`Meta::Room.objects`**, etc.) comes from **`internalCache.ComponentStackMerge`** ([`componentStackMerge.ts`](../../internalCache/componentStackMerge.ts)). Steady-state documentation: [`internalCache/AGENT.md`](../../internalCache/AGENT.md) (**Component stack merge**). Execution context: [task plan **WML composition (recipe)**](../../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md#wml-composition-recipe).

**Coupled thread template:** Optional **hypothetical** paired delivery remains **deferred**; there is **no** normative **PerceptionThread** state machine for multi-channel in v1 unless product requests one; see **Coupled PerceptionThread template (deferral)** and **Coupled delivery (optional pattern)** in the contract.

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

Keeping **immediate** and **correlated** behavior under **`mtw.ephemera.perception`** avoids splitting "simple" and "hard" delivery into separate subsystems that would have to merge as features evolve. **Obligations** and **normative routing** for fan-in are in [Normative decisions and obligations](#normative-decisions-and-obligations) below; pass-through semantics this stack consumes are in [`AGENT.passThrough.contract.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md).

---

## Delivery paths (correlated vs imperative)

Steady-state map of which legs are satisfied by **`mtw.ephemera.perception`** fan-in versus imperative [`perceptionMessage`](../../perception/index.ts). This is **current routing**, not a changelog.

### Correlated delivery (DataSource fan-in)

These paths **register** a perception thread (or enter through code that registers), **kick** passive render where needed, and emit room-related **`PublishMessage`** from [`orchestrate.ts`](orchestrate.ts) when **`Render Pertains`** and orchestration lifecycle events correlate to those threads.

| Flow | How it is entered | Notes |
| --- | --- | --- |
| **Room `look` (room id)** | [`parse/executeAction.ts`](../../parse/executeAction.ts) **`look`** when **`EphemeraId`** is a room | **`threadKind`:** **`roomDescription`**. Does **not** use imperative **`Perception`** for the **full** room description. |
| **Room header refresh (asset `Component Updated`)** | [`dataSource/index.ts`](../index.ts) **`processComponentUpdated`** [`kickRoomHeaderBroadcastForRoom`](kickRoomHeaderBroadcast.ts) | **`threadKind`:** **`roomHeaderBroadcast`**, grouped by **`perspectiveKey`**. |
| **Room headers after asset change (`PerceptionAssetMessage`)** | [`perceptionMessage`](../../perception/index.ts) handles the bus message and calls **`kickRoomHeaderBroadcastForRoom`** per linked room | Same correlated header pipeline as the row above; the imperative handler is only the **entry** that kicks registration + render. |
| **Move, arrival-room header** | [`moveCharacter`](../../moveCharacter/index.ts) when the arrival room has a **non-empty** **`perspectiveKey`** | **`threadKind`:** **`characterMove`**. Leave/Arrive narrative uses [`characterMoveDelivery.ts`](characterMoveDelivery.ts). |

### Imperative delivery (`perceptionMessage`)

These paths **enqueue** **`type: 'Perception'`** for [`perceptionMessage`](../../perception/index.ts) without the correlated room fan-in above (until a deliberate follow-on wires them).

| Source | Reference |
| --- | --- |
| **`look` (non-room target)** | [`parse/executeAction.ts`](../../parse/executeAction.ts) |
| **`checkLocation`** (`forceRender`) | [`checkLocation/index.ts`](../../checkLocation/index.ts) |
| **Link API** (feature, character, knowledge) | [`app.ts`](../../app.ts) |
| **Map subscription** success path | [`mapSubscription/index.ts`](../../mapSubscription/index.ts) |
| **`moveCharacter` fallback** | When there is **no** **`characterMoveKey`** (empty arrival-room **`perspectiveKey`**), header refresh still uses imperative **`Perception`** with **`header: true`** ([`moveCharacter/index.ts`](../../moveCharacter/index.ts)) |

**Other room `Perception` payloads:** Any **`PerceptionRoomMessage`** that still reaches **`perceptionMessage`** uses immediate **`ComponentRender.get`** + **`PublishMessage`** in the handler. Only **room `look` from `executeAction`** uses the correlated room description path today; see [Correlated room description (policy)](#correlated-room-description-policy).

---

## Normative decisions and obligations

### Plan assumptions

- **`mtw.ephemera.perception`** is a **published** Ephemera DataSource on the **internal** bus (**`StreamingEvent`**, **`subscribedEvents`**, **`publishedEvents`**) like other ephemera DataSources. A later **split** (ingress adapter vs domain core) is allowed if complexity grows.
- **Bus-only graph:** subscribe and publish perception-related work through the **internal bus** only. **EventBridge** / external **replay** are **out of scope** unless added deliberately.
- **In-memory fan-in:** aggregation lives on **`internalCache.PerceptionThreads`** only for the lambda invocation; **no** durable checkpoints until **replay** or **cross-invocation** continuity requires them (**TBD**).

### Implementation stance

- **Route** new audience-facing room and room-header work through this DataSource when it matches [Delivery paths (correlated vs imperative)](#delivery-paths-correlated-vs-imperative); keep imperative [`perceptionMessage`](../../perception/index.ts) accurate for remaining entry points. Keep [`perception/AGENT.md`](../../perception/AGENT.md) aligned as routing evolves.
- **Prefer** the same DataSource patterns as [`renderOrchestration`](../renderOrchestration/) and [`renderCache`](../renderCache/) where they fit (**`api.ephemera`** ingress helpers, **`subscribedEvents`** / **`publishedEvents`**, **`EphemeraDataSource`** + **`subscribe()`**). Perception-specific fan-in will not map one-to-one to every orchestration or cache concern; use those trees as **reference implementations**, not a spec to force-fit.

### Imperative `perceptionMessage` baseline (v1)

Policy for the imperative handler in [`perception/index.ts`](../../perception/index.ts) (orthogonal to **`mtw.ephemera.perception`** fan-in, but affects what still hits the bus):

| Policy | Detail |
| --- | --- |
| **Message components** | **Message** component delivery was **removed** from **`perceptionMessage`**; that UX is intended to be **rebuilt** on the DataSource-oriented model rather than preserved in the imperative path. |
| **Knowledge and Map** | Branches are **disabled** in the handler via **`KNOWLEDGE_PERCEPTION_ENABLED`** and **`MAP_PERCEPTION_ENABLED`**. They are **not** migrated in v1; callers may still enqueue **`Perception`** for maps/knowledge until follow-on wiring. |

### Routing identity

- **Bucket key:** **`componentId` + `perspectiveKey`** only. A bucket may hold **multiple** thread rows (**`register`** appends; **`remove(registrationId)`** drops one).
- **`cacheId`:** **not** part of the match predicate for **`Render Pertains`** / **`Generation Started`**. Producers include **`cacheId`** on **`Render Pertains`** for **cache content and durability**; that does **not** require perception to **route** or **open** a thread by **`cacheId`**. **Matching** stays **`componentId` + `perspectiveKey`** (and registration). Perception may **persist** **`cacheId`** on the row (e.g. for dedupe or cache lifecycle alignment) --- separate from the match predicate. See [**Correlation vs routing**](../renderCache/AGENT.md#correlation-vs-routing) in **`mtw.ephemera.renderCache`**.
- **Logical completion:** Defining **same logical completion** for subscriber dedupe (pass-through **uncertainty 6**) may still use **`cacheId` + routing identity** without using **`cacheId`** as the **primary** bucket key.
- **Concurrency:** If two logical completions could **overlap** for the same **`(componentId, perspectiveKey)`**, policy may add a **generation epoch** or nonce at registration (**TBD**). The default is **not** to promote **`cacheId`** to the primary map key without revisiting that decision.
- **Terminal dedupe:** If **`status`** is already **`Terminal`**, further **relevant** orchestration/cache stream events are **`console.log`**'d and **ignored** (no second **`PublishMessage`**), including a **late** **`Generation Started`** that would only add a **Generating** placeholder. Perception does **not** argue whether **`Generation Started` "should"** have fired earlier. **`Orchestration Error`** / **`Generation Deferred`** use the **same terminal overwrite** behavior as success (**overwrite** prior **Generating** **`messageId`** when present), then **`remove`** where applicable.
- **Duplicate intermediates:** Multiple **`Generation Started`** (or similar in-flight signals) before **terminal** are an **acceptable intermediate** (pass-through **uncertainty 6**); **`singleFlight`** and orchestration docs constrain duplicate **generation** work. Subscriber-side **terminal** dedupe for **delivery** remains an **open** obligation (see table below).

### Correlated room description (policy)

- **No `Cache Updated`-only fan-in (v1):** Perception does **not** subscribe to fan-in driven **only** by **`Cache Updated`** for room description. Scenarios that would depend on **`Cache Updated`** alone stay **deferred**. A possible **future** end-of-invocation **sweep** of unfulfilled threads is **out of scope** until deliberately designed.
- **Room examine entry (v1):** The correlated **room description** path **registers** and **kicks** render from **`parse/executeAction`** only (room **`look`**). **`checkLocation`**, **`perceptionMessage`**, and other callers are **not** wired to that correlated path until a deliberate follow-on.
- **Bucket after terminal (room description):** After **terminal** delivery, the **room description** thread row **need not** retain the finished render (emit full description and drop the registration). **Other** thread kinds may later **retain** terminal material or combine with **separate** inputs; treat that as a **per-`threadKind`** choice when extending the model.
- **Placeholder copy:** **Generating** / **Error** **`PublishMessage`** for room description use the **same shape** as terminal full room: **`displayProtocol`**, **`metaData`**, **`displayMode: 'full'`**, and related fields, with **dirt-simple** body text; copy is **throwaway** until product polish.
- **No-slow path UX:** On cache **hit** paths (**`Current Cache Valid`** / **`Exact Match Found`** leading to **`Render Pertains`** without **`Generation Started`**), the user does **not** see a **Generating** placeholder---only the **terminal** description **`PublishMessage`**.

### Virtual lanes (Generating traffic)

The **main** cascade (**`executeAction`**, **`renderOrchestration`**, **`renderCache`**, perception **`receiveEvents`** for non-Generating work) stays on the **default** lane unless a slice opts in. **Generating** placeholder traffic uses a **`laneId`** allocated on the **slow path** in **`findRender`** at handoff into **`generateRoomPreview`**, threaded through **`publishOrchestration`** / bus **`send`** for **Generating**-scoped **StreamingEvent** traffic only, with **`flushOrchestrationLane`** so placeholders reach subscribers before long-running generation. **Owned detail:** [`AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus) (**Virtual lanes**), [`lambda/ephemera/messageBus/AGENT.md`](../../messageBus/AGENT.md).

### Aggregation placement and lifecycle

**`internalCache.PerceptionThreads`** ([`perceptionThreads.ts`](../../internalCache/perceptionThreads.ts)): in-memory only; wired to **`InternalCache.clear()`**; **no** **`flush()`** (not Dynamo-backed). See [`internalCache/AGENT.md`](../../internalCache/AGENT.md) (**PerceptionThreads**).

### Pass-through relationship

| Topic | Role |
| --- | --- |
| **`Render Pertains`**, **`Cache Updated`**, correlation vs broadcast | Defines what emitters publish; perception **interprets** those signals for **who** gets placeholders vs terminal vs cache-only refresh. |
| **Contract alignment** (phases in parent epics) | Encodes producer obligations; perception is the **consumer** that closes the client delivery loop. |
| **[`AGENT.passThrough.contract.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md)** | Draft contract; refine alongside implementation and [**Encoding the contract in unit tests**](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests). |

### Obligations accruing to future perception (working list)

Debt acknowledged while pass-through and types catch up. **Update this table** when upstream decisions land.

| Source | Obligation (draft) | Status |
| --- | --- | --- |
| Pass-through contract | Interpret **`Render Pertains`** (correlated) vs **`Cache Updated`** (abstract) for **different delivery audiences** (present for placeholder vs newly present). | TBD |
| Pipeline / orchestration | **`renderOrchestration`** moves lifecycle off **`conversation.sendMessage`** toward the **six outbound types**; perception must **not** assume conversation-backed correlation long-term. **`Generation Started`**, **`Orchestration Error`**, **`Generation Deferred`** consumer rules **TBD**. **Multiple** **`Generation Started`** for one logical job is an **acceptable intermediate** (pre-**`singleFlight`** / recovery); align with contract **uncertainty 6** and [`renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md#single-flight-generation) (**Single-flight generation**). | TBD |
| Pass-through **uncertainty 6** (subscriber idempotency) | Producers may emit **duplicate or retried** notifications; perception **owns** collapsing those into **delivery** semantics: **repeated intermediate** states are **fine**; do **not** surface **two terminal / final** deliveries for the **same** logical completion (same **`cacheId`** + routing identity, or agreed successor key). **Exact** dedupe strategy **TBD**. | TBD |
| Contract uncertainties | Fan-in must stay **single-path** for passive orchestration (no silent fork); aligns with pass-through and completion rubric **section 4**. | TBD |
| Epic / rubric | **Fan-in** assembler role: merge orchestration progress, cache events, presence into **`PublishMessage`** / timeline rules. | TBD |
| Current code | Preserve or migrate behavior documented in [`perception/AGENT.md`](../../perception/AGENT.md) (triggers, scale, navigation). | TBD |

**Uncertainty 6 (summary):** Orchestration + cache aim to avoid duplicate **generation** (**`singleFlight`**); **duplicate** **`Generation Started`** may still occur until idempotency hardens. Perception implements **terminal** dedupe for **delivery** as in [Routing identity](#routing-identity) above; the **full** subscriber collapse strategy for all products remains **TBD** (table row).

### Related documentation

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../taskPlanning/AGENT.md) | Task planning framework |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md`](../../AGENT.ephemeraPerceptionVertical.planning.md) | Parent epic |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | Phase order, pass-through, contract encoding in tests |
| [`AGENT.passThrough.contract.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md) | Pass-through / readiness draft (perception consumes) |
| [`lambda/ephemera/perception/AGENT.md`](../../perception/AGENT.md) | Imperative triggers, navigation, message shapes |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md`](../../AGENT.ephemeraPerceptionVertical.planning.completionRubric.md) | Rubric **section 3** (fan-in), **section 4** (ready to show) |
| [`messageBus/AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus) | **Virtual lanes** (`InternalMessageBus`) |

### Verification

Run from repository root unless noted.

| Scope | Command | When |
| --- | --- | --- |
| **Ephemera package (default)** | `cd lambda/ephemera && npm test` | After changes under `lambda/ephemera/`; full suite before merge when touching shared behavior |
| **Imperative perception** | `cd lambda/ephemera && npx jest perception/index.test.ts` | Iterating on [`perception/index.ts`](../../perception/index.ts) |
| **This DataSource** | `cd lambda/ephemera && npx jest dataSource/perception/` | Perception DataSource and unit tests |
| **Patterns package** | `cd packages/mtw-lambda-patterns && npm test` | After changing `InternalMessageBus` or DataSource base in `mtw-lambda-patterns` |

**Contract tests:** Per [`AGENT.passThrough.contract.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests), add placeholder or skipped tests early with reasons; activate as behavior lands.
