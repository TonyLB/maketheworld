# Workbench composition and Standard* binding (charcoal-client)

**Status:** Draft plan --- design evolving. **Next step:** Lock **D8a**, **D1-D4**, then implement **Phase 1** (`useWorkbenchComponent` working copy + debounced flush + **D14** reconcile + `WorkbenchShortNameField`).

This plan is task-scoped. Archive or delete it after the initiative ships; move lasting norms into [`charcoal-client/src/components/Workbench/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/AGENT.md) and related foundation docs.

**Framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md)

---

## Purpose

Reduce repetitive Workbench editor code while making composition predictable:

1. **Two-tier editing:** a **working `StandardComponent`** in the editor session (cheap `clone()` + mutate on each change) and **debounced `updateStandard`** to Redux (expensive whole-asset clone + diff + merge).
2. **Standard* in / Standard* out** at leaf and row UI (controlled components), reading/writing the **working** instance via `useWorkbenchComponent` --- not orphan leaf `localValue` that can drift from committed state.
3. **Composable list editors** that derive row handlers from parent `items` + `onItemsChange` (facet pattern), or flush structural edits immediately when appropriate.
4. **Shared glue** for resolve, normalize, and flush (especially **`shortName`**).

**Non-goals for this initiative:**

- A generic form generator for every `StandardComponent` type.
- Replacing domain editors for facets, topology (`Area` exit edges), reference import, or layered navigation.
- Changing `updateStandard` reducer semantics or persistence (clone / diff / merge stays as today).

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
| **Committed copy** | `standardForm.byUniversalId[id]` in Redux via `useWorkbenchAsset` | **Asset** `standardForm._clone()` + `diff` + merge into `edit` | Debounced **`flushToStandardForm`** (per editor session), plus explicit flush (navigate away, blur policy TBD) |

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
3. **List shells** (facets, reference lists, exit edges) may still call `updateStandard` immediately for **structural** changes (add/remove/import), or maintain their own working slice --- document per pattern. Scalar fields on the parent component use the session working copy.
4. **Compose by sections** on the screen (shortName, DEFAULT prose, lists, topology), not by flattening into one generic form type --- but scalar sections on the **same** component share one working copy.
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
| Clear list composition | New editable lists follow facet/exit-edge pattern; reference lists gain optional controlled mode where needed |
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
| **D1** | [ ] | **Where `useWorkbenchComponent` lives** | **(A)** `foundations/useWorkbenchComponent.ts` next to `useWorkbenchAsset`. **(B)** `foundations/bindings/` subtree for hooks + helpers. **(C)** defer hook; only ship field components first. |
| **D2** | [ ] | **Mutation style (working vs flush)** | **Working (agreed):** `updateComponent` uses `working.clone()` then mutates clone (`_payload` or future `with*`). **Flush (pick one):** **(A)** `draft.byUniversalId[id] = working.clone()`. **(B)** in-place mutate component already on draft if same reference policy allows. **(C)** hybrid: assign clone on flush; optional `with*` when mtw-wml adds helpers. |
| **D3** | [ ] | **`withShortName()` in mtw-wml** | **(A)** Phase 1 client-only helpers (`setShortNameOnPayload`, `normalizeOptionalLiteral`). **(B)** Add `withShortName()` on component wrapper in mtw-wml in parallel (AGENT.implementation already lists as follow-up). **(C)** defer mtw-wml; client-only until a second initiative. |
| **D4** | [ ] | **`WorkbenchShortNameField` API** | Must consume **working** from `useWorkbenchComponent` context (preferred) or explicit `working` + `updateComponent` props. **(A)** context only. **(B)** props for tests/storybook. **(C)** both. Field calls `updateComponent` on change --- **no** own `updateStandard` or persist debounce. |
| **D5** | [ ] | **Field accessor helpers** | With working-copy session, prefer **`updateComponent(room => ...)`** in field components. **(A)** defer generic `useWorkbenchLiteralField`. **(B)** thin accessor hook for `working.shortName` only. **(C)** reject; only `WorkbenchShortNameField` in Phase 1. |
| **D6** | [ ] | **Reference list controlled mode** | **(A)** add `ReferenceListControlled` (`referenceList` + `onReferenceListChange`) alongside existing `ReferenceListEditor`. **(B)** refactor `ReferenceListEditor` to use controlled core internally. **(C)** defer; only document facet/exit pattern for new lists. |
| **D7** | [ ] | **Inline editors and `updateStandard`** | **(A)** refactor `MarkInlineEditor` to `value`/`onChange` on `StandardLiteral` + parent owns mark update. **(B)** `MarkInlineEditor` takes `onShortNameChange` only. **(C)** leave inline editors until reference-list controlled mode exists. |
| **D8** | [X] | **Debouncing policy (agreed direction)** | **Per-component editor session:** debounce **`flushToStandardForm`** only (default ~1000ms, configurable). **`updateComponent`** is immediate (working copy). **Remove** persist debounce from primitives when under session provider; literals may stay uncontrolled string UI bound to `working` field. **Not** per-field persist timers (multiplies asset diffs). |
| **D8a** | [ ] | **Debounce timing / flush triggers** | **(A)** timer reset on any `updateComponent`. **(B)** flush on blur per field in addition. **(C)** `flushNow` on unmount / breadcrumb navigation (required minimum). Default delay ms. |
| **D14** | [X] | **Sync working copy from Redux (three-way reconcile)** | See [Sync from Redux (D14)](#sync-from-redux-d14). Store **`lastReceived`** + **`working`**. On external `committed` change: `editDiff = lastReceived.diff(working)`; if empty, adopt `incoming`; else try `incoming.merge(editDiff)`; on throw/failure, supersede (`working = incoming`) + snackbar. Advance **`lastReceived`** after successful flush (**D14b**). |
| **D14a** | [ ] | **Detect external vs self flush** | Ignore reconcile when Redux update is echo of this session's flush (e.g. generation counter / `lastFlushedAt` / compare pre-flush snapshot). **(A)** ref after flush. **(B)** `pendingFlush` flag until committed matches flushed working. |
| **D14b** | [X] | **Advance `lastReceived` on flush** | After successful `flushToStandardForm`, set `lastReceived` to committed component (clone). Prevents re-applying already-persisted `editDiff` on next external sync. |
| **D14c** | [ ] | **Reconcile vs debounced flush race** | **(A)** `flushNow()` before reconcile when both pending. **(B)** reconcile uses current `working` only (default). Document in hook. |
| **D9** | [ ] | **Shared editor layout shell** | **(A)** extract `WorkbenchComponentEditorLayout` (scroll + padding + column). **(B)** defer layout extraction. **(C)** only extract when touching each editor for shortName anyway. |
| **D10** | [ ] | **Pure updater module location** | **(A)** `foundations/workbenchMutations.ts` (cross-component). **(B)** colocate per domain (`AreaEdit/areaEditMutations.ts` pattern). **(C)** push shared pieces to mtw-wml when not UI-specific. |

### Semantics (must be consistent once D4-D8 land)

| ID | Status | Decision | Notes |
| --- | --- | --- | --- |
| **D11** | [ ] | **shortName empty handling** | Align with omission-over-empty: empty -> `undefined` on payload (Mark/Guidance style) vs always assign `StandardLiteral` (Feature/Room style). Pick one norm; encode in shared helper. |
| **D12** | [ ] | **No-op update suppression** | **(A)** skip `flushToStandardForm` when `working` deep-equals last flushed snapshot. **(B)** rely on reducer diff only. **(C)** both. Apply on flush path, not on every `updateComponent`. |
| **D13** | [ ] | **readonly propagation** | Field components always combine `readonly` prop with `useWorkbenchAsset().readonly`. Document in Workbench AGENT. |

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

Do **not** store `editDiff` --- derive when needed: `editDiff = lastReceived.diff(working)` (`undefined` if no local change vs baseline).

### Lifecycle

**Mount / `componentId` change:**

```text
lastReceived = committed.clone()
working      = committed.clone()
```

**`updateComponent`:** mutate `working` only; leave `lastReceived` unchanged.

**Successful `flushToStandardForm` (D14b):** when Redux `committed` reflects the flush (or immediately after dispatch if policy is optimistic), set `lastReceived = committed.clone()`. Optionally align `working` if treating post-flush as clean.

**External `committed` change** (detect via **D14a** --- not an echo of this session's flush):

```text
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
```

**Component removed from asset:** if `incoming` is missing, do not merge; end session (empty editor / pop breadcrumb).

**Components without `invert()`:** if `diff` cannot be computed reliably, fall back to supersede path (same as merge failure) until invert exists.

### Pure helper (Phase 1 test target)

Extract for unit tests without React, e.g. `reconcileCommittedComponent({ lastReceived, working, incoming }) -> { working, lastReceived, superseded }`.

### Product requirements (linked)

- **`flushNow` on unmount / breadcrumb** before losing provider (**D8a**) so edits are not only in `working`.
- **Snackbar** on supersede: e.g. "This component was updated elsewhere; unsaved changes on this screen were discarded." (Undo optional later.)
- **Import / `fetchImports`:** non-overlapping import + local shortName should **`merge` succeed**; same field changed locally and externally should supersede or throw then supersede.

### Rejected alternatives (reference)

| Option | Why not alone |
| --- | --- |
| **R1. Blind reset** | Drops in-flight edits on any Redux twitch |
| **R2. Dirty flag only** | Does not compose import + typing on different fields |
| **R4. Manual banner** | Heavier UX; may add later for review-before-supersede |

---

## Open questions (not yet decision-ready)

1. **D14a** / **D14c** --- flush echo detection and reconcile-vs-flush race (**D14** core algorithm is locked).
2. **Guidance `instructions`** --- raw string on payload vs `StandardLiteral`; same working-copy session or separate?
3. **Character `displayName` vs `shortName`** --- separate field component or parameterized literal field?
4. **Layered context component id** --- should `useWorkbenchComponent` read `getCurrentComponentLayerId` with fallback (like `GuidanceEditor`) via an option flag?
5. **Instrumentation** --- forward `ScopedInstrumentationOptions` on `flushToStandardForm`?
6. **Testing strategy** --- hook tests with mocked `updateStandard`; RTL for provider + shortName field; golden refactors: Feature + Room minimum?
7. **Reference list + inline slot** --- after D7, does `renderItemEditor` receive `working` Mark from parent list context?
8. **Provider scope** --- wrap each of `RoomEditor` / `FeatureEditor` vs single provider in `WorkbenchAssetEditor` routing?

---

## Proposed phases

### Phase 1 --- Component session + shortName (highest ROI)

- `useWorkbenchComponent(componentId, guard)` -> `{ working, lastReceived, committed, updateComponent, flushToStandardForm, flushNow, isDirty?, readonly, missing }`
- Debounced flush per **D8**; `flushNow` on unmount minimum (**D8a**); advance `lastReceived` on flush (**D14b**)
- `reconcileCommittedComponent` helper + tests; wire external `committed` changes per **D14** (**D14a** for echo skip)
- `normalizeOptionalLiteral` / apply-on-flush helpers (location per **D10**, **D11**)
- `WorkbenchComponentProvider` + `WorkbenchShortNameField` (API per **D4**)
- `StandardLiteralEditor` used **without** internal persist debounce when `debounce={false}` or session prop
- Refactor **FeatureEditor**, **KnowledgeEditor**, **RoomEditor**, **AreaEditor**
- Unit tests: flush helper, hook flush debounce; one RTL test for shortName field

### Phase 2 --- Facet / list sessions + inline editors

- Facet prose: working sub-copy or commit-into-parent-`working` + shared flush (Slate caveat in Agreed direction)
- `applyWorkingComponentToDraft(draft, id, working)` helper for flush path
- Refactor **MarkInlineEditor** per **D7** (update parent `working` or separate Mark session)
- Document in [`AGENT.reference-lists.md`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md) when to use inline vs typical list

### Phase 3 --- Lists and mtw-wml ergonomics

- Reference list controlled variant per **D6**
- Optional mtw-wml `withShortName()` per **D3**
- Migrate **GuidanceEditor**, **MarkEditor**, **LensDetail** shortName paths
- Optional `WorkbenchComponentEditorLayout` per **D9**

### Phase 4 --- Cleanup and durable docs

- Move lasting guidance into Workbench `AGENT.md` (binding conventions, layer diagram)
- Remove duplicated patterns from per-editor files
- Delete or archive this plan

---

## Progress

| Phase | Status | Notes |
| --- | --- | --- |
| Decisions D1-D14 | D8, D14, D14b agreed; D14a/D14c open | |
| Phase 1 | Not started | |
| Phase 2 | Not started | |
| Phase 3 | Not started | |
| Phase 4 | Not started | |

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]` (including nested bullets).

- [ ] **Milestone 0 --- Lock decisions**
  - [X] Resolve **D14** + **D14b** (three-way reconcile; advance baseline on flush)
  - [ ] Resolve **D14a**, **D14c** (flush echo detection; reconcile vs flush race)
  - [ ] Resolve **D8a** (flush triggers: unmount, blur, delay)
  - [ ] Resolve **D1**, **D2**, **D3**, **D4**, **D10** (structure + working/flush mutation)
  - [ ] Resolve **D11**, **D12**, **D13** (shortName semantics, dirty flush skip)
  - [ ] Resolve **D5**, **D6**, **D7**, **D9** (scope for Phase 1 vs defer)
- [ ] **Milestone 1 --- Phase 1 implementation**
  - [ ] Add `useWorkbenchComponent` + provider (per **D1**, **D8**)
  - [ ] Implement debounced `flushToStandardForm` + `flushNow` (per **D8**, **D8a**)
  - [ ] Implement resync per **D14** + `reconcileCommittedComponent` tests
  - [ ] Add flush/normalize helpers + tests (per **D10**, **D11**, **D12**)
  - [ ] Add `WorkbenchShortNameField` + adjust literal editor debounce (per **D4**)
  - [ ] Refactor Feature, Knowledge, Room, Area editors
  - [ ] Update Recommended order checkboxes and Progress table in this doc
- [ ] **Milestone 2 --- Phase 2**
  - [ ] `updateComponentInDraft` / facet binding hook
  - [ ] Refactor `MarkInlineEditor` and document inline list contract
- [ ] **Milestone 3 --- Phase 3**
  - [ ] Reference list controlled mode (if **D6** not deferred)
  - [ ] mtw-wml `withShortName` (if **D3** not deferred)
  - [ ] Remaining editors + optional layout shell
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

After **Milestone 2+**:

3. Edit shortName then description on same Room within debounce window -> one asset diff (batched flush).
4. Navigate away after edit -> `flushNow` persists (per **D8a** / **D14**).
5. Situation facet / DEFAULT render editors still behave until Phase 2 (no regression).

**D14 reconcile (unit tests on helper):**

6. No local edits: `lastReceived` tracks `incoming`, `working` reset.
7. Local shortName only + import updates different field: `incoming.merge(editDiff)` preserves local shortName.
8. Conflicting merge (same field): supersede + `superseded: true` (snackbar in UI test optional).

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
- **FacetListEditorGeneric** and **ExitEdgeRowEditor** are templates for list/row composition; structural list edits may still flush immediately.
- **ReferenceListEditor** optimizes navigation/summary (`ReferenceListItem`); editable lists use **items + onItemsChange** at the Standard* layer when row editing matters.
- **D14:** three-way reconcile via `lastReceived.diff(working)` and `incoming.merge(editDiff)`; supersede + snackbar on failure; **D14b** advance `lastReceived` after flush.
