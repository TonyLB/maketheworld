# lifeLine slice (agent notes)

## Role

**lifeLine** owns the WebSocket connection to Ephemera (and related services), publishes inbound payloads to **`LifeLinePubSub`**, and exposes thunks for **request/response** and **multi-message (conversation)** patterns over the socket. See [`index.api.ts`](index.api.ts) for implementation.

## `socketDispatchPromise` (current)

**Location:** [`index.api.ts`](index.api.ts) (`socketDispatchPromise`).

**Correlation:** Matches **only** top-level **`RequestId`**. Intended for **single round-trip** responses. Do **not** use **`RequestId`-only** matching for **multi-message** streams; use **`socketDispatchConversation`** with **`conversationId`** (and optional **`matchRequestIdFallback`** during migration).

**Behavior:**

- Ensures a **`RequestId`** on the outbound message (generates **`uuidv4()`** if omitted).
- Subscribes **once** to **`LifeLinePubSub`**: on the **first** inbound payload whose top-level **`RequestId`** matches, it **unsubscribes** and **resolves** (or **rejects** on **`messageType === 'Error'`**).
- Inbound data for Ephemera typically arrives after the lambda returns: the socket receives **`{ statusCode, body }`**, the client **`JSON.parse`s `body`**, and publishes the result so **`RequestId`** and response fields sit at the top level (see **`setupSocket.onmessage`** in the same file).

**Implication:** One logical request maps to **one** Promise resolution. This matches **single merged** **`ReturnValue`** bodies from Ephemera ([`lambda/ephemera/returnValue/extractReturnValue`](../../../../lambda/ephemera/returnValue/index.ts)) and the **completion-only** [`conversation.sendMessage`](../../../../lambda/ephemera/conversations/conversationTypes/generateRoomPreview/materialize.ts) path for **`generateRoomPreview`**.

**Typical call sites:** [`RoomPreviewEditor`](../../components/Workbench/RoomEdit/RoomPreviewEditor.tsx), [`RoomDescription`](../../components/Message/RoomDescription.tsx), and other `dispatch(socketDispatchPromise({ ... }))` usages.

## `socketDispatchConversation` (implemented)

**Location:** [`index.api.ts`](index.api.ts) (`socketDispatchConversation`), pure filter **`matchesCorrelationPayload`** (exported for tests).

**Correlation:** Prefer **`payload.conversationId === outboundConversationId`**. Optional **`matchRequestIdFallback`**: also accept **`payload.RequestId === outboundRequestId`** for migration until every **`ReturnValue`** carries **`conversationId`**.

**Goal:** Support **multiple** correlated inbound messages for **one** user action (e.g. **Generating** then **final preview result**), without losing correlation. **Preferred:** a client-generated **`conversationId`** (UUID) passed on the wire and echoed on each step; **`RequestId`** may still appear during migration alongside **`conversationId`**.

**Behavior:**

- Ensures **`conversationId`** ( **`uuidv4()`** if omitted on the payload) and **`RequestId`** ( **`uuidv4()`** if omitted), same as **`socketDispatchPromise`** for **`RequestId`**.
- Subscribes to **`LifeLinePubSub`** **before** **`webSocket.send`**. Outbound JSON is **`{ service, ...payload, RequestId, conversationId }`** ( **`service`** defaults to **`ephemera`**; overloads match **`socketDispatchPromise`** for asset / subscriptions / WML / ping).
- Delivers **every** matching inbound payload to **`onEvent`**. A payload matches when **`payload.conversationId === conversationId`**, or when **`matchRequestIdFallback: true`** and **`payload.RequestId === RequestId`** (migration before the server echoes **`conversationId`** on every **`ReturnValue`**).
- **Terminal (default):** **`isTerminal`** defaults to **`isTerminalConversationStep`** from [`@tonylb/mtw-interfaces/ts/ephemera`](../../../../packages/mtw-interfaces/ts/ephemera.ts): **`messageType === 'Error'`**; **`GenerateRoomPreview`** with **`conversationStep === 'complete'`** or **`'error'`**; **legacy** one-shot **`GenerateRoomPreview`** (no **`conversationStep`**) with a valid **`generateRoomPreview`** body; **not** terminal for **`conversationStep === 'generating'`** or for unrelated **`messageType`** values. Override **`isTerminal`** when a flow needs different rules. When terminal, invokes optional **`onTerminal`** after **`onEvent`**, then **unsubscribes**. **`messageType === 'Error'`** with **`error`** also **`dispatch`**es **`push(error)`** like **`socketDispatchPromise`**.
- **Return value:** **`Promise<{ conversationId, unsubscribe }>`**. **`unsubscribe`** is idempotent and detaches without waiting for another publish (uses the subscription id from **`LifeLinePubSub.subscribe`**). Use **`unsubscribe`** on unmount, navigation, or superseding a run with a new **`conversationId`**.
- **Disconnected socket:** **`Promise.reject`** with **`{ message: payload.message }`** (same shape as **`socketDispatchPromise`**).

**Wire types:** Preview **`conversationStep`** kinds (**`generating`**, **`complete`**, **`error`**) and helpers (**`isTerminalConversationStep`**, **`isGenerateRoomPreviewConversationStep`**, **`isConversationCorrelatedPayload`**) live in **`@tonylb/mtw-interfaces`** (see **`ConversationStepKind`** and **`EphemeraClientMessageGenerateRoomPreview`**). Other **`LifeLinePubSub`** subscribers are unchanged in this pass; narrow with those helpers when handling streamed preview steps.

**Server-side design:** [`lambda/ephemera/conversations/AGENT.planning.md`](../../../../lambda/ephemera/conversations/AGENT.planning.md) (**Multi-stage WebSocket delivery and coordination trap**), task list [`AGENT.planning.tasklist.md`](../../../../lambda/ephemera/conversations/AGENT.planning.tasklist.md) **section 4**.

**Tests:** [`socketDispatchConversation.test.ts`](socketDispatchConversation.test.ts).

## References

- [`lambda/ephemera/conversations/AGENT.planning.md`](../../../../lambda/ephemera/conversations/AGENT.planning.md) - coordination trap, vertical slice, orchestration alignment.
- [`lambda/ephemera/renderOrchestration/AGENT.planning.md`](../../../../lambda/ephemera/renderOrchestration/AGENT.planning.md) - **`RenderGenerationStarted`**, cache lifecycle.
- [`lambda/ephemera/AGENT.event.md`](../../../../lambda/ephemera/AGENT.event.md) - WebSocket and **`ReturnValue`** overview.
