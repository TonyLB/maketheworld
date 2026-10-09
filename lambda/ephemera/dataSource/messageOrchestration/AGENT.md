# Content ingress (`dataSource/messageOrchestration`)

A **plain module, not a DataSource**: it subscribes to no events and publishes no stream events. It is imported for its side effect from [`../../app.ts`](../../app.ts) (it registers the `onClear` deferral that resets per-invocation state) and called directly by producers and by perception's render-completion handlers. The directory keeps its historical name.

Owns **delivery of render content to the listeners that asked for it**: a producer registers a listener (who gets the message, in which format, at which transcript position), a render-completion handler reports the resolved content once, and each listener publishes its own addressed `PublishMessage`. This decouples *who wants a render* from *who resolves it* without either side knowing about the other.

| Layer | Owner |
| --- | --- |
| Transcript position (`CreatedTime`, `MessageId`) | The producer: the presentation compiler stamps `beatAnchorTime + index`; a one-off listener mints its own with `newDirectIngressAddress()` |
| Content resolution (passive render, cache read) | `renderOrchestration`, kicked off once per key by the first listener |
| Content report | [`../perception/orchestrate.ts`](../perception/orchestrate.ts) (`reportIngressContent`) |
| Per-listener projection and publish | **This module** ([`index.ts`](index.ts)) |

## API

- **`registerIngressSlot(bus, address, spec, kickoff?)`** registers a listener. `address` is `{ createdTime, messageId }`; `spec` ([`IngressListenerSpec`](contentIngress.ts)) is `{ componentId, perspectiveKey, targets, contentStream, format }`. The **first** registration against a key runs `kickoff` (single-flight: a second same-invocation listener wanting the same content never triggers a second render request). A **later** registrant does not kick off; it is replayed the **latest** recorded wave only, published at its own address.
- **`reportIngressContent(bus, componentId, perspectiveKey, contentStream, content)`** records the wave and publishes it to every registered listener. It returns the number of listeners delivered to.
- **`newDirectIngressAddress()`** mints `{ createdTime: now, messageId: MESSAGE#<uuid> }` for a listener that has no compiled position.

Callers: [`presentStepSequence.ts`](../positions/manipulation/kernel/presentStepSequence.ts) (a move's header `describe` step, at its stamped address), [`handleLookCommandRequestedForRenderOrchestration.ts`](../renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts) (the look family; a look inside a plan forwards its stamped time and `MessageId` on `Look Command Requested`), [`handleCharacterRegisteredOrientation.ts`](../connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts) (session orientation render channel, independent of its affordances channel per [`AGENT.multiChannel.contract.md`](../../AGENT.multiChannel.contract.md)'s "Cadence and independence"), [`requestFullRoomDescriptionForCharacter.ts`](../actions/actionHandlers/requestFullRoomDescriptionForCharacter.ts).

## Transcript-position rules

These are contract rules; the client depends on them ([`charcoal-client/src/slices/messages/index.ts`](../../../../charcoal-client/src/slices/messages/index.ts), `mergeMessageIdAggregate` / `applyPresentationIfLatest`).

- **A listener's waves share one `MessageId` at strictly increasing `CreatedTime`.** The first wave publishes at the address's `createdTime`; each later wave at `max(lastPublished + 1, now)`. The client keeps a `MessageId` at its **earliest** `CreatedTime` (its transcript position) and shows a row only when it carries the **latest** `CreatedTime`, so a terminal that ties or precedes its placeholder would never display.
- **Every presentation step in one plan gets a distinct time.** The client breaks `CreatedTime` ties by `MessageId`, a uuid, so equal times sort arbitrarily. The compiler's `beatAnchorTime + index` (1 ms apart) satisfies this.
- **Producers own their time; this module never assigns a transcript position.** It only applies the revision clamp above. A `PublishMessage` with no explicit `createdTime` gets `baseTime + index` in `publishMessage/index.ts`, outside this module.
- **Every wave publishes as it arrives.** There is no per-listener buffer and no settle flush: a "Generating…" placeholder is visible while the render runs, and the terminal revises the same message. Holding waves until settle would hide the placeholder for every render that finishes in the same invocation. Deduplication is only the late-registrant replay collapse.
- **The bus never batches.** `InternalMessageBus.publish` calls subscribers immediately with one payload, so every wave is its own `publishMessage` call (its own stored row and wire push). Ordering rests on `CreatedTime`, never on arrival.

## Ingress mechanics

[`contentIngress.ts`](contentIngress.ts) (`ContentIngressIndex`) owns content resolution state, kickoff single-flight and replay. It has no `messageBus` dependency: it returns data and [`index.ts`](index.ts) publishes.

- Buckets are keyed by `(componentId, perspectiveKey, contentStream)`. Bucket non-emptiness **is** the single-flight signal.
- **A listener is never removed** until the invocation's `clear()`: a placeholder wave and a later terminal wave both reach the same, full listener list. Any design where the first wave consumes the correlation leaves the second with nothing to match. A duplicated or out-of-order wave therefore re-publishes (same `MessageId`, later time) rather than being dropped; accepted deliberately, since the client aggregates by `MessageId`.
- `RenderContent` encodes the **content-vs-envelope split**: ingress deals only in content, never in an addressed `PublishMessage`. `{ kind: 'literal'; message }` is already-built WML with no cache record behind it, delivered as-is; `{ kind: 'roomRender'; componentId; renderedContent }` is a raw cache record; `{ kind: 'roomPlaceholder'; componentId; bodyText; status? }` is placeholder/error body text. The last two are projected per listener at publish time.
- State is per-invocation: the module's `messageBus.registerDeferral` resets it `onClear`. A render that completes in a **later** invocation finds no listener.

### Invariant: the roster-broadcast fallback stays gated on listener count

`handleRenderPertains`'s fallback ([`../perception/orchestrate.ts`](../perception/orchestrate.ts)) broadcasts to the whole room roster when nothing is registered for a render. Since directed kinds register here rather than with `PerceptionThreads`, that fallback is gated on `entries.length === 0 && publishedCharacterMove === 0`, the count `reportIngressContent` returns. Dropping the second clause spuriously broadcasts every directed room render to every occupant.

## Ingress key and per-listener format

The bucket key is **content identity** --- `(componentId, perspectiveKey, contentStream)` --- and nothing finer. One `RenderRequested` yields one cache record carrying both `summary` and `description`, so every listener wanting a given room's render wants the byte-identical record regardless of how it will present it. Keying on anything finer splits listeners who share content into separate buckets and pays `renderOrchestration`'s cross-invocation Dynamo single-flight redundantly, which is exactly the cost kickoff single-flight exists to eliminate.

`contentStream` is exactly the normative `roomChannel: 'render' | 'affordances'` binary (`messageBus/baseClasses.ts`, [`AGENT.multiChannel.contract.md`](../../AGENT.multiChannel.contract.md)) --- reused vocabulary, not a parallel one. It earns its place in the key because one room `componentId` genuinely carries two channels: `handleAffordancesPertain.ts` lists on the same `(roomId, perspectiveKey)` the render pipeline uses.

**`format` is an envelope property, not part of the key.** Header versus full is a slicing of one shared cache record (`roomHeaderWmlFromCacheRecord` is `roomRenderWmlFromCacheRecord` over narrowed content), so it cannot be a property of production --- the producer is format-agnostic and `RenderRequested` carries no format field. `IngressListenerSpec` is a `contentStream`-discriminated union: `{ contentStream: 'render'; format: 'header' | 'full' }` or `{ contentStream: 'affordances'; format: 'default' }`. A header listener and a full listener against the same content cost nothing extra: no negotiation with the producer, no second render, no cache variant.

**Projection happens at envelope construction**, in `buildListenerMessage` ([`index.ts`](index.ts)): for `roomRender` content it picks `roomHeaderWmlFromCacheRecord` vs `roomRenderWmlFromCacheRecord` per the listener's `format`; for `roomPlaceholder` it picks `roomHeaderGeneratingPlaceholderWml`/`roomHeaderErrorPlaceholderWml` (header) vs `placeholderRoomFullWml` (full, in [`../perception/roomFullPlaceholderWml.ts`](../perception/roomFullPlaceholderWml.ts)). `handleRenderPertains` correspondingly reports the raw cache record, not a pre-sliced WML string.

## Registered render kinds

`characterMove`, `roomDescription`, `featureDescription`, `knowledgeDescription`, `objectDescription`, and `sessionOrientationRender` all register here. `sessionOrientationAffordances` is the one directed-consequence kind still on `PerceptionThreads` (no placeholder wave, no cache-record content shape --- `publishAffordancePerceptionForPerspective` hydrates and publishes itself).

- **`roomDescription`/`sessionOrientationRender` share `characterMove`'s bucket.** All three are `(componentId=roomId, perspectiveKey, contentStream:'render')`, differing only by `format`. `orchestrate.ts`'s `reportIngressContent` calls in `handleRenderPertains`/`handleGenerationStarted`/`handleOrchestrationErrorOrDeferred` fan out to all of them; there are no per-kind report sites.
- **`featureDescription`/`knowledgeDescription`/`objectDescription` get their own buckets** (distinct `componentId`) and stay `kind: 'literal'` --- one projection each, so no format concept applies. `knowledgeDescription`'s `directResponse` → `SESSION#...` target resolution happens in the look handler, at registration rather than delivery time.
- **A `describe` step can request a *header*.** `ExecutorDescribeStep` carries an optional `header` binding (`{ perspectiveKey, assets }`); without it the describe is a full-format look. `presentStepSequence` delivers a header-bound describe by registering a header-format listener at the step's stamped address and kicking the passive render (or, for a `null` perspective key, publishing the static cache header at that address).

  A move's header is **caller-supplied** on the op (`PositionKernelMoveOp.header`, compiled to a `describe` step with a `header` binding), not derived by `compilePositionKernelOp`. Navigate resolves it from an async perspective-key lookup and passes it; object routes pass `null`. So "suppress the header when an endpoint is a character host" is true by construction, and the compiler deliberately has **no** host-kind branch for it. What remains open is only a kernel-produced description that wants header format rather than full; no production route needs it yet.

## Explicit non-goals

- **No reactive-broadcast perception.** `roomHeaderBroadcast` (multi-target, room-content-driven, no actor) stays on `PerceptionThreads`, along with `sessionOrientationAffordances`. This module is for directed consequence --- a specific actor's command producing perception aimed at them.
- **No stream subscription --- deliberately deferred, and still open.** This module does not subscribe to `Render Pertains`/`Generation Started` itself. Correlation is instead **pull**: whichever component already owns that subscription (`dataSource/perception/orchestrate.ts`) reports into this registry. That is a deliberate bridge reusing an in-process shape already proven for `PerceptionThreads`, not a settled judgment --- whether ingress should become a real stream subscription remains undecided. Named so the deferral stays explicit rather than hardening into an assumption.
- **No cross-invocation state.** A render completing in a later invocation is not delivered to a listener registered in an earlier one.

## Related documentation

| Doc | Role |
| --- | --- |
| [`../perception/AGENT.md`](../perception/AGENT.md) | Render-completion handlers that report into this registry |
| [`../../AGENT.narrativeTranscript.concepts.md`](../../AGENT.narrativeTranscript.concepts.md) | Why `CreatedTime` is transcript position rather than wall-clock truth |
| [`positions/AGENT.contract.md` --- Narration and presentation](../positions/AGENT.contract.md#narration-and-presentation) | How the compiler assigns presentation order: a plan's `narrate` and `describe` steps in array order, stamped `beatAnchorTime + index` (the navigate header is one of them) |
