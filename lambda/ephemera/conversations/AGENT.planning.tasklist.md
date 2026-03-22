*Status: DRAFT TASK LIST - refine as we implement. Full design context: `AGENT.planning.md`.*

## How to use this file

- Tasks are **high-level**; break them into PR-sized steps when you pick them up.
- Mark items **done** by checking the box or moving completed work to a short "Done" section at the bottom.
- **Prototype** types and behavior should stay **labeled** in code until we replace them with a union + registration pattern (see `AGENT.planning.md`).

### Staged prototyping

`AGENT.planning.md` describes **two** registry jobs: **(1) delivery routing** via `conversationId`, and **(2) intermediate fragment storage** for multi-step / cross-domain merge before assembly. We do **not** have to implement both in the first PR.

Work proceeds in **two typing passes** (sections 2 and 5) and **two prototype passes** (sections 3 and 6): first establish a **full-record discriminant** (e.g. top-level **`type`**) with a **stub payload** on the first member, then rehearse a **narrow API pipeline**; later add union members and rehearse **fragments + assembly**.

A **narrow, API-driven** flow (for example **GenerateRoomPreview** from the UI button) is a good **first partial rehearsal**: one cohesive async pipeline can lean on a **serializable routing record** (who/what to address, `RequestId`, room/perspective, etc.) so later code can resolve delivery **without** threading ad-hoc context, while **not** yet requiring named **fragments** from multiple writers. That still exercises registration, lookup, and the **shape** of durable-friendly routing fields.

A **second prototype pass** then adds the **fragment** map, merge rules, completeness, and an **assembler** where multiple domains or steps contribute (closer to move + perception + `OrchestrateMessages`). Treat the first pass as proving the **throughline**; treat the second as proving **cross-domain staging**.

---

## 1. Foundation: `internalCache` + module shell

- [x] Add `internalCache/conversations.ts` (or equivalent) implementing `ConversationsData` (name TBD) with **invocation-scoped** storage (cleared with `internalCache.clear()`).
- [x] Wire `Conversations` into `internalCache/index.ts` (`InternalCache` field, constructor if needed, `clear()`).
- [x] Create `lambda/ephemera/conversations` module entry (types barrel + registry implementation file(s)) so imports have a stable path.

---

## 2. First-pass typing (full-record discriminant + stub payload)

**Goal:** A **full-record discriminant** (e.g. a top-level **`type`** field) so each variant of `ConversationRecord` narrows **both** routing-related fields **and** payload **together**. First variant only in this pass; use a **placeholder payload** (prefer a **named** empty type, e.g. `Record<string, never>`, over a bare `{}`). No meaningful fragment types yet.

- [x] Define **`conversationId`** as opaque string; generation via **`uuidv4()`** at registration only (see `AGENT.planning.md`).
- [x] Define the **first union member**: one **`type`** tag (full-record discriminant) plus **serializable** routing fields and a **stub payload** for that member only (empty / unused for now). **Comment** that additional union members and payload shapes land in **section 5**.
- [x] Implement minimal registry operations: e.g. `register`, `get`, `delete` (exact names TBD). Defer `mergeFragments` / `putFragment` to **section 5** unless a no-op stub is useful.
- [x] Prefer **async** method signatures on the registry (`get` returns `Promise<...>`) even when v1 uses in-memory sync internals.
- [x] Unit tests for register, get, delete, idempotency rules where applicable, and clear behavior (narrow scope; extend in **section 5** / **section 6** as merge and fragments land).

---

## 3. First prototype pass: routing-first pipeline (e.g. API-activated preview)

**Chosen path:** WebSocket **`generateRoomPreview`** in [`app.ts`](../app.ts): register row, **`generateRoomPreview`** with optional **`conversationId`** on orchestration, completion via **`getConversationHandle`** **`sendMessage`**; optional **`conversationId`** on **`Put Cache Record`** / **`Cache Updated`** for prototype correlation.

**Goal:** Register a `conversationId`, persist **routing** for the run, and thread that id through the handler so delivery stays coherent (e.g. `ReturnValue` / `RequestId`). **No requirement** yet for multiple fragment writers or a full assembler beyond whatever the single pipeline already does.

Suggested candidate: **GenerateRoomPreview** (UI button): one cohesive async chain; exercises **job (1)** from `AGENT.planning.md` more than **job (2)**.

- [x] Wire **registration + lookup** for the chosen API path; align `ConversationRecord` with the **section 2** union for that path.
- [x] Thread **`conversationId`** through the request handler and any helpers that need delivery context (minimal surface; prototype bus threading is temporary; **section 7** removes it from the renderCache DS).
- [x] Keep **WebSocket** / `ReturnValue` / `RequestId` coherent with the registered record (**section 7** picks up renderCache correlation without DS-threaded `conversationId`).
- [x] Tests scoped to routing + registry behavior for this path (bus mocks as needed).

---

## 4. Multi-stage WebSocket contract (preview; next after section 3)

**Goal:** Break the **single-ReturnValue** coordination lock for authoring **preview** (and similar flows) so the client and server can support **multiple correlated** messages per logical operation. Full rationale: [`AGENT.planning.md`](AGENT.planning.md) section **Multi-stage WebSocket delivery and coordination trap (preview path)**. Client patterns: [`charcoal-client/src/slices/lifeLine/AGENT.md`](../../../charcoal-client/src/slices/lifeLine/AGENT.md).

**Wedge:** Ship a **vertical slice** first (same lambda invocation may emit **generating** then **result** before async multi-DataSource work is required). Wire shape names (**`ConversationStep`**, **`socketDispatchConversation`**) are **working names** until implementation locks them.

**Correlation (preferred):** Client-generated **`conversationId`** on the wire, with **`registerConversation`** accepting an **optional** caller-supplied id when present (validate format, reject duplicates / collisions); omit to keep **server-generated** `uuidv4()` for existing call sites. See discussion in planning narrative; **`RequestId`** may still ride alongside during migration.

- [x] **Registry (server):** Refactor **`registerConversation`** / [`registry.ts`](../registry.ts) so **`conversationId`** may be **optional** in the input: if provided, validate (e.g. UUID) and register under that id; if omitted, preserve current **`uuidv4()`** behavior. Document invariants (single registration per id per invocation, reject duplicate `set`). Add **unit tests** (happy path, duplicate id, invalid shape, omitted id matches legacy).
- [ ] **Client:** Add **`socketDispatchConversation`** (or equivalent): subscribe to **multiple** `LifeLinePubSub` payloads sharing **`conversationId`** (and optionally **`RequestId`** during migration), expose **`onEvent`** / **unsubscribe**; drop subscription on unmount, navigation, or superseding run.
- [ ] **Shared types:** Discriminated **step** union (e.g. generating vs terminal result vs error); align with Ephemera **`ReturnValue`** / future **`ConversationStep`** body; **`packages/mtw-interfaces`** or ephemera client types as appropriate.
- [ ] **Server:** Extend **`sendMessage`** materialization ([`conversationTypes/generateRoomPreview/materialize.ts`](../conversationTypes/generateRoomPreview/materialize.ts)) to emit **non-terminal** steps; carry **`conversationId`** on each step (and **`RequestId`** only if still needed for migration / merged `ReturnValue`).
- [ ] **Preview UI:** Update [`RoomPreviewEditor`](../../../charcoal-client/src/components/Workbench/RoomEdit/RoomPreviewEditor.tsx) (and tests) to consume the stream; align **Generating** UX with server-driven steps where intended.
- [ ] **Orchestration alignment:** When **`generateRoomPreview`** path emits early feedback, coordinate with [`renderOrchestration/AGENT.planning.md`](../renderOrchestration/AGENT.planning.md) (`RenderGenerationStarted`, cache lifecycle).

---

## 5. Second-pass typing (payload union + second routing variant)

**Goal:** Extend the **same** `ConversationRecord` union: add a **second `type` variant** with a **meaningful** payload (prototype `Partial` of `{ leaveMessage, arriveMessage, roomHeader }` or equivalent). Refine the **first** variant's payload from stub to a **typed** fragment union where needed. **Comment** that fragment types are **prototype**.

- [ ] Introduce **additional union members** on the full-record discriminant (same top-level **`type`** pattern as section 2). Each member carries its own routing + payload fields; **narrowing on `type`** selects both.
- [ ] Restrict **empty** / no-fragment payload to the **first** `type` only (type-level story matches the first prototype pass).
- [ ] Add the **second** `type` variant (e.g. **moveCharacter** / ordered world messages) with routing + payload fields **for that pipeline**.
- [ ] Implement **`mergeFragments` / `putFragment`** (names TBD) and any **merge** semantics tests deferred from section 2.

---

## 6. Second prototype pass: fragments + assembly

Document the chosen path in a one-line note at the top of this section when you start it.

**Goal:** Prototype **job (2)**: named fragments, merge semantics, completeness, and an **assembler** that emits ordered messaging (`PublishMessage`, `Perception`, **`OrchestrateMessages`** / `messageGroupId` as needed). Typical fit: **move + ordered world messages + perception**, or any flow with **at least two** writers contributing before user-visible output.

- [ ] Document **completeness rules**: which of `leaveMessage` / `arriveMessage` / `roomHeader` are **required** before assembly; partial failure rules if any.
- [ ] Implement **fragment writers**: at least two code paths that **merge** into the conversation record (simulated or real).
- [ ] Implement **assembler** (or thin orchestrator): reads conversation by `conversationId`, uses **`OrchestrateMessages`** / `messageGroupId` as needed, emits `PublishMessage` / `Perception` / etc. (match existing `moveCharacter` / perception patterns where applicable).
- [ ] Tests for assembler: given a fully populated prototype fragment record, **expected** bus messages or message bus mock expectations (scope to what is practical).

---

## 7. Third prototype pass: correlate `renderCache` without intent inside the DS

**Goal:** After the routing + fragments prototypes land, **remove** the **temporary** plumbing that threads **`conversationId`** through **`api.ephemera` `Put Cache Record`** commands and **`mtw.ephemera.renderCache` `Cache Updated`** payloads (see [`AGENT.md`](AGENT.md), [`dataSource/localApiEvents.ts`](../dataSource/localApiEvents.ts), [`dataSource/renderCache/`](../dataSource/renderCache/)). **`mtw.ephemera.renderCache`** should again emit **cache-shaped** events only; **conversations** (or a dedicated orchestration module) **subscribes** to those streams and **resolves** which open conversation (if any) an event belongs to using **keys on the event** (`componentId`, `perspectiveId`, `dataCategory`, etc.) plus **registry lookup**, not a conversation id carried inside the DS envelope.

**Rationale:** This matches the original intent behind **`PreviewGenerationRequests`**: match **outputs** of the cache pipeline back to **waiters** without stuffing **original intent** into the data source implementation.

- [ ] **Subscribe** to the relevant internal bus output(s) (e.g. `mtw.ephemera.renderCache` **`Cache Updated`**, errors as needed) from a **single orchestration layer** that can consult **`internalCache.Conversations`** (or future durable rows).
- [ ] **Define match rules** (e.g. room + perspective, optional request token, merge keys) so a **`Cache Updated`** can be tied to an **extant** `generateRoomPreview` (or other) conversation **without** `conversationId` on the event.
- [ ] **Delete** prototype fields and parameters: strip **`conversationId`** from **`PutCacheRecordCommand`**, **`RenderCacheCacheUpdatedPayload`**, **`PublishPutCacheRecord`**, **`GenerateRoomPreviewOptions`**, and any call sites/tests that exist only for DS-threaded correlation; keep behavior that still makes sense (e.g. synchronous preview completion in **`app.ts`** unchanged aside from removing the bus pass-through).
- [ ] **Tests:** orchestration resolves the correct conversation (or none) from a realistic **`Cache Updated`** payload; renderCache DS tests do **not** require `conversationId` on the stream.

---

## 8. Documentation and cleanup

- [ ] Mark prototype fragment types and assembler in **code comments** (or short module README) pointing to `AGENT.planning.md`.
- [x] Add `AGENT.md` in this directory once behavior and API are stable enough for other agents (optional; can follow first merge).

---

## 9. Deferred (do not block v1 prototype)

- [ ] **Discriminated union** of fragment payloads + **serializer-style registration** for new fragment kinds (post-prototype).
- [ ] **Durable** conversation storage (Dynamo) and cross-invocation `get`.
- [ ] **`mtw.ephemera.conversations` DataSource** if inbound event streams justify it.

---

## References

- `lambda/ephemera/conversations/AGENT.planning.md` - full design, rationale, and rejected alternatives.
