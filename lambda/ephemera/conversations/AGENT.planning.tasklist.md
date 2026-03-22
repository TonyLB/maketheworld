*Status: DRAFT TASK LIST - refine as we implement. Full design context: `AGENT.planning.md`.*

## How to use this file

- Tasks are **high-level**; break them into PR-sized steps when you pick them up.
- Mark items **done** by checking the box or moving completed work to a short "Done" section at the bottom.
- **Prototype** types and behavior should stay **labeled** in code until we replace them with a union + registration pattern (see `AGENT.planning.md`).

### Staged prototyping

`AGENT.planning.md` describes **two** registry jobs: **(1) delivery routing** via `conversationId`, and **(2) intermediate fragment storage** for multi-step / cross-domain merge before assembly. We do **not** have to implement both in the first PR.

Work proceeds in **two typing passes** (sections 2 and 4) and **two prototype passes** (sections 3 and 5): first establish a **full-record discriminant** (e.g. top-level **`type`**) with a **stub payload** on the first member, then rehearse a **narrow API pipeline**; later add union members and rehearse **fragments + assembly**.

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

- [ ] Define **`conversationId`** as opaque string; generation via **`uuidv4()`** at registration only (see `AGENT.planning.md`).
- [ ] Define the **first union member**: one **`type`** tag (full-record discriminant) plus **serializable** routing fields and a **stub payload** for that member only (empty / unused for now). **Comment** that additional union members and payload shapes land in **section 4**.
- [ ] Implement minimal registry operations: e.g. `register`, `get`, `delete` (exact names TBD). Defer `mergeFragments` / `putFragment` to **section 4** unless a no-op stub is useful.
- [ ] Prefer **async** method signatures on the registry (`get` returns `Promise<...>`) even when v1 uses in-memory sync internals.
- [ ] Unit tests for register, get, delete, idempotency rules where applicable, and clear behavior (narrow scope; extend in **section 4** / **section 5** as merge and fragments land).

---

## 3. First prototype pass: routing-first pipeline (e.g. API-activated preview)

Document the chosen path in a one-line note at the top of this section when you start it.

**Goal:** Register a `conversationId`, persist **routing** for the run, and thread that id through the handler so delivery stays coherent (e.g. `ReturnValue` / `RequestId`). **No requirement** yet for multiple fragment writers or a full assembler beyond whatever the single pipeline already does.

Suggested candidate: **GenerateRoomPreview** (UI button): one cohesive async chain; exercises **job (1)** from `AGENT.planning.md` more than **job (2)**.

- [ ] Wire **registration + lookup** for the chosen API path; align `ConversationRecord` with the **section 2** union for that path.
- [ ] Thread **`conversationId`** through the request handler and any helpers that need delivery context (minimal surface; see **section 6** for cross-cutting threading).
- [ ] Keep **WebSocket** / `ReturnValue` / `RequestId` coherent with the registered record (see **section 6**).
- [ ] Tests scoped to routing + registry behavior for this path (bus mocks as needed).

---

## 4. Second-pass typing (payload union + second routing variant)

**Goal:** Extend the **same** `ConversationRecord` union: add a **second `type` variant** with a **meaningful** payload (prototype `Partial` of `{ leaveMessage, arriveMessage, roomHeader }` or equivalent). Refine the **first** variant's payload from stub to a **typed** fragment union where needed. **Comment** that fragment types are **prototype**.

- [ ] Introduce **additional union members** on the full-record discriminant (same top-level **`type`** pattern as section 2). Each member carries its own routing + payload fields; **narrowing on `type`** selects both.
- [ ] Restrict **empty** / no-fragment payload to the **first** `type` only (type-level story matches the first prototype pass).
- [ ] Add the **second** `type` variant (e.g. **moveCharacter** / ordered world messages) with routing + payload fields **for that pipeline**.
- [ ] Implement **`mergeFragments` / `putFragment`** (names TBD) and any **merge** semantics tests deferred from section 2.

---

## 5. Second prototype pass: fragments + assembly

Document the chosen path in a one-line note at the top of this section when you start it.

**Goal:** Prototype **job (2)**: named fragments, merge semantics, completeness, and an **assembler** that emits ordered messaging (`PublishMessage`, `Perception`, **`OrchestrateMessages`** / `messageGroupId` as needed). Typical fit: **move + ordered world messages + perception**, or any flow with **at least two** writers contributing before user-visible output.

- [ ] Document **completeness rules**: which of `leaveMessage` / `arriveMessage` / `roomHeader` are **required** before assembly; partial failure rules if any.
- [ ] Implement **fragment writers**: at least two code paths that **merge** into the conversation record (simulated or real).
- [ ] Implement **assembler** (or thin orchestrator): reads conversation by `conversationId`, uses **`OrchestrateMessages`** / `messageGroupId` as needed, emits `PublishMessage` / `Perception` / etc. (match existing `moveCharacter` / perception patterns where applicable).
- [ ] Tests for assembler: given a fully populated prototype fragment record, **expected** bus messages or message bus mock expectations (scope to what is practical).

---

## 6. Threading `conversationId` through the system

- [ ] Add `conversationId` to **orchestration** and/or **API** messages for the pipeline you are wiring (the **first** prototype can start API-only; the **second** extends orchestration types as needed). Minimal surface; avoid megablob types.
- [ ] Ensure **WebSocket** `ReturnValue` / `RequestId` story stays coherent where the pipeline returns to a client.

---

## 7. Documentation and cleanup

- [ ] Mark prototype fragment types and assembler in **code comments** (or short module README) pointing to `AGENT.planning.md`.
- [ ] Add `AGENT.md` in this directory once behavior and API are stable enough for other agents (optional; can follow first merge).

---

## 8. Deferred (do not block v1 prototype)

- [ ] **Discriminated union** of fragment payloads + **serializer-style registration** for new fragment kinds (post-prototype).
- [ ] **Durable** conversation storage (Dynamo) and cross-invocation `get`.
- [ ] **`mtw.ephemera.conversations` DataSource** if inbound event streams justify it.

---

## References

- `lambda/ephemera/conversations/AGENT.planning.md` - full design, rationale, and rejected alternatives.
