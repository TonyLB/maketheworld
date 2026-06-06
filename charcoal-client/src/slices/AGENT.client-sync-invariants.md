# Client sync invariants (charcoal-client)

Cross-cutting requirements for collaborative editing, derived Redux selectors, and Workbench session editors. These invariants prevent referential churn and unbounded render loops when the client overlays optimistic edits on streamed backend state.

Subsystem docs (steady-state architecture; link here rather than duplicating):

- [personalAssets/AGENT.md](./personalAssets/AGENT.md) -- effective pending overlay, `getLocalStandardForm`
- [wmlDataSource/AGENT.md](./wmlDataSource/AGENT.md) -- `confirmedRequestIds`, `getWMLConfirmedRequestIds`
- [dataSource/AGENT.md](./dataSource/AGENT.md) -- event ledger model (authoritative Snapshot, update envelopes, CompactedCheckpoint)
- [dataSource/AGENT.implementation.md](./dataSource/AGENT.implementation.md) -- dispatched correlation cleanup, `requestIdTracking`, merge algorithm
- [Workbench/AGENT.md](../components/Workbench/AGENT.md) -- `useWorkbenchComponent` session model

Regression tests: see **Verification** at the end of this doc.

---

## Memoization-plus (aspirational)

**Memoization-plus** is the name for an architectural target this doc works toward: **derived views keep stable references when domain semantics are unchanged**. It extends the contract Redux and Reselect already provide for **stored** slice data upward through the WML derivation graph (layers 3-5 in I4).

Plain Reselect memoization: same **input references** -> same **output reference**.

Memoization-plus: same **meaning** -> same **output reference**, even when a naive recompute would allocate (filter/map, `merge().toJSON()`, fresh confirmed-id arrays, etc.).

That bridges two layers the client already mixes:

| Layer | Typical change detection |
| --- | --- |
| Redux storage + Reselect | Reference equality (`===`) on stored and derived inputs |
| WML domain (`StandardForm`, `StandardComponent`) | Semantic equality (`.equals()`, `.diff()`) |

Without systematic Memoization-plus at derived boundaries, React, Reselect, and editor guards that assume `===` become **load-bearing for correctness**, not just performance. Referential churn can cause infinite update loops (I5), spurious Slate resync (I3), or unnecessary work --- even when WML semantics did not change.

| If Memoization-plus were systematic... | Today (partial / missing) |
| --- | --- |
| I1 would mainly guard **performance and ergonomics** (fewer rerenders, Reselect behaves as documented). | I1 violations are **correctness bugs** (unstable `standardForm` refs break editor feedback). |
| I3 domain guards in every consumer would be optional. | I3 patches (e.g. Slate `standard` guard) are **belt-and-suspenders** where refs still churn. |
| I2 call-site checks (e.g. reconcile `.equals()`) become **belt-and-suspenders**. | I2 is **load-bearing**: reconcile and other consumers must use **semantic** change detection because refs still churn upstream. |

**Stepping stones already in tree** (not yet systematic through the full chain):

- [`standardFormFromData`](../components/Workbench/foundations/useWorkbenchAsset.ts) -- `WeakMap<StandardFormData, StandardForm>`; stable `StandardForm` only when `StandardFormData` reference is stable.
- Session reconcile in [`useWorkbenchComponent`](../components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.tsx) -- `committed` changes detected with `.equals()`, not reference churn alone (I2).

**How invariants map to the target:**

- **I1** -- proactive Memoization-plus at selectors and cross-slice inputs (Phase 3 E5/E6).
- **I2** -- collaboration must not react to identity-only noise (invariant always). Proactive memo shrinks how often that bites; defensive `.equals()` at reconcile and similar call sites may demote from load-bearing to belt-and-suspenders but should not be deleted without tests.
- **I3 / I5** -- consumer-boundary rules and regression tests; shrink as I1 improves, but tests stay as the definition of "systematic."

### Proposed primitives (not implemented)

Future implementation should live in a small shared module (e.g. `charcoal-client/src/lib/semanticMemo.ts`); names below are aspirational.

#### `createSemanticSelector` (selector layer)

Wraps a Reselect output (or a plain selector) for types that implement semantic equality (`.equals()`, or `deepEqual` for `StandardFormData`).

**Behavior:** keep a module- or selector-scoped cache. On each read, run the inner selector to produce `candidate`. If `cache` exists and `cache` is semantically equal to `candidate`, return **`cache`** (the previous reference). Otherwise replace `cache` with `candidate` and return it.

**Effect:** ten fresh `StandardRoom` instances with the same meaning collapse to **one stable pointer** for downstream `===` checks, Reselect input stability, and editor props.

**Priority placement (I4):** apply at documented derived boundaries, not on every helper:

| Hop | Memo target | Notes |
| --- | --- | --- |
| 3 | `getWMLConfirmedRequestIds`, `getEffectivePendingEdits` | Prefer structural stability (E5) first; semantic/array compare if needed |
| 4-5 | `getLocalStandardForm`, `getStandardForm` | `StandardFormData` via `deepEqual` and/or `StandardForm` via `.equals()` |
| 6 | `committed` (`byUniversalId[componentId]`) | Per-`componentId` cache; highest leverage for session + reconcile |

Reselect already supports custom memoizers (`createSelectorCreator` + equality-aware memoize). `createSemanticSelector` would encode project conventions: immutability of cached values, cache keying (`assetId`, `componentId`), and TTL rules.

**Relationship to Phase 3:** E5 (stable confirmed-id inputs) is structural Memoization-plus at the source. E6 (`deepEqual` at `useWorkbenchAsset`) is a one-off semantic selector boundary. Extract repeated E6 patterns into `createSemanticSelector` when a second call site appears.

#### `useSemanticMemo` (render / hook layer)

React hook with the same contract as `createSemanticSelector`, for values derived **inside** components or hooks rather than in Redux selectors.

```text
useSemanticMemo(factory, deps, equals?)
  -> runs factory when deps change
  -> if result equals cached result semantically, return cached reference
  -> else update cache and return new reference
```

**Use when:** session-local derivations, props passed to `memo()` children, or hook outputs not worth a global selector. **Lower priority** than `createSemanticSelector`: fixing the derivation graph fixes many consumers at once.

If selectors and [`standardFormFromData`](../components/Workbench/foundations/useWorkbenchAsset.ts) are correct, much of `useWorkbenchAsset` may not need this.

#### Design constraints (apply to both primitives)

1. **Immutability** -- cached canonical instances must not be mutated in place; session `working` continues to use `clone()` before edit.
2. **TTL** -- `Date.now()` for correlation cleanup belongs in **dispatched** thunks/reducers (`pruneStaleRequestCorrelation`, `trimStalePendingEdits`), not selector memo inputs.
3. **Cost** -- prefer `deepEqual` on `StandardFormData` at merge boundaries; domain `.equals()` on whole `StandardForm` or per-component slices where cheaper.
4. **Correctness over `===` at collaboration boundaries** -- even with systematic semantic memo, keep I2-style `.equals()` at reconcile until tests prove the proactive layer is complete; then demote to belt-and-suspenders, do not remove the invariant.

#### Adoption sketch

1. Phase 3 ad hoc fixes (E5/E6, Slate `standard` guard) -- prove I1/I3/I5 tests pass.
2. Extract `createSemanticSelector` from the second duplicated boundary.
3. Add per-component semantic cache for `committed` if whole-form compare is too heavy.
4. Introduce `useSemanticMemo` only for remaining component-local churn.

The table below is the **interim contract** until derived hops implement Memoization-plus consistently. Satisfying it is necessary now; it remains the spec against which future refinements are measured.

---

## Invariants

| ID | Invariant | Rationale |
| --- | --- | --- |
| **I1** | **Derived-view referential stability:** `getLocalStandardForm`, `getStandardForm`, and cross-slice inputs to their Reselect chain (e.g. effective confirmed id lists, `getEffectivePendingEdits`) return the **same reference** when store semantics are unchanged. | Unstable merges force new `StandardFormData` instances and break editor guards. Confirmed-id and effective-pending selectors are pure Reselect chains over storage. |
| **I2** | **Churn vs collaboration:** Session `committed` / reconcile react to **semantic** asset changes (flush, stream, import), not referential noise from selector recompute. | Reconcile exists for collaborative external updates; it must not be triggered (and downstream must not react) to identity-only churn. |
| **I3** | **Session editor boundary:** Under `useWorkbenchComponent`, field editors mutate **`working`**; **`committed`** is for reconcile. Consumers of `useWorkbenchAsset().standardForm` on session screens treat it as display/link context unless using **domain** equality. Props feeding Slate must not change reference when domain is unchanged. | Workbench AGENT documents Slate buffering against stale Redux; unstable `standardForm` references defeat that guard when `debounce={false}`. |
| **I4** | **Layer ordering (collaboration path):** Each hop documents what constitutes a change and what must be idempotent. | Makes it obvious when a new derived field belongs in which layer. |
| **I5** | **Bounded mount under session editors:** Mounting session field editors (e.g. `DefaultRenderEditor` with `debounce={false}`) with an **unchanged** store must produce **bounded** render/update work (no infinite loop). | Encodes Area -> Room freeze as a regression class, not a one-off manual check. |

---

## I4: Layer ordering

Collaboration and display flow (left to right):

1. **Stream** -- mtw.wml Snapshot / Content Update / Merge Conflict envelopes
2. **wmlDataSource base** -- `materializedView` per subscribed asset (`getWMLBase`). **Authoritative after** authoritative Snapshot rebase on subscribe (`replayCursor = replayAt ?? createdAt`). Before rebase, value may be **provisional** (thin pre-sidecar merges from OOO replay CUs); optional product-layer gating for Workbench display --- merge engine stays unified in [dataSource/AGENT.md](./dataSource/AGENT.md). Do **not** apply snapshot-expectation gating to updates-only DataSources (`replayable: false`).
3. **Effective pending filter** -- exclude confirmed RequestIds (`getWMLConfirmedRequestIds`); output `getEffectivePendingEdits`
4. **Local form** -- `base + effectivePendingEdits + edit` via `getLocalStandardForm` (edit-layer WML)
5. **Merged display** -- `inherited.merge(local)` via `getStandardForm`
6. **Session `committed`** -- `standardForm.byUniversalId[componentId]` from `useWorkbenchAsset`
7. **Reconcile** -- `reconcileCommittedComponent` when external `committed` changes semantically (`.equals()`)
8. **Session `working`** -- in-memory copy; field editors mutate via `updateComponent`; debounced flush to Redux

```mermaid
flowchart LR
  stream[stream events] --> wmlDS[wmlDataSource base]
  wmlDS --> confirmedIds[getWMLConfirmedRequestIds]
  confirmedIds --> effectivePending[getEffectivePendingEdits]
  effectivePending --> localForm[getLocalStandardForm]
  localForm --> mergedForm[getStandardForm]
  mergedForm --> committed[session committed]
  committed --> reconcile[reconcileCommittedComponent]
  reconcile --> working[session working]
  working --> editors[field editors]
```

**Idempotency expectation:** steps 3-5 are pure functions of upstream storage. Steps 6-8 must not treat identity-only churn at step 5 as a semantic external update.

---

## Dispatched correlation cleanup

Pending/confirmed TTL eviction is **dispatched storage GC**, not selector-time filtering. Selectors (`getWMLConfirmedRequestIds`, `getEffectivePendingEdits`) are pure reads of storage.

**GC owners:** `pendingHygieneCheck` (event-driven, primary confirm path), lazy trim on `saveEdit`, and `pruneStaleRequestCorrelation` on `LifeLinePubSub` `PeriodicTick` (~30s). **Oscillation invariant:** never prune a confirmed id while a pending row with the same `meta.key` still exists in storage.

Confirmed-id referential churn was an original I1 pain point; pure Reselect over storage (`storedConfirmedRequestIdStrings`, `STABLE_EMPTY_CONFIRMED_IDS`) addresses it without read-time clocks. See [dataSource/AGENT.implementation.md](./dataSource/AGENT.implementation.md) (**Dispatched correlation cleanup**).

---

## I2 and I3 in practice

- **I2:** [`reconcileCommittedComponent`](../components/Workbench/foundations/workbenchMutations.ts) compares `prev.equals(committed)` before merging external updates. Referential churn in `getStandardForm` alone must not drive reconcile.
- **I3:** [`useStandardRenderEditorHook`](../components/Workbench/foundations/StandardRender/StandardRenderEditor.tsx) sync guard uses `.equals()` for both `value` and `standard` (belt-and-suspenders when upstream refs still churn).

---

## Collaboration sync fixes (2026-06)

| Invariant | Fix |
| --- | --- |
| **I1** | `storedConfirmedRequestIdStrings` + Reselect in [`dataSource/requestIdTracking.ts`](./dataSource/requestIdTracking.ts) and [`wmlDataSource/selectors.ts`](./wmlDataSource/selectors.ts); `STABLE_EMPTY_CONFIRMED_IDS` for empty results. Pure `getEffectivePendingEdits` (confirmed-id filter only). |
| **I3** | `useStandardRenderEditorHook` uses reference-or-domain check (`===` then `.equals()`) for `value` and `standard`. |
| **I5** | Area -> Room with `debounce={false}` accepted (automated bounded-mount tests + manual navigation, 2026-06-05). E3 interim mitigation superseded. |

---

## Verification

### Automated

```bash
cd charcoal-client
npm run test:single -- src/slices/personalAssets/selectors.test.ts
npm run test:single -- src/slices/wmlDataSource/index.test.ts
npm run test:single -- src/slices/personalAssets/pendingHygiene.test.ts
npm run test:single -- src/components/Workbench/foundations/StandardRender/StandardRenderEditor.test.tsx
npm run test:single -- src/components/Workbench/foundations/DefaultRenderEditor.test.tsx
npm run test:single -- src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.test.tsx
```

I1 referential-stability tests in `selectors.test.ts` and `wmlDataSource/index.test.ts` are enforced (`it`). I3/I5 editor tests assert bounded work in bounded churn iterations. Pending overlay doubling is covered in `selectors.test.ts` and `pendingHygiene.test.ts`.

### Manual verification

- Area -> Room navigation with `debounce={false}` on a Draft asset (2026-06-05).
- Edit -> flush -> stream confirm: no doubled `shortName` / overlay in Workbench UI (see [personalAssets/AGENT.md](./personalAssets/AGENT.md) **Optimistic persist flow** race fix; verified 2026-06-05).
