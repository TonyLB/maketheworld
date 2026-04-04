# Conversations registry (agent notes)

## Two layers: storable vs live handle

**Storable rows** (`StorableConversationRecord`, per-variant types like `StorableConversationRecordGenerateRoomPreview`) are **JSON-safe**: `conversationId`, `type`, `routing`, `payload` fragments, etc. They are what [`internalCache/conversations.ts`](../internalCache/conversations.ts) **`set`** stores and what a future Dynamo row would contain.

**`internalCache.Conversations.get`** is a **runtime composite read**: `{ record, handle } | undefined`. **`record`** is that same storable row. **`handle`** is a discriminated union on **`kind`** (see [`conversationTypes/compositeRead.ts`](conversationTypes/compositeRead.ts)):

- **`generateRoomPreview`** rows: **`kind: 'conversationCompositeReadGenerateRoomPreview'`** with a real **`sendMessage`** — same wire behavior as `materializeGenerateRoomPreview` (see [`conversationTypes/generateRoomPreview/materialize.ts`](conversationTypes/generateRoomPreview/materialize.ts)).
- **Other `type` values** (until enriched): **`kind: 'conversationCompositeReadStub'`** — no `sendMessage`.

Use **`isConversationCompositeReadHandleGenerateRoomPreview`** / **`isConversationCompositeReadHandleStub`** before calling **`sendMessage`**.

There is no separate `getConversationHandle` helper layer anymore for this vertical; for enriched rows, the runtime `sendMessage` capability is returned directly on the composite `internalCache.Conversations.get(...).handle`.

**Live handles** (`ConversationHandle`, e.g. `ConversationHandleGenerateRoomPreview`) are the **same discriminated union** at the **`type`** tag, plus **runtime-only** fields such as **`sendMessage`**. These are **not** persisted. They are built **on read** by [`internalCache/conversations.ts`](../internalCache/conversations.ts) using cached dependencies from the cache instance.

Use `internalCache.Conversations.get(conversationId)?.record` when you only need the data; use `internalCache.Conversations.get(conversationId)?.handle` + guards when you want the enriched read in one step.

## API contract: `set` vs composite `get`

- **`set(...)`** accepts **JSON-safe** `StorableConversationRecord` only (what a future Dynamo row would hold).
- **`get(...)`** is a **runtime** read: it returns **`record`** (that storable shape) plus **`handle`** (discriminated enrichment --- not the same type as the stored row alone). Callers must not treat **`get`** as returning "only what was persisted."

Without that explicit split, **`set`** / **`get`** look asymmetric by accident; they are **intentionally** asymmetric: storage is pure data; read-time enrichment is predictable and typed (**`record`** vs **`handle`**).

## Design decision: composite `get` (Option C)

**Chosen:** one composite **`internalCache.Conversations.get(...)`** that returns **`{ record, handle }`** (this document's "two layers" above).

**Not chosen**

- **Option A (registry-first enrichment):** extra helper boundary between storage and wire send; dropped as low value versus call-path friction.
- **Option B (separate enriched read, e.g. `getHandle(...)`):** dual-read indirection when a single **`get`** can return both concerns.

**Rationale:** Shortest path at usage sites; matches the **`internalCache`-first** model used elsewhere (tests can mock **`Conversations.get`** and receive the full composite). **Materialization** (`materializeGenerateRoomPreview`, `materializeRoomStateRender`, ...) remains the **only** layer that turns stored fragments into **`ConversationStep`** wire payloads and performs **`apiClient.send`** --- not **`generateRoomPreview`** orchestration core logic.

**Guardrails:** Keep **`record` / `handle`** naming in types and comments; document that **`set`** writes storable rows while **`get`** is a composite runtime read (not the same TypeScript symmetry as a trivial key-value cache).

## Testing / layering note

The send path is layered: **`Conversations.get`** -> **materialize** -> **`sendMessage`**. Prefer tests that exercise the **composite `get`** when you need end-to-end behavior; that aligns with mocking **`internalCache`** primitives the way other Ephemera code does.

## Orchestration boundary (`generateRoomPreview`)

[`dataSource/renderOrchestration/generateRoomPreview.ts`](../dataSource/renderOrchestration/generateRoomPreview.ts) does **not** call the conversation registry directly. It takes injected hooks such as **`onGenerating`** for slow-path feedback; the **caller** (e.g. [`app.ts`](../app.ts)) completes the WebSocket story by reading **`internalCache.Conversations.get(conversationId).handle`** and calling **`sendMessage`** for terminal **`ConversationStep`** delivery. Keeps transport details out of generation core.

## Invariants

- Stored conversation rows remain **serializable** and persistence-ready.
- **Materialization** remains the **single** place **envelope** fields are assembled into **`ConversationStep`** messages for the wire.
- **`ConversationStep`** remains the feedback mechanism for this vertical (**`generating`**, **`complete`**, **`error`**).
- **Slow-path-only** emission of **`generating`** stays enforced in **orchestration** policy (not ad hoc extra sends from materialize).

## Preview API result types

**`GenerateRoomPreviewResult`** (and **`GenerateRoomPreviewSuccess`** / **`GenerateRoomPreviewFailure`**) live in [`conversationTypes/generateRoomPreview/baseClasses.ts`](conversationTypes/generateRoomPreview/baseClasses.ts) next to the storable row and handle for that path; per-variant **`materialize.ts`** builds the live handle. [`dataSource/renderOrchestration/generateRoomPreview.ts`](../dataSource/renderOrchestration/generateRoomPreview.ts) **implements** that contract; orchestration does not own the wire result shapes.

## Temporary: `conversationId` on renderCache bus traffic

For the prototype, **`conversationId`** may be set on **`api.ephemera`** **`Put Cache Record`** commands and echoed on **`mtw.ephemera.renderCache`** **`Cache Updated`** payloads (see [`dataSource/localApiEvents.ts`](../dataSource/localApiEvents.ts), [`dataSource/renderCache/index.ts`](../dataSource/renderCache/index.ts)). **Dynamo** cache rows are unchanged. Remove this plumbing once orchestration can correlate cache events to conversations **without** carrying intent inside the DS envelope (see [AGENT.planning.tasklist.md](AGENT.planning.tasklist.md) **section 7**).

## Discriminant

A single top-level **`type`** field identifies the variant. Narrowing on **`type`** narrows **`routing`**, **`payload`**, and **`sendMessage`** together. Type guards live next to the variant (e.g. `isStorableConversationRecordGenerateRoomPreview`).

## Adding a second prototype path (new `type` variant)

1. Add a **storable** branch in `conversationTypes/<variant>/` (e.g. `baseClasses.ts` for routing + payload shape).
2. Extend **`StorableConversationRecord`** with `| StorableConversationRecord...`.
3. Add a **handle** type (storable branch + `sendMessage` with the right args).
4. Extend **`ConversationHandle`**.
5. Add a **`case`** in [`internalCache/conversations.ts`](../internalCache/conversations.ts) (and optional `assertNever` in `default` when the union grows).
6. Register/get tests and materialization tests for the new branch.

Persisted storage always uses **storable** types only.

## Streaming / progress (planned)

The WebSocket **`generateRoomPreview`** path in [`app.ts`](../app.ts) uses **`registerConversation`**, **`generateRoomPreview`**, then reads **`internalCache.Conversations.get(conversationId).handle`** and calls **`sendMessage`** (single **`ReturnValue`** completion). **Multi-stage** delivery (server-driven **Generating** plus final result) is specified in [AGENT.planning.md](AGENT.planning.md) (**Multi-stage WebSocket delivery and coordination trap**), task list **section 4**, and the client [lifeLine AGENT.md](../../../charcoal-client/src/slices/lifeLine/AGENT.md) (**`socketDispatchConversation`**).

## Design reference

Full rationale, fragment staging, coordination trap, and deferred items: [AGENT.planning.md](AGENT.planning.md). Task sequencing: [AGENT.planning.tasklist.md](AGENT.planning.tasklist.md). Composite **`get`**, rejected alternatives, and send/orchestration boundaries are summarized in this file (sections above).
