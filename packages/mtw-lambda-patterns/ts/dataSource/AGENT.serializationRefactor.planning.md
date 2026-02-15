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

---

## Background (summary)

- **Documentation gap**: DataSource/serialization is harder to reason about than WML/StandardForm; docs admit "Multi-Context Serialization Challenge" and inconsistent authority. See earlier analysis in this chat for doc vs. code gaps.
- **External leaks**: Subscriptions handlerFramework is typed and implemented in terms of `CoreExternalFormat`; it matches on `update?.type`. DataSource builds `CoreExternalFormat` inside `streamEvent`. Initialize lambda builds `CoreExternalFormat` by hand. Ephemera bypasses `fromEventBridgeFormat` and passes `event.detail` as content to deserialize.
- **Mixed authority**: Deserializers correctly use only `header.type`; subscription `matchEvent` uses `update?.type`.
- **Split ownership**: Coordination event contracts live in lambda/wml; others in mtw-interfaces. Wire shape (`CoreExternalFormat`) is known by DataSource, formatTransform, initialize, subscriptions, and lambda handlers.

---

## Refactor work items

Use the checkboxes and "Status" lines to track progress. Add GitHub issue numbers or PR links when created.

### 1. Single path: EventBridge -> deserialize

- [ ] **1a. Ephemera uses fromEventBridgeFormat**  
  - **What**: In `lambda/ephemera/app.ts`, use `fromEventBridgeFormat(event)` and pass `coreFormat.update` and a header derived from `coreFormat` (and `event["detail-type"]`) to `deserialize`. Stop passing `event.detail` as content.  
  - **Status**:  
  - **Depends on**: None.  
  - **Files**: `lambda/ephemera/app.ts`, ephemera deserializer usage.

### 2. Subscription framework: match on header only

- [ ] **2a. matchEvent uses header-only envelope**  
  - **What**: Change `SubscriptionLibrary.matchEvent` (and any callers) so matching uses only header-like fields: `dataSourceKey`, `type`, `streamKey` (and optionally `timestamp`). Obtain `type` from the envelope (e.g. `coreFormat` after `fromEventBridgeFormat`, or a dedicated header object), not from `event.update?.type`. The full event can still be `CoreExternalFormat` when passed to `transform` and `publish`.  
  - **Status**:  
  - **Depends on**: None (can be done independently).  
  - **Files**: `lambda/subscriptions/handlerFramework/baseClasses.ts` (e.g. `matchEvent`), any tests that assert on matching behavior.

### 3. Confine CoreExternalFormat construction (publisher)

- [ ] **3a. Introduce a publisher abstraction**  
  - **What**: Add a small component (e.g. `StreamEventPublisher` or a function in a dedicated module) that takes `(header, internalUpdate)` and optional `eventSerializer`, calls `serializer.serialize({ content, header })`, builds `CoreExternalFormat`, then calls `toEventBridgeFormat` / `toDynamoDBFormat` and performs send/store. Define where this lives (e.g. in mtw-lambda-patterns/ts/dataSource or next to formatTransform).  
  - **Status**:  
  - **Depends on**: None (design decision: new file vs. extend existing).

- [ ] **3b. DataSource.streamEvent uses publisher**  
  - **What**: Refactor `DataSource.streamEvent` so it only builds the header and invokes the publisher with `(header, update)`. DataSource no longer constructs `CoreExternalFormat` or calls `toEventBridgeFormat`/`toDynamoDBFormat` directly.  
  - **Status**:  
  - **Depends on**: 3a.

- [ ] **3c. Initialize lambda uses publisher**  
  - **What**: Replace manual `CoreExternalFormat` construction in `lambda/initialize/app.ts` with a call to the same publisher (or a helper that uses it), so the diagnostics event is built in one place.  
  - **Status**:  
  - **Depends on**: 3a.

### 4. Event contracts in mtw-interfaces

- [ ] **4a. Move Coordination event contracts to mtw-interfaces**  
  - **What**: Move Coordination event types (e.g. `CoordinationCanonizeEventExternal`, `CoordinationEventExternal`, etc.) and `CoordinationEventSerializer` from `lambda/wml/dataSource/coordinationSerializer.ts` to a suitable module under `packages/mtw-interfaces/ts/eventBridge/` (e.g. `coordination` or under `wml` if that fits). Update lambda/wml to import from `@tonylb/mtw-interfaces/ts/eventBridge/...`.  
  - **Status**:  
  - **Depends on**: None (can be done independently; may want a single PR with 4b).  
  - **Files**: New or existing file in mtw-interfaces; `lambda/wml/dataSource/coordinationSerializer.ts` (delete or re-export); `lambda/wml/app.ts`, `lambda/wml/dataSource/mtw-wml.ts`, tests.

- [ ] **4b. Update EventBridge AGENT.implementation.md contract**  
  - **What**: Fix the documented serializer contract in `packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md` so the only signature shown is `{ content, header }` (remove the old `dataSourceKey`, `streamKey`, `update`/`externalUpdate` code blocks).  
  - **Status**:  
  - **Depends on**: None.

### 5. Documentation improvements (parallel track)

- [ ] **5a. Single "Serialization data flow" section**  
  - **What**: Add a section (e.g. in AGENT.implementation.md) that spells out the full pipeline: outbound (internal update -> streamEvent -> serializer -> CoreExternalFormat -> toEventBridgeFormat -> EventBridge) and inbound (EventBridge -> fromEventBridgeFormat -> header + coreFormat.update -> deserialize -> internal -> messageBus). Match the actual code and formatTransform.  
  - **Status**:  
  - **Depends on**: Optional; can be done anytime.

- [ ] **5b. Division of responsibility for serialization boundary**  
  - **What**: Add a short "Division of responsibility" (or equivalent) that states who builds the header, who builds the wire envelope, who routes on what, and why external content still has `type`. One place to look for "who does what" at the boundary.  
  - **Status**:  
  - **Depends on**: Optional; can be done anytime.

---

## Suggested ordering

- **Quick wins (no new abstractions)**: 1a (Ephemera path), 2a (subscription match on header), 4a+4b (Coordination move + doc fix).
- **Publisher refactor**: 3a -> 3b -> 3c (introduce publisher, then DataSource, then initialize).
- **Docs**: 5a and 5b can proceed in parallel with any of the above.

---

## References

- This directory: [AGENT.md](./AGENT.md), [AGENT.implementation.md](./AGENT.implementation.md).
- Format and types: [formatTransform.ts](./formatTransform.ts), [baseClasses.ts](./baseClasses.ts), [index.ts](./index.ts).
- Event contracts: [mtw-interfaces/ts/eventBridge/AGENT.implementation.md](../../../mtw-interfaces/ts/eventBridge/AGENT.implementation.md).
- Subscriptions: [lambda/subscriptions/handlerFramework/baseClasses.ts](../../../../lambda/subscriptions/handlerFramework/baseClasses.ts), [lambda/subscriptions/AGENT.md](../../../../lambda/subscriptions/AGENT.md).
- Lambda handlers (inbound path): `lambda/wml/app.ts`, `lambda/assets/app.ts`, `lambda/ephemera/app.ts`.
- Initialize (outbound): `lambda/initialize/app.ts`.

---

*Last updated: planning doc created. Update "Last updated" and checkboxes as work progresses.*
