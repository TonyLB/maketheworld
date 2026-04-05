# Conversations registry (agent notes)

## Client multi-message WebSocket (`socketDispatchConversation`)

Charcoal-client exposes **`socketDispatchConversation`** in [`charcoal-client/src/slices/lifeLine/index.api.ts`](../../../charcoal-client/src/slices/lifeLine/index.api.ts) (notes in [`charcoal-client/src/slices/lifeLine/AGENT.md`](../../../charcoal-client/src/slices/lifeLine/AGENT.md)). It was **prototyped** when the workbench **room preview generation** UI drove a multi-step stream (that UI and the matching **preview** conversation path on the server are **removed**).

The client helper is **known to work** (tests and historical use) and may matter for **future** features that need correlation (`conversationId`, optional **`RequestId`**) and terminal steps over the socket. **Today** there are **no production call sites** in charcoal-client pairing with a live multi-message server stream for preview.

On Ephemera, the **`generateRoomPreview`** **conversation** module and **`ConversationStep`** / **`apiClient.send`** materialization for that pipeline are **gone**. Passive render uses **`roomStateRender`** rows and **`materializeRoomStateRender`**, which maps terminal resolve output to **message bus** messages (see below), not the old preview wire.

## Two layers: storable vs live handle

**Storable rows** (`StorableConversationRecord`, today **`StorableConversationRecordRoomStateRender`**) are **JSON-safe**: `conversationId`, `type`, `routing`, `payload` fragments. They are what [`internalCache/conversations.ts`](../internalCache/conversations.ts) **`set`** stores and what a future Dynamo row would contain.

**`internalCache.Conversations.get`** is a **runtime composite read**: `{ record, handle } | undefined`. **`record`** is that storable row. **`handle`** is a discriminated union on **`kind`** (see [`conversationTypes/compositeRead.ts`](conversationTypes/compositeRead.ts)):

- **`roomStateRender`** rows: **`kind: 'conversationCompositeReadRoomStateRender'`** with **`sendMessage`** --- built by **`materializeRoomStateRender`** ([`conversationTypes/roomStateRender/materialize.ts`](conversationTypes/roomStateRender/materialize.ts)). Terminals map to **`RenderReady`** / related message-bus shapes when **`routing.passiveBusDelivery`** is set.
- **Unknown `type` values** (until enriched): **`kind: 'conversationCompositeReadStub'`** --- no `sendMessage`.

Use **`isConversationCompositeReadHandleRoomStateRender`** / **`isConversationCompositeReadHandleStub`** before relying on **`sendMessage`**.

There is no separate `getConversationHandle` helper; enriched **`sendMessage`** lives on the composite `internalCache.Conversations.get(...).handle`.

**Live handles** (`ConversationHandle`, today **`ConversationHandleRoomStateRender`**) add **runtime-only** **`sendMessage`**. They are built **on read** in [`internalCache/conversations.ts`](../internalCache/conversations.ts).

Use `internalCache.Conversations.get(conversationId)?.record` when you only need the data; use `internalCache.Conversations.get(conversationId)?.handle` + guards when you want the enriched read in one step.

## API contract: `set` vs composite `get`

- **`set(...)`** accepts **JSON-safe** `StorableConversationRecord` only (what a future Dynamo row would hold).
- **`get(...)`** is a **runtime** read: **`record`** plus **`handle`** (discriminated enrichment --- not the same type as the stored row alone).

Storage is pure data; read-time enrichment is predictable and typed (**`record`** vs **`handle`**).

## Design decision: composite `get` (Option C)

**Chosen:** one composite **`internalCache.Conversations.get(...)`** that returns **`{ record, handle }`**.

**Rationale:** Shortest path at usage sites; matches the **`internalCache`-first** model used elsewhere. **`materializeRoomStateRender`** turns stored rows into **`sendMessage`** behavior; orchestration **`generateRoomPreview`** ([`dataSource/renderOrchestration/generateRoomPreview.ts`](../dataSource/renderOrchestration/generateRoomPreview.ts)) does **not** call the registry --- it receives optional **`sendMessage`** from **`findRender`** deps for slow-path feedback.

**Guardrails:** Keep **`record` / `handle`** naming; document that **`set`** writes storable rows while **`get`** is composite.

## Testing / layering note

Prefer tests that exercise the **composite `get`** when you need end-to-end behavior; align with mocking **`internalCache`** the way other Ephemera code does.

## Orchestration boundary (`generateRoomPreview` module)

[`dataSource/renderOrchestration/generateRoomPreview.ts`](../dataSource/renderOrchestration/generateRoomPreview.ts) is the **cache-miss generator** (LLM + `putCacheRecord`). It takes optional **`sendMessage`** for **`RenderProgress` / `RenderResolveOutput`**. Callers are **`findRender`** and tests --- not **`app.ts`** preview registration. Passive **`orchestrateRenderRequest`** mints a **`roomStateRender`** row and wires **`sendMessage`** into **`findRender`** so terminals reach the bus via **`materializeRoomStateRender`**.

## Invariants

- Stored conversation rows remain **serializable** and persistence-ready.
- **`roomStateRender`** materialization is the layer that connects stored rows to **message bus** delivery for passive orchestration (when **`passiveBusDelivery`** is present).
- **Slow-path-only** rules for **`generating`**, etc., live in orchestration / **`generateRoomPreview`** policy, not ad hoc sends from materialize.

## Wire types (`packages/mtw-interfaces`)

Legacy **preview** client/API shapes (e.g. **`GenerateRoomPreview`**, **`ConversationStep`** with **`pipeline: 'generateRoomPreview'`**) may still exist in **`@tonylb/mtw-interfaces`** until the [interfaces remove-preview pass](../../../taskPlanning/packages/mtw-interfaces/AGENT.removePreviewGeneration.planning.md). Lambda no longer defines a **`generateRoomPreview`** **conversation** variant or **`GenerateRoomPreviewResult`** next to storable rows.

## Temporary: `conversationId` on renderCache bus traffic

For the prototype, **`conversationId`** may be set on **`api.ephemera`** **`Put Cache Record`** commands and echoed on **`mtw.ephemera.renderCache`** **`Cache Updated`** payloads (see [`dataSource/localApiEvents.ts`](../dataSource/localApiEvents.ts), [`dataSource/renderCache/index.ts`](../dataSource/renderCache/index.ts)). **Dynamo** cache rows are unchanged. Remove this plumbing once orchestration can correlate cache events to conversations **without** carrying intent inside the DS envelope (see [AGENT.planning.tasklist.md](AGENT.planning.tasklist.md) **section 7**).

## Discriminant

A single top-level **`type`** field identifies the variant. Narrowing on **`type`** narrows **`routing`**, **`payload`**, and **`sendMessage`** together. Type guards include **`isStorableConversationRecordRoomStateRender`**.

## Adding a new `type` variant

1. Add a **storable** branch under `conversationTypes/<variant>/`.
2. Extend **`StorableConversationRecord`**.
3. Add a **handle** type and **`materialize...`** if needed.
4. Extend **`ConversationHandle`** / **`ConversationCompositeReadHandle`**.
5. Add a **`case`** in [`internalCache/conversations.ts`](../internalCache/conversations.ts).
6. Register/get tests.

## Design reference

Full rationale and deferred items: [AGENT.planning.md](AGENT.planning.md). Task sequencing: [AGENT.planning.tasklist.md](AGENT.planning.tasklist.md).
