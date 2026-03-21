*Status: DRAFT TASK LIST - refine as we implement. Full design context: `AGENT.planning.md`.*

## How to use this file

- Tasks are **high-level**; break them into PR-sized steps when you pick them up.
- Mark items **done** by checking the box or moving completed work to a short "Done" section at the bottom.
- **Prototype** types and behavior should stay **labeled** in code until we replace them with a union + registration pattern (see `AGENT.planning.md`).

---

## 1. Foundation: `internalCache` + module shell

- [ ] Add `internalCache/conversations.ts` (or equivalent) implementing `ConversationsData` (name TBD) with **invocation-scoped** storage (cleared with `internalCache.clear()`).
- [ ] Wire `Conversations` into `internalCache/index.ts` (`InternalCache` field, constructor if needed, `clear()`).
- [ ] Create `lambda/ephemera/conversations` module entry (types barrel + registry implementation file(s)) so imports have a stable path.

---

## 2. Types and registry API

- [ ] Define **`conversationId`** as opaque string; generation via **`uuidv4()`** at registration only (see `AGENT.planning.md`).
- [ ] Define **routing** record (discriminated or path-specific variants; start minimal for the first pipeline).
- [ ] Define **prototype fragment** shape: `Partial` of `{ leaveMessage, arriveMessage, roomHeader }` with **placeholder** inner types (refine when wiring writers). **Comment** that this is a **prototype**.
- [ ] Implement registry operations (exact names TBD): e.g. `register`, `get`, `mergeFragments` / `putFragment`, optional `complete` or `delete`.
- [ ] Prefer **async** method signatures on the registry (`get` returns `Promise<...>`) even when v1 uses in-memory sync internals.
- [ ] Unit tests for register, merge semantics, idempotency rules, and clear behavior.

---

## 3. First end-to-end pipeline (pick one)

Choose the **first** vertical slice (e.g. **move + ordered world messages + perception header**, or a smaller **preview** path if we decide to start narrower). Document the choice in a one-line note at the top of this section.

- [ ] Document **completeness rules**: which of `leaveMessage` / `arriveMessage` / `roomHeader` are **required** before assembly; partial failure rules if any.
- [ ] Implement **fragment writers**: at least two code paths that **merge** into the conversation record (simulated or real).
- [ ] Implement **assembler** (or thin orchestrator): reads conversation by `conversationId`, uses **`OrchestrateMessages`** / `messageGroupId` as needed, emits `PublishMessage` / `Perception` / etc. (match existing `moveCharacter` / perception patterns where applicable).
- [ ] Tests for assembler: given a fully populated prototype fragment record, **expected** bus messages or message bus mock expectations (scope to what is practical).

---

## 4. Threading `conversationId` through the system

- [ ] Add `conversationId` to **orchestration** and/or **API** messages for the first pipeline (minimal surface; avoid megablob types).
- [ ] Ensure **WebSocket** `ReturnValue` / `RequestId` story stays coherent where the first pipeline returns to a client.

---

## 5. Documentation and cleanup

- [ ] Mark prototype fragment types and assembler in **code comments** (or short module README) pointing to `AGENT.planning.md`.
- [ ] Add `AGENT.md` in this directory once behavior and API are stable enough for other agents (optional; can follow first merge).

---

## 6. Deferred (do not block v1 prototype)

- [ ] **Discriminated union** of fragment payloads + **serializer-style registration** for new fragment kinds (post-prototype).
- [ ] **Durable** conversation storage (Dynamo) and cross-invocation `get`.
- [ ] **`mtw.ephemera.conversations` DataSource** if inbound event streams justify it.

---

## References

- `lambda/ephemera/conversations/AGENT.planning.md` - full design, rationale, and rejected alternatives.
