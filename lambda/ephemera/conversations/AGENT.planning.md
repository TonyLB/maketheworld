*Status: ACTIVE PLANNING DOCUMENT - conversations registry (routing + fragment staging, v1 in-memory).*

**Prototype notice:** The **first** fragment shapes and aggregation rules we implement are intentionally a **prototype**. They should be **documented as such in code** (comments or adjacent README), not treated as stable public API. Expect **iteration** once we have real usage; see **Prototype fragment shape** and **Evolving fragment kinds** below.

## Purpose

This document tracks the design for a **conversation registry** under `lambda/ephemera/conversations/`, backed by **in-memory** storage on `internalCache.Conversations`.

The registry has **two** jobs:

1. **Delivery routing** — a **first-class correlation handle** (`conversationId`) so code anywhere in an Ephemera handler run can **look up** enough context to **stream multiple responses** (or route perception) **without** threading callbacks through deep async call chains.
2. **Intermediate fragment storage** — **serializable** **fragments** produced by **different** domains or steps (e.g. character-location side effects vs perception output) keyed by the same `conversationId`, so a later **assembly** step can merge them into ordered user-visible messages (`PublishMessage`, `Perception`, etc.) without relying on **implicit** cache warming or **tribal** flush order.

This is **not** a commitment to a full `mtw.ephemera.conversations` DataSource on day one; see "DataSource" below.

## Motivation

- **Request/response is insufficient** when LLM or multi-step work introduces latency: the UI needs early feedback ("Generating...") and later completion tied to the **same user intent**.
- **`RequestId`** (WebSocket) correlates a single `ReturnValue`; orchestration events today carry `characterId`, `targets`, `messageGroupId`, etc., but not a **unified operation id** shared across the bus.
- A **registry** centralizes "how to deliver" for a given run so **orchestration**, **perception**, and **api** boundaries stay decoupled.
- **Cross-domain coordination** (e.g. `moveCharacter` and `perception` today; later **`mtw.ephemera.characterLocations`** vs **`mtw.ephemera.perception`**) needs an **explicit** handoff: "this fragment was produced **for** this coordinated moment" — not only **implicit** updates to `internalCache` (e.g. `RoomCharacterList`) that downstream code must assume were written by a prior step.
- **Fragment storage** avoids **brittle** alternatives: **fat** stream events that mix domain state with messaging, or **messageBus**-only staging (fragments as bus messages + priority ordering) that recreates the same assembly problem **implicitly** and is harder to reason about.

## Scope (v1)

- **In-memory only**: registry state lives on `internalCache.Conversations` and is cleared with `internalCache.clear()` at handler start (same **invocation-scoped** lifecycle as other internal memoization; see `../dataSource/renderOrchestration/AGENT.planning.md` lifecycle notes).
- **Thin API** (shape TBD): create/register a conversation record, look up by `conversationId`, **attach or merge fragments** by kind (TBD), optionally mark complete or remove (exact verbs to be decided).
- **Serializable records**: anything stored must be safe to **persist later** (no closures, no non-JSON-friendly handles). v1 may only use memory, but the **field names and types** should assume a future Dynamo row. **Fragments** are part of that contract (each fragment kind is a **typed**, serializable blob).
- **Assembly**: a dedicated step (module or handler TBD) reads **routing + fragments** for a `conversationId` and emits final bus messages with correct **`OrchestrateMessages`** / `messageGroupId` usage where required. v1 may **inline** assembly for the first pipeline we wire; the **shape** should still separate **fragment writers** from **assemblers** conceptually.

### Intermediate fragments (why here, not only on the bus)

- **Explicit contract**: e.g. `characterLocations` processing stores "post-move presence" (or whatever slice perception needs) on the conversation; **`perception`** reads it by `conversationId` instead of assuming **`moveCharacter`** ran first and warmed **unspecified** cache keys.
- **Scheduling flexibility**: producers can run in an order that minimizes **avoidable latency** once fragments are **named** and **required** for assembly (subject to real dependencies: some steps still **must** wait for domain writes).
- **Multi-DataSource future**: inlining everything in one `receiveEvents` **does not** scale once **multiple** domains each have their own DS and `api.ephemera` surfaces; **fragments + assembler** keeps cross-domain orchestration **one** place without **fat** outbound stream events.

**Rejected / deferred for this design (documented for comparison)**

- **Bus-only fragments**: same intermediate assembly **implicitly**; priority ordering is easy to get wrong; harder to test than a **typed** fragment map on the conversation.
- **Fat stream events**: domain event carries full "how we messaged" payload; hard to reason about and couples domains.

## Naming: `conversationId`

We use **`conversationId`** (not `operationId`) in **types and wire shapes** that may outlive the first MVP:

- v1 may only support a **single logical operation** per id (multi-message responses, not multi-turn chat).
- Broader **back-and-forth** semantics can reuse the same id without a cross-repo rename of persisted fields.
- Document in code/comments that **v1 is a subset** of "conversation" so readers do not assume full chat transcripts on day one.

## Relationship to other modules

| Area | Role |
|------|------|
| `dataSource/renderOrchestration/` | Publishes lifecycle events; should carry `conversationId` once registry exists. |
| `perception/` | Uses lookup to route placeholders and final messages; may **write** perception fragments onto the conversation for assembly. |
| `internalCache/` | Holds `Conversations` (and `clear()` integration). |
| `dataSource/` (e.g. future `characterLocations`, `perception`) | Each emits **domain** stream events; **fragments** on the conversation record the **handoff** for cross-domain user messaging. |
| **Assembler** (name TBD) | Consumes **fragments + routing** for a `conversationId`, emits ordered `PublishMessage` / `Perception` / etc. |

## Data shape (open decisions)

The following are **discussion items**, not final:

### Identifier

- **Format**: `conversationId` is an opaque string, consistent with other synthetic ids in Ephemera: generate it with **`uuidv4()`** at registration time (do not derive it from room/component/perspective or other domain fields).
- **Stability**: same id for the whole run from "user asked" through terminal outcome.

### Delivery paths (orthogonal; avoid one megablob)

Several different mechanisms show up next to each other in orchestration types (e.g. `RenderTargetContext` in `dataSource/renderOrchestration/events.ts`). They solve **different** problems; the conversations registry should not assume one flat record must satisfy every path at once.

| Path | Typical need | Notes |
|------|----------------|--------|
| **Direct / authoring (e.g. Preview)** | A **specific** user gets progress + result on **their** connection | WebSocket **`RequestId`** on `ReturnValue`; **`CharacterId`** from the request. Not the same as "everyone in the room." |
| **Room-scoped broadcast** | Whoever is **in the room now** should receive stream chunks while present | Resolve **targets** from **presence** at send time (e.g. `RoomCharacterList`). Practical v1: recipients are **current** occupants; **do not** require a cumulative list of everyone who ever saw an earlier chunk unless we explicitly add that product requirement later. |
| **Ordered sub-orchestration (e.g. move)** | A **single** logical update that must interleave with related messages (leave / arrive / perception) | **`messageGroupId`** via `internalCache.OrchestrateMessages` (`before` / `after` / `next`); see `moveCharacter/index.ts`. This is **timeline ordering**, not "who is the audience." |

**Implication:** the serializable payload for `internalCache.Conversations` should be a **small core** (e.g. `conversationId`, maybe channel discriminant) plus **path-specific** fields or **variants**, rather than a universal superset of every field `RenderTargetContext` might ever carry.

### Serializable delivery payload + fragment map (main open items)

The registry cannot store a real **`sendMessage` function** (not JSON-safe, not Dynamo-safe). The intended pattern is:

1. Store a **serializable delivery-routing record** keyed by `conversationId`.
2. Store **named intermediate fragments** on the same record (or a linked sub-structure), each **typed** and **serializable**. The **first** cut is a **single prototype shape** (see below); later we generalize.
3. Expose **small helpers**: **writers** append fragments; **assemblers** (or `deliver` for streaming-only flows) **`get`** the record and call `messageBus.send(...)` (e.g. `PublishMessage`, `Perception`, `ReturnValue`).

So the design work is to pin down **routing fields**, **fragment kinds**, and **completeness rules** (when assembly is allowed to run) so any code that runs mid-flight can contribute or consume **without** the original closure and **without** undocumented cache side effects.

### Prototype fragment shape (move / character-location style)

For the **initial** implementation we are **prototyping** one concrete merged structure, not a final taxonomy:

- Treat fragments as a **`Partial`** record of three conceptual slots aligned with existing move/perception orchestration:
  - **`leaveMessage`** — whatever serialized data is needed to emit the leave-side `WorldMessage` (and targets / suppression flags as needed).
  - **`arriveMessage`** — same for the arrive-side `WorldMessage`.
  - **`roomHeader`** — whatever serialized data is needed for the room header / `Perception` leg (e.g. WML or references produced by perception).
- **Aggregation**: **writers** (e.g. character-location path, perception path) each **merge** their contribution into this partial record as pieces become available (same keys overwritten or deep-merged per field rules we define for the prototype). The **assembler** runs when the record satisfies **completeness** for that pipeline (all required keys present, or explicit partial rules).

This **single-record partial** is a **learning vehicle**: it keeps the first assembler small and makes cross-domain handoffs visible. It is **not** the long-term shape for every future pipeline (preview streaming, knowledge, etc.).

### Evolving fragment kinds (post-prototype)

After we have **a few real examples** of fragment payloads and merge behavior, it is **almost inevitable** that we will:

- Replace the flat prototype with a **discriminated union** of fragment payload types (per domain or per message kind), and/or
- Introduce a **registration** pattern for new fragment kinds — **analogous to** stream event serializers or similar factories — so adding a new variant is **one** well-scoped change (type + serializer + merge rule + assembler hook) instead of ad-hoc edits across the registry.

Until then, **prefer** keeping the prototype **localized** (one module or one union branch) and **label** it **prototype** so the follow-up generalization is a planned refactor, not a surprise breaking change.

**Assembly and races**

- The assembler must run only when **required** fragments are present (or when explicitly handling partial failure). Document **per pipeline** which fragments are mandatory.
- **Parallelism** is a **scheduling** benefit: fragments make **independent** work easier to run concurrently **where dependencies allow**; they do not remove **ordering** requirements for the final user-visible timeline (`OrchestrateMessages` still applies at assembly time).

**Grounding in render orchestration (planned "Generating" path)**

v2 render lifecycle messages in `dataSource/renderOrchestration/events.ts` reuse **`RenderTargetContext`** (`characterId`, `targets`, `messageGroupId`) plus **`componentId`** / **`perspective`**. That type is a **convenient aggregate for bus messages**, not proof that every conversation record needs every field: see **Delivery paths** above for which axis matters when.

For **Room** placeholders and final perception, perception still needs concrete **`characterIds`** (or equivalent) for `sendRoomGeneratingHeader`-style sends; mapping **`targets`** or room id to character ids may be **path-specific**.

The Room placeholder path today is implemented as **`sendRoomGeneratingHeader`** in `perception/index.ts`, which sends `PublishMessage` with `displayProtocol: 'PerceptionMessage'` and needs:

- **`roomId`** (the Room `componentId`),
- **`characterIds`** (non-empty list of `EphemeraCharacterId` — today passed explicitly; orchestration may only have a single `characterId` or may need to **resolve** `targets` into character ids, which is a follow-up),
- **`messageGroupId`** (optional; ties placeholder to later overwrites).

**What we can know at conversation registration time**

For a flow that starts from an API request (e.g. `GenerateRoomPreview`), the handler already has **`CharacterId`**, **`RoomId`**, optional **`RequestId`**, and perspective inputs (`assetStack` / mark state). That is enough to **register** routing for:

- **Perception-style** sends (who receives the "Generating" header and later room perception),
- **WebSocket** completion (`ReturnValue` with the same **`RequestId`** when applicable).

For bus-only triggers (e.g. state-driven `RenderRequested`), the publisher of `RenderRequested` must supply **`RenderTargetContext`** (or equivalent) at registration time so later handlers do not lose delivery context.

**Additional fields (still TBD)**

- **Client correlation**: optional `requestId` / WebSocket `RequestId` for `ReturnValue` and client-side matching.
- **Domain hints**: `componentId`, perspective key or full **`Perspective`** if serializable (needed for cache/orchestration alignment).
- **Phase / status** (optional in v1): e.g. `pending` | `generating` | `complete` | `failed` to guard duplicate sends.

**Open question**

Prefer a **discriminated** delivery envelope (`directPreview` | `roomBroadcast` | `orderedMove` | ...) with **only the fields that path needs**, over a single superset of `RenderTargetContext` + `componentId` + `perspective` + `requestId`. First consumer wiring should drive the first variant(s), not the union of all possible render paths.

### Future typing direction: correlated `record` + enriched `handle`

When the registry exposes a composite read API shaped like `{ record, handle }`, it is easy for types to become an "uncorrelated product": `record` narrows by `record.type`, while enriched capability narrows separately (for example via `handle.kind`).

For the long-term "single storage type, less typeguard duplication" goal, prefer a **correlated discriminated union** (or envelope) where the same discriminant ties together:

- the stored row variant (`record.type`), and
- the enriched runtime capability needed at call sites (for example `handle.sendMessage` for that same `record.type`).

Revisit trigger: when we have a concrete **second** conversation `type` that is enriched via composite reads, and call sites need correlated access beyond just "call `sendMessage` on the handle".

Non-goal until then: removing existing stub vs live distinctions; keep them explicit so intermediate migration steps remain safe.

### API surface (brainstorm)

- Prefer an **async** registry API (`get` returns `Promise<...>`) even when v1 implements with synchronous memory, so Dynamo-backed `get` does not force a second migration.
- Operations might include: `register`, `get`, **`putFragment` / `mergeFragments`** (names TBD), `complete` / `delete` (optional), or idempotent terminal transitions.
- **Assembly** might be `tryAssemble(conversationId)` or triggered when the last required fragment arrives — **TBD**.

## Multi-stage WebSocket delivery and coordination trap (preview path)

**Status:** The **lambda** preview conversation module and **`generateRoomPreview`** API ingress are **removed**. This section remains as **design history** for multi-stage WebSocket coordination; **`socketDispatchConversation`** on the client is still available for **future** pipelines.

### The lock-in loop

**Historically**, **authoring preview** and similar flows tended to co-evolve as a **single round-trip**:

- The **client** uses **`socketDispatchPromise`**, which resolves **once** when an inbound message matches **`RequestId`** (see `charcoal-client/src/slices/lifeLine/AGENT.md`).
- The **Ephemera** handler merges **`ReturnValue`** into **one** response body ([`returnValue/extractReturnValue`](../returnValue/index.ts)).
- **`conversation.sendMessage`** for the preview pipeline was implemented for **terminal** outcomes in the removed **`generateRoomPreview`** conversation module.

Together these create a **coordination trap**: moving to **event-driven** orchestration (multiple internal steps, async cache outcomes) **wants** multi-stage signaling, but the **wire** only models **one** terminal payload per request, so neither side fully commits until the other does.

### Exit strategy: vertical slice

Break the loop with an **end-to-end wedge** that does **not** require a full multi-DataSource cascade on day one:

1. **Registry:** Allow **`registerConversation`** to accept an **optional** client-supplied **`conversationId`** (validated UUID; reject duplicates) so the same id can label the registry row and every streaming message; when omitted, keep **server-generated** ids for backward compatibility. Detailed checklist: [`AGENT.planning.tasklist.md`](AGENT.planning.tasklist.md) **section 4** (first task under that section).
2. **Client:** Introduce **`socketDispatchConversation`** (name TBD): subscribe to **multiple** correlated WebSocket payloads (e.g. shared **`conversationId`**, with **`RequestId`** optional during migration) and expose **`onEvent`** / teardown (unsubscribe when the UI unmounts or starts a new run). Documented in **`charcoal-client/src/slices/lifeLine/AGENT.md`**.
3. **Wire shape:** Add a discriminated **step** envelope (working name **`ConversationStep`**) for progress vs completion vs error; keep **`conversationId`** (and optionally **`RequestId`**) stable across steps.
4. **Server:** Extend **materialization** so **`sendMessage`** (or a parallel path) can emit **non-terminal** steps before the final **`ReturnValue`** (or migrate completion entirely into steps once clients exist).
5. **Orchestration:** Emit an early **generating** signal in the same invocation **before** blocking work, then align with **`RenderGenerationStarted`** / cache outcomes as the cascade matures ([`../dataSource/renderOrchestration/AGENT.planning.md`](../dataSource/renderOrchestration/AGENT.planning.md)).

**Scope:** This section targets **direct / authoring preview** (`ReturnValue` to **one connection**). It is **orthogonal** to in-room **`PublishMessage`** / **`sendRoomGeneratingHeader`** (perception path); do not collapse those into one mechanism here.

### Task sequencing

Executable checklist: [`AGENT.planning.tasklist.md`](AGENT.planning.tasklist.md) **section 4** (multi-stage WebSocket contract). Cross-links: [`../dataSource/renderOrchestration/AGENT.planning.md`](../dataSource/renderOrchestration/AGENT.planning.md) **Integration follow-up**, [`AGENT.event.md`](../AGENT.event.md).

## DataSource: `mtw.ephemera.conversations`?

**v1 default: no** separate `EphemeraDataSource` for conversations unless we have:

- Inbound **bus commands** (e.g. `api.ephemera`) that mutate conversation state from **multiple writers**, or
- A need for the same **replay / streaming** machinery as other DS-backed domains.

The **internalCache gateway** pattern (memory mirror + future durable store) still applies when we add persistence; the **DataSource shell** can appear when **inbound event streams** justify it.

## Implementation checklist (when we build)

- [ ] `internalCache/conversations.ts` (or equivalent) + wire into `InternalCache` constructor and `clear()`.
- [ ] `lambda/ephemera/conversations/` module: types for **routing + fragment map** (prototype `Partial` of `leaveMessage` / `arriveMessage` / `roomHeader` for first pipeline), registry implementation, tests; **comment or doc** that fragment types are **prototype**.
- [ ] Thread `conversationId` through orchestration events and WebSocket responses where needed.
- [ ] First **assembler** (or inline equivalent) for one end-to-end pipeline; document **required fragment kinds** for that pipeline.
- [ ] Short `AGENT.md` in this directory once behavior stabilizes (optional follow-up).

## References

- `lambda/ephemera/dataSource/renderOrchestration/AGENT.md` - orchestration responsibilities and status (canonical).
- `lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md` - message contracts and handler lifecycle.
- `lambda/ephemera/dataSource/renderOrchestration/events.ts` - `RenderTargetContext`, lifecycle message shapes.
- `lambda/ephemera/perception/index.ts` - `sendRoomGeneratingHeader` (placeholder "Generating..." path).
- `lambda/ephemera/moveCharacter/index.ts` - `messageGroupId` / `OrchestrateMessages.before` and `.after` for leave vs arrive ordering.
- `lambda/ephemera/internalCache/index.ts` - `clear()` and cache composition.
- `lambda/ephemera/AGENT.event.md` - WebSocket and internal bus overview.
- `charcoal-client/src/slices/lifeLine/AGENT.md` - `socketDispatchPromise` vs proposed `socketDispatchConversation` (multi-stage preview).
