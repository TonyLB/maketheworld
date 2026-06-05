# lifeLine slice (agent notes)

## Role

**lifeLine** owns the WebSocket connection to Ephemera (and related services), publishes inbound payloads to **`LifeLinePubSub`**, and exposes thunks for **request/response** and **multi-message (conversation)** patterns over the socket. See [`index.api.ts`](index.api.ts) for implementation.

## `LifeLinePubSub` (common client bus)

**Location:** [`lifeLinePubSub.ts`](lifeLinePubSub.ts) (singleton); re-exported from [`index.api.ts`](index.api.ts).

Inbound WebSocket payloads and client-local synthetic messages share this **`PubSub`**. Subscribers must narrow by `messageType` or package type guards before handling.

## `PeriodicTick` (client-local)

**Location:** [`periodicTick.ts`](periodicTick.ts).

**Payload:** `{ messageType: 'PeriodicTick'; now: number }` (type `PeriodicTickLifeLineMessage` in [`lifeLine.d.ts`](lifeLine.d.ts)).

**Guard:** `isPeriodicTickLifeLineMessage(payload)` --- required before handling in subscribers.

**Publisher:** `startPeriodicTickPublisher({ intervalMs?, getNow? })` / `stopPeriodicTickPublisher()`. Default interval **30_000** ms (`PERIODIC_TICK_DEFAULT_INTERVAL_MS`). Publishes via **`LifeLinePubSub`**; never parsed from WebSocket JSON.

**Activation:** lifeLine SSM only --- started in **`establishWebSocket`** `onopen` (alongside `pingInterval`), stopped in **`disconnectWebSocket`** via `stopPeriodicTickPublisher()`. Handle stored on **`LifeLineInternal.periodicTickInterval`**. Not activated from app root or `useSSM.ts`.

**Subscribers:** Long-lived `LifeLinePubSub.subscribe` with `isPeriodicTickLifeLineMessage` guard. Periodic GC subscriber lives in [personalAssets/index.ts](../personalAssets/index.ts) (`registerPeriodicCleanupSubscriber` + store init binding); dispatches `pruneStaleRequestCorrelation` using `payload.now`.

**Tests:** [`periodicTick.test.ts`](periodicTick.test.ts).

## `socketDispatchPromise` (current)

**Location:** [`index.api.ts`](index.api.ts) (`socketDispatchPromise`).

**Correlation:** Matches **only** top-level **`RequestId`**. Intended for **single round-trip** responses. Do **not** use **`RequestId`-only** matching for **multi-message** streams; use **`socketDispatchConversation`** with **`conversationId`** (and optional **`matchRequestIdFallback`** during migration).

**Behavior:**

- Ensures a **`RequestId`** on the outbound message (generates **`uuidv4()`** if omitted).
- Subscribes **once** to **`LifeLinePubSub`**: on the **first** inbound payload whose top-level **`RequestId`** matches, it **unsubscribes** and **resolves** (or **rejects** on **`messageType === 'Error'`**).
- Inbound data for Ephemera typically arrives after the lambda returns: the socket receives **`{ statusCode, body }`**, the client **`JSON.parse`s `body`**, and publishes the result so **`RequestId`** and response fields sit at the top level (see **`setupSocket.onmessage`** in the same file).

**Implication:** One logical request maps to **one** Promise resolution. This matches **single merged** **`ReturnValue`** bodies from Ephemera ([`lambda/ephemera/returnValue/extractReturnValue`](../../../../lambda/ephemera/returnValue/index.ts)).

**Typical call sites:** `dispatch(socketDispatchPromise({ ... }))` from slices and components that need a single acknowledged response, for example: [`activeCharacters/index.api.ts`](../activeCharacters/index.api.ts) (`fetchEphemera`, `sync`, map subscribe), [`ephemera/index.api.ts`](../ephemera/index.api.ts), [`player/index.api.ts`](../player/index.api.ts), [`dataSource/index.api.ts`](../dataSource/index.api.ts), [`personalAssets/index.ts`](../personalAssets/index.ts) and [`personalAssets/index.api.ts`](../personalAssets/index.api.ts), [`UI/collaborationStatus/index.api.ts`](../UI/collaborationStatus/index.api.ts), [`Message/RoomDescription.tsx`](../../components/Message/RoomDescription.tsx) (`message: 'link'`), [`Message/index.tsx`](../../components/Message/index.tsx), [`Message/RoomCharacter.tsx`](../../components/Message/RoomCharacter.tsx), [`Knowledge/index.tsx`](../../components/Knowledge/index.tsx), [`Workbench/AssetSelector.tsx`](../../components/Workbench/AssetSelector.tsx) (WML service).

## `socketDispatchConversation` (implemented)

**Location:** [`index.api.ts`](index.api.ts) (`socketDispatchConversation`), pure filter **`matchesCorrelationPayload`** (exported for tests).

**Framework status:** This path was **prototyped** with the removed workbench **room preview generation** feature. We know it **works** (including unit tests and prior end-to-end use) and **anticipate** using it again when a feature needs **multiple correlated inbound** WebSocket payloads for one user action. **Right now** charcoal-client has **no production callers** and no active product flow that emits matching server payloads; the code stays in place **mostly for future need**. Server-side conversation and **`ConversationStep`** shapes may still evolve (see [`lambda/ephemera/conversations/AGENT.md`](../../../../lambda/ephemera/conversations/AGENT.md)); default **`isTerminal`** still comes from **`@tonylb/mtw-interfaces`** until a packages cleanup.

**Correlation:** Prefer **`payload.conversationId === outboundConversationId`**. Optional **`matchRequestIdFallback`**: also accept **`payload.RequestId === outboundRequestId`** for migration until every **`ReturnValue`** carries **`conversationId`**.

**Goal:** Support **multiple** correlated inbound messages for **one** outbound action without losing correlation. **Preferred:** a client-generated **`conversationId`** (UUID) passed on the wire and echoed on each step; **`RequestId`** may still appear during migration alongside **`conversationId`**.

**Behavior:**

- Ensures **`conversationId`** ( **`uuidv4()`** if omitted on the payload) and **`RequestId`** ( **`uuidv4()`** if omitted), same as **`socketDispatchPromise`** for **`RequestId`**.
- Subscribes to **`LifeLinePubSub`** **before** **`webSocket.send`**. Outbound JSON is **`{ service, ...payload, RequestId, conversationId }`** ( **`service`** defaults to **`ephemera`**; overloads match **`socketDispatchPromise`** for asset / subscriptions / WML / ping).
- Delivers **every** matching inbound payload to **`onEvent`**. A payload matches when **`payload.conversationId === conversationId`**, or when **`matchRequestIdFallback: true`** and **`payload.RequestId === RequestId`** (migration before the server echoes **`conversationId`** on every **`ReturnValue`**).
- **Terminal (default):** **`isTerminal`** defaults to **`isTerminalConversationStep`** from [`@tonylb/mtw-interfaces/ts/ephemera`](../../../../packages/mtw-interfaces/ts/ephemera.ts). Override with a custom predicate when your flow uses different completion rules. When terminal, invokes optional **`onTerminal`** after **`onEvent`**, then **unsubscribes**. **`messageType === 'Error'`** with **`error`** also **`dispatch`**es **`push(error)`** like **`socketDispatchPromise`**.
- **Return value:** **`Promise<{ conversationId, unsubscribe }>`**. **`unsubscribe`** is idempotent and detaches without waiting for another publish (uses the subscription id from **`LifeLinePubSub.subscribe`**). Use **`unsubscribe`** on unmount, navigation, or superseding a run with a new **`conversationId`**.
- **Disconnected socket:** **`Promise.reject`** with **`{ message: payload.message }`** (same shape as **`socketDispatchPromise`**).

**Wire types:** Discriminated inbound shapes for Ephemera (including **`ConversationStep`** when used) live in **`@tonylb/mtw-interfaces`**. Import **`isTerminalConversationStep`** from this slice re-export or from the package when implementing **`isTerminal`** or handling steps in feature code.

**Server-side design:** Multi-stage WebSocket delivery and conversation orchestration are documented in [`lambda/ephemera/conversations/AGENT.planning.md`](../../../../lambda/ephemera/conversations/AGENT.planning.md) and related task lists.

**Tests:** [`socketDispatchConversation.test.ts`](socketDispatchConversation.test.ts).

## `parseCommand` command dispatch strategy

**Location:** [`index.api.ts`](index.api.ts) (`parseCommand`).

`parseCommand` supports explicit command dispatch behavior:

- Default `commandDispatchStrategy: 'fireAndForget'` sends command mode via `socketDispatch` (no required `RequestId`).
- Optional `commandDispatchStrategy: 'promise'` sends command mode via `socketDispatchPromise`, which adds `RequestId` on outbound wire for correlation.
- Non-command modes (`SayMessage`, `NarrateMessage`, `OOCMessage`) remain fire-and-forget action dispatch.

This keeps current command UX behavior stable while exposing a correlation-ready path for features that need round-trip gating or timeout handling.

## References

- [`lambda/ephemera/conversations/AGENT.planning.md`](../../../../lambda/ephemera/conversations/AGENT.planning.md) - coordination trap, vertical slice, orchestration alignment.
- [`lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md`](../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md) - **`RenderGenerationStarted`**, cache lifecycle.
- [`lambda/ephemera/AGENT.event.md`](../../../../lambda/ephemera/AGENT.event.md) - WebSocket and **`ReturnValue`** overview.
