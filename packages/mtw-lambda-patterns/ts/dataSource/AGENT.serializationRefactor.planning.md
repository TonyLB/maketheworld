# DataSource Serialization Boundary Refactor - Planning

**Status**: Planning / in progress across multiple issues and sessions.  
**Purpose**: Semi-durable tracker for refactoring the DataSource serialization boundary so it is easier to reason about, with clear separation between internal and external representations and consistent authority (header for routing).  
**When done**: Either delete this file or replace with a short "Refactor completed; see AGENT.md / AGENT.implementation.md" note.

---

## Goals

1. **Stop external representation from leaking** into code on the wrong side of the boundary (subscription matching, DataSource internals, initialize lambda).
2. **Make "header is authoritative for routing" true everywhere** (including subscriptions), and avoid routing on `content.type` / `update.type`.
3. **Single path from EventBridge to deserialize**: all lambdas use `fromEventBridgeFormat` and pass `coreFormat.update` + header to deserialize (no raw `event.detail` as content).
4. **Single place that builds the wire envelope**: confine `CoreExternalFormat` construction to a publisher (or equivalent) so DataSource and initialize do not hand-build it.
5. **Centralize event contracts**: all event types and serializers in mtw-interfaces (including Coordination); lambdas only import and use them.
6. **Centralize header-level routing logic**: define header-level discriminants and predicates once (per data source or domain) and derive all envelope guards (lazy, resolved, and external/core) from that single source so we do not duplicate envelope typeguards across regimes.

---

## Already good: single header representation

We already have a **single header representation** for all places. One type (`StreamingEventHeader` and extended variants like `WMLStreamingEventHeader`) is used for internal (messageBus, receiveEvents, aggregators) and external (serializer params, `CoreExternalFormat.header`). In `streamEvent` we build one `header` and pass it to the serializer, CoreExternalFormat, and the messageBus event; the same object flows to both sides of the boundary. The only "second" representation is wire encoding (EventBridge: Source, DetailType, Detail.streamKey, etc.), which is "one logical header, different layout per transport," not a different in-memory shape. Preserve this: do not introduce separate internal vs external header types or duplicate header construction.

---

## Background (summary)

- **Documentation gap**: DataSource/serialization is harder to reason about than WML/StandardForm; docs admit "Multi-Context Serialization Challenge" and inconsistent authority. See earlier analysis in this chat for doc vs. code gaps.
- **External leaks**: Subscriptions handlerFramework is typed and implemented in terms of `CoreExternalFormat`; it matches on `update?.type`. DataSource builds `CoreExternalFormat` inside `streamEvent`. Initialize lambda builds `CoreExternalFormat` by hand. Ephemera bypasses `fromEventBridgeFormat` and passes `event.detail` as content to deserialize.
- **Mixed authority**: Deserializers correctly use only `header.type`; subscription `matchEvent` uses `update?.type`.
- **Split ownership**: Coordination event contracts live in lambda/wml; others in mtw-interfaces. Wire shape (`CoreExternalFormat`) is known by DataSource, formatTransform, initialize, subscriptions, and lambda handlers.

---

## Envelope-typing (proposed) — typing and authority only

We **propose** adopting **envelope-typing as the rule in our types and code**: header (envelope) is the single source of truth for routing and discrimination; we do not route on `content.type` or `update.type`. This refactor is about **authority and typing**, not about changing what we store or send.

**Out of scope for this refactor:** Changing the **data shape** of what we persist or transmit. We do *not* propose removing `type` from the payload in EventBridge Detail, SNS bodies, DynamoDB records, or subscription client messages. Those wire/stored formats may continue to include `type` in the body for backward compatibility and self-description. Any future "payload domain-only on the wire" change would be a separate, larger change (migration, rollout, contract impact).

**In scope:** (1) **Authority:** Every code path that has access to a header (or envelope) uses it for routing—e.g. `matchEvent` uses `event.header?.type`, not `event.update?.type`. (2) **Building the envelope:** When we construct outbound wire (e.g. EventBridge Detail), we take `type` from the header, not from the payload—even if we then also copy it into the payload for compatibility. (3) **Typing / localizing:** Where it helps, we can type our internal flow as header + content and treat external content as opaque at the boundary; discrimination is by header only. Deserialize already routes only on `header.type`; no change there.

**Current state:** Internal is envelope-typing (header authoritative). Externally we duplicate `type` into the payload so receivers can build the header; some code (e.g. subscription `matchEvent`, client building header) reads `update.type` instead of using an envelope field.

**Proposed direction (no data-shape change):** We use header/envelope for all routing and for populating type when building wire. Payloads may still contain `type`; we simply do not rely on it as the source of truth. One mental model: envelope = authoritative; content may still carry type for wire compatibility.

**Benefits:** Header authoritative everywhere; no dependency on payload type for routing; clearer single source of truth; optional localizing of external types to the boundary (see Findings). No migration or wire-format change required.

**Three processing regimes, one semantic envelope:** The same logical streaming envelope appears in three processing regimes: (1) external/core (`CoreExternalFormat`) before deserialize, where `update` is external content; (2) lazy internal (`StreamingEventEnvelope`) on the messageBus and DataSource side, where content is behind `getContentInternal`; and (3) resolved internal (`ResolvedStreamingEnvelope`) for aggregators, replay, and serializer params, where `content` is fully realized. All three regimes share the same header semantics and should reuse the same header-level routing predicates; the only difference between them is how and when content is obtained.

---

## Findings: implications of envelope-typing (authority + typing; data-shape out of scope)

Implications for the in-scope refactor (use header for routing and when building wire; no change to stored/sent payload shape). Historical notes about a possible future "payload domain-only on the wire" change are kept briefly where useful but are **out of scope** for this plan.

### Localizing external content types (optional advantage)

With header as the single authority for routing, we can **optionally** localize external content types to serializer (and wire-contract) files so that most code reasons only about internal types. Discrimination would be by header only; the only code that must "understand" external content shape is the serializer and deserialize. DataSource can stay generic over an opaque external type; client could treat the incoming message as opaque and pass it to deserialize. **Current complication:** Today external types are used in lambdas (DataSource generic params), subscription module (message union, type guards), and client slice types. The refactor (authority only, no data-shape change) still allows us to prefer header for discrimination and reduce reliance on payload type in our types and guards where we have header available.

### Audit: receivers that use payload type

Every place that uses payload type has the full envelope or the payload; we currently put type in the payload for SNS Feedback, DynamoDB, and subscription client message. **In scope:** subscription `matchEvent` has CoreExternalFormat (including header) but reads `update?.type`; we change it to use `event.header?.type`. Other receivers (fromSNSFeedbackFormat, fromDynamoDBFormat, client) continue to derive type from the payload as today—we are not changing those wire formats.

### Format transform (mtw-lambda-patterns/ts/dataSource/formatTransform.ts)

- **In scope:** **toEventBridgeFormat** should take `type` from `coreFormat.header.type` (not from `update`) when setting `DetailType`. We may still copy type into the Detail body for compatibility; the change is "authority" (header is the source when building). **fromEventBridgeFormat** already builds header from DetailType; no change required. Other toX/fromX: when we have a header, use it; when we only have payload (e.g. SNS Feedback, DynamoDB replay), we continue to derive type from payload as today.
- **Out of scope:** Changing Detail body, SNS body, or DynamoDB record to remove `type` from the payload; adding envelope-level `type` to SNS/WebSocket/DynamoDB.

### Serializers (mtw-interfaces/ts/eventBridge, lambda/wml coordinationSerializer)

- **In scope:** Callers that build wire (e.g. publisher, toEventBridgeFormat) get `type` from header when building the envelope; they do not rely on serialize output containing `type`. **deserialize** already routes only on `header.type`; no change.
- **Out of scope:** Changing serialize to return only domain fields; changing external type definitions to drop `type` from content. Serializer output and external types may continue to include `type` for wire compatibility.

### EventBridge / Detail shape

- **In scope:** When building Detail, we set DetailType from header (not from update). We may still include `type` in the Detail body; the change is where we *get* the value (header).
- **Out of scope:** Removing `type` from the Detail body. Receiving path already uses DetailType for header; no change.

### Subscriptions (handlerFramework, client message)

- **In scope:** **matchEvent (baseClasses.ts)** should use envelope/header for routing: e.g. `event.header?.type` (or equivalent) instead of `event.update?.type`. CoreExternalFormat already has a header; we just stop reading type from update.
- **Out of scope:** Changing SubscriptionClientMessage shape (e.g. adding top-level `type`, making `update` domain-only). Transforms and client continue to use current message shape; client may still build header from `update.type` where the message has no envelope-level type.

### Client (charcoal-client dataSource slice)

- **In scope:** No change required if subscription message shape is unchanged. Client continues to build header from `update.type` when the message has no envelope-level type. Reducers already use `header.type` once header is built.
- **Out of scope:** Adding envelope-level `type` to the subscription message and changing the client to use it.

### SNS Feedback / WebSocket / DynamoDB

- **In scope:** When building outbound messages/records, use header for `type` when we have it (same authority rule). When reading (fromSNSFeedbackFormat, fromDynamoDBFormat), we continue to derive type from the payload as today if there is no envelope-level type.
- **Out of scope:** Changing SNS, WebSocket, or DynamoDB payload/record shape (e.g. adding envelope-level `type`, removing `type` from `update`).

### External / legacy consumers

- **Out of scope:** We are not changing the wire contract, so existing consumers that expect `type` in the body are unaffected.

### Remaining questions (minimal; no data-shape change)

- **Tests:** Ensure changes (e.g. matchEvent using header, toEventBridgeFormat taking type from header) are covered so regressions are caught. No migration or rollout coordination required for this refactor.

### Summary (in scope vs out of scope)

| Layer | In scope (authority + typing) | Out of scope (data-shape) |
|-------|------------------------------|----------------------------|
| toEventBridgeFormat | Get type from header when setting DetailType | Removing type from Detail body |
| matchEvent | Use `event.header?.type`, not `event.update?.type` | Changing subscription message shape |
| Serializer / CoreExternalFormat | Callers use header for type when building wire | Serialize return shape; update type in content |
| Subscription client message | No change (or optional: prefer header when present) | Top-level type; update domain-only |
| SNS / DynamoDB / client | Use header when building; keep current read path | Envelope-level type; payload domain-only |

---

## Refactor work items

Use the checkboxes and "Status" lines to track progress. Add GitHub issue numbers or PR links when created.

### 1. Single path: EventBridge -> deserialize

- [x] **1a. Ephemera uses fromEventBridgeFormat**  
  - **What**: In `lambda/ephemera/app.ts`, use `fromEventBridgeFormat(event)` and pass `coreFormat.update` and a header derived from `coreFormat` (and `event["detail-type"]`) to `deserialize`. Stop passing `event.detail` as content.  
  - **Status**: Done.  
  - **Depends on**: None.  
  - **Files**: `lambda/ephemera/app.ts`, ephemera deserializer usage.

### 2. Subscription framework: match on header only

- [x] **2a. matchEvent uses header-only envelope**  
  - **What**: Change `SubscriptionLibrary.matchEvent` (and any callers) so matching uses only header-like fields: `dataSourceKey`, `type`, `streamKey` (and optionally `timestamp`). Obtain `type` from the envelope (e.g. `coreFormat` after `fromEventBridgeFormat`, or a dedicated header object), not from `event.update?.type`. The full event can still be `CoreExternalFormat` when passed to `transform` and `publish`.  
  - **Status**: Done.  
  - **Depends on**: None (can be done independently).  
  - **Files**: `lambda/subscriptions/handlerFramework/baseClasses.ts` (e.g. `matchEvent`), any tests that assert on matching behavior.

### 3. Envelope-typing — authority and typing only (proposed; data-shape change out of scope)

*Placed here (before publisher and contracts) because it has no dependency on 4–6 and establishes "header is authoritative" early; the rest of the refactor then builds on that rule.*

- [x] **3a. matchEvent uses header only** — SubscriptionLibrary.matchEvent uses `event.header?.type` (or equivalent) for routing, not `event.update?.type`. Same change as 2a; done as part of 2a.
- [x] **3b. toEventBridgeFormat uses header for type** — When building EventBridge Detail, take `type` from `coreFormat.header.type` (not from `update`) for DetailType. Implemented via `effectiveType = header?.type ?? update.type`; DetailType uses `effectiveType` while payload shape remains unchanged.
- [x] **3c. (Optional) Localize external types** — Where it helps, treat external content as opaque at the boundary and discriminate only by header; reduce reliance on payload type in types/guards. Documented in `CoreExternalFormat` and `AGENT.implementation.md` that `header.type` is authoritative for routing and `update.type` is preserved for wire compatibility and deserialization.
- [x] **3d. Tests** — Cover matchEvent and toEventBridgeFormat behavior so regressions are caught. Added tests in `formatTransform.test.ts` for header-wins vs. no-header fallback and re-ran DataSource tests.
- [x] **3e. Centralize header predicates and derive envelope guards**  
  - **What**: For each DataSource/subscribedEvents module, define header-level discriminants (for example, a header union or small header-focused predicates) that describe the subscribed variants once, and introduce helpers (for example, `HeaderGuard`, `makeStreamingEnvelopeGuardFromHeaderGuard`, and `makeResolvedEnvelopeGuardFromHeaderGuard`) that lift those header predicates into envelope guards for each regime: lazy internal (`StreamingEventEnvelope<unknown>`), resolved internal (`ResolvedStreamingEnvelope<..., ...>`), and external/core (`CoreExternalFormat`) where needed. Initial implementation introduces `HeaderGuard`, `makeStreamingEnvelopeGuardFromHeaderGuard`, and `makeResolvedEnvelopeGuardFromHeaderGuard` in `baseClasses.ts` and refactors WML, contentHeaders, library, and ephemera `subscribedEvents.ts` modules to use header predicates plus `makeStreamingEnvelopeGuardFromHeaderGuard` for their subscribed-envelope guards.
  - **Scope**: **In scope**: type-level refactor only; reuse of header predicates across wrappers; no behavior change intended and no changes to wire or stored data shape. **Out of scope**: introducing runtime classes, changing serializer signatures, or altering messageBus payload contracts.
  - **Why**: Eliminates duplicated envelope-level typeguards across regimes while honoring envelope-typing; makes header semantics explicit and reusable, and keeps a future class-based representation (if ever desired) mechanically straightforward because all routing logic is already factored at the header layer. When applying this, prefer using the new helpers for any new DataSources and then refactor existing subscribedEvents modules opportunistically; the first wave has covered WML, contentHeaders, library, and ephemera.
- [x] **3f. Complete aggregate-guard migration**  
  - **What**: Migrate the two remaining DataSource subscribedEvents modules (mtw.assets: `lambda/assets/dataSource/subscribedEvents.ts`; mtw.assets.players: `lambda/assets/players/subscribedEvents.ts`) to use a header predicate plus `makeStreamingEnvelopeGuardFromHeaderGuard` for their subscribed-envelope guard, so every subscribedEvents module uses the same pattern for "is this envelope in our subscribed set?"
  - **Why**: Removes the mixed state where four modules use the helper and two use hand-written envelope guards; one consistent pattern everywhere improves reasoning and ensures we get full benefit from the 3e work.
  - **Status**: Done. Both modules now use `isAssetsSubscribedHeader` / `isPlayersSubscribedHeader` plus `makeStreamingEnvelopeGuardFromHeaderGuard`. Assets predicate restricted to (dataSourceKey, type) pairs from `AssetsIncomingEvent`; assets dataSource index test updated to assert on those types. All six subscribedEvents modules now use the same aggregate-guard pattern.
- [x] **3g. Derive per-event envelope guards from header predicates**  
  - **What**: Introduce a pattern (and optional helper, e.g. a narrow-header predicate lifted into an envelope guard that narrows to a single union variant) so that per-event guards (e.g. "is this a Zone Changed event?") are derived from the same header-level source of truth as the aggregate guard. Refactor existing per-event guards in all subscribedEvents modules to use this pattern so "what event types we handle" is defined in one place per DataSource (no duplicated `dataSourceKey`/`type` checks in each per-event guard).
  - **Why**: Completes the single-source-of-truth story; adding or changing a subscribed event type then requires updating one header-level definition (and payload types), not N separate guard functions. Maximizes clarity gains from the header-predicate abstraction.
  - **Status**: Done. Per-event guards use the same `makeStreamingEnvelopeGuardFromHeaderGuard` with narrow `Content` and `H`; all six subscribedEvents modules refactored to use narrow header predicates plus that helper for variant guards.
- [x] **3h. (Optional) Narrow header union type**  
  - **What**: Where beneficial, define a proper header union type per DataSource (e.g. `ContentHeadersSubscribedHeader`) and type the aggregate header predicate as `HeaderGuard<ThatUnion>`, so TypeScript narrows the envelope's header after the guard. Align with 3f/3g so the union is the single source for both aggregate and per-event guards.
  - **Why**: Gives the type system a direct representation of "subscribed header variants" and can simplify per-event guard derivation (3g). Optional because the current predicate-only approach already centralizes logic; the union type adds type-level clarity.
  - **Status**: Done. All six subscribedEvents modules now export a header union type (e.g. `LibrarySubscribedHeader`, `PlayersSubscribedHeader`) and use it for the aggregate predicate and for `makeStreamingEnvelopeGuardFromHeaderGuard<SubscribedContent, ThatUnion>`.
- **Explicitly out of scope:** Changing wire/stored data shape (removing type from payloads in EventBridge, SNS, DynamoDB, subscription message); serializer return shape; migration or rollout coordination.

### 4. CoreExternalFormat: construction (publisher) and consumption (subscription lambda)

- [x] **4a. Introduce a publisher abstraction**  
  - **What**: Add a small component (e.g. `StreamEventPublisher` or a function in a dedicated module) that takes `(header, internalUpdate)` and optional `eventSerializer`, calls `serializer.serialize({ content, header })`, builds `CoreExternalFormat`, then calls `toEventBridgeFormat` / `toDynamoDBFormat` and performs send/store. Define where this lives (e.g. in mtw-lambda-patterns/ts/dataSource or next to formatTransform).  
  - **Status**: Done. Added `streamEventPublisher.ts` with `publishStreamEvent`; builds CoreExternalFormat and returns all four wire formats (eventBridgeEvent, optional dynamoRecord, snsFeedbackFormat, webSocketFormat). Helper `wireFormatsFromCoreFormat(coreFormat, options?)` is available for call sites that already have a CoreExternalFormat (e.g. deliverReplayData). Exported from dataSource index; unit tests added.
  - **Depends on**: None (design decision: new file vs. extend existing).

- [x] **4b. DataSource.streamEvent uses publisher**  
  - **What**: Refactor `DataSource.streamEvent` so it only builds the header and invokes the publisher with `(header, update)`. DataSource no longer constructs `CoreExternalFormat` or calls `toEventBridgeFormat`/`toDynamoDBFormat` directly.  
  - **Status**: Done. streamEvent builds header and calls publishStreamEvent; uses returned eventBridgeEvent and dynamoRecord for send/store; no direct CoreExternalFormat/toEventBridgeFormat/toDynamoDBFormat in streamEvent. deliverReplayData uses `wireFormatsFromCoreFormat` for SNS feedback (snapshot and replay events) instead of calling `toSNSFeedbackFormat` directly; DataSource no longer imports `toSNSFeedbackFormat`.  
  - **Depends on**: 4a.

- [x] **4c. Initialize lambda uses publisher**  
  - **What**: Replace manual `CoreExternalFormat` construction in `lambda/initialize/app.ts` with a call to the same publisher (or a helper that uses it), so the diagnostics event is built in one place.  
  - **Status**: Done. initializePrimitivesData calls publishStreamEvent(header, content, serializer) and uses returned eventBridgeEvent for EventBridge send; no direct CoreExternalFormat or toEventBridgeFormat in initialize lambda.  
  - **Depends on**: 4a.

- [x] **4d. Subscription lambda: matchEvent on header and reuse HeaderGuard (CoreExternalFormat consumption)**  
  - **What**: (1) Add a helper in the patterns layer (e.g. `makeCoreExternalFormatGuardFromHeaderGuard`) that takes a `HeaderGuard<H>` and returns a guard `(coreFormat: CoreExternalFormat) => coreFormat is CoreExternalFormat & { header: H }`, so the same header predicates used by DataSource subscribedEvents can be reused for external/core regime. (2) Refactor subscription lambda `matchEvent` (handlerFramework/baseClasses.ts) to use `event.header` for routing (e.g. `event.header?.type`, `event.header?.dataSourceKey`) instead of `event.update?.type`, and have each subscription/DataSource supply or use the same subscribed header predicate (or the derived CoreExternalFormat guard) so "what we subscribe to" is a single source of truth across DataSource and subscription lambda.  
  - **Why**: Completes the header-authority and single-source-of-truth story for the inbound subscription path; subscription lambda no longer duplicates routing logic or reads type from the payload. Entangled with CoreExternalFormat because matchEvent receives CoreExternalFormat.  
  - **Status**: Done. Added makeCoreExternalFormatGuardFromHeaderGuard in formatTransform; matchEvent uses event.header for routing (with fallback); SubscriptionHandler accepts optional coreFormatGuard; at least one library entry uses the guard. Header is authoritative for routing.  
  - **Depends on**: 3e/3f/3g (header predicates and guards exist in subscribedEvents); can be done before or after 4a–4c.

- [x] **4e. Subscription lambda: EventBridge to WebSocket via publisher wire formats**  
  - **What**: Use the publisher abstraction for the EventBridge-to-WebSocket translation in the subscriptions lambda. Today each subscription handler builds a `SubscriptionClientMessage` by hand via a transform `(event: CoreExternalFormat) => SubscriptionClientMessage`. Now that the publisher (and `wireFormatsFromCoreFormat`) produces `webSocketFormat`, use it as the single source for "CoreExternalFormat to client wire shape": e.g. in `SubscriptionEvent.publish`, obtain `wireFormatsFromCoreFormat(coreFormat).webSocketFormat` and adapt to `SubscriptionClientMessage` (flatten `webSocketFormat.message` if the client contract is flat), or use it as the default when no custom transform is provided. Handlers that need filtering or obfuscation can still apply an optional transform on top of that default.  
  - **Why**: Aligns EventBridge-to-WebSocket translation with the rest of the wire-format pipeline; one place produces the client-facing message from CoreExternalFormat, reducing duplication and drift between subscription handlers and formatTransform.  
  - **Status**: Done. Subscription lambda uses wireFormatsFromCoreFormat and an adapter (flatten WebSocketFormat + merge header RequestIds/RequestId) as the default when no handler transform is provided; publish uses default or custom transform. Single source for CoreExternalFormat to client wire shape.  
  - **Depends on**: 4a (publisher and wireFormatsFromCoreFormat exist). Can be done after or alongside 4d. **Note**: SubscriptionClientMessage (mtw-interfaces) is flat (`messageType`, `dataSourceKey`, `streamKey`, `timestamp`, `update`); WebSocketFormat has a nested `message`. An adapter or small helper (e.g. flatten `webSocketFormat.message` into the client shape) may be needed unless the client contract is updated to match.

- [x] **4f. Unify WebSocket wire shape: flat base type in patterns, domain union in mtw-interfaces**  
  - **What**: (1) In patterns (formatTransform): redefine `WebSocketFormat` as the **flat** shape we actually send over the WebSocket (no nested `message`): `{ messageType: 'StreamEvent', dataSourceKey, streamKey, timestamp, update, RequestId?, RequestIds? }`. This is the canonical base type only; patterns does not define or depend on any domain-specific union. (2) Update `toWebSocketFormat` to return that flat shape (and merge `coreFormat.header?.RequestIds` / `RequestId` into the result so the flat message is complete). Update `fromWebSocketFormat` to accept the flat shape and destructure into CoreExternalFormat. (3) In mtw-interfaces (subscriptions): import the flat base type from patterns; define `SubscriptionClientMessage` as the union of narrowed variants (WMLSubscriptionClientMessage, ContentHeadersSubscriptionClientMessage, etc.) that extend or constrain that base with specific `dataSourceKey` and `update` types. All domain payload types and the full union remain in interfaces. (4) In the subscription lambda: use `wireFormatsFromCoreFormat(coreFormat).webSocketFormat` directly as the default message when no handler transform is provided; remove or reduce the adapter in baseClasses (no flatten step, only header merge if still needed).  
  - **Why**: Single source of truth for the WebSocket stream-event shape; no duplicated flat vs nested formats. Patterns stays generic (base type only); interfaces owns the domain union and type guards. Subscription lambda can send webSocketFormat as-is.  
  - **Status**: Done. WebSocketFormat is flat in formatTransform; toWebSocketFormat/fromWebSocketFormat use it and merge RequestIds/RequestId; mtw-interfaces subscription types extend WebSocketFormat; subscription lambda uses webSocketFormat directly and adapter removed.  
  - **Depends on**: 4e (adapter and default path exist).  
  - **Files**: `packages/mtw-lambda-patterns/ts/dataSource/formatTransform.ts` (WebSocketFormat, toWebSocketFormat, fromWebSocketFormat); `packages/mtw-interfaces/ts/subscriptions.ts` (import base from patterns, define union on top); `lambda/subscriptions/handlerFramework/baseClasses.ts` (simplify or remove defaultSubscriptionMessageFromCoreFormat).

### 5. Event contracts in mtw-interfaces

- [x] **5a. Move Coordination event contracts to mtw-interfaces**  
  - **What**: Move Coordination event types (e.g. `CoordinationCanonizeEventExternal`, `CoordinationEventExternal`, etc.) and `CoordinationEventSerializer` from `lambda/wml/dataSource/coordinationSerializer.ts` to a suitable module under `packages/mtw-interfaces/ts/eventBridge/` (e.g. `coordination` or under `wml` if that fits). Update lambda/wml to import from `@tonylb/mtw-interfaces/ts/eventBridge/...`.  
  - **Status**: Done. Coordination types and CoordinationEventSerializer live in `@tonylb/mtw-interfaces/ts/eventBridge/coordination`; lambda/wml imports from there. `lambda/wml/dataSource/coordinationSerializer.ts` and its test were removed.  
  - **Depends on**: None (can be done independently; may want a single PR with 5c).  
  - **Files**: New or existing file in mtw-interfaces; `lambda/wml/dataSource/coordinationSerializer.ts` (delete or re-export); `lambda/wml/app.ts`, `lambda/wml/dataSource/mtw-wml.ts`, tests.

- [x] **5b. Document future option: remove mtw.coordination EventBridge, localize coordination as internal-only**  
  - **What**: In [AGENT.development.md](../../../../AGENT.development.md) (or equivalent master roadmap), add a short "Future task" note: the possible shift to remove `mtw.coordination` EventBridge events entirely and treat coordination (Apply Edit, Move Asset, Purge Asset, etc.) as purely internal API handling—each lambda responsible for the structure of its own API handling, no shared EventBridge coordination channel. This is a future option worth pursuing, not part of the current serialization refactor.  
  - **Why**: Captures the option so it can be revisited; keeps current plan (5a) reversible and avoids the refactor scope expanding into coordination removal.  
  - **Status**: Done. Documented in AGENT.development.md under "Coordination events: remove mtw.coordination EventBridge, localize API handling".  
  - **Depends on**: None.  
  - **Files**: `AGENT.development.md` (add subsection or bullet under Future Development Considerations).

- [x] **5c. Update EventBridge AGENT.implementation.md contract**  
  - **What**: Fix the documented serializer contract in `packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md` so the only signature shown is `{ content, header }` (remove the old `dataSourceKey`, `streamKey`, `update`/`externalUpdate` code blocks).  
  - **Status**: Done. All serializer code blocks now use `{ content, header }`; discovery table no longer references removed coordinationSerializer path.  
  - **Depends on**: None.

### 6. Generic extended-header merge for WebSocketFormat

- [x] **6a. Replace ad-hoc RequestId/RequestIds in toWebSocketFormat with generic extended-header merge**  
  - **What**: Today `toWebSocketFormat` (formatTransform.ts) explicitly sets `RequestId` and `RequestIds` on the flat WebSocket message from `coreFormat.RequestId`, `coreFormat.header?.RequestId`, and `coreFormat.header?.RequestIds`. Refactor to a generic approach: define the "extended" part of the header (e.g. header minus base four: dataSourceKey, streamKey, timestamp, type) and merge that extended part into the flat WebSocket message—so any top-level fields the subscription client contract expects from the header (RequestIds, RequestId, or future extended fields) are produced by one rule (e.g. "spread header minus base four onto the message") rather than hardcoding each field. Align with how EventBridge already handles extended header generically (Detail.extendedHeader). Update `fromWebSocketFormat` if needed to reconstruct header from the flat message using the same convention.  
  - **Why**: Removes ad-hoc handling and keeps WebSocketFormat in sync with the single "extended header" concept used elsewhere; adding a new extended header field for the client no longer requires editing toWebSocketFormat.  
  - **Status**: Done. toWebSocketFormat/fromWebSocketFormat use generic extended-header merge (header minus base four); shared getExtendedFromHeader used across all to* transforms; WebSocket tests added.  
  - **Depends on**: 4f (flat WebSocketFormat and current merge exist).  
  - **Files**: `packages/mtw-lambda-patterns/ts/dataSource/formatTransform.ts` (toWebSocketFormat, fromWebSocketFormat; possibly shared helper for "header minus base four" if not already present).

- [ ] **6b. Document extended-header rule for all wire formats (close doc gap)**  
  - **What**: Update durable documentation so the extended-header rule is stated for **all** wire formats, including WebSocket. Today [AGENT.implementation.md](./AGENT.implementation.md) "Serialization: extendedHeader" lists only EventBridge Detail, DynamoDB, and SNS; WebSocket is mentioned only in an example that describes current ad-hoc behavior. Change the Wire bullet to state that **every** wire format (EventBridge, DynamoDB, SNS, WebSocket) uses the same rule: extended header = "header minus base four," one object or one generic merge onto the message—no per-field enumeration. Add a sentence that the format layer (formatTransform) and publisher must apply this rule in every transform so that adding a new extended header field never requires editing multiple places. Optionally tighten [formatTransform.ts](./formatTransform.ts) module comment and [AGENT.md](./AGENT.md) "Format transforms" so they explicitly say all contexts follow the same rule.  
  - **Why**: The doc gap (WebSocket omitted from the generic rule) likely contributed to toWebSocketFormat being the outlier; closing it ensures future implementers and 6a align with one stated rule.  
  - **Depends on**: None (can be done before or with 6a).  
  - **Files**: `packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md` (Serialization: extendedHeader); optionally `formatTransform.ts` (module comment), `AGENT.md` (Format transforms / Key Insight).

- [x] **6c. Make CoreExternalFormat header-only (remove top-level dataSourceKey, streamKey, timestamp, RequestId)**  
  - **What**: Refactor CoreExternalFormat to `{ header, update }` only; header is required and is the single source of truth for all envelope fields. Update all format transforms, streamEventPublisher, DataSource.deliverReplayData, and lambda apps (wml, assets, ephemera) to construct and read from header only. Update tests and durable docs.  
  - **Why**: Removes redundant double-representation and aligns in-memory format with "header authoritative" rule.  
  - **Status**: Done. CoreExternalFormat is `{ header, update }`; header required and authoritative. formatTransform, streamEventPublisher, DataSource, lambda apps, tests, and AGENT.implementation.md/AGENT.md updated.  
  - **Depends on**: None.  
  - **Files**: formatTransform.ts, streamEventPublisher.ts, index.ts (DataSource), lambda/wml/app.ts, lambda/assets/app.ts, lambda/ephemera/app.ts, formatTransform.test.ts, streamEventPublisher.test.ts, AGENT.implementation.md, AGENT.md.

### 7. Documentation improvements (parallel track)

- [ ] **7a. Single "Serialization data flow" section**  
  - **What**: Add a section (e.g. in AGENT.implementation.md) that spells out the full pipeline: outbound (internal update -> streamEvent -> serializer -> CoreExternalFormat -> toEventBridgeFormat -> EventBridge) and inbound (EventBridge -> fromEventBridgeFormat -> header + coreFormat.update -> deserialize -> internal -> messageBus). Match the actual code and formatTransform.  
  - **Status**:  
  - **Depends on**: Optional; can be done anytime.

- [ ] **7b. Division of responsibility for serialization boundary**  
  - **What**: Add a short "Division of responsibility" (or equivalent) that states who builds the header, who builds the wire envelope, and who routes on what. With envelope-typing (authority only), document that header is authoritative for routing; payload may still carry `type` for wire compatibility.  
  - **Status**:  
  - **Depends on**: Optional; can be done anytime.

---

## Suggested ordering

- **Early / quick wins (header authoritative first)**: 1a (Ephemera path), 2a (matchEvent on header), 3a (same as 2a), 3b (toEventBridgeFormat uses header for type), 3d (tests). Then 5a+5c (Coordination move + doc fix). Doing 3 before 4–7 establishes the authority rule with no new abstractions; publisher and docs can follow.
- **Publisher refactor**: 4a -> 4b -> 4c (introduce publisher, then DataSource, then initialize). **Subscription lambda (4d, 4e)**: 4d (matchEvent on header) can be done once 3e/3f/3g are in place; 4e (EventBridge-to-WebSocket via wireFormatsFromCoreFormat) is a natural follow-on now that the publisher produces all wire formats—subscription handlers can use the same abstraction for the client message instead of hand-building from CoreExternalFormat.
- **Extended-header cleanup**: 6b (doc: extended-header rule for all wire formats) can be done anytime; 6a (generic extended-header merge for WebSocketFormat) after 4f. **CoreExternalFormat header-only**: 6c (done).
- **Docs**: 7a and 7b can proceed in parallel with any of the above.
- **Optional later**: 3c (localize external types) as needed.
- **Header-predicate rollout (after 3e)**: 3f (complete aggregate-guard migration for assets/dataSource and assets/players) -> 3g (derive per-event guards from header predicates across all modules) -> 3h (optional narrow header union type where beneficial). Doing 3f then 3g removes the mixed state and completes the single-source-of-truth; 3h refines types if desired.

---

## References

- This directory: [AGENT.md](./AGENT.md), [AGENT.implementation.md](./AGENT.implementation.md).
- Format and types: [formatTransform.ts](./formatTransform.ts), [baseClasses.ts](./baseClasses.ts), [index.ts](./index.ts).
- Event contracts: [mtw-interfaces/ts/eventBridge/AGENT.implementation.md](../../../mtw-interfaces/ts/eventBridge/AGENT.implementation.md).
- Subscriptions: [lambda/subscriptions/handlerFramework/baseClasses.ts](../../../../lambda/subscriptions/handlerFramework/baseClasses.ts), [lambda/subscriptions/AGENT.md](../../../../lambda/subscriptions/AGENT.md).
- Lambda handlers (inbound path): `lambda/wml/app.ts`, `lambda/assets/app.ts`, `lambda/ephemera/app.ts`.
- Initialize (outbound): `lambda/initialize/app.ts`.

---

*Last updated: 3f, 3g, 3h added for durable plan to complete header-predicate rollout (aggregate migration, per-event derivation, optional narrow header union). Data-shape change remains out of scope; no migration or rollout required.*
