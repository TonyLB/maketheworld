# mtw.ephemera.perception

**Status:** Bus-only, non-replayable `EphemeraDataSource`. Subscribes to **`api.ephemera`** ingress **`Character Perception Requested`** and **`Perception Thread Registered`**, to **`mtw.ephemera.renderCache`** **`Render Pertains`** plus selected **`mtw.ephemera.renderOrchestration`** outbounds (**`Generation Started`**, **`Orchestration Error`**, **`Generation Deferred`**) for **room description**, **room header broadcast**, **`characterMove`**, **`featureDescription`**, and **`knowledgeDescription`** render correlation, to **`mtw.ephemera.affordanceCache`** **`Affordances Pertain`** for affordance-channel terminal publish, (membership presentation fan-in) to **`mtw.ephemera.actions`** **`Character Navigate`** / **`Character Home`**, **`mtw.connections.characters`** **`Character Connected`** / **`Character Disconnected`**, and **`mtw.ephemera.positions`** **`Character Moved`**, and (object manipulation presentation fan-in) to **`mtw.ephemera.actions`** **`Object Take Hold`** / **`Object Drop`** / **`Object Establish Relation`** / **`Object Dissolve Relation`** and **`mtw.ephemera.positions`** **`Object Moved`** / **`Object Relation Changed`** (see [`subscribedEvents.ts`](subscribedEvents.ts), [`membershipPresentationLegAdapters.ts`](membershipPresentationLegAdapters.ts), [`objectManipulationPresentationLegAdapters.ts`](objectManipulationPresentationLegAdapters.ts)). Character path: **`streamKey`** = viewed character id (`CHARACTER#...`); thread registration: **`streamKey`** = **`componentId`**. `receiveEvents` routes membership and object-manipulation legs through module-scoped **`FanInClusterStore`** instances ([`index.ts`](index.ts)); non-fan-in envelopes use existing handlers: Character via `Meta::Character` and **`PublishMessage`** (`characterPerception.ts`); thread registration calls **`internalCache.PerceptionThreads.register(cmd)`** with a **`threadKind`**-discriminated **`PerceptionThreadRegisterCommand`** (initial thread body derived inside **`register`**; multiple rows may share the same **`componentId` + `perspectiveKey`**); render stream payloads are handled in [`orchestrate.ts`](orchestrate.ts) (**`PublishMessage`**, correlated **`messageId`**, **`metaData.roomChannel: 'render'`** for room threads; **`metaData.componentUUID`** only for Feature/Knowledge); **`Affordances Pertain`** is handled in [`handleAffordancesPertain.ts`](handleAffordancesPertain.ts) (**`AffordanceRoomDeliverable.get`**, **`metaData.roomChannel: 'affordances'`**, one new **`messageId`** per occupant). Roster/objects triggers route through **`mtw.ephemera.affordanceOrchestration`** -> **`affordanceCache`**. No outbound `mtw.ephemera.perception` stream events yet.

**Bus delivery:** All perception **`PublishMessage`** producers use **`messageBus.publish`**; lambda boundary **`flushAndSettle`** quiesces the invocation. Membership fan-in leave/arrive **`WorldMessage`** rows and move header **`PerceptionMessage`** set **`deliveryMode: 'deferred'`** (move-only coalescer). **Render-correlated** threads (**`roomDescription`**, **`roomHeaderBroadcast`**, **`sessionOrientationRender`**, **`characterMove`**, **`featureDescription`**, **`knowledgeDescription`**) use **immediate** wire with explicit **`createdTime`**: **`T0`** on Generating (stored on **`PerceptionThreads`** row), terminal **`max(T0 + 1, now)`** with same **`messageId`**. Ingress helpers **`sendCharacterPerceptionRequested`** / **`sendPerceptionThreadRegistered`** publish **`StreamingEvent`** on the bus. COMP-KICK (**`kickRoomHeaderBroadcastForRoom`**) publishes thread registration + render kicks.

**Render targeting registry:** In-memory state on **`internalCache.PerceptionThreads`** ([`perceptionThreads.ts`](../../internalCache/perceptionThreads.ts): **`register`** appends a row per composite key, **`list`** / **`update`** / **`remove(registrationId)`**, synthetic **`registrationId`** when omitted; no cross-thread dedupe; [`InternalCache.clear()`](../../internalCache/index.ts) only, no **`flush()`**). **`threadKind`** includes **`roomDescription`**, **`roomHeaderBroadcast`**, **`sessionOrientationRender`**, **`sessionOrientationAffordances`**, **`characterMove`**, **`featureDescription`**, and **`knowledgeDescription`** (same **`componentId` + `perspectiveKey`** bucket; separate rows). Correlated render flows (room examine, room header refresh, character move header, **feature/knowledge description fan-in**, **link API / feature and knowledge `look`**) are **shipped** at the handler layer. **Which entry points use correlated render versus imperative [`perceptionMessage`](../../perception/index.ts)** is documented in [Delivery paths (correlated vs imperative)](#delivery-paths-correlated-vs-imperative). See [Render targeting registry (PerceptionThreads)](#render-targeting-registry-perceptionthreads) for per-`threadKind` fields. **Policy**, **normative decisions**, and **obligations** are in [Normative decisions and obligations](#normative-decisions-and-obligations). **`characterMove`** rows are **targeting-only** for mover header render: **`targets`**, **`componentId`**, **`perspectiveKey`**, **`characterId`**, optional **`messageGroupId`**, optional pre-assigned **`messageId`**, optional Model A **`createdTime`** on the thread body.

**Membership presentation fan-in (Phase 1 shipped for navigate + disconnect + connect; F2-2 shipped slice 1d; Phase 2 shipped; Phase 3+ PerceptionThreads slim shipped):** Move **emission policy** (intent + fact -> leave/arrive shape + copy) runs on generic **`FanInClusterStore`** + **`MembershipPresentationFanInCluster`** on this DataSource --- **separate** from **`PerceptionThreads`** (see [Render targeting registry](#render-targeting-registry-perceptionthreads)). **Cluster spec:** [`membershipPresentationFanIn.ts`](membershipPresentationFanIn.ts). **Ingress adapters:** [`membershipPresentationLegAdapters.ts`](membershipPresentationLegAdapters.ts) (`toMembershipPresentationLeg`, envelope guards); extended [`subscribedEvents.ts`](subscribedEvents.ts). **Store wiring:** module-scoped **`FanInClusterStore`** on [`index.ts`](index.ts) with deferral tag **`fanIn-mtw.ephemera.perception`**; **`receiveEvents`** routes membership legs via **`toMembershipPresentationLeg`** (sequential batch loop). **Publish:** [`publishMembershipPresentation.ts`](publishMembershipPresentation.ts) emits leave/arrive **`WorldMessage`** rows with Model A **`createdTime`** from fact **`beatAnchorTime`**; **multi-leave** when fact **`froms[]`** has multiple entries (exit-aware only when intent **`fromRoomId`** matches that entry). **Exit-aware copy (F1-9):** when navigate intent carries **`exitName`**, **`buildMembershipEmissionPlan`** sets **`copyKind: 'exitAware'`** (trust parse; no fact **`legalExits`** gate in slice 1). **Fact** leg: **`Character Moved`** on **`mtw.ephemera.positions`** with **`froms[]`** + **`to`** (positions slice **1d**); **intent** legs: **`mtw.ephemera.actions`** (**`Character Navigate`**, **`Character Home`**) + **`mtw.connections.characters`**. **`MembershipEndpoint`:** singular **`to`** only; `null` = out of play. Fact leg uses **`froms: EphemeraRoomId[]`** (`[]` = out of play; **F2-2** / **F1-7**). **Render-blind:** membership fan-in does not correlate **`Render Pertains`** or render errors --- leave/arrive emission does not wait on header render outcomes. Framework pattern: [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md#fan-in-cluster-pattern-multi-leg-ingress-correlation).

**Object manipulation presentation fan-in (Phase 5 shipped --- v1 `takeHold` + `drop`; Phase B shipped --- `establishRelation` + `dissolveRelation`; carried-set narration shipped 2026-07-15, Pipeline A -> B migration Slice 4):** Pick-up, drop, and relational attach **transcripts** (intent + fact -> single **`WorldMessage`**) run on a **separate** **`FanInClusterStore`** + membership and relational **`FanInCluster`** implementations --- parallel to membership presentation fan-in, not mixed into **`MembershipPresentationFanInCluster`**. **Cluster spec:** [`objectManipulationPresentationFanIn.ts`](objectManipulationPresentationFanIn.ts). **Ingress adapters:** [`objectManipulationPresentationLegAdapters.ts`](objectManipulationPresentationLegAdapters.ts) (`toObjectManipulationPresentationLeg`, returns an **array** of legs per envelope); membership intent **`Object Take Hold`** / **`Object Drop`** + fact **`Object Moved`**; relational intent **`Object Establish Relation`** / **`Object Dissolve Relation`** + fact **`Object Relation Changed`**. **Correlation (membership):** actor **`characterId`** + grounded **`objectId`** + fact **`beatAnchorTime`**; intent legs carry **`operation: 'takeHold' | 'drop'`** plus **`objectIds`** (the full carry-closed transfer set, BD-13). **Membership carry fan-out:** the adapter emits **one intent leg per object** in the set (each with its own `objectId` but the shared `objectIds`), so every object in the set still gets matched against its own `Object Moved` fact leg by the unchanged per-`(characterId, objectId)` cluster mechanism --- but `buildObjectManipulationEmissionPlan` returns `null` (no publish) for any cluster whose `objectId` isn't `objectIds[0]` (the primary) when the set has more than one member, so exactly one `WorldMessage` fires per command regardless of carry size. **Correlation (relational):** actor **`characterId`** + **`subjectId`** + **`targetId`** + fact **`beatAnchorTime`**; intent legs carry **`operation: 'establishRelation' | 'dissolveRelation'`**. **Endpoint checks (membership):** **`takeHold`** --- intent **`roomId`** in fact **`froms`**, fact **`to`** = intent **`characterId`**; **`drop`** --- intent **`characterId`** in fact **`froms`**, fact **`to`** = intent **`roomId`**. **Endpoint checks (relational):** intent **`subjectId`**, **`targetId`**, **`roomId`**, **`relationKind`** (+ **`relationLabel`** when **`Custom`**) must match fact; **`establishRelation`** <-> fact **`establish`**, **`dissolveRelation`** <-> fact **`dissolve`**. Relational fan-in **requires** actions intent (no fact-only deferral). **Publish:** [`publishObjectManipulationPresentation.ts`](publishObjectManipulationPresentation.ts) --- deterministic templates: membership **`${Player} picks up ${Object}`** / **`${Player} drops ${Object}`**, each with a conditional **`" and everything on it"`** suffix (`ObjectManipulationEmissionPlan.carriedObjectCount > 1`) for a carry; relational **`${Player} puts ${Subject} on ${Target}`** (enum variants for **`Under`**, **`Against`**, **`Custom`** label); dissolve **`${Player} takes ${Subject} off ${Target}`** (no copy LLM); **`createdTime`** = fact **`beatAnchorTime`** exactly (Model A, no leave/arrive epsilon); targets source **`roomId`** + actor **`characterId`**; **`deliveryMode: 'deferred'`**. **Labels at emit:** [`resolveTakeHoldPresentationLabels.ts`](resolveTakeHoldPresentationLabels.ts) (membership, primary object only); [`resolveRelationalPresentationLabels.ts`](resolveRelationalPresentationLabels.ts) (relational) via **`CharacterMeta`** + merged **`ComponentAggregate`**. **Unknowns (D12):** withhold unstated spatial detail --- template only, fallbacks **`Someone`** / **`something`**. **Deferral (membership only):** fact-only settle derives actor/room from fact endpoints when intent absent, treated as `carriedObjectCount: 1` (the full set is only known from an intent leg; this is an existing, unrelated edge case for a lost intent, not something the carry fix needed to close). Shares deferral tag **`fanIn-mtw.ephemera.perception`** with membership store ([`index.ts`](index.ts)).

### Adding manipulation transcript operators

When adding a new atomic **`operationKind`** with transcript copy (e.g. relational attach):

1. Extend [`objectManipulationPresentationLegAdapters.ts`](objectManipulationPresentationLegAdapters.ts) --- intent + fact leg guards and correlation keys.
2. Extend [`objectManipulationPresentationFanIn.ts`](objectManipulationPresentationFanIn.ts) --- cluster endpoint checks (mirror **`takeHold`**: intent source/dest hosts must match fact **`froms` / `to`**).
3. Add publish helper or branch in [`publishObjectManipulationPresentation.ts`](publishObjectManipulationPresentation.ts) --- deterministic template per operator (no copy LLM); **`createdTime`** = fact **`beatAnchorTime`**.
4. Register new intent/fact envelope types in [`subscribedEvents.ts`](subscribedEvents.ts) and route in [`index.ts`](index.ts) **`FanInClusterStore`** loop.

Reference vertical: **`takeHold`** files above. Operator fiction: [`../../diegeticLogic/AGENT.operators.concepts.md`](../../diegeticLogic/AGENT.operators.concepts.md).

**Entry kicks:** UI room look via **`routeTrustedUiAction`** -> **`Action Assessed`** -> **`Look Command Requested`**, [`kickRoomHeaderBroadcast.ts`](kickRoomHeaderBroadcast.ts) / [`dataSource/index.ts`](../index.ts) / imperative [`perceptionMessage`](../../perception/index.ts) pair **`sendPerceptionThreadRegistered`** with passive **`Render Requested`** (**`targets`**) through **`renderOrchestration`**. **[`orchestrateCharacterNavigate`](../positions/navigate/orchestrateNavigate.ts)** registers a targeting-only **`characterMove`** **`PerceptionThreads`** row when the arrival room has a **non-empty** **`perspectiveKey`**, then kicks passive render for the mover. Leave/arrive world lines are **not** pre-baked on that row --- membership fan-in owns them. Affordance refresh ("who is here?") is a **separate** kick via **`RoomUpdate`** from [`applyCharacterRoomMembership`](../positions/membership/applyCharacterRoomMembership.ts) (not **`characterMove`** lifecycle).

**Development notes:** Steady-state **delivery map**: [Delivery paths (correlated vs imperative)](#delivery-paths-correlated-vs-imperative). Imperative [`perceptionMessage`](../../perception/index.ts) also uses **`messageBus.publish`** (ReturnValue tail included). **Follow-on design** (particularizing registration): [`AGENT.development.md`](AGENT.development.md) (test commands there too).

**Related:** Imperative [`perceptionMessage`](../../perception/index.ts) bridges the Character branch through `sendCharacterPerceptionRequested` into this DataSource. Character-voice speech (**`SayMessage`** / **`NarrateMessage`** / **`OOCMessage`**) is **not** perception fan-in; see [`../narration/AGENT.md`](../narration/AGENT.md).

## Multi-channel room UI (render vs affordances)

Normative contract: [`AGENT.multiChannel.contract.md`](../../AGENT.multiChannel.contract.md) (**Navigation intent and user journeys (agreed)** for coupling vs navigation intent). Narrative transcript: [`AGENT.narrativeTranscript.concepts.md`](../../AGENT.narrativeTranscript.concepts.md).

**Room-render** and **room-affordances** share **`DisplayProtocol: 'PerceptionMessage'`** and discriminate with **`metaData.roomChannel`** on **`PerceptionRoomMetaData`** (`@tonylb/mtw-interfaces`). **Correlated** render (**Generating** / terminal overwrite on the same **`messageId`**) applies to the **render** channel only; **room-affordances** **`PublishMessage`** rows sit **outside** that replace pipeline.

**Journeys:** No planned journey requires strict cross-channel pairing; navigation **intends** both channels when practical. First-arrival staging (affordances before render) is a **client** composition concern by default, not server withholding of affordances.

**Phase B (server, shipped):** Correlated render **`PublishMessage`** rows set **`metaData.roomChannel: 'render'`**. **Affordance ingress (M4, shipped):** internal bus **`type: 'RoomUpdate'`**, **`mtw.ephemera.objects` `Objects Changed`**, and **`mtw.assets.componentTopology` `TopologyInvalidated`** (via orchestration fan-out) enqueue **`mtw.ephemera.affordanceOrchestration`** -> **`affordanceCache`** -> **`Affordances Pertain`** -> [`handleAffordancesPertain`](handleAffordancesPertain.ts). Wire **`displayProtocol: 'RoomUpdate'`** is **retired**. Render vs affordance WML **de-dupe** on the server is **deferred** per contract. See [`AGENT.multiChannel.contract.md`](../../AGENT.multiChannel.contract.md) **Phase B server migration (agreed)** and **De-duplication (norm vs Phase B)**.

**Phase C (client, shipped):** Sticky **`RoomHeader`** shell (**`VirtualMessageList`** + **`RoomDescription`** **`header`**), **`RoomUpdate`** never visible and unused for the header path (no storage purge mandate), full **`StandardForm.merge`** (**render** base, **affordances** incoming), **Contents:** only when objects exist, affordance **withholding** until render catch-up or **10 s** timeout, and related UX norms are **agreed** in [`AGENT.multiChannel.contract.md`](../../AGENT.multiChannel.contract.md) **Phase C client composition (agreed)**. Implementation lives in **charcoal-client** (selectors, **`VirtualMessageList`** / **`RoomDescription`**).

**Render Pertains (terminal, render channel):** In [`orchestrate.ts`](orchestrate.ts) **`handleRenderPertains`** for room threads, terminal **`PublishMessage`** rows with **`metaData.roomChannel: 'render'`** use [`roomRenderWmlFromCacheRecord.ts`](roomRenderWmlFromCacheRecord.ts): **`wmlContent`** is built from **`payload.cacheRecord.renderedContent`** (prose **`<Render>`** mirror). For **`featureDescription`** / **`knowledgeDescription`**, **`handleFeatureKnowledgeRenderPertains`** builds terminal WML via [`featureKnowledgeRenderWmlFromCacheRecord.ts`](featureKnowledgeRenderWmlFromCacheRecord.ts) from **`cacheRecord.renderedContent`** with **`metaData.componentUUID`** only (no **`roomChannel`**). Imperative [`perceptionMessage`](../../perception/index.ts) **`PerceptionRoomMessage`** uses the same room shape: **`internalCache.RenderCache.get`**, then [`roomRenderChannelWmlForRoomId`](roomRenderWmlFromCacheRecord.ts) (first row, or empty prose when no cache rows).

**Structural room WML (affordances):** Merged room **`StandardForm`** without **`RenderCache`**, **`Examples`**, or **`StandardRoomData.render`** (exits, characters present, merged **shortName**, graph-placed **`StandardRoom.objects`** from improvisation merge, etc.) comes from **`internalCache.AffordanceRoomDeliverable`** ([`affordanceRoomDeliverable.ts`](../../internalCache/affordanceRoomDeliverable.ts)). Steady-state documentation: [`internalCache/AGENT.md`](../../internalCache/AGENT.md) (**Affordance room deliverable**). **WML composition (affordance channel):** one **`AffordanceRoomDeliverable.get(roomId, perspectiveKey)`** per **`Affordances Pertain`** event (perspective-scoped body, **`ephemeraWire`**); see [Server publish sites (multi-channel)](#server-publish-sites-multi-channel) above.

**Coupled thread template:** Optional **hypothetical** paired delivery remains **deferred**; there is **no** normative **PerceptionThread** state machine for multi-channel in v1 unless product requests one; see **Coupled PerceptionThread template (deferral)** and **Coupled delivery (optional pattern)** in the contract.

### Server publish sites (multi-channel)

Steady-state map of **where** room-scale **`PerceptionMessage`** **`PublishMessage`** rows are produced and how **`metaData.roomChannel`** is set.

| Site | `roomChannel` | Notes |
| --- | --- | --- |
| [`publishMessage/index.ts`](../../publishMessage/index.ts) | Caller-supplied | Resolves **`ROOM#...`** (and exclusions) to **`CHARACTER#...`** via **`getRoomCharacterList`**, then to connections. Does **not** inject **`roomChannel`**; room **`PerceptionMessage`** payloads from perception paths carry **`metaData.roomChannel`**. Affordance producers should pass an explicit new **`messageId`** per row (**`MESSAGE#${uuid}`**). |
| [`perception/index.ts`](../../perception/index.ts) **`perceptionMessage`** | **`'render'`** | **`PerceptionRoomMessage`**: **`RenderCache.get`** + **`roomRenderChannelWmlForRoomId`**, one **`PublishMessage`** per target (prose only; no stack merge on this channel). **`sendRoomGeneratingHeader`**: one multi-target **`PublishMessage`**. **`PerceptionAssetMessage`**: **`kickRoomHeaderBroadcastForRoom`** (DataSource kick), not direct room WML in this handler. |
| [`index.ts`](index.ts) **`receiveEvents`** | | Membership legs -> [`membershipPresentationFanIn.ts`](membershipPresentationFanIn.ts) **`FanInClusterStore`**; object manipulation legs -> [`objectManipulationPresentationFanIn.ts`](objectManipulationPresentationFanIn.ts) **`FanInClusterStore`**. **`Character Perception Requested`** -> [`characterPerception.ts`](characterPerception.ts). **`Perception Thread Registered`** -> **`PerceptionThreads.register`**. **`Affordances Pertain`** -> [`handleAffordancesPertain`](handleAffordancesPertain.ts). Render-cache / orchestration payloads -> [`orchestrateRoomDescriptionStreams`](orchestrate.ts). |
| [`publishObjectManipulationPresentation.ts`](publishObjectManipulationPresentation.ts) | --- | **`WorldMessage`** pick-up / drop transcripts (**`displayProtocol: 'WorldMessage'`** only; no **`roomChannel`**). Single line per successful **`takeHold`** or **`drop`**; **`createdTime`** = fact **`beatAnchorTime`**. |
| [`orchestrate.ts`](orchestrate.ts) | **`'render'`** (room threads) / none (F/K) | **`handleRenderPertains`**: terminal **`wmlContent`** from [`roomRenderWmlFromCacheRecord`](roomRenderWmlFromCacheRecord.ts) --- one shared string per event for **`roomDescription`**, **`roomHeaderBroadcast`**, **`sessionOrientationRender`**, and **`characterMove`** headers (cache-backed prose). **`handleFeatureKnowledgeRenderPertains`**: terminal from [`featureKnowledgeRenderWmlFromCacheRecord`](featureKnowledgeRenderWmlFromCacheRecord.ts) for **`featureDescription`** / **`knowledgeDescription`** (**`metaData.componentUUID`** only). **`handleGenerationStarted`** / **`handleOrchestrationErrorOrDeferred`**: room header placeholders via **`roomHeaderGeneratingPlaceholderWml`** / **`roomHeaderErrorPlaceholderWml`**; full-room placeholders via **`placeholderRoomFullWml`**; F/K placeholders via **`placeholderFeatureKnowledgeFullWml`** (component-shaped **`<Render>`**). |
| [`handleAffordancesPertain.ts`](handleAffordancesPertain.ts) | **`'affordances'`** | Terminal on **`Affordances Pertain`**: **`sessionOrientationAffordances`** thread lookup first (**`publishAffordancePerceptionForPerspective`**, **`registration.targets`** e.g. **`CHARACTER#...`**); **fallback** when no affordance thread: perspective-filtered occupants via **`getCharacterRoomPerspectiveKey`**; **one compose** via **`AffordanceRoomDeliverable.get(roomId, perspectiveKey)`**, then **one `PublishMessage` per delivery** (**`targets: [characterId]`** or **`SESSION#...`** for session-only paths); new **`MESSAGE#${uuid}`** per row. Uncoupled from render threads (**D38**). |
| [`roomUpdate/index.ts`](../../roomUpdate/index.ts) | --- | Internal bus **`type: 'RoomUpdate'`** enqueues **`Affordances Requested`** via [`sendAffordanceRefreshRequestedForRoom`](../affordanceOrchestration/sendAffordanceRefreshRequestedForRoom.ts) (reason: **`roster`**); wire **`displayProtocol: 'RoomUpdate'`** is **retired**. |

**Uncoupled signals:** **`mtw.ephemera.state` `State Changed`** drives **render** / passive-render fan-out only --- it does **not** emit affordance-channel **`PerceptionMessage`** rows. **`RoomUpdate`**, **`mtw.ephemera.objects` `Objects Changed`**, and **`TopologyInvalidated`** (orchestration fan-out, reason: **`topology`**) enqueue **`mtw.ephemera.affordanceOrchestration`**; terminal affordance **`PublishMessage`** follows **`Affordances Pertain`** ([`handleAffordancesPertain.ts`](handleAffordancesPertain.ts)).

**Open follow-ups (server, multi-channel):** **Coupled** render+affordance **PerceptionThread** pairing stays **deferred** unless product requests it (contract **Coupled delivery**).

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
| **Room `look` (room id)** | [`routeTrustedUiAction`](../routeTrustedUiAction.ts) -> **`sendActionAssessed`** **`LookComponent`** -> **`Look Command Requested`** -> render orchestration | **`threadKind`:** **`roomDescription`**. Does **not** use imperative **`Perception`** for the **full** room description. |
| **Room `look` (event-driven)** | [`handleLookCommandRequestedForRenderOrchestration.ts`](../renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts) | Same **`roomDescription`** thread; **direct** **`internalCache.PerceptionThreads.register`** then **`orchestrateRenderRequest`** (aligns with navigate register-first pattern). |
| **Feature / Knowledge look (UI + link)** | [`routeTrustedUiAction`](../routeTrustedUiAction.ts) or [`app.ts`](../../app.ts) -> **`sendActionAssessed`** **`LookComponent`** -> **`Look Command Requested`** -> [`handleLookCommandRequestedForRenderOrchestration.ts`](../renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts) | **`threadKind`:** **`featureDescription`** / **`knowledgeDescription`**. Knowledge **`directResponse`** targets session on terminal delivery. |
| **Room header refresh (asset `Component Updated`)** | [`dataSource/index.ts`](../index.ts) **`processComponentUpdated`** [`kickRoomHeaderBroadcastForRoom`](kickRoomHeaderBroadcast.ts) | **`threadKind`:** **`roomHeaderBroadcast`**, grouped by **`perspectiveKey`**. |
| **Room headers after asset change (`PerceptionAssetMessage`)** | [`perceptionMessage`](../../perception/index.ts) handles the bus message and calls **`kickRoomHeaderBroadcastForRoom`** per linked room | Same correlated header pipeline as the row above; the imperative handler is only the **entry** that kicks registration + render. |
| **Move, arrival-room header** | [`orchestrateCharacterNavigate`](../positions/navigate/orchestrateNavigate.ts) when the arrival room has a **non-empty** **`perspectiveKey`** | **`threadKind`:** **`characterMove`** (targeting-only). Generating/terminal header **`PerceptionMessage`** to mover via [`orchestrate.ts`](orchestrate.ts). |
| **Move, leave/arrive world lines** | **`mtw.ephemera.positions`** **`Character Moved`** fact + intent streams (navigate, home, connect, disconnect) | **Membership presentation fan-in** ([`membershipPresentationFanIn.ts`](membershipPresentationFanIn.ts), [`publishMembershipPresentation.ts`](publishMembershipPresentation.ts)). **Render-blind** --- does not wait on header render. |
| **Move, affordance refresh** | **`RoomUpdate`** from [`applyCharacterRoomMembership`](../positions/membership/applyCharacterRoomMembership.ts) when membership **`changed`** | Roster/exits refresh for all occupants in affected rooms --- **separate** from mover header (**F3-2**). |
| **Session orientation (Character Registered)** | [`handleCharacterRegisteredOrientation`](../connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts) (render + affordance orchestration ingress) | **`threadKind`:** **`sessionOrientationRender`** + **`sessionOrientationAffordances`**, **`targets: [characterId]`**. Render fan-in in [`orchestrate.ts`](orchestrate.ts); affordance terminal in [`handleAffordancesPertain.ts`](handleAffordancesPertain.ts) resolves **`sessionOrientationAffordances`** rows **before** roster fallback (`resolveAffordanceTargetsForPerspective`). Render uses correlated **`messageId`** (Generating + terminal); affordance uses a fresh **`messageId`** per terminal row (uncoupled channel). |

**Thread registration principle:** capture delivery intent once at registration; orchestration and cache outbounds carry **`roomId` / `componentId` + `perspectiveKey` only**. Terminal handlers look up the **`(roomId, perspectiveKey)`** bucket and read **`registration.targets`** (or **`registration.characterId`** for single-viewer **`roomDescription`**).

### Post-move presentation (F3-2)

After membership persist, **three decoupled** presentation legs may run when **`changed`**:

| Concern | Audience | Mechanism |
| --- | --- | --- |
| **Leave/arrive world lines** | Roster / room occupants per fan-in shape | **Membership presentation fan-in** on **`Character Moved`** + intent streams |
| **Mover arrival header (render)** | **`characterMove`** **`targets`** (mover only) | Slim **`characterMove`** PerceptionThread + passive render; [`orchestrate.ts`](orchestrate.ts) Generating/terminal |
| **Affordance refresh** ("who is here?", exits) | All occupants in affected rooms | **`RoomUpdate`** from [`applyCharacterRoomMembership`](../positions/membership/applyCharacterRoomMembership.ts) -> affordance orchestration |

**Deferred:** generalizing affordance refresh to a positions **`Object Moved`** (or similar) stream consumer --- out of scope until richer move facts justify it (**F3-2**).

### Render targeting registry (PerceptionThreads)

**Not** the membership **`FanInClusterStore`**. **`PerceptionThreads`** captures **who** gets async render delivery and correlates **`Render Pertains`** / orchestration lifecycle to **`(componentId, perspectiveKey)`** buckets.

| `threadKind` | Register captures | Thread body (correlate) | Handler |
| --- | --- | --- | --- |
| **`roomDescription`** | **`characterId`** (single viewer), routing | Generating/Terminal + **`messageId`**, optional **`createdTime`** | [`orchestrate.ts`](orchestrate.ts) |
| **`roomHeaderBroadcast`** | **`targets`**, routing | same | [`orchestrate.ts`](orchestrate.ts) |
| **`sessionOrientationRender`** | **`targets`**, routing | same | [`orchestrate.ts`](orchestrate.ts) |
| **`characterMove`** | **`targets`**, **`characterId`**, routing, optional pre-assigned **`messageId`** | same | [`orchestrate.ts`](orchestrate.ts) |
| **`sessionOrientationAffordances`** | **`targets`**, routing | Terminal only (no Generating pipeline) | [`handleAffordancesPertain.ts`](handleAffordancesPertain.ts) |
| **`featureDescription`** | **`characterId`** (single viewer), routing | Generating/Terminal + **`messageId`**, optional **`createdTime`** | [`orchestrate.ts`](orchestrate.ts) |
| **`knowledgeDescription`** | **`characterId`**, routing, optional **`directResponse`** (session targeting) | same | [`orchestrate.ts`](orchestrate.ts) |

**`registrationId`** is the stable row key within an invocation for orchestrate match. Optional render-kick **`requestId`** deferred (**F3-2** evaluated; existing **`registrationId`** sufficient while render orchestration correlates on routing identity only).

### Imperative delivery (`perceptionMessage`)

These paths **enqueue** **`type: 'Perception'`** for [`perceptionMessage`](../../perception/index.ts) without the correlated room fan-in above (until a deliberate follow-on wires them).

| Source | Reference |
| --- | --- |
| **`repairCharacterLegalPlacement`** (`forceRender`) | [`positions/membership/repairCharacterLegalPlacement.ts`](../positions/membership/repairCharacterLegalPlacement.ts) (no bus adapter; future asset-visibility ingress) |
| **Link API (character)** | [`app.ts`](../../app.ts) |
| **Map subscription** success path | [`mapSubscription/index.ts`](../../mapSubscription/index.ts) |
| **Navigate header fallback** | When there is **no** **`characterMove`** registration (empty arrival-room **`perspectiveKey`**) and passive render did not kick, header refresh uses imperative **`Perception`** with **`header: true`** ([`orchestrateNavigate.ts`](../positions/navigate/orchestrateNavigate.ts)). Same-room connect/reconnect does **not** use this path; session RoomHeader bootstrap is owned by **`Character Registered`** orientation. |

**Other room `Perception` payloads:** Any **`PerceptionRoomMessage`** that still reaches **`perceptionMessage`** uses **`RenderCache.get`**, **`roomRenderChannelWmlForRoomId`**, and **`PublishMessage`** with **`roomChannel: 'render'`** (prose from cache, first row; no structural merge on this channel). Room **`look`** (trusted UI and typed **`LookRoom`**) uses the correlated room description path via Action Assessed or **`Look Command Requested`**; see [Correlated room description (policy)](#correlated-room-description-policy).

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
| **Knowledge and Map** | **Knowledge:** correlated delivery is **shipped** via **`featureDescription`** / **`knowledgeDescription`** fan-in; imperative F/K branches **removed** from **`perceptionMessage`**. **Map:** server runtime **retired**; imperative **`Perception`** for **`MAP#`** is a no-op (see [`../maps/AGENT.md`](../maps/AGENT.md)). |

### Routing identity

- **Bucket key:** **`componentId` + `perspectiveKey`** only. A bucket may hold **multiple** thread rows (**`register`** appends; **`remove(registrationId)`** drops one).
- **`cacheId`:** **not** part of the match predicate for **`Render Pertains`** / **`Generation Started`**. Producers include **`cacheId`** on **`Render Pertains`** for **cache content and durability**; that does **not** require perception to **route** or **open** a thread by **`cacheId`**. **Matching** stays **`componentId` + `perspectiveKey`** (and registration). Perception may **persist** **`cacheId`** on the row (e.g. for dedupe or cache lifecycle alignment) --- separate from the match predicate. See [**Correlation vs routing**](../renderCache/AGENT.md#correlation-vs-routing) in **`mtw.ephemera.renderCache`**.
- **Logical completion:** Defining **same logical completion** for subscriber dedupe (pass-through **uncertainty 6**) may still use **`cacheId` + routing identity** without using **`cacheId`** as the **primary** bucket key.
- **Concurrency:** If two logical completions could **overlap** for the same **`(componentId, perspectiveKey)`**, policy may add a **generation epoch** or nonce at registration (**TBD**). The default is **not** to promote **`cacheId`** to the primary map key without revisiting that decision.
- **Terminal dedupe:** If **`status`** is already **`Terminal`**, further **relevant** orchestration/cache stream events are **`console.log`**'d and **ignored** (no second **`PublishMessage`**), including a **late** **`Generation Started`** that would only add a **Generating** placeholder. Perception does **not** argue whether **`Generation Started` "should"** have fired earlier. **`Orchestration Error`** / **`Generation Deferred`** use the **same terminal overwrite** behavior as success (**overwrite** prior **Generating** **`messageId`** when present), then **`remove`** where applicable.
- **Duplicate intermediates:** Multiple **`Generation Started`** (or similar in-flight signals) before **terminal** are an **acceptable intermediate** (pass-through **uncertainty 6**); **`singleFlight`** and orchestration docs constrain duplicate **generation** work. Subscriber-side **terminal** dedupe for **delivery** remains an **open** obligation (see table below).

### Correlated room description (policy)

- **No `Cache Updated`-only fan-in (v1):** Perception does **not** subscribe to fan-in driven **only** by **`Cache Updated`** for room description. Scenarios that would depend on **`Cache Updated`** alone stay **deferred**. A possible **future** end-of-invocation **sweep** of unfulfilled threads is **out of scope** until deliberately designed.
- **Room examine entry (v1):** Correlated **room description** registers from **`Action Assessed`** **`LookComponent`** (trusted UI room **`look`**, `source: uiLook`) or **`Parse Requested`** bare **`look` / `l`** -> **`LookRoom`** -> **`Look Command Requested`**, and from event-driven look in **`renderOrchestration`** (direct register). **`perceptionMessage`** and other callers are **not** wired to that correlated path until a deliberate follow-on.
- **Bucket after terminal (room description):** After **terminal** delivery, the **room description** thread row **need not** retain the finished render (emit full description and drop the registration). **Other** thread kinds may later **retain** terminal material or combine with **separate** inputs; treat that as a **per-`threadKind`** choice when extending the model.
- **Placeholder copy:** **Generating** / **Error** **`PublishMessage`** for room description use the **same shape** as terminal full room: **`displayProtocol`**, **`metaData`**, **`displayMode: 'full'`**, and related fields, with **dirt-simple** body text; copy is **throwaway** until product polish.
- **No-slow path UX:** On cache **hit** paths (**`Current Cache Valid`** / **`Exact Match Found`** leading to **`Render Pertains`** without **`Generation Started`**), the user does **not** see a **Generating** placeholder---only the **terminal** description **`PublishMessage`**.

### Correlated Feature / Knowledge description (policy)

F/K threads (**`featureDescription`**, **`knowledgeDescription`**) are **simpler** than room description: single viewer, no multi-target fallback, no header vs full split.

- **Ingress:** Trusted UI **`look`** (`source: uiLook`) and link API (`source: link`) for **`FEATURE#`** / **`KNOWLEDGE#`** use **`Action Assessed`** **`LookComponent`** -> **`Look Command Requested`** -> [`handleLookCommandRequestedForRenderOrchestration.ts`](../renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts). See [`../actions/AGENT.md`](../actions/AGENT.md#look-ingress).
- **Generating / Error / terminal:** Fan-in in [`orchestrate.ts`](orchestrate.ts) mirrors **`roomDescription`**: **`Generation Started`** -> Generating placeholder **`PublishMessage`** (same **`messageId`** overwrite where applicable); **`Orchestration Error`** / **`Generation Deferred`** -> Error placeholder; **`Render Pertains`** -> terminal WML from **`cacheRecord.renderedContent`** via [`featureKnowledgeRenderWmlFromCacheRecord.ts`](featureKnowledgeRenderWmlFromCacheRecord.ts).
- **Targeting:** **`[characterId]`** by default; Knowledge **`directResponse`** -> **`SESSION#...`** on terminal delivery when applicable.
- **`metaData`:** **`componentUUID`** only (no **`roomChannel`**).
- **Imperative retire:** **`perceptionMessage`** does **not** deliver Feature or Knowledge; legacy **`Perception`** payloads with F/K ids are no-ops. Perspective, mark state, and orchestration policy: [`../renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md#feature--knowledge-render-pipeline-shipped).

### Generating traffic and quiescence

**`Generation Started`** publishes concurrent with LLM work; boundary **`flushAndSettle`** quiesces the invocation (publish/settle steady state). See [`lambda/ephemera/messageBus/AGENT.md`](../../messageBus/AGENT.md) and [`messageBus/AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md).

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
| [`messageBus/AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md) | **Publish/settle** (`InternalMessageBus`) |

### Verification

Run from repository root unless noted.

| Scope | Command | When |
| --- | --- | --- |
| **Ephemera package (default)** | `cd lambda/ephemera && npm test` | After changes under `lambda/ephemera/`; full suite before merge when touching shared behavior |
| **Imperative perception** | `cd lambda/ephemera && npx jest perception/index.test.ts` | Iterating on [`perception/index.ts`](../../perception/index.ts) |
| **This DataSource** | `cd lambda/ephemera && npx jest dataSource/perception/` | Perception DataSource and unit tests |
| **Feature / Knowledge fan-in** | `cd lambda/ephemera && npx jest dataSource/perception/orchestrate.featureKnowledgeStreams.test.ts` | F/K correlated delivery (Generating, terminal, Error) |
| **F/K ingress + orchestration** | `cd lambda/ephemera && npx jest dataSource/actions/index.test.ts dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.test.ts dataSource/routeTrustedUiAction.test.ts app.test.ts` | Action Assessed / Look Command Requested / link API |
| **Session orientation (cross-layer)** | `cd lambda/ephemera && npx jest dataSource/characterRegisteredOrientation.integration.test.ts` | `sessionOrientationRender` + `sessionOrientationAffordances` terminal fan-in from `Character Registered` through orchestration and cache |
| **Patterns package** | `cd packages/mtw-lambda-patterns && npm test` | After changing `InternalMessageBus` or DataSource base in `mtw-lambda-patterns` |

**Contract tests:** Per [`AGENT.passThrough.contract.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests), add placeholder or skipped tests early with reasons; activate as behavior lands.
