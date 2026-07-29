# `mtw.ephemera.messageOrchestration`

Bus-only, non-replayable `EphemeraDataSource`. Registered from [`../../app.ts`](../../app.ts) via `import './dataSource/messageOrchestration'`.

Owns **ordering and addressing for directed presentation messages**: a producer declares a bundle's slots up front in compiled order, each slot resolves independently and reports its content, and the bundle flushes the resolved subset to `messageBus.publish` in the original compiled order. This decouples resolution order from delivery order without a graph or tree abstraction --- the compiler already knows the order, so nothing needs to reconstruct it.

| Layer | Owner |
| --- | --- |
| Instruction compile (produces the ordered slot list) | Plan/Synthesize |
| Slot resolution (a mutation's fact-streaming, the perception kernel's per-step render) | Whichever component owns that slot |
| Bundle correlation, settle, ordered flush | **`mtw.ephemera.messageOrchestration`** (this package) |
| Terminal WebSocket delivery | `messageBus.publish` (`PublishMessage`), called directly from this DataSource's fan-in handler |

## Ingress

Two `api.ephemera` command kinds, both in-process only (no EventBridge --- see [`../localApiEvents.ts`](../localApiEvents.ts)'s header comment on the pattern this reuses):

- **`Message Bundle Declared`** (`MessageBundleDeclareCommand`, [`localApiEvents.ts`](localApiEvents.ts)): `{ bundleId, slots: [{ slotId, expectedPublishType, componentId?, perspectiveKey?, targets?, contentStream?, format? }] }` --- the full, compiled-order slot list, emitted once per bundle. `componentId`/`perspectiveKey`/`targets`/`contentStream`/`format` form the slot's **match key**; only slots that a render-completion handler must self-match against populate them (e.g. navigate's header slot). Slots resolved by a producer that already knows its own `bundleId`/`slotId` statically (navigate's leave/arrive slots) leave them unset.
- **`Message Slot Reported`** (`MessageSlotReportCommand`, [`localApiEvents.ts`](localApiEvents.ts)): `{ bundleId, slotId, message }` where `message` is a `PublishMessage` (`../../messageBus/baseClasses.ts`) --- the eventual bus-publish payload, held until the bundle settles rather than published immediately.

Envelope guards and typed send-helpers (`sendMessageBundleDeclared`, `sendMessageSlotReported`) live in [`subscribedEvents.ts`](subscribedEvents.ts), mirroring `dataSource/perception/subscribedEvents.ts`'s `sendCharacterPerceptionRequested` shape.

Callers: `orchestrateNavigate.ts` (navigate's header slot), `dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts` (the whole look family), `dataSource/connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts` (session orientation render channel), `dataSource/actions/actionHandlers/requestFullRoomDescriptionForCharacter.ts`.

## Fan-in / settle mechanics

[`messageOrchestrationFanIn.ts`](messageOrchestrationFanIn.ts) is a `FanInCluster` spec on the shared `FanInCluster`/`FanInClusterStore` framework (see [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md#fan-in-cluster-pattern-multi-leg-ingress-correlation); concrete precedent `dataSource/perception/membershipPresentationFanIn.ts`).

Cluster identity is `bundleId`, known on every leg. **Either** leg kind (`bundle-declare` or `slot-report`) may seed the cluster --- unlike membership presentation's provisional/unify case --- so a slot-report arriving before its bundle-declare joins the same cluster instead of being silently dropped. `completed` is "the bundle has been declared and every declared `slotId` has a registered leg."

Settle is `messageBus`'s deferral tail (`registerDeferral`/`flushAndSettle`/`settleDeferrals()`), the same mechanism membership and object-manipulation presentation fan-in use for "optional leg never arrives." It is registered here **manually** --- `messageBus.registerDeferral('fanIn-mtw.ephemera.messageOrchestration', { onClear, afterSettled })` in [`index.ts`](index.ts), guarded on `getOpenPartialCount() > 0` --- rather than via `FanInClusterStore`'s own `registerDeferral` convenience method. **This must stay manual:** the convenience method calls `settleDeferrals()` unconditionally, which throws when `setHandlerContext` was never called (i.e. no event reached `receiveEvents` during the invocation). `dataSource/perception/index.ts` wires its two stores the same way for the same reason.

## Publish behavior

On completion, or at settle with some slots still unresolved, the cluster's `handler` iterates the declared slot list **in compiled order** and publishes each slot that has a report, skipping any that never resolved (tolerant failure: an anticipated slot whose message never materializes must not block its siblings).

**The bundle assigns `CreatedTime` itself** --- `baseTime + offset`, `offset` incrementing only over slots that actually resolved, so a skipped slot leaves no gap --- **overwriting** whatever `createdTime` the reported `PublishMessage` carried. This belongs at the bundle because the bundle is the only place that knows the full, correctly-ordered resolved set at the moment of flush. Pushing it to producers instead means every producer computing a mutually-consistent time independently, which degenerates into beat-anchor and clamp arithmetic that must be reimplemented for each new slot kind.

`expectedPublishType` on each declared slot is carried through but **not validated** against the reported message's `displayProtocol`; no current caller can violate it.

## Content ingress / delivery seam

Ingress and Delivery are two loosely-coupled state machines. The split exists because a render resolves in **two waves** against the same key --- a "Generating…" placeholder, then a terminal --- and any design where the first wave consumes the correlation leaves the second wave with nothing to match against.

- **Ingress** ([`contentIngress.ts`](contentIngress.ts), `ContentIngressIndex`) owns content resolution, kickoff single-flight, and replay. Bucket-per-`(componentId, perspectiveKey, contentStream)`.
  - `registerSlot(bundleId, spec)` returns `{ shouldKickoff: true }` the first time a bucket is touched (the caller invokes its own kickoff), or `{ shouldKickoff: false, replay }` on a later registration against a still-live bucket, where `replay` is every event recorded so far. Bucket non-emptiness **is** the single-flight signal: a second same-invocation listener wanting the same content never triggers a second render request, and still sees everything it missed.
  - `reportContent(componentId, perspectiveKey, contentStream, content)` records the event and returns every currently-registered listener. **It never removes a listener** --- placeholder and terminal waves both see the same, full list.
  - `RenderContent` is a discriminated union encoding the **content-vs-envelope split**: Ingress deals only in content, never in an addressed `PublishMessage`. `{ kind: 'literal'; message }` is already-built WML with no cache record behind it, delivered as-is; `{ kind: 'roomRender'; componentId; renderedContent }` is a raw cache record, projected per listener at delivery time; `{ kind: 'roomPlaceholder'; componentId; bodyText; status? }` is placeholder/error body text, likewise projected per listener.
  - Deliberately has no `messageBus` dependency --- it returns data and the caller decides what to do with it.
- **Delivery** ([`messageOrchestrationFanIn.ts`](messageOrchestrationFanIn.ts) plus [`deliveredSlotIndex.ts`](deliveredSlotIndex.ts), `DeliveredSlotIndex`) owns bundle waiting and delivered state.
  - Waiting-stage consolidation is free: `registerLeg`'s `this.reports.set(leg.slotId, message)` is a plain `Map` overwrite, so if both a placeholder and a terminal land before the bundle completes, only the latest is delivered.
  - `DeliveredSlotIndex` covers the post-flush case. `FanInClusterStore.completeReadyPartials` permanently drops a cluster once `completed`, so a slot-report arriving **after** a bundle flushed (the terminal, once the placeholder already completed it) would otherwise have nothing to stand against and would silently orphan. `MessageOrchestrationFanInCluster.handler()` --- via the `deliveredSlotIndex` field on `MessageOrchestrationFanInHandlerContext` --- snapshots `{ slotId, targets, messageId, createdTime }` for every slot it actually publishes. `receiveEvents` checks `deliveredSlotIndex.find(bundleId, slotId)` **before** routing a leg into `FanInClusterStore.route()`: a hit publishes standalone (reusing `targets`/`messageId`, with `createdTime` of `Math.max(already.createdTime + 1, getCurrentTimestamp())`); a miss routes normally. The clamp anchors to the placeholder's exact bundle-assigned time because a standalone terminal is a genuinely later, distinct transcript event --- not a reuse of the placeholder's position.
  - **`MessageId` stability is Delivery's job, assigned lazily.** `registerLeg` mints a messageId on a slot's *first* report and carries it forward on every later overwriting report (`supplied ?? existing?.messageId ?? mint()`). Because `reports` is already the single source of truth for a slot across however many waves arrive before flush, this needs no `messageId`/`createdTime` fields on `MessageOrchestrationSlotSpec` at all.
- **Call direction is one-way**: Ingress calls into Delivery as content resolves; Delivery never reaches back into Ingress.

### Invariants this seam depends on

- **The roster-broadcast fallback must stay gated on listener count.** `handleRenderPertains`'s fallback (`dataSource/perception/orchestrate.ts`) broadcasts to the whole room roster when nothing is registered for a render. Since directed kinds register here rather than with `PerceptionThreads`, that fallback is gated on `entries.length === 0 && publishedCharacterMove === 0` --- the count `reportIngressContent` returns. Dropping the second clause spuriously broadcasts every directed room render to every occupant.
- **`FanInClusterStore.completeReadyPartials` must reassign `openPartials` synchronously**, before awaiting any handler. Two `route()` calls interleaving at that `await` --- exactly what Ingress fanning one piece of content out to two listeners produces, since each triggers its own nested `bus.publish()` --- would otherwise both see the same partial as ready and both flush it, duplicating the wire message. This constrains the shared library, not just this DataSource.
- **A repeat event for an already-delivered slot re-publishes rather than being dropped.** `DeliveredSlotIndex` carries no "already stood alone" flag, so a duplicated or out-of-order bus event produces a redundant standalone publish (same `messageId`, `createdTime` strictly after the recorded slot time --- always computed from the recorded value, since a standalone does not re-record itself). Accepted deliberately; the client aggregates by `MessageId`.

## Ingress key and per-listener format

The bucket key is **content identity** --- `(componentId, perspectiveKey, contentStream)` --- and nothing finer. One `RenderRequested` yields one cache record carrying both `summary` and `description`, so every slot wanting a given room's render wants the byte-identical record regardless of how it will present it. Keying on anything finer splits listeners who share content into separate buckets and pays `renderOrchestration`'s cross-invocation Dynamo single-flight redundantly, which is exactly the cost this seam's kickoff single-flight exists to eliminate.

`contentStream` is exactly the normative `roomChannel: 'render' | 'affordances'` binary (`messageBus/baseClasses.ts`, [`AGENT.multiChannel.contract.md`](../../AGENT.multiChannel.contract.md)) --- reused vocabulary, not a parallel one. It earns its place in the key because one room `componentId` genuinely carries two channels: `handleAffordancesPertain.ts` lists on the same `(roomId, perspectiveKey)` the render pipeline uses.

**`format` is an envelope property, not part of the key.** Header versus full is a slicing of one shared cache record (`roomHeaderWmlFromCacheRecord` is `roomRenderWmlFromCacheRecord` over narrowed content), so it cannot be a property of production --- the producer is format-agnostic and `RenderRequested` carries no format field. `MessageOrchestrationSlotSpec` is a `contentStream`-discriminated union (`localApiEvents.ts`): `{ contentStream: 'render'; format: 'header' | 'full' }`, `{ contentStream: 'affordances'; format: 'default' }`, or neither field (leave/arrive slots, which carry no match key).

A useful consequence: declaring a header slot and a full slot against the same content costs nothing --- no negotiation with the producer, no second render, no cache variant.

**Projection happens at envelope construction.** `deliverListenerContent` ([`index.ts`](index.ts)) is the one place it occurs: for `roomRender` content it picks `roomHeaderWmlFromCacheRecord` vs `roomRenderWmlFromCacheRecord` per the listener's own `spec.format`; for `roomPlaceholder` it picks `roomHeaderGeneratingPlaceholderWml`/`roomHeaderErrorPlaceholderWml` (header) vs `placeholderRoomFullWml` (full, in [`../perception/roomFullPlaceholderWml.ts`](../perception/roomFullPlaceholderWml.ts)). `handleRenderPertains` correspondingly reports the raw cache record, not a pre-sliced WML string.

## Registered render kinds

`characterMove`, `roomDescription`, `featureDescription`, `knowledgeDescription`, `objectDescription`, and `sessionOrientationRender` all register against this DataSource's ingress registry. `sessionOrientationAffordances` is the one directed-consequence kind still on `PerceptionThreads` (no placeholder wave, no cache-record content shape --- `publishAffordancePerceptionForPerspective` hydrates and publishes itself).

- **Bundles are uniform, including 1-slot bundles.** Every producer of a directed render request declares a bundle, even a bare `look` with exactly one describe slot. Ordering is a consequence of a bundle having multiple slots, not a gate on using the registry, so a 1-slot bundle gets the same registry, single-flight, and fan-out machinery for free instead of needing a bypass path. `handleCharacterRegisteredOrientation.ts`'s render channel declares its own 1-slot bundle, independent of the affordances channel --- a session orientation's two channels are never one bundle, per [`AGENT.multiChannel.contract.md`](../../AGENT.multiChannel.contract.md)'s "Cadence and independence."
- **The look family declares and registers in one site.** `handleLookCommandRequestedForRenderOrchestration.ts`'s four branches (room/feature/knowledge/object) each mint a `bundleId`, call `sendMessageBundleDeclared`, then `registerIngressSlot` (`format: 'full'`) in the same function --- nothing crosses a bus hop, because a look's single describe slot has no sibling and no cross-component correlation need. **Constraint if this changes:** should a bundle ever carry more than one `describe` step, declaration must move upstream to wherever the full ordered list is first known (navigate's leave/header/arrive pattern exists precisely because its slots resolve in genuinely separate components). See `lookBundleSlotIds.ts`'s doc comment. `knowledgeDescription`'s `directResponse` → `SESSION#...` target resolution happens in this handler, at registration rather than delivery time.
- **`roomDescription`/`sessionOrientationRender` share `characterMove`'s bucket.** All three are `(componentId=roomId, perspectiveKey, contentStream:'render')`, differing only by `format`. `orchestrate.ts`'s three `reportIngressContent` calls in `handleRenderPertains`/`handleGenerationStarted`/`handleOrchestrationErrorOrDeferred` fan out to all of them; there are no per-kind report sites.
- **`featureDescription`/`knowledgeDescription`/`objectDescription` get their own buckets** (distinct `componentId`) and stay `kind: 'literal'` --- one projection each, so no format concept applies.
- **Open question for the presentation kernel:** slots can express format, but producers cannot. `ExecutorDescribeStep` has no format field and every kernel-produced describe is unconditionally full, so a kernel step requesting a *header* slot is undesigned. Carried in [`taskPlanning/lambda/ephemera/AGENT.presentationKernel.planning.md`](../../../../taskPlanning/lambda/ephemera/AGENT.presentationKernel.planning.md).

## Explicit non-goals

- **No bundling for reactive-broadcast perception.** `roomHeaderBroadcast` (multi-target, room-content-driven, no actor) stays on `PerceptionThreads`, along with `sessionOrientationAffordances`. Bundling is for directed consequence --- a specific actor's command producing perception aimed at them.
- **No `CreatedTime` computation for non-bundled traffic.** A payload with no explicit `createdTime` gets `baseTime + index` in payload-array order, in `publishMessage/index.ts`.
- **No EventBridge / DataSource-to-DataSource subscription --- API Ingress only. Deliberately deferred, and still open.** Both ingress kinds are `api.ephemera` in-process commands; this DataSource does not subscribe to other DataSources' streamed events, and in particular does not subscribe to `Render Pertains`/`Generation Started` itself. Correlation is instead **pull**: whichever component already owns that subscription (`dataSource/perception/orchestrate.ts`) reports into this registry. That is a deliberate bridge reusing an in-process shape already proven for `PerceptionThreads`, not a settled judgment --- whether ingress should become a real stream subscription remains undecided. Named so the deferral stays explicit rather than hardening into an assumption.
- **No outbound stream events** --- output is a direct `messageBus.publish` call, not a further stream republish ([`publishedEvents.ts`](publishedEvents.ts) is a `busOnly` placeholder).

## Related documentation

| Doc | Role |
| --- | --- |
| [`../perception/AGENT.md`](../perception/AGENT.md) | Render-completion handlers that report into this registry; the `FanInCluster` precedent this package mirrors |
| [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md#fan-in-cluster-pattern-multi-leg-ingress-correlation) | Fan-in framework |
| [`../../AGENT.narrativeTranscript.concepts.md`](../../AGENT.narrativeTranscript.concepts.md) | Why `CreatedTime` is transcript position rather than wall-clock truth |
| [`taskPlanning/lambda/ephemera/AGENT.presentationKernel.planning.md`](../../../../taskPlanning/lambda/ephemera/AGENT.presentationKernel.planning.md) | Successor initiative: positional state binding for narration |
