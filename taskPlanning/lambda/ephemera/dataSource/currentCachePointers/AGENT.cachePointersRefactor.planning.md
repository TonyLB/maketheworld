# Cache pointer commissioning (`currentCacheId`)

**Status: ACTIVE --- all decisions made; implementation not started.** Promoted from DRAFT STUB on 2026-08-03 after a diagnosis session (the duplicate-`CACHE#`-row bug) established that the pointer **read** path already exists and is **dead in production**. This plan supersedes the stub's framing; see [Correction to the stub's premise](#correction-to-the-stubs-premise).

**All four decisions resolved 2026-08-03. Phase 1 (CP-3 migration cleanup) shipped 2026-08-03 --- next slice is Phase 2.** Commission the pointer (CP-1); fan-out unchanged and no invalidation mechanism to build (CP-2); finish the migration off `Meta::Room` pointer storage (CP-3, done); write at the existing `renderCache` seam, and **`mtw.ephemera.currentCachePointers` is cancelled** (CP-4).

**Read [Corrections](#corrections-to-earlier-analysis-in-this-plan) before trusting any analysis in this file** --- two conclusions here were withdrawn after review, both from inferring semantics off flag names instead of reading the contract.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
**Refinement rule:** Edits that change **shared semantics** belong in the canonical contract [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) as well as here.

---

## Purpose

`Cache::${perspectiveKey}` catalog rows carry an optional **`currentCacheId`** fast pointer at the `CACHE#...` row that most recently answered for that component + perspective. The intent is to let render resolve short-circuit: one `getItem` on a known-good cache row instead of a `query` across the component's `CACHE#` rows.

**Nothing has ever written it.** This plan decides whether to commission that path --- and, if so, what it turns on.

## Correction to the stub's premise

The April 2026 stub proposed a **new `mtw.ephemera.currentCachePointers` DataSource** subscribing to `Render Pertains` / `Generation Deferred` to project pointers into **`Meta::Room.currentCacheByPerspective`**. Two things have changed since:

1. **The canonical pointer moved.** The M2 migration made catalog-row **`currentCacheId`** canonical; `Meta::Room.currentCacheByPerspective` is the **legacy** field, read only as a fallback ([`perspectivePointer.ts:20-25`](../../../../../lambda/ephemera/dataSource/renderCache/perspectivePointer.ts#L20-L25)).
2. **The read and clear halves already shipped** inside `renderCache` / `renderOrchestration`. The stub's "future DataSource" would now be inserting a write into a scheme whose other halves already have homes.

**CP-4 resolved this against the stub:** the DataSource is **cancelled**. The folder name is now vestigial --- this plan covers a `renderCache`-internal field, not a DataSource. The contract doc's `currentCachePointers` obligations are superseded accordingly (see [Contract impact](#contract-impact-of-cp-4)).

---

## Findings (2026-08-03 diagnosis)

Grep of production code (excluding `*.test.ts`) for `currentCacheId` and `currentCacheByPerspective`:

| Half | Where | State |
| --- | --- | --- |
| **Read** | [`perspectivePointer.ts:11-27`](../../../../../lambda/ephemera/dataSource/renderCache/perspectivePointer.ts#L11-L27) `resolvePerspectivePointer`; [`:67-92`](../../../../../lambda/ephemera/dataSource/renderCache/perspectivePointer.ts#L67-L92) `collectPerspectivePointerEntries` | Shipped |
| **Clear** | [`perspectivePointer.ts:29-57`](../../../../../lambda/ephemera/dataSource/renderCache/perspectivePointer.ts#L29-L57) `clearPerspectivePointer`; [`catalogRow.ts:104-119`](../../../../../lambda/ephemera/dataSource/renderCache/catalogRow.ts#L104-L119) `conditionalInvalidateCatalogRow` | Shipped |
| **Write** | --- | **Does not exist, for either field** |

**Consequences of the missing write (all currently true in production):**

- `resolvePerspectivePointer` unconditionally returns `undefined`, so **`pointerHint` is never set** on a resolve input ([`requestIntake.ts:66`](../../../../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.ts#L66), [`:118`](../../../../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.ts#L118)).
- The **entire pointer-validation branch** at [`findRender.ts:51-78`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts#L51-L78) has never executed --- including its `clearPerspectivePointer` call, which is reachable **only** from inside that branch.
- **`'Current Cache Valid'` has never been emitted.** It is a declared outbound with a subscriber ([`handleRenderOrchestrationInbound.ts:140-145`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderOrchestrationInbound.ts#L140-L145)) and contract tests, and zero production mileage.
- `collectPerspectivePointerEntries` always returns `[]`, so the **"P" (pointer-only) set** in [`fanOutStateChangedToPassiveRenders.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/fanOutStateChangedToPassiveRenders.ts) is always empty and `S = A`.

So this is not "fill a gap in a live feature." It is **commissioning a dormant subsystem** that has test coverage but has never run.

---

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **CP-1** | **Does the pointer earn its keep? --- YES.** The pointer is a **per-(component, perspective) MRU of size 1, keyed on mark state**: validation at [`findRender.ts:55-61`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts#L55-L61) requires `markStatesEqual`, so it survives exactly as long as state does not change and self-invalidates on the first read after it does. It replaces a `getExactMatch` query that scans **all** `CACHE#` rows for the component --- every perspective, every mark state --- so it trades `O(1)` for `O(total accumulated rows)`, and the per-hit saving **grows with the accumulation the design intends**. Hit rate is `(reads per state-epoch - 1) / (reads per state-epoch)`, high for any populated room. **Do not gate on measuring current row counts:** today's low counts are an artifact of a system that has never played (state never changes, so no branching into distinct `SITUATION`/authored entries and no improvised generated entries). Measuring that baseline measures the absence of the feature the pointer supports, not the pointer's value. The 2026-08-03 duplicate-row bloat was a **bug** (exact copies of one row); meaningfully distinct rows accumulating through play is the **requirement**. Only degenerate case: a component whose state changes more often than it is read --- pointer always stale on arrival --- which is not worth gating on, since the write is cheap against a growing query. | --- | **Decided 2026-08-03 (commission it)** |
| **CP-2** | **RESOLVED --- fan-out is the designed mechanism and stays; the pointer needs no invalidation write.** Two earlier framings in this row were **wrong and are withdrawn** (see the struck rows below and [Corrections](#corrections-to-earlier-analysis-in-this-plan)). What holds: **mark state is not stored on the catalog row** --- it is compared at read time ([`findRender.ts:59`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts#L59)) between live marks and the pointed-to row's `markState`, so a state change makes the pointer fail validation on next read, which clears it and falls through to exact-match. **No eager invalidation write is required for the state-change axis.** A component-level "invalidate all perspectives in one write" is not available anyway (catalog rows are per-perspective, no component epoch) and is not needed. Authored-content staleness is the separate axis, already handled by `conditionalInvalidateCatalogRow` (which deletes `currentCacheId`). **Decision: pointer writes feed `collectPerspectivePointerEntries` as designed; build no new invalidation mechanism.** | Implementation slice | **Decided 2026-08-03 (fan-out as designed; no invalidation write)** |
| ~~CP-2a (withdrawn 2026-08-03 --- false premise)~~ | ~~"Delete the P half of the fan-out; it can't pre-warm anything because `allowGeneration: false`."~~ **Wrong.** `allowGeneration: false` caps cost by forbidding the **LLM slow path**, not by preventing renders: authored situations are seeded as authored-provenance `CACHE#` rows, so **exact-match is a full render path for a state never seen before**. P items therefore resolve normally in the common case. See [contract - State-driven fan-out set and `allowGeneration`](../AGENT.passThrough.contract.planning.md#state-driven-fan-out-set-and-allowgeneration-set-algebra), which states directly that this is "**not** 'skip orchestration'". | --- | **Withdrawn** |
| ~~CP-2 (original framing --- withdrawn)~~ | **Writing the catalog pointer silently activates the fan-out "P" set.** `collectPerspectivePointerEntries` unions catalog `currentCacheId` with the legacy Meta map, and `fanOutStateChangedToPassiveRenders` uses the result as the pointer-only perspectives to re-render on every `State Changed`. That set is empty today. Once pointers are written, **every room state change fans out passive renders for every perspective anyone has ever looked at**, not just perspectives with a live audience. Decide the intended scope (all-time pointers? TTL? only perspectives with current `targets`?) and whether P is wanted at all. This is the largest blast radius in the plan. **Sharpened by CP-1's resolution:** pointers are cleared on invalidation and on failed validation, but a pointer for a perspective nobody revisits is **never** cleared, so P trends toward "every perspective ever pointed at." Fan-out cost then scales as `(state changes) x (historical perspectives)` --- **multiplicatively, in exactly the high-play regime that earns the pointer its keep**. Same growth driver as CP-1, opposite sign. **Withdrawn 2026-08-03:** this mischaracterized the fan-out as **eager pre-computation**. It is not --- it is the **same `orchestrateRenderRequest` a first-time look runs**, driven by a state-change event instead of a read, and refreshing the perspectives of **players present** (set **A**, real `targets`) is the point of it. The scaling worry was overstated on top of that error: P is bounded in theory by "every perspective ever seen" but in practice much less. Kept for the reasoning trail. | --- | **Withdrawn** |
| **CP-4** | **RESOLVED --- write at the existing `renderCache` seam; the separate DataSource is cancelled.** `setPerspectivePointer` is called from [`handleRenderOrchestrationInbound.ts`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderOrchestrationInbound.ts)'s hit and generate paths, which already receive `componentId` + `cacheId` + perspective and already live in the DataSource that **owns the catalog row**. **`mtw.ephemera.currentCachePointers` will not be built.** Rationale: the drive to handle pointers in a separate DataSource **emerged from** the legacy pattern of recording them on `Meta::Room` --- i.e. outside the catalog, in a row owned by a different concern. With CP-3 retiring that storage, the pointer is simply a field on a `renderCache`-owned row, and its maintenance belongs with the rest of that row's CRUD. The separation the stub was protecting no longer has a boundary to protect. | Implementation slice | **Decided 2026-08-03 (renderCache seam; DataSource cancelled)** |

---

## Corrections to earlier analysis in this plan

Recorded 2026-08-03 because each of these is an **easy cold-read mistake** about how render cache works, and two of them were made in this very document.

| Misreading | Reality |
| --- | --- |
| "`allowGeneration: false` means the resolve cannot produce a render, so audience-less fan-out accomplishes nothing." | It forbids the **LLM slow path** only. **Authored situations are seeded into the cache as authored-provenance `CACHE#` rows** (via `ensureAuthoredCatalog` / hydrate diff), so a state **never seen before** can still match authored expectations and render via exact-match. `allowGeneration: false` is a **cost cap**, not a capability switch. |
| "State-change fan-out is eager pre-computation, in tension with `renderCache`'s lazy design." | Fan-out is an **event driver**: it runs the **same `orchestrateRenderRequest`** that a player entering the room for the first time would run. Lazy evaluation *at the moment of change*. The contract says this explicitly --- "**not** 'skip orchestration'". |
| "The pointer-only P set has no purpose." | When room state changes, the perspectives of **players present** (set **A**) genuinely need refreshing from each character's point of view. P covers perspectives with no audience at capped cost. Bounded in theory by "every perspective ever seen," in practice much less. |

**Where to read this properly:** [contract --- State-driven fan-out set and `allowGeneration` (set algebra)](../AGENT.passThrough.contract.planning.md#state-driven-fan-out-set-and-allowgeneration-set-algebra) defines **A**, **P**, **S = A union P**, and the `allowGeneration` policy split. [`renderCache/AGENT.md` --- Authored cache (invalidate + hydrate)](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) covers authored seeding. **Reading `fanOutStateChangedToPassiveRenders.ts` alone is not sufficient** --- the flag names do not carry these semantics, and inferring them from the code is how the errors above happened.

**Possible doc gap (minor):** [`renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) line 74 describes P as using "`allowGeneration: false` and cheap paths only" without noting that **authored seeding makes cheap paths sufficient for most state changes**. That connection currently requires joining two documents. A one-line cross-reference there would close it.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) for durability conventions.
2. Read [Corrections](#corrections-to-earlier-analysis-in-this-plan) **first** --- three cold-read traps, two of which were fallen into while writing this plan.
3. Read the contract's [State-driven fan-out set and `allowGeneration` (set algebra)](../AGENT.passThrough.contract.planning.md#state-driven-fan-out-set-and-allowgeneration-set-algebra) **before** reading fan-out code. The flag names do not carry their own semantics.
4. Read [Findings](#findings-2026-08-03-diagnosis) above **before** the code --- the dead-path result is not obvious from reading either module alone, because each half looks complete in isolation.
3. Read the pointer module end to end: [`renderCache/perspectivePointer.ts`](../../../../../lambda/ephemera/dataSource/renderCache/perspectivePointer.ts) (all three functions; it is under 100 lines).
4. Read the consumer side: [`renderOrchestration/findRender.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts) (pointer-validation branch) and [`renderOrchestration/requestIntake.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.ts) (where `pointerHint` would be populated).
5. Read the fan-out contract for CP-2: [`renderOrchestration/fanOutStateChangedToPassiveRenders.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/fanOutStateChangedToPassiveRenders.ts) header comment (the `S = A union P` contract).
6. Durable module docs: [`renderCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) ("Perspective pointers") and [`renderOrchestration/AGENT.planning.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md#L76) (rollout guidance --- note it predates the finding that no writer exists).
7. Canonical cross-DataSource contract: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md), uncertainties **9** and **11**.
8. **Testing authority:** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). This package is Jest and uses `npm run test` (**not** `npm test`), run from `lambda/ephemera`. If commands anywhere conflict, that file wins.
9. **Baseline before edits** (should pass):
   ```bash
   cd lambda/ephemera && npm run test -- --watchAll=false dataSource/renderCache/ dataSource/renderOrchestration/
   ```

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Nested bullets follow the same rule.

- [X] **Phase 0 --- decisions.** All four resolved 2026-08-03; see the decisions table for reasoning.
  - [X] **CP-1** --- commission the pointer. (The deletion branch that once stood here is retired, along with the measurement gate that would have produced a false negative.)
  - [X] **CP-2** --- fan-out stays as designed (standard orchestration driven by a state-change event, not eager pre-computation); no invalidation mechanism to build, since read-time validation already covers the state-change axis.
  - [X] **CP-3** --- finish the migration off `Meta::Room` pointer storage.
  - [X] **CP-4** --- write at the `renderCache` seam; cancel the separate DataSource.
- [X] **Phase 1 --- CP-3 migration cleanup.** Delete Meta pointer storage per the CP-3 scope list. **Behaviorally inert** --- removing a fallback that has never once returned a value cannot regress anything, and there is no Dynamo backfill because no row ever carried these fields. **Leads deliberately:** it simplifies `perspectivePointer.ts` before Phase 3 writes into it, and its signature ripples land in `fanOutStateChangedToPassiveRenders.ts` **before** Phase 4 goes on to smoke-test that same file's P behavior. Reviewable as pure subtraction.
- [ ] **Phase 2 --- retire the cancelled DataSource's obligations.** Doc-only, plus one comment; see [Contract impact](#contract-impact-of-cp-4). Lands with the deletion it describes rather than trailing the activation.
- [ ] **Phase 3 --- write path.** Add `setPerspectivePointer(componentId, perspectiveKey, cacheId)` to `perspectivePointer.ts` (idempotent; no `CACHE#` row writes), called from the `renderCache` seam chosen in CP-4. Pointers **feed** `collectPerspectivePointerEntries` as designed (CP-2) --- this is what activates the **P** set for the first time. **Do not land without Phase 4:** Phase 4 is not follow-up work, it is the verification of this change.
- [ ] **Phase 4 --- commission the dormant consumers deliberately.** One call site activates **three** paths that have never run in production. Verify against real smoke tests rather than trusting existing unit coverage, which has never been validated against production behavior.
  - [ ] `findRender`'s pointer-validation branch (per-read, cheap).
  - [ ] The `'Current Cache Valid'` outbound and its subscriber arm in `handleOrchestrationHitPath` --- an event that has never been emitted (per-read, cheap).
  - [ ] The **P** set becoming non-empty --- **the only one that changes work volume.**
  - [ ] Smoke-verify read-time pointer invalidation end to end: read a room (pointer written), change its state, read again --- expect pointer validation to fail, the pointer to be cleared, and **exact-match against the authored row for the new state** to answer. This is CP-2's payoff test.
  - [ ] Smoke-verify **state-change fan-out** now that pointers exist: with a player present, change room state and confirm the **A** perspective re-renders and delivers to that character; confirm **P** entries resolve at capped cost without invoking generation.
- [ ] **Phase 5 --- durable docs.** Move steady-state rules into [`renderCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) and the relevant `AGENT.contract.md` (the contract's subscriber tables are already handled in Phase 2); add the one-line authored-seeding cross-reference to [`renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) noted under **Corrections**; then delete this plan.

---

## Contract impact of CP-4

**The obligations were never implemented --- they exist only in design docs.** Verified 2026-08-03: no `currentCachePointers` module or directory in `lambda/` or `packages/`, not registered in [`app.ts`](../../../../../lambda/ephemera/app.ts), and **no** skipped/`todo` contract tests encoding its behavior (the contract's "start as `describe.skip`" strategy was never applied here). Neither obligation exists in code: the **set** side has no writer at all, and **clear-on-`Generation Deferred`** is an explicit no-op at [`handleRenderOrchestrationInbound.ts:164-166`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderOrchestrationInbound.ts#L164-L166). (`clearPerspectivePointer` is **not** a partial build of that obligation --- it fires on pointer **validation failure** inside `findRender`, a different trigger, and already lives in `renderCache`.)

**So Phase 2 is doc-only, plus one comment.** The lone code artifact is that no-op's comment --- `// No cache row writes here; meta pointers are currentCachePointers.` --- which defers to a DataSource that will never exist and should be rewritten to say the pointer self-invalidates at read.

**The retired obligation is unnecessary, not merely unbuilt:** under CP-2 the pointer fails validation on the next read after state changes, so `Generation Deferred` correctly stays a no-op. There is nothing a clear-on-defer subscriber would have done.

Contract entries to retire (Phase 2):

| Location | Current claim | Replacement |
| --- | --- | --- |
| Subscribers / roles tables | `currentCachePointers` owns meta pointer maintenance; subscribes to `Render Pertains` (set) and `Generation Deferred` (clear) | `renderCache` maintains `currentCacheId` on the catalog row it already owns, at the `handleRenderOrchestrationInbound` seam. No new subscriber. |
| Ownership table (**Meta** pointers row) | Pointers are `Meta::Room` fields owned by a planned DataSource | Pointers are catalog-row fields; `Meta::Room` pointer storage is **deleted** (CP-3). |
| Uncertainty 9 | Payload richness justified partly by `currentCachePointers` needs | Still resolved, but the justification reduces to Perception's needs alone. |
| Contract-test table | Unit tests for the future DataSource | Fold into `renderCache` tests (pointer-only writes, idempotent set, no `CACHE#` touches). |

Also update the sub-epic index item **C.5** in [`AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md), which currently lists this as a pending DataSource slice.

---

## Verification

Baseline and per-slice (from `lambda/ephemera`):

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/renderCache/ \
  dataSource/renderOrchestration/
npx tsc --noEmit
```

Full-suite check before handing off a slice (integration tests sit outside `tsconfig`, so `tsc` alone does not cover them):

```bash
cd lambda/ephemera && npm run test -- --watchAll=false
```

**Dead-path grep** --- confirms the premise still holds before starting, and inverts once Phase 3 lands (a writer should appear alongside the readers):

```bash
grep -rn "currentCacheId\|currentCacheByPerspective" --include="*.ts" lambda packages \
  | grep -v node_modules | grep -v "\.test\."
```

---

## Contract tests

Per the stub's original obligation, kept: unit tests for **pointer-only** writes (no accidental `CACHE#` deletes), **idempotent** sets, and clears on `Generation Deferred`, using the **Encoding the contract in unit tests** discipline in [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests).

Add for CP-2: a fan-out test asserting the **size and membership** of the P set for a component with several historical pointers, so the blast radius is pinned by a test rather than discovered in production.

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework |
| [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) | **Canonical contract** --- `Generation Deferred`, `Render Pertains`, uncertainties 9 / 11 |
| [`renderCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) | Catalog row schema; `Render Pertains` producer; "Perspective pointers" |
| [`renderOrchestration/AGENT.planning.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md) | Perspective-scoped pointer rollout guidance (predates the no-writer finding) |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | Sub-epic index (item **C.5**) |
| [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) | Test command authority |

---

## Progress

| Milestone | Status |
| --- | --- |
| Stub created; obligations + links | Done (2026-04-14) |
| Contract + contract-align index updated | Done (2026-04-14) |
| **Diagnosis: no writer exists for either pointer field; read/clear halves are dead code** | **Done (2026-08-03)** |
| Promoted stub to active plan; CP-1..CP-4 named | Done (2026-08-03) |
| CP-1 decision gate --- **commission the pointer** (MRU-of-1 on mark state; saving grows with designed row accumulation) | Done (2026-08-03) |
| CP-2 fan-out / invalidation --- **fan-out is the designed mechanism and stays; no invalidation write needed** | Done (2026-08-03) |
| Two withdrawn misreadings recorded in **Corrections** (authored seeding vs `allowGeneration`; fan-out as "eager") | Done (2026-08-03) |
| CP-3 --- **finish the Meta migration** (pure code deletion; no data to migrate) | Done (2026-08-03) |
| CP-4 --- **write at the `renderCache` seam; `mtw.ephemera.currentCachePointers` cancelled** | Done (2026-08-03) |
| **Phase 1** --- CP-3 migration cleanup (delete Meta pointer storage) | **Done (2026-08-03)** |
| **Phase 2** --- retire cancelled DataSource obligations (doc-only + one comment) | Not started --- next slice |
| **Phase 3 + 4** --- write path and commissioning (**one slice**; Phase 4 is Phase 3's verification) | Not started |
| **Phase 5** --- durable docs; delete this plan | Not started |
