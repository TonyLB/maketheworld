*Status: PREP ARTIFACT — **Plan Mode prep READY** for remaining task 2 (composite `get` enrichment); implementation of that slice not required for this readiness gate.*

# A. Persistent Context (Cross-Cycle)

## Invalidation Rule (Persistent Context)

Entries in A-sections (especially A3 and A5) must be actively maintained.

When prior context becomes incorrect:

- It must be explicitly updated, superseded, or marked invalid
- It must not silently persist once known to be outdated

## A1. Prep Scope

- Feature / effort: Ephemera conversations `sendMessage` boundary migration (composite `Conversations.get` read shape; see planning doc for full framing).
- Planning doc: `lambda/ephemera/conversations/AGENT.sendMessage.planning.md`
- Tasklist doc: `lambda/ephemera/conversations/AGENT.sendMessage.planning.tasklist.md`

## A2. Standing Constraints

Sourced only from explicit statements in `AGENT.sendMessage.planning.md` (not from task inference):

- Architecture: Keep `internalCache.Conversations` storage JSON-safe internally; `set(...)` accepts storable JSON-safe rows.
- Read contract: Runtime read path may return both storable data and enrichment (for example `{ record, handle }`); storable vs runtime fields must be explicit in naming and type docs.
- Set/get clarity: `set(...)` writes storable rows; `get(...)` is a composite runtime read (per chosen direction).
- Materialization: Remains the single envelope-injection point for wire messages.
- Wire / behavior invariants: `ConversationStep` remains the feedback mechanism for the vertical (`generating`, `complete`, `error`); slow-path-only rule for `generating` remains enforced in orchestration.
- Scope posture: Prototype layering from the first vertical is not contract-locked; migration may simplify helper boundaries.

## A3. Established Code Context

| Artifact | Why it matters | Notes |
| -------- | -------------- | ----- |
| `lambda/ephemera/internalCache/conversations.ts` | `ConversationsData`: `set` stores storable rows only; `get` returns `ConversationsCompositeGetResult \| undefined` (`record` + no-op stub `handle`). | Shipped (task 1 foundation). |
| `lambda/ephemera/conversations/conversationTypes/compositeRead.ts` | `ConversationCompositeReadHandleStub`, `createConversationCompositeReadHandleStub`, `ConversationsCompositeGetResult`. | Shipped (task 1 foundation). |
| `lambda/ephemera/internalCache/index.ts` | `InternalCache.Conversations`; `clear()` clears conversations map. | Unchanged aside from `ConversationsData` API. |
| `lambda/ephemera/conversations/registry.ts` | `Conversations.get` for duplicate check / `?.record`; `getConversationHandle` materializes with default `{ messageBus, getConnectionId: () => internalCache.Global.get('ConnectionId') }` (ignores cache `handle`). | Updated Pass 7 (`getConnectionId` deps). |
| `lambda/ephemera/internalCache/conversations.test.ts` | Unit tests for composite `get` shape and stub identity. | Shipped (task 1 foundation). |
| `lambda/ephemera/conversations/registry.test.ts` | Registry round-trip and `getConversationHandle` + `sendMessage`. | Shipped (task 1 foundation). |
| `lambda/ephemera/conversations/conversationTypes/handle.ts` | Live `ConversationHandle` union (generateRoomPreview today). | Distinct from composite read stub. |
| `lambda/ephemera/conversations/AGENT.md` | Documents `set` vs composite `get` vs `getConversationHandle`. | Shipped (task 1 foundation). |
| `lambda/ephemera/app.ts` | `generateRoomPreview` path: `registerConversation` -> `getConversationHandle` with `{ messageBus, getConnectionId }` -> `onGenerating` / terminal `sendMessage`. | Task 3 caller refactor target; passes explicit `getConnectionId` after materialize deps refactor. |

Previously known files must not be treated as INSPECTED without re-examination when starting a new cycle.

## A4. Parked Issues (Cross-Cutting)

Parked Issue IDs (only) should use stable, origin-anchored semantic slugs rather than numeric sequence IDs.

### [PARKED-dedupe-after-callsite-migration]

- **Origin:** CONSULT (resolution of `ISSUE-task2-duplicate-materialize-vs-registry`).
- **Description:** Do **not** remove or replace the materialized `sendMessage` produced by `getConversationHandle` until **all** call sites use the new composite-read / enriched-handle primitive (expected: task 4 migration sweep, not task 2–3 alone).
- **Why parked:** Preserves behavior and test stability while task 2 proves composite `get` and task 3 moves individual callers.
- **Dependencies:** Task 2 functional `get.handle.sendMessage`; task 3+ call-site inventory complete.
- **Revisit trigger:** Start of task 4 (or when no production/tests depend on `getConversationHandle` for the migrated verticals).

### [PARKED-envelope-record-handle-pairing]

- **Origin:** CONSULT (follow-up to `ISSUE-task2-composite-handle-typing`).
- **Description:** Revisit whether to introduce a **single envelope type** that discriminates **both** `record` and `handle` together (tighter than correlating `record.type` with `handle.kind` across two fields).
- **Why parked:** For task 2, **`handle.kind`** remains the discriminant on the composite handle; type guards at use sites validate `sendMessage` capability.
- **Dependencies:** Task 2 composite handle union in place; experience with dual-field correlation.
- **Revisit trigger:** After task 2 ships or when a second conversation `type` adds composite enrichment and pairing errors become likely.

## A5. Decisions Ledger

### [DECISION-option-c-composite-get]

- Decision: Chosen migration direction is Option C — composite `get` on `internalCache.Conversations` (for example `{ record, handle }`), with JSON-safe storage unchanged.
- Origin: REQUESTED (documented authoritatively in planning doc before this prep artifact).
- Supersedes: (none recorded here)
- Rationale: As stated in `AGENT.sendMessage.planning.md` — shorter call path, internalCache-first fit, storable fields remain first-class on composite return.
- Implications: Read contract and tests will change relative to storable-only `get`; registry/helper roles may be reassessed in later cycles.

### [DECISION-task1-handle-stub-noop]

- Decision: Task 1 composite `handle` field uses a **no-op** stub (no meaningful runtime behavior; satisfies typing only).
- Origin: REQUESTED (human CONSULT)
- Supersedes: (none)
- Rationale: Unblocks composite `get` without task-2 materialization on the cache read path.
- Implications: `getConversationHandle` continues to ignore cache `handle` and materialize from `record` until a later task moves enrichment.

### [DECISION-registry-composite-get-adapter]

- Decision: Registry uses an explicit adapter pattern on composite `get`: read **`record`** for storable semantics and duplicate checks; materialize handles from **`record`** as today.
- Origin: REQUESTED (human CONSULT)
- Supersedes: (none)
- Rationale: Keeps `getStorableConversationRecord` JSON-safe contract and correct truthy checks.
- Implications: All `internalCache.Conversations.get` uses in `registry.ts` must use composite shape consistently.

### [DECISION-docs-bundle-implementation-pr]

- Decision: Documentation updates for composite `get` (`conversations.ts` docblock, `conversations/AGENT.md`) ship in the **same PR** as the implementation.
- Origin: REQUESTED (human CONSULT)
- Supersedes: (none)
- Rationale: Avoid doc/code drift.
- Implications: `CHANGE-docs-composite-get` is not a standalone follow-up PR unless scope is explicitly split later.

### [DECISION-task1-foundation-implemented]

- Decision: Task 1 foundation is **implemented** in the codebase: composite `ConversationsData.get`, `conversationTypes/compositeRead.ts` stub, registry adapters, `conversations.test.ts` / `registry.test.ts`, `conversations.ts` docblock and `AGENT.md`; tasklist section 1 checkboxes completed.
- Origin: CORRECTIVE (post-implementation record)
- Supersedes: (none)
- Rationale: Closes prep cycle against shipped state; A3 reflects current contracts.
- Implications: Next cycle should ACTIVATE TASK 2+; re-verify code context when scope changes.

### [DECISION-materialize-deps-getConnectionId]

- Decision: Materializers **do not** import `internalCache`. `ConversationMaterializeDeps` (and `MaterializeGenerateRoomPreviewDeps`) include **`getConnectionId: () => Promise<string | undefined>`**; callers (`registry` defaults, `app.ts`, tests) supply the binding to `internalCache.Global.get('ConnectionId')` or mocks.
- Origin: REQUESTED (human CONSULT, resolves `ISSUE-task2-module-graph`).
- Supersedes: (none)
- Rationale: Breaks the load-time cycle risk between `internalCache` construction and conversation materialization; enables `internalCache/conversations.ts` to import materialization in task 2 without pulling materializers back into the cache module graph.
- Implications: Shipped in code (`generateRoomPreview/materialize.ts`, `materializeConversationHandle.ts`, `registry.ts`, `app.ts`, tests, `AGENT.md`).

### [DECISION-composite-handle-kind-discriminant]

- Decision: For task 2 composite read **`handle`**, use existing / extended **`kind`** field as the **discriminant** between stub and live branches. Use **type guards** at call sites so `sendMessage` is only invoked when the handle `kind` implies a payload-capable `sendMessage`.
- Origin: REQUESTED (human CONSULT, resolves `ISSUE-task2-composite-handle-typing`).
- Supersedes: (none)
- Rationale: Avoids premature unified envelope type; keeps stub vs live distinguishable at compile time where guards are applied.
- Implications: Implementation must define live `kind` value(s) for `generateRoomPreview` distinct from `conversationCompositeReadStub`; optional future **A4** `[PARKED-envelope-record-handle-pairing]` if we unify record+handle later.

### [DECISION-change-task2-enriched-plumbing-accepted]

- Decision: **`CHANGE-task2-enriched-handle-plumbing`** is **ACCEPTED** as the task 2 direction (reuse materializers for wire construction; no duplicated `ConversationStep` logic in `ConversationsData`).
- Origin: REQUESTED (human CONSULT).
- Supersedes: (none)
- Rationale: Matches A2 single envelope-injection path.
- Implications: Remaining task 2 work wires composite `get` to `materializeConversationHandle` (or equivalent single call) with deps injected from `InternalCache` / registry patterns; **not** yet fully implemented until enriched `handle` on `get` lands.

---

# B. Active Prep Workspace

## B0. Proposed Changes (Human Review Surface)

### [CHANGE-task2-enriched-handle-plumbing]

- **Type:** Dependency / module-boundary wiring (internalCache `ConversationsData.get` vs existing materialization).
- **Origin:** DERIVED (ASSESS code inspection).
- **Status:** ACCEPTED (human CONSULT); **partially applied** — prerequisite **DECISION-materialize-deps-getConnectionId** implemented in codebase; composite `get` still returns stub until remaining task 2 wiring + `handle.kind` union ships.
- **Summary:** Implement task 2 by making composite `get` return a `handle` whose `sendMessage` is behaviorally the same as `materializeGenerateRoomPreview` today, **without** copying `ConversationStep` / `apiClient.send` construction into a second place (A2: single envelope-injection path via existing materializer).
- **Rationale:** `generateRoomPreview/materialize.ts` already owns the wire payload; duplicating it in `internalCache/conversations.ts` would fork the invariant and drift tests.
- **Alternatives considered:**
  1. **Constructor or lazy inject from `internalCache/index.ts`:** `ConversationsData` accepts a `(record) => ConversationHandle` (or per-type) callback wired in `InternalCache` after the singleton exists, so `conversations.ts` does not static-import `materializeConversationHandle` (avoids pulling materialize while `internalCache/index` is still loading).
  2. **Refactor materialize deps (chosen):** `getConnectionId` on `ConversationMaterializeDeps`; shipped in Pass 7.
  3. **Duplicate send logic in `ConversationsData`:** rejected for A2 single-injection-point and maintenance risk unless explicitly accepted.
- **Impact:** Touches `ConversationsData` construction (likely `InternalCache` constructor), `compositeRead.ts` typing (stub vs live branch by `kind`), tests (`conversations.test.ts` at minimum).
- **Requires explicit approval:** Was yes; **approved**.

(Task 1 changes were ACCEPTED then implemented; detail archived in **C — [CYCLE-task1-foundation-composite-get]**.)

---

## B1. Cycle Scope

- **Current task:** Task 2 from `AGENT.sendMessage.planning.tasklist.md` — **Vertical slice: move `sendMessage` enrichment onto composite `get`** (prove end-to-end for one pipeline that runtime `handle.sendMessage` can replace post-read layering).
- **In-scope:**
  - Choose one prototype vertical (expected first candidate: `generateRoomPreview` per tasklist / planning doc).
  - Trace the existing post-read chain (`registry` / `materializeConversationHandle` / nested `materialize...sendMessage`) for that vertical and record what must live in handle enrichment.
  - Update composite `get` so the returned `handle.sendMessage` carries the materialization behavior previously reached only after `get` + registry/materialize for that vertical.
  - Preserve wire-envelope invariants: `ConversationStep` shape, `conversationId`, optional `RequestId`, slow-path `generating` rules.
  - Add or adjust tests for this vertical proving behavior parity (or document intentional deltas).
- **Out-of-scope (defer to later tasklist sections):**
  - **Task 3 (explicit):** Refactor production paths (e.g. `app.ts` `getConversationHandle` + `handle.sendMessage`) to use `internalCache.Conversations.get(...).handle.sendMessage` directly; remove or bypass redundant registry/materialize indirection **at call sites**. Task 2 may still leave `getConversationHandle` materializing from `record` in parallel for parity.
  - Tasks 4–6: migration sweep across other patterns, post-migration helper cleanup, rollout validation beyond this vertical slice.

---

## B2. Cycle Status

- Phase: REFINE (CONSULT decisions recorded; B3 seeded from them)
- **Readiness for Plan Mode (prep gate):** **READY** — no material uncertainty in **B5**; **B4** inspected; **B3** canonical intent set; **B0** ACCEPTED; blocking issues moved to **B6** or **A4** with explicit parking. Plan Mode should not need to invent architecture or contracts for this slice.
- **Task 2 implementation (deliverable):** Composite `get` enrichment + tests per **B3** still **outstanding in the codebase** (separate from prep readiness; tracked by tasklist, not by this gate).
- Confidence: High for prep readiness; implementation risk is ordinary execution work under **B3**

---

## B3. Canonical Intent (REFINE Output)

- **Intended behavior (task 2):** For `generateRoomPreview` rows, `internalCache.Conversations.get(id)` returns `handle` such that **`handle.sendMessage`** is functionally equivalent to **`materializeConversationHandle(record, deps).sendMessage`** with the same process deps (`messageBus`, `getConnectionId`). Stub handles remain for other `type` values until later tasks.
- **Implementation direction:** Call into **`materializeConversationHandle`** (or a thin wrapper) from the composite read path so envelope construction stays single-sourced. Inject **`ConversationMaterializeDeps`** into `ConversationsData` from **`InternalCache`** construction (same defaults as `getConversationHandle`: `messageBus` module + `() => internalCache.Global.get('ConnectionId')`).
- **Typing:** Composite **`handle`** is a discriminated union on **`kind`**. Stub keeps existing `conversationCompositeReadStub`; live `generateRoomPreview` branch uses a **distinct** `kind` and carries **`sendMessage`**. Call sites that send must **type-narrow** (guard) so `sendMessage` is only used when `kind` implies the correct payload type.
- **Allowed patterns:** `getConnectionId` injection at registry/app/internalCache boundaries; type guards on `handle.kind`.
- **Disallowed patterns:** Duplicated `ConversationStep` / `apiClient.send` blocks outside materializers; materializers importing `internalCache`.
- **Deferred items:** Removing `getConversationHandle` materialization — **A4** `[PARKED-dedupe-after-callsite-migration]`. Unified record+handle envelope type — **A4** `[PARKED-envelope-record-handle-pairing]`. Caller refactor to composite `get` — task 3 (**B1**).

---

## B4. Code Context (ASSESS / CONSULT Evidence)

| Status | Artifact | Why it matters |
| ------ | -------- | -------------- |
| INSPECTED | `lambda/ephemera/internalCache/conversations.ts` | `get` always returns `{ record, handle: createConversationCompositeReadHandleStub() }`; no per-row logic; **no deps** on `messageBus` or materializers. Task 2 must inject real `sendMessage` here or via injected factory. |
| INSPECTED | `lambda/ephemera/conversations/conversationTypes/compositeRead.ts` | `ConversationCompositeReadHandleStub` is a singleton marker object with **no** `sendMessage`; `ConversationsCompositeGetResult.handle` typed to that stub only. Task 2 needs a widened or discriminated composite handle type for `generateRoomPreview` (other types may stay stub until later tasks). |
| INSPECTED | `lambda/ephemera/conversations/registry.ts` | `getStorableConversationRecord` / duplicate check use `get(...)?.record`; `getConversationHandle` uses `?.record` then `materializeConversationHandle(record, deps)` — **ignores** composite `handle`. Task 2 does **not** require changing this; task 3 may dedupe. |
| INSPECTED | `lambda/ephemera/conversations/materializeConversationHandle.ts` | Single switch on `record.type`; only `generateRoomPreview` branch today; right place to keep dispatch DRY if composite `get` delegates here. |
| INSPECTED | `lambda/ephemera/conversations/conversationTypes/generateRoomPreview/materialize.ts` | **Authoritative** `sendMessage`: uses **`deps.getConnectionId()`** (no `internalCache` import after Pass 7 refactor). Same wire branches and `apiClient.send` as before. |
| INSPECTED | `lambda/ephemera/renderOrchestration/generateRoomPreview.ts` | Slow path only calls `onGenerating?.()` (line 123); **does not** call conversation send. `generating` wire emission stays with whoever supplies `onGenerating` (today `app.ts`). Task 2 does not move orchestration logic. |
| INSPECTED | `lambda/ephemera/internalCache/conversations.test.ts` | Asserts stub identity and round-trip `{ record, handle }`; must gain tests that **`handle.sendMessage`** matches materialized behavior (mock `apiClient` / set `Global` ConnectionId like `registry.test.ts`). |
| INSPECTED | `lambda/ephemera/conversations/registry.test.ts` | Parity reference: `getConversationHandle` + `sendMessage` + `apiClient.send` expectations; task 2 tests can mirror payloads for composite `get` without requiring registry changes. |
| INSPECTED | `lambda/ephemera/conversations/AGENT.md` | Still states cache `handle` is placeholder; must be updated when task 2 ships (same PR per A5). |
| INSPECTED | `lambda/ephemera/app.ts` (generateRoomPreview branch) | Uses `getConversationHandle` with `{ messageBus, getConnectionId }` then `handle.sendMessage`. **Out of scope for task 2** per B1 (caller still registry path until task 3). |

**Trace (task 2 vertical `generateRoomPreview`):** Storable row in map -> `Conversations.get` returns stub today -> **target:** return handle (distinct **`kind`**) whose `sendMessage` matches **`materializeConversationHandle(record, deps)`** when deps are wired from `InternalCache`. **Pass 7:** materializers no longer import `internalCache`; static import of `materializeConversationHandle` from `internalCache/conversations.ts` is no longer blocked by that cycle.

---

## B5. Open Issues (ASSESS Output)

**INTENTIONALLY BLANK — NO MATERIAL ENTRIES** (Pass 8 re-ASSESS): Prior B5 items closed via CONSULT + code. Remaining task 2 work follows **B3** / **ACCEPTED** **B0** without new architectural forks.

---

## B6. Resolved Issues (Validated)

### [ISSUE-task2-module-graph]

- **Resolution:** **Inject `getConnectionId`** on `ConversationMaterializeDeps`; remove `internalCache` import from `generateRoomPreview/materialize.ts`. Registry and `app.ts` supply `() => internalCache.Global.get('ConnectionId')`; tests use mocks.
- **Evidence:** `lambda/ephemera/conversations/conversationTypes/generateRoomPreview/materialize.ts`, `materializeConversationHandle.ts`, `registry.ts`, `app.ts`, `materializeConversationHandle.test.ts`, `registry.test.ts`, `app.generateRoomPreview.test.ts`; Jest passes on those suites.
- **Confidence:** High for cycle removal; composite `get` import path still to be implemented under task 2.

### [ISSUE-task2-composite-handle-typing]

- **Resolution:** Use composite **`handle.kind`** as discriminant; **type guards** before `sendMessage`; optional future paired envelope — **A4** `[PARKED-envelope-record-handle-pairing]`.
- **Evidence:** Human CONSULT; recorded in **A5** `DECISION-composite-handle-kind-discriminant` and **B3**.
- **Confidence:** High for intent; implementation pending.

### [ISSUE-task2-duplicate-materialize-vs-registry]

- **Resolution:** **Park** removal of `getConversationHandle` materialization until all call sites migrate — **A4** `[PARKED-dedupe-after-callsite-migration]` (task 4-scale).
- **Evidence:** Human CONSULT.
- **Confidence:** High.

---

## B7. Pass History

### Pass 5 — ACTIVATE TASK (task 2 vertical slice)

- **Phase:** ACTIVATE TASK (per `AGENT.planModePrep.process.md`).
- **Actions:** Loaded tasklist section 2 into **B1**; set **B2** to ASSESS / NOT READY; seeded **B4** with NEEDED artifacts for tracing registry/materialize/`generateRoomPreview` and tests. Did not populate B0, B3, B5, B6 (no ASSESS conclusions yet).
- **Issues added/resolved:** none (B5 remains not in play).
- **Changes proposed/updated:** none (B0 not in play).
- **Notes:** Next step is **ASSESS** — inspect B4 files, align with standing constraints (single envelope-injection point, JSON-safe `set`), record INSPECTED rows and material open issues only with evidence.

### Pass 6 — ASSESS (task 2)

- **Phase:** ASSESS.
- **Actions:** Inspected all B4 NEEDED paths; traced `generateRoomPreview` post-read chain; sharpened **B1** task 2 vs **task 3** (functional composite `handle.sendMessage` **without** mandatory `app.ts` / caller refactor); filled **B4** INSPECTED table; opened **B5** (`ISSUE-task2-module-graph`, `ISSUE-task2-composite-handle-typing`, `ISSUE-task2-duplicate-materialize-vs-registry`); added **B0** `CHANGE-task2-enriched-handle-plumbing` (PROPOSED); updated **A3** with `app.ts` row; advanced **B2** to CONSULT / NOT READY.
- **Issues added/resolved:** added B5 issues; none resolved yet.
- **Changes proposed/updated:** B0 enrichment plumbing proposal.
- **Notes:** `ISSUE-task2-duplicate-materialize-vs-registry` is informational for scoping; primary blockers are module graph + typing. Next: **CONSULT** to ACCEPT/REJECT/adjust B0 and close B5 items with decisions.

### Pass 7 — CONSULT (task 2)

- **Phase:** CONSULT.
- **Actions:** Human approved **B0**; directed **module-graph** fix via materialize deps (not lazy factory); **`handle.kind`** discriminant + type guards; park dedupe of `getConversationHandle` until post-call-site migration (task 4); park paired record+handle envelope follow-up.
- **Issues:** B5 items resolved or parked per above; **A4** / **A5** / **B3** updated; **B0** ACCEPTED.
- **Code:** Implemented `getConnectionId` on `ConversationMaterializeDeps`, updated `app.ts`, tests, `AGENT.md`.

### Pass 8 — RE-ASSESS (post-deps refactor)

- **Phase:** RE-ASSESS.
- **Actions:** Confirmed materializers carry no `internalCache` import; verified call sites and tests; no **new** material uncertainties beyond executing **B3** (wire `ConversationsData`, extend `handle` union + `kind`, `conversations.test.ts` parity).
- **Issues:** B5 cleared as no material entries; **B6** holds validated resolutions.

### Pass 9 — READINESS (prep vs implementation)

- **Phase:** READINESS clarification (process alignment).
- **Actions:** Updated **B2** and **D** so **READY** means Plan Mode can run without material guesses — **not** that task 2 code is already merged. Separated **prep readiness** from **task deliverable** status.

(Full pass log for task 1 preserved under **C — [CYCLE-task1-foundation-composite-get]**.)

---

# C. Archive

## [CYCLE-task1-foundation-composite-get]

- **Scope:** Task 1 — Foundation: composite read shape on `Conversations.get` (`AGENT.sendMessage.planning.tasklist.md` section 1).
- **Key outcomes:** Composite `get` (`{ record, handle } | undefined`) with no-op stub `handle`; registry reads `record` only for storable facades and materialization; tests and docs updated; tasklist section 1 complete.
- **Decisions (ledger):** `DECISION-option-c-composite-get`, `DECISION-task1-handle-stub-noop`, `DECISION-registry-composite-get-adapter`, `DECISION-docs-bundle-implementation-pr`, `DECISION-task1-foundation-implemented`.
- **Patterns established:** Storable-only `set`; runtime composite `get`; live `ConversationHandle` still via `getConversationHandle` / `materializeConversationHandle` until task 2.
- **Pass summary:** INIT → ACTIVATE TASK → ASSESS (B4 INSPECTED, B5 issues, B0 PROPOSED) → CONSULT (B0 ACCEPTED, B3 canonical intent, B6 resolved) → implementation (Plan Mode) → **CLEANUP (this archive)**.

---

# D. Readiness Criteria

**What this gate means:** Readiness here is whether **Plan Mode can execute this cycle without guessing** on material questions (per `AGENT.planModePrep.process.md` Phase 7). It is **not** whether the tasklist implementation has already been merged. Shipping code is the **outcome** of Plan Mode / implementation, not a prerequisite for declaring prep READY.

READY for Plan Mode when:

- No **material** uncertainty remains (non-material details may still be decided during implementation).
- Relevant **code context is inspected** so intent is grounded in evidence, not assumption.
- **Blocking** open issues are resolved, parked in **A4** with a revisit trigger, or explicitly downgraded to non-material.
- **Proposed changes** intended for this cycle are **ACCEPTED** before REFINE applies them to intent; do not conflate this with "every future code edit has landed."

**Not required for prep READY:** completing the composite `get` enrichment in the repo, green CI for the final PR, or checking off tasklist boxes — those follow Plan Mode / implementation.

**Current state:** **READY for Plan Mode** on task 2 remainder (**B0** ACCEPTED, **B3** filled, **B5** no material entries, **B4** INSPECTED, **B6** / **A4** hold resolved and parked items). **Next step:** run Plan Mode (or implement) against **B3**; after code ships, optionally run **RESOLUTION VALIDATION** / **CLEANUP** for this cycle and update **A3** / tasklist.

---

# E. Cleanup (CLEANED)

**Completed:** Pass 4 (Phase 8 CLEANUP).

- Promoted durable context to **A3** (post-implementation) and **A5** (`DECISION-task1-foundation-implemented`).
- Archived task 1 cycle under **C — [CYCLE-task1-foundation-composite-get]**.
- Cleared **B0–B7** to intentional blank states for the next cycle.
- **A4** unchanged (still no parked issues).

Invariant satisfied: **B** reset; **A** updated; **C** contains cycle summary.
