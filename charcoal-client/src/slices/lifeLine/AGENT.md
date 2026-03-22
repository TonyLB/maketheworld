# lifeLine slice (agent notes)

## Role

**lifeLine** owns the WebSocket connection to Ephemera (and related services), publishes inbound payloads to **`LifeLinePubSub`**, and exposes thunks for **request/response** patterns over the socket. See [`index.api.ts`](index.api.ts) for implementation.

## `socketDispatchPromise` (current)

**Location:** [`index.api.ts`](index.api.ts) (`socketDispatchPromise`).

**Behavior:**

- Ensures a **`RequestId`** on the outbound message (generates **`uuidv4()`** if omitted).
- Subscribes **once** to **`LifeLinePubSub`**: on the **first** inbound payload whose top-level **`RequestId`** matches, it **unsubscribes** and **resolves** (or **rejects** on **`messageType === 'Error'`**).
- Inbound data for Ephemera typically arrives after the lambda returns: the socket receives **`{ statusCode, body }`**, the client **`JSON.parse`s `body`**, and publishes the result so **`RequestId`** and response fields sit at the top level (see **`setupSocket.onmessage`** in the same file).

**Implication:** One logical request maps to **one** Promise resolution. This matches **single merged** **`ReturnValue`** bodies from Ephemera ([`lambda/ephemera/returnValue/extractReturnValue`](../../../../lambda/ephemera/returnValue/index.ts)) and the **completion-only** [`conversation.sendMessage`](../../../../lambda/ephemera/conversations/conversationTypes/generateRoomPreview/materialize.ts) path for **`generateRoomPreview`**.

**Typical call sites:** [`RoomPreviewEditor`](../../components/Workbench/RoomEdit/RoomPreviewEditor.tsx), [`RoomDescription`](../../components/Message/RoomDescription.tsx), and other `dispatch(socketDispatchPromise({ ... }))` usages.

## `socketDispatchConversation` (proposed)

**Status:** Not implemented; design and task list live under Ephemera **conversations** planning.

**Goal:** Support **multiple** correlated inbound messages for **one** user action (e.g. **Generating** then **final preview result**), without losing correlation. **Preferred:** a client-generated **`conversationId`** (UUID) passed to Ephemera and replayed on each step; **`RequestId`** may still appear during migration alongside **`conversationId`**.

**Sketch:**

- Client generates **`conversationId`** and includes it on the WebSocket request; Ephemera **`registerConversation`** accepts that id (see task list **section 4**, registry task).
- Dispatch the initial message with the same **service** pattern as today; include **`conversationId`** on the payload per contract.
- Subscribe to **`LifeLinePubSub`** for **all** payloads matching **`conversationId`** (or **`RequestId`** during migration) until:
  - a **terminal** step arrives (success/failure), or
  - the caller **unsubscribes** (component unmount, navigation, or a newer preview run superseding the old id).
- Expose an API shaped like **observable** / **callback** semantics: e.g. **`onEvent(step)`**, **`onComplete`**, **`dispose()`** — exact names TBD when implemented.

**Wire types:** A discriminated **step** union (working name **`ConversationStep`**: generating vs result vs error) should align with Ephemera materialization and [`mtw-interfaces`](../../../../packages/mtw-interfaces) client shapes once defined.

**Server-side design:** [`lambda/ephemera/conversations/AGENT.planning.md`](../../../../lambda/ephemera/conversations/AGENT.planning.md) (**Multi-stage WebSocket delivery and coordination trap**), task list [`AGENT.planning.tasklist.md`](../../../../lambda/ephemera/conversations/AGENT.planning.tasklist.md) **section 4**.

## References

- [`lambda/ephemera/conversations/AGENT.planning.md`](../../../../lambda/ephemera/conversations/AGENT.planning.md) - coordination trap, vertical slice, orchestration alignment.
- [`lambda/ephemera/renderOrchestration/AGENT.planning.md`](../../../../lambda/ephemera/renderOrchestration/AGENT.planning.md) - **`RenderGenerationStarted`**, cache lifecycle.
- [`lambda/ephemera/AGENT.event.md`](../../../../lambda/ephemera/AGENT.event.md) - WebSocket and **`ReturnValue`** overview.
