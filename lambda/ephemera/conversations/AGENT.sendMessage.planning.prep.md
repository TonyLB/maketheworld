*Status: PREP ARTIFACT — CLEANED (task 2 cycle archived). Next: ACTIVATE TASK for tasklist section 3+.*

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
| `lambda/ephemera/internalCache/conversations.ts` | `ConversationsData`: constructor takes `ConversationMaterializeDeps`; `get` returns composite `{ record, handle }`; for `generateRoomPreview`, `handle` is live (`kind: 'conversationCompositeReadGenerateRoomPreview'`) with `sendMessage` from `materializeConversationHandle(record, deps)`; other `type` values get stub until enriched. | Shipped task 2. |
| `lambda/ephemera/conversations/conversationTypes/compositeRead.ts` | `ConversationCompositeReadHandle` union (stub + `ConversationCompositeReadHandleGenerateRoomPreview`); guards `isConversationCompositeReadHandleStub` / `isConversationCompositeReadHandleGenerateRoomPreview`; `ConversationsCompositeGetResult`. | Shipped task 2. |
| `lambda/ephemera/internalCache/index.ts` | `Conversations: ConversationsData` constructed with `messageBus` and `getConnectionId: () => this.Global.get('ConnectionId')` (field order after `Global`). | Shipped task 2. |
| `lambda/ephemera/conversations/registry.ts` | `get` for duplicate / `?.record`; `getConversationHandle` still materializes from `record` only (ignores cache `handle`); default deps include `getConnectionId`. | Unchanged task 2 behavior; task 3+ may switch callers to composite `get`. |
| `lambda/ephemera/internalCache/conversations.test.ts` | Round-trip shape, `apiClient` mock, `sendMessage` parity vs materialized `ConversationStep` payloads. | Shipped task 2. |
| `lambda/ephemera/conversations/registry.test.ts` | Registry + `getConversationHandle` + `sendMessage`. | Shipped; regression for task 2. |
| `lambda/ephemera/conversations/conversationTypes/generateRoomPreview/materialize.ts` | Wire `sendMessage`; no `internalCache` import (deps-injected `getConnectionId`). | Shipped Pass 7 + task 2 consumer. |
| `lambda/ephemera/conversations/conversationTypes/handle.ts` | Live `ConversationHandle` union (generateRoomPreview today). | Distinct from composite read handle shape. |
| `lambda/ephemera/conversations/AGENT.md` | `handle.kind`, guards, composite `get` vs `getConversationHandle` coexistence. | Shipped task 2. |
| `lambda/ephemera/app.ts` | `generateRoomPreview` path still uses `getConversationHandle` + `sendMessage` (task 3: optional switch to composite `get`). | Explicit `getConnectionId` in deps. |

Previously known files must not be treated as INSPECTED without re-examination when starting a new cycle.

## A4. Parked Issues (Cross-Cutting)

Parked Issue IDs (only) should use stable, origin-anchored semantic slugs rather than numeric sequence IDs.

### [PARKED-dedupe-after-callsite-migration]

- **Origin:** CONSULT (resolution of `ISSUE-task2-duplicate-materialize-vs-registry`).
- **Description:** Do **not** remove or replace the materialized `sendMessage` produced by `getConversationHandle` until **all** call sites use the new composite-read / enriched-handle primitive (expected: task 4 migration sweep, not task 2–3 alone).
- **Why parked:** Preserves behavior and test stability while task 3 moves individual callers.
- **Dependencies:** Task 2 composite `get` **shipped**; task 3+ call-site inventory complete.
- **Revisit trigger:** Start of task 4 (or when no production/tests depend on `getConversationHandle` for the migrated verticals).

### [PARKED-envelope-record-handle-pairing]

- **Origin:** CONSULT (follow-up to `ISSUE-task2-composite-handle-typing`).
- **Description:** Revisit whether to introduce a **single envelope type** that discriminates **both** `record` and `handle` together (tighter than correlating `record.type` with `handle.kind` across two fields).
- **Why parked:** **`handle.kind`** remains the discriminant on the composite handle; type guards at use sites validate `sendMessage` capability.
- **Dependencies:** Task 2 composite handle union **shipped**; experience with dual-field correlation as more `type` variants gain enrichment.
- **Revisit trigger:** When a second conversation `type` adds composite enrichment and pairing errors become likely.

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
- Implications: Historical for `generateRoomPreview` (task 2 added live branch); stub remains for not-yet-enriched `type` values.

### [DECISION-registry-composite-get-adapter]

- Decision: Registry uses an explicit adapter pattern on composite `get`: read **`record`** for storable semantics and duplicate checks; materialize handles from **`record`** as today.
- Origin: REQUESTED (human CONSULT)
- Supersedes: (none)
- Rationale: Keeps JSON-safe storable row reads via composite `internalCache.Conversations.get` and correct truthy checks.
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
- Implications: Superseded for composite-handle behavior by task 2 row in A3; archive **C — [CYCLE-task1-foundation-composite-get]**.

### [DECISION-materialize-deps-getConnectionId]

- Decision: Materializers **do not** import `internalCache`. `ConversationMaterializeDeps` (and `MaterializeGenerateRoomPreviewDeps`) include **`getConnectionId: () => Promise<string | undefined>`**; callers (`registry` defaults, `app.ts`, tests) supply the binding to `internalCache.Global.get('ConnectionId')` or mocks.
- Origin: REQUESTED (human CONSULT, resolves `ISSUE-task2-module-graph`).
- Supersedes: (none)
- Rationale: Breaks the load-time cycle risk between `internalCache` construction and conversation materialization; enables `internalCache/conversations.ts` to import materialization in task 2 without pulling materializers back into the cache module graph.
- Implications: Shipped in code (`generateRoomPreview/materialize.ts`, `registry.ts`, `app.ts`, tests, `AGENT.md`).

### [DECISION-composite-handle-kind-discriminant]

- Decision: For task 2 composite read **`handle`**, use existing / extended **`kind`** field as the **discriminant** between stub and live branches. Use **type guards** at call sites so `sendMessage` is only invoked when the handle `kind` implies a payload-capable `sendMessage`.
- Origin: REQUESTED (human CONSULT, resolves `ISSUE-task2-composite-handle-typing`).
- Supersedes: (none)
- Rationale: Avoids premature unified envelope type; keeps stub vs live distinguishable at compile time where guards are applied.
- Implications: **Shipped** — live `kind` `conversationCompositeReadGenerateRoomPreview`; optional future **A4** `[PARKED-envelope-record-handle-pairing]`.

### [DECISION-change-task2-enriched-plumbing-accepted]

- Decision: **`CHANGE-task2-enriched-handle-plumbing`** is **ACCEPTED** as the task 2 direction (reuse materializers for wire construction; no duplicated `ConversationStep` logic in `ConversationsData`).
- Origin: REQUESTED (human CONSULT).
- Supersedes: (none)
- Rationale: Matches A2 single envelope-injection path.
- Implications: **Applied** — see `DECISION-task2-vertical-slice-implemented`.

### [DECISION-task2-vertical-slice-implemented]

- Decision: Task 2 (**AGENT.sendMessage.planning.tasklist.md** section 2) is **implemented**: composite `get` returns live `handle` for `generateRoomPreview` via `materializeConversationHandle` + `handle.kind` + guards; `InternalCache` wires `ConversationMaterializeDeps`; `conversations.test.ts` wire parity; `AGENT.md` + tasklist section 2 complete.
- Origin: CORRECTIVE (post-implementation record)
- Supersedes: (none)
- Rationale: Closes task 2 prep cycle against shipped state.
- Implications: Next prep cycle **ACTIVATE TASK** for section 3 (callers consume composite `get` directly) unless scope changes; **A4** parking still governs deduping `getConversationHandle` until task 4-scale migration.

---

# B. Active Prep Workspace

## B0. Proposed Changes (Human Review Surface)

**INTENTIONALLY BLANK — NOT YET IN PLAY**

(Task 2 changes were ACCEPTED then implemented; detail archived in **C — [CYCLE-task2-composite-get-enrichment]**.)

---

## B1. Cycle Scope

**INTENTIONALLY BLANK — NOT YET IN PLAY**

(Load during ACTIVATE TASK for the next tasklist section.)

---

## B2. Cycle Status

- Phase: INIT
- Readiness: NOT READY
- Confidence: (not assessed)

---

## B3. Canonical Intent (REFINE Output)

**INTENTIONALLY BLANK — NOT YET IN PLAY**

---

## B4. Code Context (ASSESS / CONSULT Evidence)

| Status    | Artifact | Why it matters |
| --------- | -------- | -------------- |

**INTENTIONALLY BLANK — NOT YET IN PLAY**

(Authoritative shipped notes for conversations composite read live in **A3** until the next cycle seeds NEEDED rows.)

---

## B5. Open Issues (ASSESS Output)

**INTENTIONALLY BLANK — NOT YET IN PLAY**

---

## B6. Resolved Issues (Validated)

**INTENTIONALLY BLANK — NOT YET IN PLAY**

---

## B7. Pass History

**INTENTIONALLY BLANK — NOT YET IN PLAY**

(Full pass logs for task 1 and task 2 preserved under **C — [CYCLE-task1-foundation-composite-get]** and **C — [CYCLE-task2-composite-get-enrichment]**.)

---

# C. Archive

## [CYCLE-task1-foundation-composite-get]

- **Scope:** Task 1 — Foundation: composite read shape on `Conversations.get` (`AGENT.sendMessage.planning.tasklist.md` section 1).
- **Key outcomes:** Composite `get` (`{ record, handle } | undefined`) with no-op stub `handle`; registry reads `record` only for storable facades and materialization; tests and docs updated; tasklist section 1 complete.
- **Decisions (ledger):** `DECISION-option-c-composite-get`, `DECISION-task1-handle-stub-noop`, `DECISION-registry-composite-get-adapter`, `DECISION-docs-bundle-implementation-pr`, `DECISION-task1-foundation-implemented`.
- **Patterns established:** Storable-only `set`; runtime composite `get`; live `ConversationHandle` still via `getConversationHandle` / `materializeConversationHandle` until task 2.
- **Pass summary:** INIT → ACTIVATE TASK → ASSESS (B4 INSPECTED, B5 issues, B0 PROPOSED) → CONSULT (B0 ACCEPTED, B3 canonical intent, B6 resolved) → implementation (Plan Mode) → **CLEANUP (this archive)**.

## [CYCLE-task2-composite-get-enrichment]

- **Scope:** Task 2 — Vertical slice: move `sendMessage` enrichment onto composite `get` (tasklist section 2); vertical `generateRoomPreview`.
- **Key outcomes:** `ConversationCompositeReadHandle` union with `kind` discriminant + type guards; `ConversationsData` injects `ConversationMaterializeDeps` and delegates `get` to `materializeConversationHandle` for `generateRoomPreview`; `InternalCache` wires `messageBus` + `getConnectionId`; `conversations.test.ts` parity with materialized wire payloads; `AGENT.md` updated; prerequisite `getConnectionId` on materialize deps (Pass 7) preserved; tasklist section 2 checked off. **Out of scope delivered as parked:** caller refactor to composite `get` (task 3); removing `getConversationHandle` materialization (task 4 per **A4**).
- **Decisions (ledger):** `DECISION-materialize-deps-getConnectionId`, `DECISION-composite-handle-kind-discriminant`, `DECISION-change-task2-enriched-plumbing-accepted`, `DECISION-task2-vertical-slice-implemented`; plus continued `DECISION-registry-composite-get-adapter`, `DECISION-docs-bundle-implementation-pr`.
- **Patterns established:** Single envelope path via materializers; composite `handle.sendMessage` callable after `isConversationCompositeReadHandleGenerateRoomPreview`; duplicate materialization (cache `get` vs `getConversationHandle`) acceptable until **A4** revisit.
- **Pass summary:** Pass 5 ACTIVATE TASK → Pass 6 ASSESS → Pass 7 CONSULT (`getConnectionId` refactor + typing + parking) → Pass 8 RE-ASSESS → Pass 9 READINESS clarification → Plan Mode implementation → **CLEANUP (this archive)**.

---

# D. Readiness Criteria

READY for Plan Mode when:

- No **material** uncertainty remains (non-material details may still be decided during implementation).
- Relevant **code context is inspected** so intent is grounded in evidence, not assumption.
- **Blocking** open issues are resolved, parked in **A4** with a revisit trigger, or explicitly downgraded to non-material.
- **Proposed changes** intended for this cycle are **ACCEPTED** before REFINE applies them to intent.

**What this gate does not mean:** Merged implementation is not required to have declared prep READY for a prior cycle; see `AGENT.planModePrep.process.md` Phase 7.

**Current state:** **NOT READY** — workspace reset after CLEANUP; start next cycle with **ACTIVATE TASK** (e.g. tasklist section 3) then **ASSESS**.

---

# E. Cleanup (CLEANED)

**Completed:** Phase 8 CLEANUP for **task 2** cycle (this pass).

- Promoted durable context to **A3** (post-task-2 shipped) and **A5** (`DECISION-task2-vertical-slice-implemented`; refreshed implications on prior task 2 decisions).
- Updated **A4** dependency notes (task 2 shipped).
- Archived task 2 under **C — [CYCLE-task2-composite-get-enrichment]**.
- Cleared **B0–B7** to intentional blank states for the next cycle.
- **B7** historical detail: Passes 5–9 + implementation summarized in archive entry.

Invariant satisfied: **B** reset; **A** updated; **C** contains cycle summaries.
