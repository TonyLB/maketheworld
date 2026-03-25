*Status: DRAFT TASK LIST - sendMessage boundary migration (Option C composite `get`). Refine as implementation proceeds.*

## How to use this file

- Tasks are intentionally high-level and should be broken into PR-sized implementation slices when picked up.
- Keep this list aligned with `AGENT.sendMessage.planning.md` (chosen direction: Option C composite `get`).
- Mark items done by checking boxes or moving completed work into a short "Done" section.
- Preserve guardrails from planning doc: storage remains JSON-safe; runtime enrichment is explicit; materialization remains single envelope-injection path.

---

## 1. Foundation: composite read shape on `Conversations.get`

**Goal:** Shift the read contract from "storable record only" to a composite runtime read shape that can carry both storable data and handle enrichment.

- [x] Define the target `get` return shape (working shape: `{ record, handle } | undefined`) and document field semantics (`record` is canonical storable row; `handle` is runtime enrichment).
- [x] Implement minimal `handle` stub for first pass (no broad behavior changes yet).
- [x] Update immediate call-sites that currently rely on raw row reads so they access storable data via the new composite shape.
- [x] Keep `set(...)` contract explicitly storable-only; verify set/get docs communicate this clearly.
- [x] Update/extend unit tests around `internalCache.Conversations` read behavior.

---

## 2. Vertical slice: move `sendMessage` enrichment onto composite `get`

**Goal:** Pick one pipeline and prove end-to-end that runtime `handle.sendMessage` can replace post-read layering for that path.

- [x] Choose one prototype vertical (expected first candidate: `generateRoomPreview`).
- [x] Trace existing post-read chain (registry/materialize/sendMessage nesting) for that vertical and capture what logic must move into handle enrichment (see `AGENT.sendMessage.planning.prep.md` B4).
- [x] Update composite `get` enrichment so returned `handle.sendMessage` contains the previously nested materialization behavior for the chosen vertical.
- [x] Keep wire-envelope invariants intact (`ConversationStep` shape, `conversationId`, optional `RequestId`, slow-path `generating` rules).
- [x] Add/adjust tests for this vertical proving behavior parity (or intentional behavior changes if documented).

---

## 3. Vertical refactor: callers consume `handle.sendMessage` directly

**Goal:** Replace the previous involved calling pattern in the chosen vertical with direct use of the enriched handle returned from `Conversations.get`.

- [x] Refactor vertical call-sites to use composite `get` and `handle.sendMessage` directly.
- [x] Remove or bypass now-redundant intermediate access patterns for this vertical.
- [x] Rework unit-test mocking strategy to match the new primitive boundary (mock composite cache read/handle rather than old helper chain where appropriate).
- [x] Confirm this refactor keeps orchestration behavior and error handling aligned with current expectations.

---

## 4. Broader migration sweep across remaining patterns

**Goal:** Apply the same boundary change consistently across other conversation calling patterns.

- [ ] Inventory remaining conversation read/send call paths still using prior layering.
- [ ] Migrate paths incrementally to composite `get` and enriched handle usage.
- [ ] Update each affected test suite to the new mocking and assertion boundary.
- [ ] Track any path-specific exceptions; document why they remain if not migrated immediately.

---

## 5. Post-migration cleanup and reorganization

**Goal:** Reassess helper structure once direct callers no longer invoke prior registry/materialize helpers in the old way.

- [ ] Identify helper methods/modules now only indirectly used or duplicated by new enrichment path.
- [ ] Decide whether to condense, relocate, or remove obsolete layers while preserving readability.
- [ ] Keep a single clear ownership point for materialization/envelope injection logic.
- [ ] Update docs (`AGENT.sendMessage.planning.md`, `conversations/AGENT.md`, type comments) to reflect final structure.

---

## 6. Validation and rollout notes

- [ ] Run targeted tests for each migrated vertical and a broader pass for conversation-related modules.
- [ ] Confirm no regressions in `ConversationStep` delivery semantics and correlation fields.
- [ ] Note migration risks, open questions, and follow-up tasks for any deferred cleanup.

---

## Related files

- `lambda/ephemera/conversations/AGENT.sendMessage.planning.md`
- `lambda/ephemera/conversations/AGENT.planning.md`
- `lambda/ephemera/conversations/AGENT.planning.tasklist.md`
- `lambda/ephemera/internalCache/conversations.ts`
- `lambda/ephemera/conversations/registry.ts`
- `lambda/ephemera/conversations/materializeConversationHandle.ts`
- `lambda/ephemera/conversations/conversationTypes/generateRoomPreview/materialize.ts`
