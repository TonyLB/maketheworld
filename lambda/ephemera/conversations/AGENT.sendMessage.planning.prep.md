*Status: PREP ARTIFACT — CLEANED (task 1 cycle archived). Next: ACTIVATE TASK for the next tasklist slice.*

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
| `lambda/ephemera/conversations/registry.ts` | Sole production caller of `Conversations.get`: duplicate check via `get !== undefined`; storable via `?.record`; handle via `materializeConversationHandle(record)` (ignores cache `handle`). | Shipped (task 1 foundation). |
| `lambda/ephemera/internalCache/conversations.test.ts` | Unit tests for composite `get` shape and stub identity. | Shipped (task 1 foundation). |
| `lambda/ephemera/conversations/registry.test.ts` | Registry round-trip and `getConversationHandle` + `sendMessage`. | Shipped (task 1 foundation). |
| `lambda/ephemera/conversations/conversationTypes/handle.ts` | Live `ConversationHandle` union (generateRoomPreview today). | Distinct from composite read stub. |
| `lambda/ephemera/conversations/AGENT.md` | Documents `set` vs composite `get` vs `getConversationHandle`. | Shipped (task 1 foundation). |

Previously known files must not be treated as INSPECTED without re-examination when starting a new cycle.

## A4. Parked Issues (Cross-Cutting)

Parked Issue IDs (only) should use stable, origin-anchored semantic slugs rather than numeric sequence IDs.

**INTENTIONALLY BLANK — NOT YET IN PLAY**

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

---

# B. Active Prep Workspace

## B0. Proposed Changes (Human Review Surface)

**INTENTIONALLY BLANK — NOT YET IN PLAY**

(Task 1 changes were ACCEPTED then implemented; detail archived in **C — [CYCLE-task1-foundation-composite-get]**.)

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

(Authoritative post-task-1 file notes live in **A3** until the next cycle seeds NEEDED rows.)

---

## B5. Open Issues (ASSESS Output)

**INTENTIONALLY BLANK — NOT YET IN PLAY**

---

## B6. Resolved Issues (Validated)

**INTENTIONALLY BLANK — NOT YET IN PLAY**

---

## B7. Pass History

**INTENTIONALLY BLANK — NOT YET IN PLAY**

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

READY when:

- No material uncertainty remains
- Code context is inspected
- All blocking issues resolved
- All applied changes are ACCEPTED

Current state: **NOT READY** — workspace reset after CLEANUP; start next cycle with **ACTIVATE TASK** then ASSESS.

---

# E. Cleanup (CLEANED)

**Completed:** Pass 4 (Phase 8 CLEANUP).

- Promoted durable context to **A3** (post-implementation) and **A5** (`DECISION-task1-foundation-implemented`).
- Archived task 1 cycle under **C — [CYCLE-task1-foundation-composite-get]**.
- Cleared **B0–B7** to intentional blank states for the next cycle.
- **A4** unchanged (still no parked issues).

Invariant satisfied: **B** reset; **A** updated; **C** contains cycle summary.
