# Workbench composition and Standard* binding (charcoal-client)

**Status:** **Milestone 1 complete** --- decisions **D1-D15** (+ **D14a-c**) locked. **Next step:** **Phase 2** (facet prose + parent-session reference lists + inline editors; see **D15**).

This plan is task-scoped. Archive or delete it after the initiative ships; move lasting norms into [`charcoal-client/src/components/Workbench/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/AGENT.md) and related foundation docs.

**Framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md)

---

## Purpose

Reduce repetitive Workbench editor code while making composition predictable:

1. **Two-tier editing:** a **working `StandardComponent`** in the editor session (cheap `clone()` + mutate on each change) and **debounced `updateStandard`** to Redux (expensive whole-asset clone + diff + merge).
2. **Standard* in / Standard* out** at leaf and row UI (controlled components), reading/writing the **working** instance via `useWorkbenchComponent` --- not orphan leaf `localValue` that can drift from committed state.
3. **Composable list editors** that derive row handlers from parent `items` + `onItemsChange` (facet pattern), mutating the parent **`working`** copy where a **`WorkbenchComponentProvider`** session exists (**D15**).
4. **Shared glue** for resolve, normalize, and flush (especially **`shortName`**).

**Non-goals for this initiative:**

- A generic form generator for every `StandardComponent` type.
- Replacing domain editors for facets, topology (`Area` exit edges), reference import, or layered navigation.
- Changing `updateStandard` reducer semantics or persistence (clone / diff / merge stays as today).
- Shared editor layout extraction (`WorkbenchComponentEditorLayout`) --- **D9** deferred to a separate UI sweep after data binding is standardized.

---

## Problem statement (current state)

Workbench component editors (`RoomEditor`, `FeatureEditor`, `AreaEditor`, `GuidanceEditor`, `MarkEditor`, etc.) repeat:

| Concern | Typical pattern today |
| --- | --- |
| Resolve | `getCurrentComponentId` -> `standardForm.byUniversalId[id]` -> `instanceof StandardRoom` |
| Read | `component.shortName ?? new StandardLiteral('')` |
| Write | `updateStandard` on every debounced field change -> **whole-asset** diff ([`reducers.ts`](../../../../../charcoal-client/src/slices/personalAssets/reducers.ts)) |
| Local UI state | `StandardLiteralEditor` / Slate keep **leaf** `localValue` while Redux is stale during debounce ([`useUpdatedSlate`](../../../../../charcoal-client/src/hooks/useUpdatedSlate.ts) documents this) |
| Normalize | Empty string -> `undefined` (inconsistent); optional equality guard before dispatch |
| Layout | Duplicated nested `Box` scaffolding |

**Partial solutions already in the tree** (extend, do not replace blindly):

| Pattern | Location | Role |
| --- | --- | --- |
| Primitive binding | [`StandardLiteralEditor`](../../../../../charcoal-client/src/components/Workbench/foundations/StandardLiteral/StandardLiteralEditor.tsx), [`StandardRenderEditor`](../../../../../charcoal-client/src/components/Workbench/foundations/StandardRender/StandardRenderEditor.tsx) | `value` + `onChange` on `StandardLiteral` / `StandardRender` |
| Domain section | [`DefaultRenderEditor`](../../../../../charcoal-client/src/components/Workbench/foundations/DefaultRenderEditor.tsx) -> [`SituationFacetRenderFieldsEditor`](../../../../../charcoal-client/src/components/Workbench/foundations/SituationFacetRenderFieldsEditor.tsx) | Hides facet path + create-on-edit |
| List + composed handlers | [`FacetListEditorGeneric`](../../../../../charcoal-client/src/components/Workbench/foundations/FacetList/FacetListEditorGeneric.tsx) | `facets` + `onFacetsChange` + per-row handlers |
| Row + pure updaters | [`ExitEdgeRowEditor`](../../../../../charcoal-client/src/components/Workbench/AreaEdit/ExitEdgeRowEditor.tsx) + [`areaEditMutations.ts`](../../../../../charcoal-client/src/components/Workbench/AreaEdit/areaEditMutations.ts) | `StandardExitEdge` in/out; list maps to `updateStandard` |
| Reference list (view model) | [`ReferenceListEditor`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/ReferenceListEditor.tsx) | `ReferenceListItem[]` for display; draft mutation via `updateReferenceList` |
| Inline list slots | [`InlineReferenceList`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/InlineReferenceList.tsx) | Layout composition; [`MarkInlineEditor`](../../../../../charcoal-client/src/components/Workbench/MarkEdit/InlineEditor.tsx) still calls `updateStandard` internally |

**Platform note:** [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) documents direct `_payload._shortName` assignment as Workbench-only today, with optional **`withShortName()`** on components as follow-up. [`shortNameField.ts`](../../../../../packages/mtw-wml/ts/standardize/components/shortNameField.ts) already centralizes merge/invert/schema helpers.

---

## Agreed direction (normative for this initiative)

### Editing session model (two tiers)

| Tier | What | Cost | When |
| --- | --- | --- | --- |
| **Working copy** | `StandardRoom` (etc.) in React state/context from `useWorkbenchComponent` | **Component** `clone()` + payload mutate | Every keystroke / field change via `updateComponent` |
| **Committed copy** | `standardForm.byUniversalId[id]` in Redux via `useWorkbenchAsset` | **Asset** `standardForm._clone()` + `diff` + merge into `edit` | Debounced **`flushToStandardForm`** (per editor session, **D8a**), plus **`flushNow`** on unmount / breadcrumb |

```text
User edit
  -> updateComponent(updater)     // working = working.clone(); updater(working); setState
  -> UI reads working.*           // single editing truth (Slate may still use editor buffer; see below)

  ... debounce (per component editor session) ...

  -> flushToStandardForm()
  -> updateStandard({ update: (draft) => { draft.byUniversalId[id] = working.clone(); return draft } })
  -> reducer: whole-asset diff
```

**Why per-component debounce (not per-field):** each `updateStandard` diffs the **entire asset**. Batching all pending scalar edits on one component into **one flush** minimizes asset diffs. Per-field debounce timers on persist would multiply full-asset diffs when the author edits several fields in one session.

**Why a full working `StandardComponent` (not only a partial `pending` map):** field changes compose naturally on one clone; UI always reflects the same object the flush will write. Cost while typing is O(component), not O(asset).

**Not Immer today:** use mtw-wml `component.clone()` then mutate the clone's `_payload` (or future `withShortName()` / `with*` helpers). Same idea as immutable snapshots, implemented with existing APIs.

### Layering model

```text
UI primitives (StandardLiteralEditor, StandardRenderEditor)  // no updateStandard; debounce removed when under session provider
    <- field/section components (WorkbenchShortNameField, DefaultRenderEditor, ExitEdgeListEditor)
        <- useWorkbenchComponent (working copy, updateComponent, debounced flushToStandardForm)
            <- optional: WorkbenchComponentProvider (context for one componentId)
            <- pure updaters on flush path (normalize shortName, assign to draft.byUniversalId)
                <- updateStandard (asset clone -> diff -> merge into edit)
```

### Composition rules

1. **Component editor session:** one `useWorkbenchComponent` (or provider) per screen editing a single component (Room, Feature, Area, ...). Holds **`working`**, **`lastReceived`** (Redux baseline for reconcile), **`committed`** (live Redux), **`updateComponent`**, **`flushToStandardForm`** (debounced), **`flushNow`** (bypass debounce). See [Sync from Redux (D14)](#sync-from-redux-d14).
2. **Leaf editors** expose **`value` / `onChange`** against **working** fields, wired by thin field components or `useWorkbenchComponent` consumers. **No `updateStandard` inside primitives**; **no persist debounce inside primitives** when mounted under a session provider.
3. **List shells on a parent `WorkbenchComponentProvider` screen** (reference lists, facet payloads on the parent, embedded DEFAULT prose): mutate the parent's **`working`** via **`updateComponent`** + session debounced flush (**D8**, **D15**). Rule #3 did **not** require a separate `updateStandard` path for structural list changes --- that was a **Phase 1 scope** escape hatch, not a target end state. Use optional **`flushNow`** after add/remove/import when edits must be durable before navigation. **Exceptions (document per pattern):** domain topology (e.g. Area `ExitEdgeListEditor`), asset-level lists (`TopLevelEditor`), navigated drill-down screens without a parent session.
4. **Compose by sections** on the screen (shortName, DEFAULT prose, lists, topology), not by flattening into one generic form type --- but sections editing the **same** parent component share one **`working`** copy (scalars, reference-list fields, default situation facet on that parent).
5. **Reference vs facet vs component:** row contract uses the editable **Standard*** slice; list rows may use facet/exit patterns with their own flush rules.

### What "two-way binding" means here

React controlled components + **working copy** in the editor session --- not Angular `[(ngModel)]`. **Authoritative while editing:** `working`. **Authoritative across navigation / save:** Redux `standardForm` after flush. When Redux changes without this session's flush, reconcile via **D14** (`lastReceived`, `diff`, `merge`).

### Slate / rich text caveat

[`useUpdatedSlate`](../../../../../charcoal-client/src/hooks/useUpdatedSlate.ts) needs a local editor buffer so parent `value` does not overwrite in-progress typing when Redux is stale. Options for this initiative: (a) Slate buffer commits into **`working`** (facet payload or component field) on change, and **only `flushToStandardForm`** hits Redux; or (b) facet editors remain a separate sub-session until Phase 2+. Do not read prose only from Redux on every keystroke.

---

## Target outcomes

| Outcome | Success signal |
| --- | --- |
| Less boilerplate | Room/Feature/Knowledge/Area editors lose duplicated shortName `updateStandard` blocks |
| Single editing truth | Scalar fields read `working`; no drift between leaf `localValue` and Redux during debounce |
| Fewer asset diffs | Typing across multiple fields on one component batches into one debounced flush |
| Consistent shortName semantics | Omission-over-empty and readonly enforced on flush path |
| Clear list composition | Parent-session list mutations in Phase 2; **`ReferenceListControlled`** shell + migration in Phase 3 (**D15**, **D6**) |
| Testable updaters | Pure functions for normalize + apply working -> draft; **`reconcileCommittedComponent`** (D14) unit tests |
| Safe external updates | Import/collaborative Redux changes merge local edits when algebra allows; snackbar on supersede |
| Durable docs updated | Workbench `AGENT.md` links two-tier model; this plan deleted when done |

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../../../AGENT.md)
2. **Charcoal-client development (tests):** [`taskPlanning/charcoal-client/AGENT.development.md`](../../../AGENT.development.md)
3. **Workbench steady-state:** [`charcoal-client/src/components/Workbench/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/AGENT.md)
4. **Reference / facet list patterns:** [`AGENT.reference-lists.md`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md), [`AGENT.facet-list.md`](../../../../../charcoal-client/src/components/Workbench/foundations/FacetList/AGENT.facet-list.md)
5. **Persistence:** [`charcoal-client/src/slices/personalAssets/AGENT.md`](../../../../../charcoal-client/src/slices/personalAssets/AGENT.md) (`updateStandard` thunk + reducer diff)
6. **WML components / shortName:** [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md)

**Test command authority:** [`charcoal-client/AGENT.testing.md`](../../../../../charcoal-client/AGENT.testing.md). If commands conflict, follow that file. Area notes: [`taskPlanning/charcoal-client/AGENT.development.md`](../../../AGENT.development.md).

**Baseline (before edits):**

```bash
cd charcoal-client
npm run test:single -- src/components/Workbench/AreaEdit/areaEditMutations.test.ts
npm run test:single -- src/components/Workbench/foundations/ReferenceList
```

---

## Decisions register

Mark **Status** `[X]` when normative. Phases reference IDs.

### Architecture and ownership

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D1** | [X] | **Where `useWorkbenchComponent` lives** | **Locked: (A)** [`foundations/WorkbenchComponent/`](../../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/) (`index.ts` barrel; hook in `useWorkbenchComponent.tsx`) next to `useWorkbenchAsset`. |
| **D2** | [X] | **Mutation style (working vs flush)** | **Working:** `updateComponent` uses `working.clone()` then mutates clone (`_payload` or `withShortName()` per **D3**). **Flush: (A)** `draft.byUniversalId[id] = working.clone()`. |
| **D3** | [X] | **`withShortName()` in mtw-wml** | **Locked: (B)** add `withShortName()` on component wrapper in **mtw-wml in parallel** with Phase 1 client work (AGENT.implementation follow-up). Client may still use `normalizeOptionalLiteral` / apply-on-flush until `with*` lands. |
| **D4** | [X] | **`WorkbenchShortNameField` API** | **Locked: (A)** context only --- field consumes **working** + `updateComponent` from `useWorkbenchComponent` / `WorkbenchComponentProvider`. **No** `updateStandard` or persist debounce in the field. **Phase 1 task:** add **`useWorkbenchComponent` test harness** (provider wrapper + helpers to seed `standardForm` / `committed`, drive `updateComponent`, assert `working` and flush) for unit/RTL tests; do not add prop bypass on the field itself. |
| **D5** | [X] | **Field accessor helpers** | **Locked: (A)** defer generic `useWorkbenchLiteralField`; field components use **`updateComponent(component => ...)`** inline. |
| **D6** | [X] | **Reference list controlled mode** | **Locked: (A)** add **`ReferenceListControlled`** (`referenceList` + `onReferenceListChange`) alongside existing `ReferenceListEditor` (**Phase 3** --- composable shell + call-site migration). **Amended (D15):** persistence tier moves to parent **`working`** in **Phase 2**; Phase 3 is not the first time lists participate in the session model. |
| **D7** | [X] | **Inline editors and `updateStandard`** | **Locked: (C)** refactor **`MarkInlineEditor`** (and similar) in **Phase 2** via parent **`working`** / **`updateComponent`** or a per-row Mark session --- **not** blocked on **D6** (**D15**). Phase 1 deferred inline editors; document facet/exit pattern for new lists. |
| **D15** | [X] | **Reference list persistence vs controlled shell** | **Phase 2:** On **`WorkbenchComponentProvider`** screens, existing **`ReferenceListEditor`** list mutations (add/remove/import) go through parent **`updateComponent`** on **`working`** + shared debounced flush; read list state from **`working`**, not live Redux alone. Facet prose on the same parent uses **`updateComponent`** on **`working`** (edit path); optional **`applyWorkingComponentToDraft`** extracts flush assign only. Optional **`flushNow`** after structural ops when needed. **Phase 3:** **`ReferenceListControlled`** per **D6**; migrate off `listContext` + internal `updateStandard`. **Out of Phase 2 unless scoped:** Area exit topology, `TopLevelEditor` asset lists, navigated-only editors (e.g. full `MarkEditor` screen). |
| **D8** | [X] | **Debouncing policy (agreed direction)** | **Per-component editor session:** debounce **`flushToStandardForm`** only (default ~1000ms, configurable). **`updateComponent`** is immediate (working copy). **Remove** persist debounce from primitives when under session provider; literals may stay uncontrolled string UI bound to `working` field. **Not** per-field persist timers (multiplies asset diffs). |
| **D8a** | [X] | **Debounce timing / flush triggers** | **Locked: (A) + (C).** Reset debounce timer on **any** `updateComponent`. **`flushNow`** on provider unmount and breadcrumb navigation (required). **Not** per-field blur flush (**B** rejected for Phase 1). **Default delay:** 1000ms (match **D8**; hook option to override). |
| **D14** | [X] | **Sync working copy from Redux (three-way reconcile)** | See [Sync from Redux (D14)](#sync-from-redux-d14). Store **`lastReceived`** + **`working`**. On external `committed` change: `editDiff = lastReceived.diff(working)`; if empty, adopt `incoming`; else try `incoming.merge(editDiff)`; on throw/failure, supersede (`working = incoming`) + snackbar. Advance **`lastReceived`** after successful flush (**D14b**). |
| **D14a** | [X] | **Detect external vs self flush** | **Locked: (A)** `lastFlushRef` set at flush dispatch to the **component snapshot flushed** (`working.clone()`). On `committed` change: if `incoming` is **semantically equal** to `lastFlushRef` (component `equals` / agreed comparison --- not reference identity), treat as **echo** --- skip three-way reconcile; apply **D14b** baseline advance if not already done on dispatch completion. **Rejected: (B)** `pendingFlush` until props match (prop-ack). **Rejected:** field-level or distributed "wait for props" modes. Echo handling lives only in `useWorkbenchComponent`. |
| **D14b** | [X] | **Advance `lastReceived` on flush** | After successful `flushToStandardForm` dispatch (reducer completes synchronously today), set `lastReceived` from the **flushed snapshot** (same as `lastFlushRef`), not by waiting for selector echo. Prevents re-applying already-persisted `editDiff` on next external sync. **D14a** echo path is a safety net when `committed` updates later with the same semantic content. |
| **D14c** | [X] | **Reconcile vs debounced flush race** | **Locked: (B) + debounce hygiene.** On **external** reconcile: **cancel** pending debounced flush, run three-way reconcile against **current** `working` (do **not** `flushNow()` first). **Reschedule** debounced flush **after** reconcile completes (post-merge `working`; full delay per **D8a**). Flush callback must read **latest** `working` via ref, never a stale closure. **Rejected: (A)** flush-before-reconcile on every external update (extra asset diffs; not required when `editDiff` encodes unflushed edits). See [Reconcile vs debounced flush (D14c)](#reconcile-vs-debounced-flush-d14c). |
| **D9** | [X] | **Shared editor layout shell** | **Locked: (B)** defer --- duplicated `Box` scroll/padding/column scaffolding stays as-is for this initiative. Phase 1 editor refactors keep existing layout wrappers; extract `WorkbenchComponentEditorLayout` in a **follow-on UI sweep** after data binding is standardized. **Rejected for this plan:** **(A)** dedicated layout extraction milestone; **(C)** opportunistic extraction while touching shortName (would still widen Phase 1 PRs). |
| **D10** | [X] | **Pure updater module location** | **Locked: (A)** new [`foundations/workbenchMutations.ts`](../../../../../charcoal-client/src/components/Workbench/foundations/workbenchMutations.ts) (+ `.test.ts`) for cross-component pure helpers: `reconcileCommittedComponent`, shortName normalize/apply-on-flush (**D11**). `useWorkbenchComponent` imports these; domain files keep domain-only mutators (e.g. `AreaEdit/areaEditMutations.ts`). **mtw-wml** helpers (**D3**) stay in package when not UI-specific. No-op flush suppression via reducer diff only (**D12**). |

### Semantics (must be consistent once D4-D8 land)

| ID | Status | Decision | Notes |
| --- | --- | --- | --- |
| **D11** | [X] | **shortName empty handling** | **Locked:** **omission-over-empty** --- empty / whitespace-only shortName -> `undefined` on payload (clear field), not `new StandardLiteral('')`. Encode in `workbenchMutations` apply-on-flush + `updateComponent` path; aligns Mark/Guidance norm; replaces inconsistent Feature/Room "always assign literal" pattern in Phase 1 editors. |
| **D12** | [X] | **No-op update suppression** | **Locked: (B)** rely on **`updateStandard` reducer diff** only --- no pre-flush deep-equals / snapshot compare in the hook (**A**, **C** rejected). Debounced flush may still run; reducer no-ops when there is no asset change. |
| **D13** | [X] | **readonly propagation** | **Locked:** field components (e.g. `WorkbenchShortNameField`) combine optional `readonly` prop with `useWorkbenchAsset().readonly` (asset zone / published). Document in Workbench `AGENT.md` during Phase 4 (or when adding fields in Phase 1). |

---

## Sync from Redux (D14)

**Problem:** `working` diverges from Redux `committed` while the user edits. When `committed` changes **without** this session's flush (import / `fetchImports`, inherited merge, another UI path), the hook must not blindly reset (loses edits) or ignore the update (stale UI).

**Algebra (mtw-wml):** for components with `invert()`, `base.merge(base.diff(incoming))` matches `incoming` (see [`component.ts`](../../../../../packages/mtw-wml/ts/standardize/components/component.ts), [`standardForm.diff.test.ts`](../../../../../packages/mtw-wml/ts/standardize/integration/standardForm.diff.test.ts)). Merge is **not** associative; conflicts can **throw** ([`AGENT.editAlgebra.md`](../../../../../packages/mtw-wml/ts/standardize/components/AGENT.editAlgebra.md)).

### Session state

| Field | Meaning |
| --- | --- |
| **`committed`** | Live `standardForm.byUniversalId[componentId]` from `useWorkbenchAsset` (read-only selector view) |
| **`lastReceived`** | Last Redux component snapshot this session uses as reconcile **baseline** (clone) |
| **`working`** | Current editor copy; mutated only via `updateComponent` |
| **`lastFlushRef`** | Component snapshot last dispatched on flush (**D14a**); used for semantic echo classification |

Do **not** store `editDiff` --- derive when needed: `editDiff = lastReceived.diff(working)` (`undefined` if no local change vs baseline).

### Lifecycle

**Mount / `componentId` change:**

```text
lastReceived = committed.clone()
working      = committed.clone()
```

**`updateComponent`:** mutate `working` only; leave `lastReceived` unchanged.

**Successful `flushToStandardForm` (D14b + D14a):**

```text
flushed = working.clone()
lastFlushRef = flushed
dispatch updateStandard(...)   // assign flushed to draft.byUniversalId[id] per D2
lastReceived = flushed.clone() // D14b on dispatch completion (mutation-owned; do not wait for props)
```

**`committed` change** (selector subscription):

```text
incoming = committed.clone()

if incoming semantically equals lastFlushRef:
    echo -> skip reconcile (D14a); clear or retain lastFlushRef per hook policy
else:
    external -> cancel debounced flush (D14c), then three-way reconcile below
```

**External `committed` change** (not an echo of this session's flush):

```text
cancelPendingFlush()           // D14c: drop scheduled debounce before reconcile

incoming = committed.clone()   // undefined if component removed -> close session / navigate back

editDiff = lastReceived.diff(working)

if editDiff is undefined:
    lastReceived = incoming
    working      = incoming.clone()
else:
    try:
        merged = incoming.merge(editDiff)
        lastReceived = incoming
        working      = merged    // or merged.clone() if merge mutates
    catch (or policy: merge failure):
        lastReceived = incoming
        working      = incoming.clone()
        snackbar: ongoing edits superseded by external update

rescheduleDebouncedFlush()     // D14c: from post-reconcile working; do not flush immediately unless user keeps typing
```

**Component removed from asset:** if `incoming` is missing, do not merge; end session (empty editor / pop breadcrumb).

**Components without `invert()`:** if `diff` cannot be computed reliably, fall back to supersede path (same as merge failure) until invert exists.

### Pure helper (Phase 1 test target)

Extract for unit tests without React, e.g. `reconcileCommittedComponent({ lastReceived, working, incoming }) -> { working, lastReceived, superseded }`.

### Product requirements (linked)

- **`flushNow` on unmount / breadcrumb** before losing provider (**D8a**) so edits are not only in `working`.
- **Snackbar** on supersede: e.g. "This component was updated elsewhere; unsaved changes on this screen were discarded." (Undo optional later.)
- **Import / `fetchImports`:** non-overlapping import + local shortName should **`merge` succeed**; same field changed locally and externally should supersede or throw then supersede.

### Echo detection (D14a)

`useWorkbenchComponent` is a **staging adapter** relative to `personalAssets` (fast component edits vs asset-level `updateStandard`). That is intentional; echo handling must still avoid **prop-ack** ("operate differently until `committed` matches what I sent").

**Normative:**

1. Set **`lastFlushRef`** when dispatching flush (semantic snapshot of what was written).
2. Advance **`lastReceived` on flush completion** (**D14b**), same snapshot --- parallel to `pendingEdits` / RequestIds on the slice, not inferred from children.
3. When **`committed`** updates: if **`incoming` equals `lastFlushRef`** semantically, **skip reconcile**; otherwise run three-way merge / supersede.

Comparison uses mtw-wml component equality (or equivalent stable compare), not reference identity. Fields never read `lastFlushRef`.

### Reconcile vs debounced flush (D14c)

Two session actions run on different schedules: **debounced `flushToStandardForm`** (**D8** / **D8a**) and **external reconcile** (**D14**). While the user has unflushed edits in `working`, both can be "in flight" --- a timer may fire soon **and** `committed` may change (import, wml stream, another UI path).

**Failure mode without D14c:** reconcile updates `working` to `merged`, but a debounce callback scheduled **before** reconcile still flushes **pre-reconcile** `working`, undoing the merge in Redux.

```text
T0  User types -> working updated, debounce scheduled (~1s)
T1  External committed change -> reconcile would merge import + local editDiff
T2  Stale debounce fires -> flush old working -> wrong Redux state
```

**Normative (locked):**

1. Classify `committed` change (**D14a**): echo -> skip reconcile; external -> step 2.
2. **`cancelPendingFlush()`** before running three-way reconcile.
3. Reconcile using **current** `working` (`editDiff = lastReceived.diff(working)`); do **not** call `flushNow()` first --- unflushed edits are already in `editDiff`.
4. **`rescheduleDebouncedFlush()`** after reconcile finishes (from post-merge `working`). If the user is still typing, the next `updateComponent` resets the timer per **D8a** anyway.
5. Implement flush so the debounced callback always reads **latest** `working` from a ref (never a captured render closure).

**Not chosen:** **(A)** `flushNow()` before every external reconcile --- persists locals first, but adds a full-asset diff on each import while typing; merge math does not require it.

### Rejected alternatives (reference)

| Option | Why not alone |
| --- | --- |
| **R1. Blind reset** | Drops in-flight edits on any Redux twitch |
| **R2. Dirty flag only** | Does not compose import + typing on different fields |
| **R3. Prop-ack / pendingFlush (D14a-B)** | "Wait until `committed` matches flush" couples session to selector timing; rejected for **D14a** |
| **R4. Manual banner** | Heavier UX; may add later for review-before-supersede |
| **R5. Echo detection in field components** | Same anti-pattern at finer granularity; session hook only |
| **R6. Flush-before-reconcile (D14c-A)** | Extra asset diff on external updates; **D14c** uses cancel + reconcile + reschedule instead |

---

## Open questions (deferred --- not in decisions register)

These do **not** block Phase 1. Resolve during implementation or later phases as noted.

1. **Guidance `instructions`** --- raw string on payload vs `StandardLiteral`; same working-copy session or separate?
2. **Character `displayName` vs `shortName`** --- separate field component or parameterized literal field?
3. **Layered context component id** --- should `useWorkbenchComponent` read `getCurrentComponentLayerId` with fallback (like `GuidanceEditor`) via an option flag?
4. **Instrumentation** --- forward `ScopedInstrumentationOptions` on `flushToStandardForm`?
5. **Testing strategy** --- **partially locked via D4:** `useWorkbenchComponent` **test harness** seeds asset state and asserts `working` / flush; hook tests with mocked `updateStandard`; RTL for provider + shortName field; golden refactors: Feature + Room minimum?
6. **Reference list + inline slot** --- **Phase 2 (D15, D7):** `renderItemEditor` should receive Mark data from parent **`working`** (Lens/Room session) or a dedicated Mark session; finalize when wiring **`MarkInlineEditor`**.
7. **Provider scope** --- wrap each of `RoomEditor` / `FeatureEditor` vs single provider in `WorkbenchAssetEditor` routing?

---

## Proposed phases

### Phase 1 --- Component session + shortName (highest ROI)

- `useWorkbenchComponent(componentId, guard)` in **`foundations/WorkbenchComponent/`** (**D1**) -> `{ working, lastReceived, committed, updateComponent, flushToStandardForm, flushNow, isDirty?, readonly, missing }`
- Debounced flush per **D8** / **D8a** (timer reset on `updateComponent`; default 1000ms); `flushNow` on unmount + breadcrumb (**D8a**); advance `lastReceived` on flush (**D14b**)
- Flush assigns `draft.byUniversalId[id] = working.clone()` (**D2**)
- `reconcileCommittedComponent` helper + tests; wire external `committed` per **D14**; echo skip **D14a**; cancel/reschedule debounce on external reconcile **D14c**
- `workbenchMutations.ts`: `normalizeOptionalLiteral` / apply-on-flush (**D10**, **D11**); `reconcileCommittedComponent`; prefer **`withShortName()`** in mtw-wml when landed (**D3**, parallel track)
- `WorkbenchComponentProvider` + **`useWorkbenchComponent` test harness** + `WorkbenchShortNameField` (context-only **D4**)
- `StandardLiteralEditor` / `TopLevelStandardLiteralEditor` use **`debounce={false}`** under `WorkbenchComponentProvider` (session owns persist debounce); default `debounce={true}` elsewhere
- Refactor **FeatureEditor**, **KnowledgeEditor**, **RoomEditor**, **AreaEditor**
- Unit tests: reconcile helper, hook flush debounce (via harness), harness mutation assertions; one RTL test for shortName field

### Phase 2 --- Facet prose, parent-session lists, inline editors (**D15**)

**Persistence tier (end split-brain on provider screens):**

- **`applyWorkingComponentToDraft(draft, id, working)`** (or equivalent) in **`workbenchMutations.ts`** --- extract flush-side assign (`prepareComponentForFlush` + `draft.byUniversalId[id] = …`) from **`useWorkbenchComponent`**; **not** used on the edit path
- **Facet prose on parent session:** DEFAULT render (`DefaultRenderEditor` / `SituationFacetRenderFieldsEditor` on Room, Feature, Knowledge) via parent **`updateComponent`** (facet binding hook or inline updater on **`working`**) + existing session debounced flush (Slate caveat in Agreed direction)
- **Reference lists on parent session:** wire **`ReferenceListEditor`** (and Add/Import association paths) on **`WorkbenchComponentProvider`** screens to parent **`updateComponent`** + session flush --- e.g. Room guidance list; read **`working`** for display. **Not** a full **`ReferenceListControlled`** shell yet (**D6** / Phase 3)
- Refactor **`MarkInlineEditor`** per **D7** / **D15** (parent **`working`** or per-row Mark session)
- Document in [`AGENT.reference-lists.md`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md) when to use inline vs typical list and parent-session vs asset-level lists

**Explicitly out of Phase 2 unless scoped:** Area **`ExitEdgeListEditor`** (domain topology), **`TopLevelEditor`** asset lists, navigated drill-down editors (full **`MarkEditor`**, Situation-as-component screen).

### Phase 3 --- Controlled list shell, remaining editors, mtw-wml

- **`ReferenceListControlled`** per **D6** (`referenceList` + `onReferenceListChange`, facet-list-style composition); migrate call sites off **`ReferenceListEditor`** + `listContext` internal **`updateStandard`**. Persistence already on parent **`working`** where Phase 2 landed (**D15**)
- Finish / adopt mtw-wml **`withShortName()`** across flush paths if not complete in Phase 1 (**D3**)
- Migrate **GuidanceEditor**, **MarkEditor**, **LensDetail** shortName paths (full-screen / non-provider sessions)
- Layout shell extraction **out of scope** (**D9** deferred)

### Phase 4 --- Cleanup and durable docs

- Move lasting guidance into Workbench `AGENT.md` (binding conventions, layer diagram)
- Remove duplicated patterns from per-editor files
- Delete or archive this plan

---

## Progress

| Phase | Status | Notes |
| --- | --- | --- |
| Decisions D1-D14 | All locked (incl. D11-D13, D14a-c) | Milestone 0 complete |
| Phase 1 | Complete | Debounced flush + **D14** reconcile + `workbenchMutations` + `WorkbenchShortNameField` + literal `debounce={false}`; Feature/Knowledge/Room/Area editors use `WorkbenchComponentProvider` + `WorkbenchShortNameField` |
| Phase 2 | In progress | Slice 1: `applyWorkingComponentToDraft`; facet prose + parent-session reference lists (**D15**) + Mark inline remain |
| Phase 3 | Not started | **`ReferenceListControlled`** shell + migration; remaining full-screen editors |
| Phase 4 | Not started | |

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]` (including nested bullets).

- [X] **Milestone 0 --- Lock decisions**
  - [X] Resolve **D14** + **D14b** (three-way reconcile; advance baseline on flush)
  - [X] Resolve **D14a** (`lastFlushRef` + semantic echo skip; mutation-owned **D14b** baseline on flush)
  - [X] Resolve **D14c** (cancel debounce before external reconcile; reschedule after; no flush-first)
  - [X] Resolve **D8a** ((A) timer reset on `updateComponent`; (C) `flushNow` on unmount/breadcrumb; 1000ms default; no blur flush)
  - [X] Resolve **D1**, **D2**, **D3**, **D4** (hook location, flush clone assign, parallel `withShortName`, context-only field + test harness)
  - [X] Resolve **D10** (`foundations/workbenchMutations.ts` for shared pure helpers)
  - [X] Resolve **D11** (omission-over-empty shortName)
  - [X] Resolve **D12** (reducer diff only for no-op suppression)
  - [X] Resolve **D13** (readonly = prop AND asset readonly)
  - [X] Resolve **D5**, **D6**, **D7** (defer literal accessor; `ReferenceListControlled` shell in Phase 3; inline editors in Phase 2)
  - [X] Resolve **D15** (reference-list persistence on parent **`working`** in Phase 2; controlled shell in Phase 3)
  - [X] Resolve **D9** (defer layout shell --- separate UI sweep after data binding)
- [X] **Milestone 1 --- Phase 1 implementation**
  - [X] Add `useWorkbenchComponent` + provider in `foundations/` (per **D1**, **D8**)
  - [X] Add `useWorkbenchComponent` **test harness** (per **D4**)
  - [X] Reorganize session module into [`foundations/WorkbenchComponent/`](../../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/) (`index.ts` barrel; `baseClasses.ts`; hook/provider in `useWorkbenchComponent.tsx`; colocate tests + `testing/` harness/mock)
  - [X] Implement debounced `flushToStandardForm` + `flushNow` (per **D8**, **D8a**; flush `working.clone()` per **D2**; **D14a/b** on flush; cancel/reschedule helpers ready for **D14c**)
  - [X] Implement resync per **D14** + `reconcileCommittedComponent` tests
  - [X] Add `workbenchMutations.ts` + tests (per **D10**, **D11**; semantic `diff` skip per **D12**, not structural deep-equals)
  - [X] Add `WorkbenchShortNameField` + adjust literal editor debounce (per **D4**)
  - [X] Refactor Feature, Knowledge, Room, Area editors
  - [X] Update Recommended order checkboxes and Progress table in this doc
- [ ] **Milestone 2 --- Phase 2** (**D15**)
  - [X] **`applyWorkingComponentToDraft`** in `workbenchMutations.ts`; refactor **`useWorkbenchComponent`** flush to use it (flush assign only)
  - [ ] DEFAULT render / facet binding: **`SituationFacetRenderFieldsEditor`** (and **`DefaultRenderEditor`**) on parent **`working`** via **`updateComponent`**, not per-change **`updateStandard`**
  - [ ] Parent-session **`ReferenceListEditor`** bridge on **`WorkbenchComponentProvider`** screens (e.g. Room guidance list): **`updateComponent`**, not per-action **`updateStandard`**
  - [ ] Refactor `MarkInlineEditor` and document inline list contract (**D7**)
- [ ] **Milestone 3 --- Phase 3**
  - [ ] **`ReferenceListControlled`** per **D6** + migrate call sites (shell/API; persistence tier from Milestone 2)
  - [ ] mtw-wml `withShortName` (if **D3** not deferred)
  - [ ] Remaining full-screen editors (Guidance, Mark, LensDetail shortName; layout shell deferred per **D9**)
- [ ] **Milestone 4 --- Phase 4**
  - [ ] Steady-state docs in Workbench `AGENT.md`
  - [ ] Archive/delete this planning file

---

## Verification

After **Milestone 1**:

```bash
cd charcoal-client
npm run test:single -- src/components/Workbench/foundations
npm run test:single -- src/components/Workbench/FeatureEdit
npm run test:single -- src/components/Workbench/RoomEdit
npm run test:single -- src/components/Workbench/KnowledgeEdit
npm run test:single -- src/components/Workbench/AreaEdit
```

Manual smoke (Draft asset):

1. Open Workbench on a Draft asset; edit Room, Feature, Knowledge, Area **Short Name**; confirm persistence after navigation away and back.
2. Confirm published/read-only asset: shortName fields disabled.

After **Milestone 2**:

3. Edit shortName, DEFAULT description, and a reference-list change (e.g. add Guidance on Room) within one debounce window -> one asset diff (batched flush on parent **`working`**).
4. Navigate away after edit -> `flushNow` persists (per **D8a** / **D14**).
5. Room guidance list (and other Phase 2-wired **`ReferenceListEditor`** instances on provider screens) no longer call **`updateStandard`** per list action --- mutations go through parent session.

After **Milestone 3+**:

6. **`ReferenceListControlled`** call sites use `referenceList` + `onReferenceListChange` without `listContext` draft surgery.

**D14 reconcile (unit tests on helper):**

7. No local edits: `lastReceived` tracks `incoming`, `working` reset.
8. Local shortName only + import updates different field: `incoming.merge(editDiff)` preserves local shortName.
9. Conflicting merge (same field): supersede + `superseded: true` (snackbar in UI test optional).

---

## Related work (link only)

| Initiative | Relationship |
| --- | --- |
| [`taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md`](../../../../packages/mtw-wml/AGENT.areaTopologyExits.planning.md) | Area topology UI (`ExitEdgeListEditor`, `areaEditMutations`) is a reference implementation for row + pure updater pattern; not blocked by this plan |
| Area Workbench editors | Continue using domain modules for D4/D29; do not force into generic shortName field |

---

## Notes from design discussion (2026-05)

- Composing editors from **Standard* out** primitives scales; composing whole **StandardRoom** forms does not.
- **Two-tier model:** working `StandardComponent` in hook state (`clone` + mutate per edit); debounced **`updateStandard`** only on flush (whole-asset diff). UI reads **`working`**, not orphan leaf state.
- **Per-component debounce** on flush matches asset-level diff cost; **not** per-field persist timers.
- **FacetListEditorGeneric** and **ExitEdgeRowEditor** are templates for list/row composition; on parent provider screens, list mutations should join the same **`working`** session (**D15**), not a parallel Redux path.
- **ReferenceListEditor** optimizes navigation/summary (`ReferenceListItem`); editable lists use **items + onItemsChange** at the Standard* layer when row editing matters.
- **D14:** three-way reconcile via `lastReceived.diff(working)` and `incoming.merge(editDiff)`; supersede + snackbar on failure; **D14b** advance `lastReceived` after flush.

## Notes from design discussion (2026-06)

- **Do not maintain split-brain** on **`WorkbenchComponentProvider`** screens (e.g. Room shortName on **`working`** while guidance list still **`updateStandard`** per action) until Phase 3. That deferral was **sequencing**, not architecture.
- **D15:** Phase 2 = parent-session persistence for reference lists + facet prose; Phase 3 = **`ReferenceListControlled`** composable shell + migration.
- Composition rule #3 **permits** immediate **`updateStandard`** for lists; it does **not** require it once a parent session exists.
