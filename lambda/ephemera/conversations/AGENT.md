# Conversations registry (agent notes)

## Two layers: storable vs live handle

**Storable rows** (`StorableConversationRecord`, per-variant types like `StorableConversationRecordGenerateRoomPreview`) are **JSON-safe**: `conversationId`, `type`, `routing`, `payload` fragments, etc. They are what [`internalCache/conversations.ts`](../internalCache/conversations.ts) **`set`** stores and what a future Dynamo row would contain.

**`internalCache.Conversations.get`** is a **runtime composite read**: `{ record, handle } | undefined`. **`record`** is that same storable row. **`handle`** is currently a **task-1 placeholder** (`ConversationCompositeReadHandleStub` in [`conversationTypes/compositeRead.ts`](conversationTypes/compositeRead.ts)) with **no** real `sendMessage` or wire behavior; it exists so the read shape can grow in later tasks. **`getConversationHandle`** still **materializes** a live handle from **`record`** only and **does not** use the cache `handle` field yet.

**Live handles** (`ConversationHandle`, e.g. `ConversationHandleGenerateRoomPreview`) are the **same discriminated union** at the **`type`** tag, plus **runtime-only** fields such as **`sendMessage`**. These are **not** persisted. They are built **on read** by [`materializeConversationHandle.ts`](materializeConversationHandle.ts), which closes over **`MessageBus`** (and any other process-local dependencies).

Use `getStorableConversationRecord` when you only need the data; use `getConversationHandle` when code must **stream or complete** to the client without threading `messageBus` through every helper.

## Preview API result types

**`GenerateRoomPreviewResult`** (and **`GenerateRoomPreviewSuccess`** / **`GenerateRoomPreviewFailure`**) live in [`conversationTypes/generateRoomPreview/baseClasses.ts`](conversationTypes/generateRoomPreview/baseClasses.ts) next to the storable row and handle for that path; per-variant **`materialize.ts`** builds the live handle. [`renderOrchestration/generateRoomPreview.ts`](../renderOrchestration/generateRoomPreview.ts) **implements** that contract; orchestration does not own the wire result shapes.

## Temporary: `conversationId` on renderCache bus traffic

For the prototype, **`conversationId`** may be set on **`api.ephemera`** **`Put Cache Record`** commands and echoed on **`mtw.ephemera.renderCache`** **`Cache Updated`** payloads (see [`dataSource/localApiEvents.ts`](../dataSource/localApiEvents.ts), [`dataSource/renderCache/index.ts`](../dataSource/renderCache/index.ts)). **Dynamo** cache rows are unchanged. Remove this plumbing once orchestration can correlate cache events to conversations **without** carrying intent inside the DS envelope (see [AGENT.planning.tasklist.md](AGENT.planning.tasklist.md) **section 7**).

## Discriminant

A single top-level **`type`** field identifies the variant. Narrowing on **`type`** narrows **`routing`**, **`payload`**, and **`sendMessage`** together. Type guards live next to the variant (e.g. `isStorableConversationRecordGenerateRoomPreview`).

## Adding a second prototype path (new `type` variant)

1. Add a **storable** branch in `conversationTypes/<variant>/` (e.g. `baseClasses.ts` for routing + payload shape).
2. Extend **`StorableConversationRecord`** with `| StorableConversationRecord...`.
3. Add a **handle** type (storable branch + `sendMessage` with the right args).
4. Extend **`ConversationHandle`**.
5. Add a **`case`** in **`materializeConversationHandle`** (and optional `assertNever` in `default` when the union grows).
6. Register/get tests and materialization tests for the new branch.

Persisted storage always uses **storable** types only.

## Streaming / progress (planned)

The WebSocket **`generateRoomPreview`** path in [`app.ts`](../app.ts) uses **`registerConversation`**, **`generateRoomPreview`**, then **`getConversationHandle`** **`sendMessage`** (single **`ReturnValue`** completion). **Multi-stage** delivery (server-driven **Generating** plus final result) is specified in [AGENT.planning.md](AGENT.planning.md) (**Multi-stage WebSocket delivery and coordination trap**), task list **section 4**, and the client [lifeLine AGENT.md](../../../charcoal-client/src/slices/lifeLine/AGENT.md) (**`socketDispatchConversation`**).

## Design reference

Full rationale, fragment staging, coordination trap, and deferred items: [AGENT.planning.md](AGENT.planning.md). Task sequencing: [AGENT.planning.tasklist.md](AGENT.planning.tasklist.md).
