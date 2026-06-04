# Workbench consistency layer

Pure TypeScript module ([`foundations/consistency/`](./)) for Workbench **global** asset-graph operations during authoring: orphan predicate, materialize, normalize, preview, and flush helpers. Redux `updateStandard` calls in; no React imports.

## Purpose

The consistency layer centralizes **global** operations on the **local** asset `StandardForm` during Workbench authoring: **materialize** (ensure `byUniversalId` entries exist) and **normalize** (workbench orphan GC and defensive ref scrub). Editors and list shells own **local** **associate** / **disassociate** on **working** state and call the layer at flush boundaries. This folder exports pure TypeScript helpers and one Redux thunk.

## Policy at a glance

| Topic | Policy |
| --- | --- |
| **Module boundary** | This folder; Redux `updateStandard` calls in; no React imports. |
| **Orphan predicate** | [`isReferencedInAssetLayer`](#isreferencedinassetlayer): **`_topLevel` union `referencedBy`** on **local** form only. |
| **Non-empty orphan removal** | Workbench normalize drops bodies with content when unreferenced per predicate; WML merge unchanged. |
| **Fixpoint normalize** | Loop until no-op; max 50 iterations (dev throw / prod warn). |
| **Orphan preview** | [`previewOrphanClosure`](#previeworphanclosure) simulates fixpoint on clone; drives confirm dialog. |
| **Single-site list remove** | Row remove = disassociate at **one site** only (incl. **`_topLevel`**); never `removeComponent` for rows. |
| **Transitive GC** | Fixpoint normalize today; **planned:** explicit Purge **cascade** only after author confirms (normalize retired). |
| **Area orphan closure** | Disassociating an Area such that Rooms become unreferenced and are GC'd by fixpoint is **acceptable** in v1; richer Area confirm UX is future work. |
| **Materialize spec** | [`materializeComponent`](#materializecomponent): `{ universalKey, fromAsset? }`; derive tag from UUID prefix. |
| **Materialize vs normalize timing** | Eager **`materializeComponentInAsset`** on Redux local draft; **`normalizeWorkbenchDraft`** only at flush. |
| **Asset-meta flush** | [`applyAssetMetaFlush`](#applyassetmetaflush) + [`useWorkbenchAssetMeta`](../WorkbenchAssetMeta/useWorkbenchAssetMeta.tsx) mirror component session. |

## User-facing removal

**Product norm:** Removing a row from a reference list (including asset **`_topLevel`**) or clearing a site-specific slot (e.g. Room **`_lens`**) means **disassociate at that site only**. It does **not** clear the same key from other parents. **Normalize** may still delete the component body afterward if the key becomes **`!isReferencedInAssetLayer`** --- that is orphan GC, not "remove everywhere."

| UX | Scope of disassociate | Body removal |
| --- | --- | --- |
| **List row remove** (incl. TopLevel / **`_topLevel`**) | **One site** only | Only if orphaned after flush + normalize |
| **Site-specific delete** (e.g. [`LensHeader`](../../LensEdit/LensHeader.tsx) "Delete Lens reference") | **That site only** (Room **`_lens`**) | Flush + normalize when orphaned; **not** `removeComponent` |
| **Global "purge component from asset"** | **Planned (Phase 2)** | Explicit **Purge** via consistency-layer helper + **`removeComponent`**; see [updateStandardExtension planning](../../../../../../taskPlanning/charcoal-client/src/components/Workbench/AGENT.updateStandardExtension.planning.md#phase-2-migration-purge-in-normalize-out). **Not** list-row disassociate. |

- **Confirm when (today):** [`previewOrphanClosure`](#previeworphanclosure) reports **`includesNonEmpty`** --- e.g. "Removing this reference will also remove the component and all its contents." Empty-only closure may proceed without dialog.
- **Confirm when (planned Purge):** [`previewPurgeClosure`](../../../../../../taskPlanning/charcoal-client/src/components/Workbench/AGENT.updateStandardExtension.planning.md#purge-api-sketch-consistency-layer) on **edit-layer** clone; when descendants exist, author chooses **rehome** (`cascade: false`, bodies stay at asset scope / display union) vs **cascade delete** (`cascade: true`). List-row remove uses **site-local** copy only (no body deletion preview).
- **[`WMLComponentHeader`](../../WMLComponentHeader.tsx)** is **deprecated**, unused, and not mounted. Do not wire legacy purge UX.

## Exports

Public surface from [`index.ts`](./index.ts):

| Export | Role |
| --- | --- |
| **`isReferencedInAssetLayer`** | Asset-layer orphan predicate |
| **`materializeComponent`**, **`MaterializeSpec`** | Pure create/import on draft |
| **`materializeComponentInAsset`** | Awaitable Redux thunk for eager materialize |
| **`applyWorkbenchFlush`**, **`ApplyWorkbenchFlushEdit`** | Component-session flush pipeline |
| **`applyAssetMetaFlush`**, **`ApplyAssetMetaFlushEdit`**, **`WorkbenchAssetMetaWorking`** | Asset-meta session flush |
| **`normalizeWorkbenchDraft`** | Fixpoint orphan GC + defensive scrub |
| **`previewOrphanClosure`**, options/result types | Orphan closure preview |
| **`confirmOrphanClosureBeforeAssetMetaDisassociate`** | TopLevel row remove confirm |
| **`confirmOrphanClosureBeforeComponentDisassociate`** | Component-site disassociate confirm (Lens) |

## Local vs global

| Layer | Operations | Mutates (typical) |
| --- | --- | --- |
| **Local** (sessions / list shells) | **Associate**, **disassociate** | `ReferenceList` (or facet slot) on **working** component (`useWorkbenchComponent`) or asset-meta projection (`useWorkbenchAssetMeta`); scalar fields on **working** |
| **Global** (consistency layer) | **Materialize**, **normalize** | `StandardForm` draft: `byUniversalId`, workbench orphan GC; defensive ref scrub (below) |

**Associate / disassociate** mean: this **site** (e.g. `room.features`, `asset._topLevel`) does or does not list a key. They do **not** mean "delete component from asset."

## Orchestration timing

Pure functions in this module mutate a **`StandardForm` draft** passed into them. **When** to call them is Workbench policy:

| Operation | When | Call site |
| --- | --- | --- |
| **`materializeComponent`** | Immediately on create/import (pure; use via **`materializeComponentInAsset`**) | See **`materializeComponentInAsset`** below. |
| **`materializeComponentInAsset`** | Immediately on create/import | **Awaitable** thunk: **`updateStandard`** with **`type: 'updateLocal'`** on the Redux **local** draft (`getLocalStandardForm`). Fast-path when the body is already on the local form and **`fromAsset`** is unset. **Not** on component-session `working`. **Not** deferred to debounced flush. Exposed on [`useWorkbenchAsset`](../useWorkbenchAsset.ts). |
| **`applyWorkbenchFlush`** | At component-session flush | Pure pipeline: assign component **`working`** + **`normalizeWorkbenchDraft`**. Wired from [`dispatchFlush`](../WorkbenchComponent/useWorkbenchComponent.tsx) via **`updateLocal`**; [`assureDefaultSituationFromPrimitives`](../../../../slices/personalAssets/assureDefaultSituationFromPrimitives.ts) may run before **`applyWorkbenchFlush`** when DEFAULT facet prose is present. **No** materialize. |
| **`applyAssetMetaFlush`** | At asset-meta session flush | Pure pipeline: assign **`_shortName`**, **`_summary`**, **`_topLevel`** from asset-meta **`working`**, then **`normalizeWorkbenchDraft`**. Wired from [`useWorkbenchAssetMeta`](../WorkbenchAssetMeta/useWorkbenchAssetMeta.tsx) via **`updateLocal`** (mirror **`applyWorkbenchFlush`**). **No** materialize. See [below](#applyassetmetaflush). |
| **`normalizeWorkbenchDraft`** | At flush (via **`applyWorkbenchFlush`** or **`applyAssetMetaFlush`**) | Fixpoint orphan GC on the **local** draft. |

Eager materialize commits a **different** `universalKey` than the open parent session id; it should not supersede that parent's `working` / `lastReceived` (component session or open asset-meta **`working._topLevel`** when committed asset-meta is unchanged). See [Orchestration timing](#orchestration-timing) and [`applyAssetMetaFlush`](#applyassetmetaflush).

## Stored WML vs displayed UI

- **Local form** ([`getLocalStandardForm`](../../../../slices/personalAssets/selectors.ts): base + edit + pendingEdits) holds asset-layer edits: `ref={0}` top-level import stubs, negative refs, etc.
- **Merged** [`getStandardForm`](../../../../slices/personalAssets/selectors.ts) (inherited + local) is for **display** only. Inherited ancestry does **not** count as a local reference for orphan GC or preview.

Workbench normalize runs on the **local** draft, not the merged view.

## `isReferencedInAssetLayer`

**Question:** Is this component still **linked in this asset's edit data** (any ref sign), not "where does it appear in the schema tree?"

| API | Use for workbench orphan GC? |
| --- | --- |
| [`SchemaOrganization.isReferenced`](../../../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts) | **No** --- schema-tree / graph-tier semantics; can miss nested `ref={0}` Direct refs. |
| [`StandardForm.referencedBy`](../../../../../../packages/mtw-wml/ts/standardize/index.ts) alone | **No** --- scans component `referencedKeys()` only; **misses `_topLevel`** (e.g. import side-effect `ref={0}` stubs). |
| **`isReferencedInAssetLayer`** | **Yes** --- **`_topLevel` union `referencedBy`** on the **local** `StandardForm`. |

**Normative:**

```typescript
// Any ref sign (positive, negative, zero) counts. Match by sameKey on StandardReference.
function isReferencedInAssetLayer(
  localForm: StandardForm,
  target: StandardReference
): boolean {
  const inTopLevel =
    localForm._topLevel?.payload.some((r) => r.sameKey(target)) ?? false
  if (inTopLevel) return true
  return localForm.referencedBy(target).length > 0
}
```

**Implementation:** [`isReferencedInAssetLayer.ts`](./isReferencedInAssetLayer.ts), exported from [`index.ts`](./index.ts). Call sites should use **local** `StandardForm` only (not merged `getStandardForm`).

- **Orphan (workbench):** `byUniversalId` entry whose reference satisfies **`!isReferencedInAssetLayer(localForm, ref)`** after disassociations (fixpoint normalize may remove many keys).
- **Example:** [`LensHeader.tsx`](../../LensEdit/LensHeader.tsx) disassociates Room **`_lens`** on component **`working`**, confirms via **`previewOrphanClosure`**, and relies on flush **`normalizeWorkbenchDraft`** for orphan GC.
- Do **not** confuse with persisted **`referencedBy`** on blueprint rows (Area topology / lambda); this predicate uses in-memory **`StandardForm.referencedBy()`** only.

**Examples and engine behavior:** [`standardForm.referencedBy.test.ts`](../../../../../../packages/mtw-wml/ts/standardize/integration/standardForm.referencedBy.test.ts).

### WML vs Workbench orphan policy

| Context | Unreferenced component with content |
| --- | --- |
| **WML / generic merge** | Retained (supports `ref={0}` / inline orphan editing) |
| **Authoring Workbench** | Removed by normalize when **`!isReferencedInAssetLayer`** on the local form; non-empty orphans are not left without UI to edit them |

## `materializeComponent`

Ensure `draft.byUniversalId` contains a component before a reference is meaningful. **Public spec:** `{ universalKey, fromAsset? }` only --- derive component **`tag`** from the `ComponentUUID` prefix via [`componentTagFromUniversalKey`](../../../../../../packages/mtw-wml/ts/standardize/components/dataTypes/abstract.ts) (same rule as `StandardReference`), then `standardComponentFactory` (create/stub) or [`addImportToDraft`](../../../../slices/personalAssets/addImportToDraft.ts) (when `fromAsset` is set). Callers do **not** pass `tag` separately.

```typescript
function materializeComponent(
  draft: StandardForm,
  spec: { universalKey: ComponentUUID; fromAsset?: AssetUUID }
): StandardReference
```

**Implementation:** [`materializeComponent.ts`](./materializeComponent.ts), exported from [`index.ts`](./index.ts).

- **Create:** idempotent when `universalKey` is already in `byUniversalId` (returns existing `reference`).
- **Import:** requires a tag in [`SchemaImportMapping`](../../../../../../packages/mtw-base/ts/schema/metaData.ts) (`isSchemaImportMappingType`); throws for types like Character that cannot be imported via WML Import mapping.

## `materializeComponentInAsset`

Eager global materialize for Workbench create/import. **Does not** call **`normalizeWorkbenchDraft`**.

```typescript
materializeComponentInAsset(assetId)(spec: MaterializeSpec): Promise<StandardReference>
```

**Implementation:** [`materializeComponentInAsset.ts`](./materializeComponentInAsset.ts), exported from [`index.ts`](./index.ts).

| Path | Behavior |
| --- | --- |
| **Fast path** | **`!spec.fromAsset`** and `getLocalStandardForm(assetId)` already has `byUniversalId[universalKey]` with a **`reference`**: return immediately (no `updateStandard`, no `setIntent` / `heartbeat`). |
| **Dispatch path** | `await dispatch(updateStandard(assetId)({ type: 'updateLocal', update: (draft) => materializeComponent(draft, spec) }))`, then `setIntent` + `heartbeat`. Post-check: key present on local form after dispatch. |
| **Import** | When **`fromAsset`** is set, always use the dispatch path so **`addImportToDraft`** can update **`from`**. |

Call via **`useWorkbenchAsset().materializeComponentInAsset(spec)`** or `dispatch(materializeComponentInAsset(AssetId)(spec))`. Session reference lists ([**`ReferenceListSessionEditor`**](../ReferenceList/ReferenceListSessionEditor.tsx)) and **`AddReferenceImportControl`** (when **`onAssociateReference`** is set) use this path for create/import before local associate on parent **`working`**.

## `applyWorkbenchFlush`

Apply component-session **`working`** to a **local** `StandardForm` draft, then normalize. **Does not** materialize.

```typescript
function applyWorkbenchFlush<T extends StandardComponent>(
  draft: StandardForm,
  edit: {
    componentId: ComponentUUID
    working: T
    beforeAssign?: (draft: StandardForm, working: T) => void
  }
): T
```

**Implementation:** [`applyWorkbenchFlush.ts`](./applyWorkbenchFlush.ts), exported from [`index.ts`](./index.ts).

**Order inside `applyWorkbenchFlush`:** optional **`beforeAssign`** -> [`applyWorkingComponentToDraft`](../workbenchMutations.ts) (shortName prep) -> **`normalizeWorkbenchDraft`**.

**[`useWorkbenchComponent`](../WorkbenchComponent/useWorkbenchComponent.tsx) `dispatchFlush`:** runs situation DEFAULT assurance when needed, then **`applyWorkbenchFlush`**. Dispatches **`updateStandard({ type: 'updateLocal', ... })`** so the reducer diffs against **`getLocalStandardForm`**, not merged **`getStandardForm`**.

### Imported component flush (linkage + merged `working`)

For **import + inline edit** (e.g. base `<Room from=(...) ref={0} />` plus edit-layer overlay on `shortName`), the parsed **local** form may have the Room body in `byUniversalId` but **`_topLevel` empty** and **`referencedBy(room)` empty**. [`isReferencedInAssetLayer`](./isReferencedInAssetLayer.ts) is then **false** even before flush assign; **`normalizeWorkbenchFlush` at flush removes** that body (D3 non-empty orphan). Assigning merged-session **`working`** via [`applyWorkingComponentToDraft`](../workbenchMutations.ts) does not restore linkage and writes a **plain** merged `shortName`, not the edit-layer additive overlay.

**Norm until fixed:** session flush must not rely on wholesale merged assign + normalize alone for this pattern; preserve asset-layer reference (typically `_topLevel` import `ref={0}`) and persist edit-layer overlay shape. See [`applyWorkbenchFlush.test.ts`](./applyWorkbenchFlush.test.ts) (`imported Room shortName`) and task plan [`AGENT.updateStandardExtension.planning.md`](../../../../../taskPlanning/charcoal-client/src/components/Workbench/AGENT.updateStandardExtension.planning.md) Phase 1.

## `applyAssetMetaFlush`

Apply asset-meta session **`working`** to a **local** `StandardForm` draft, then normalize. **Does not** materialize. Same fixpoint **`normalizeWorkbenchDraft`** as component flush; different assign target (asset root fields, not `byUniversalId[componentId]`).

```typescript
type WorkbenchAssetMetaWorking = {
  shortName: StandardLiteral | undefined
  summary: StandardRender | undefined
  topLevel: ReferenceList
}

function applyAssetMetaFlush(
  draft: StandardForm,
  edit: {
    working: WorkbenchAssetMetaWorking
    beforeAssign?: (draft: StandardForm, working: WorkbenchAssetMetaWorking) => void
  }
): WorkbenchAssetMetaWorking
```

**Order inside `applyAssetMetaFlush`:** optional **`beforeAssign`** -> [`applyWorkingAssetMetaToDraft`](../workbenchMutations.ts) (shortName/summary prep) -> **`normalizeWorkbenchDraft`**.

**Implementation:** [`applyAssetMetaFlush.ts`](./applyAssetMetaFlush.ts), exported from [`index.ts`](./index.ts).

**[`useWorkbenchAssetMeta`](../WorkbenchAssetMeta/useWorkbenchAssetMeta.tsx) `dispatchFlush`:** debounced flush dispatches **`updateStandard({ type: 'updateLocal', ... })`** and calls **`applyAssetMetaFlush`** on the local draft clone. Asset root list create/import uses **`materializeComponentInAsset`** before associate on **`working.topLevel`**.

See [Workbench AGENT.md](../../AGENT.md#asset-meta-editing-session).

## `normalizeWorkbenchDraft`

Workbench orphan GC on the **local** draft after local disassociations. **Mutates `draft` in place** (same pattern as `materializeComponent` and `updateStandard` callbacks); returns `draft` for chaining.

```typescript
function normalizeWorkbenchDraft(draft: StandardForm): StandardForm
```

**Implementation:** [`normalizeWorkbenchDraft.ts`](./normalizeWorkbenchDraft.ts), exported from [`index.ts`](./index.ts).

**Fixpoint algorithm** (each pass):

1. **Orphan detection (load-bearing):** `_components` entries where **`!isReferencedInAssetLayer`**.
2. **Body removal (load-bearing):** drop those keys from `_components` (empty **and** non-empty --- unlike WML merge, which retains orphans with content).
3. **Ref scrub (defensive):** `removeReferences` on survivors + strip matching keys from `_topLevel` (see [Ref scrub](#ref-scrub-belt-and-suspenders) below).
4. Repeat until a pass removes zero bodies, or **50 iterations** (throw in dev, `console.warn` in prod).

Transitive removal (e.g. Area disassociate -> Room orphan -> Feature orphan) requires the fixpoint loop; one pass is not enough. Workbench authoring uses this fixpoint, **not** [`removeComponent({ cascade: true })`](../../../../../../packages/mtw-wml/ts/standardize/index.ts). Disassociating an Area such that formerly linked Rooms become unreferenced and are removed by fixpoint is **acceptable in v1**; dedicated Area remove confirm copy is future UI.

Internal helpers (`findOrphanComponents`, `scrubReferences`, `normalizeSinglePass`) live in [`normalizeWorkbenchDraft.ts`](./normalizeWorkbenchDraft.ts) and are shared with **`previewOrphanClosure`**.

## `previewOrphanClosure`

Simulate fixpoint orphan closure on a **local** draft **without mutating** the input. Uses the same passes as **`normalizeWorkbenchDraft`** via **`normalizeSinglePass`**.

```typescript
function previewOrphanClosure(
  localDraft: StandardForm,
  options?: { applyLocal?: (draft: StandardForm) => void }
): { removedKeys: ComponentUUID[]; includesNonEmpty: boolean }
```

**Implementation:** [`previewOrphanClosure.ts`](./previewOrphanClosure.ts), exported from [`index.ts`](./index.ts).

- **`applyLocal`:** run pending disassociates (or other local edits) on an internal **`_clone()`** before simulating normalize. Callers apply site-specific mutations inside this callback (e.g. via **`applyWorkingAssetMetaToDraft`** or **`applyWorkingComponentToDraft`**). A typed **`AssociationSite`** / **`disassociateAtSite`** helper may be added later; today each call site owns its site accessor.
- **`removedKeys`:** `universalKey` of each body removed across fixpoint passes, in pass order.
- **`includesNonEmpty`:** `true` if any removed body had **`!isEmpty()`** at removal time. UI should confirm before flush when `true` (e.g. [`TopLevelEditor`](../ReferenceList/TopLevelEditor.tsx) row remove, [`LensHeader`](../LensEdit/LensHeader.tsx) lens clear). Empty-only closure may proceed without that dialog.

**Confirm helpers:**

- [`confirmOrphanClosureBeforeAssetMetaDisassociate`](./confirmOrphanClosureBeforeLocalEdit.ts) simulates pending asset-meta working (including top-level disassociate) via **`applyWorkingAssetMetaToDraft`** inside **`applyLocal`**, then dispatches **`pushChoice`** when **`includesNonEmpty`**. Used by [`TopLevelEditor`](../ReferenceList/TopLevelEditor.tsx) row remove.
- [`confirmOrphanClosureBeforeComponentDisassociate`](./confirmOrphanClosureBeforeLocalEdit.ts) simulates pending component-session disassociate via **`applyWorkingComponentToDraft`** inside **`applyLocal`**, then **`pushChoice`** when **`includesNonEmpty`**. Used by [`LensHeader`](../LensEdit/LensHeader.tsx) Room **`_lens`** clear.

Does **not** mutate `localDraft`. Preview on **merged** `getStandardForm` is incorrect (inherited refs do not count for the asset-layer predicate).

## Ref scrub (belt-and-suspenders)

`normalizeWorkbenchDraft` runs a **fixpoint** loop; each pass includes a defensive **ref scrub** step after orphan body removal. Flush invokes normalize via **`applyWorkbenchFlush`** or **`applyAssetMetaFlush`**; this section defines scrub's role.

Per pass, after orphan detection and body removal:

1. **Orphan detection (load-bearing):** keys where **`!isReferencedInAssetLayer`** on the current local draft.
2. **Body removal (load-bearing):** drop those keys from `_components`.
3. **Ref scrub (defensive):** `removeReferences` on survivors + strip matching keys from `_topLevel`.
4. If step 2 removed any keys, repeat from 1; else done.

### Why scrub is not the main GC path

After a correct asset-layer orphan check, any key `K` removed in step 2 was **not** on `_topLevel` and had **empty** [`referencedBy(K)`](../../../../../../packages/mtw-wml/ts/standardize/index.ts) --- so no surviving component's `referencedKeys()` and no asset top-level slot should still mention `K`. In a correct disassociate-then-normalize flow, step 3 should be a **no-op**.

**Keep step 3 anyway** (mirror hygiene in [`removeComponent`](../../../../../../packages/mtw-wml/ts/standardize/index.ts), cheap invariant enforcement). **Do not** treat scrub as proof that authors routinely leave dangling list slots after disassociate; transitive GC comes from **step 1 on the next iteration**, not from scrub "finding" new orphans.

| Situation | Scrub role |
| --- | --- |
| Happy path (local disassociate + normalize) | Expected **no-op** |
| Legacy/broken draft (e.g. body removed without disassociate, flush ordering bugs) | Repairs inconsistency; log/dev assert optional |
| [`removeComponent`](../../../../../../packages/mtw-wml/ts/standardize/index.ts) (engine) | Scrub is **load-bearing** --- removes component bodies first, then `removeReferences` on survivors and strips `_topLevel` (different API, not workbench normalize) |

See [`normalizeWorkbenchDraft.ts`](./normalizeWorkbenchDraft.ts) (`scrubReferences`) for implementation; code comment points here.

## Tests

Run from `charcoal-client/`: `npm run test:single -- src/components/Workbench/foundations/consistency`

| File | Coverage |
| --- | --- |
| [`isReferencedInAssetLayer.test.ts`](./isReferencedInAssetLayer.test.ts) | Predicate matrix: `_topLevel`-only, `ref={0}` stub, nested list ref, inherited-only vs merged (`inherited.merge(local)`), `sameKey` matching |
| [`materializeComponent.test.ts`](./materializeComponent.test.ts) | Create, idempotent materialize, import (`fromAsset`) |
| [`materializeComponentInAsset.test.ts`](./materializeComponentInAsset.test.ts) | `updateLocal` dispatch, local-draft early exit, import always dispatches, no normalize |
| [`applyWorkbenchFlush.test.ts`](./applyWorkbenchFlush.test.ts) | Assign, `beforeAssign`, normalize after disassociate, imported Room shortName (Phase 0/1 fixture), no materialize |
| [`applyAssetMetaFlush.test.ts`](./applyAssetMetaFlush.test.ts) | Assign asset-meta fields, `beforeAssign`, normalize after topLevel disassociate, shortName, no materialize |
| [`normalizeWorkbenchDraft.test.ts`](./normalizeWorkbenchDraft.test.ts) | Fixpoint orphan GC, `_topLevel` transitive removal, Area-participant transitive path, happy-path scrub no-op, `scrubReferences` defensive fixtures |
| [`previewOrphanClosure.test.ts`](./previewOrphanClosure.test.ts) | Non-mutation, `includesNonEmpty`, `applyLocal`, parity with `normalizeWorkbenchDraft` |

## Related documentation

| Doc | Role |
| --- | --- |
| [Workbench AGENT.md](../../AGENT.md) | Workbench composition; component session; asset-meta session |
| [AGENT.reference-lists.md](../ReferenceList/AGENT.reference-lists.md) | List shells, associate/disassociate sites |
| [personalAssets AGENT.md](../../../../slices/personalAssets/AGENT.md) | `updateStandard`, merge, diff |
| [`StandardForm` / `referencedBy`](../../../../../../packages/mtw-wml/ts/standardize/index.ts) | Engine reference graph |
| [`schemaOrganization.ts`](../../../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts) | Schema tree --- not the workbench orphan predicate |
| [`standardForm.removeComponent.test.ts`](../../../../../../packages/mtw-wml/ts/standardize/integration/standardForm.removeComponent.test.ts) | Engine `removeComponent` + scrub |
