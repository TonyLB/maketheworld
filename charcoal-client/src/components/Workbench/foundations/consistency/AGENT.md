# Workbench consistency layer

Pure TypeScript module ([`foundations/consistency/`](./)) for Workbench **global** asset-graph operations during authoring: materialize, flush assign, site-local disassociate confirm, and explicit Purge. Redux `updateStandard` calls in; no React imports.

## Purpose

The consistency layer centralizes **global** operations on the **local** asset `StandardForm` during Workbench authoring: **materialize** (ensure `byUniversalId` entries exist), **flush assign** (persist session `working` onto the local draft), **site-local confirm** before list disassociates, and **Purge** (`removeComponent` with author-chosen rehome/cascade). Editors and list shells own **local** **associate** / **disassociate** on **working** state and call the layer at flush boundaries.

## Policy at a glance

| Topic | Policy |
| --- | --- |
| **Module boundary** | This folder; Redux `updateStandard` calls in; no React imports. |
| **Single-site list remove** | Row remove = disassociate at **one site** only (incl. **`_topLevel`**); never `removeComponent` for rows. |
| **Body retention** | Disassociate does **not** delete `byUniversalId` bodies; bodies remain until **Purge** or engine **`removeComponent`**. |
| **Site-local confirm** | [`confirmSiteDisassociateBefore*`](#confirmsitedisassociatebeforelocaledit) always confirms (except empty local body); copy explains asset-level retention and remaining **`referencedBy`**. |
| **Explicit Purge** | [`purgeComponentFromAssetFlow`](#purgecomponentfromassetflow) on **TopLevel** rows only (Phase 2c); uses [`previewPurgeClosure`](#previewpurgeclosure) + [`confirmPurgeBeforeRemove`](#confirmpurgebeforeremove) + [`purgeComponentInAsset`](#purgecomponentinasset). |
| **Materialize spec** | [`materializeComponent`](#materializecomponent): `{ universalKey, fromAsset? }`; derive tag from UUID prefix. |
| **Materialize vs flush** | Eager **`materializeComponentInAsset`** on Redux local draft. Session flush is **assign only** (no orphan GC). |
| **Asset-meta flush** | [`applyAssetMetaFlush`](#applyassetmetaflush) + [`useWorkbenchAssetMeta`](../WorkbenchAssetMeta/useWorkbenchAssetMeta.tsx) mirror component session. |

## User-facing removal

| UX | Scope | Body removal |
| --- | --- | --- |
| **List row remove** (incl. TopLevel / **`_topLevel`**) | **One site** only | **No** --- body remains; confirm explains retention |
| **Site-specific delete** (e.g. [`LensHeader`](../../LensEdit/LensHeader.tsx) lens clear, Room situations) | **That site only** | **No** --- same site-local confirm |
| **TopLevel Purge** ([`TopLevelEditor`](../ReferenceList/TopLevelEditor.tsx)) | **Whole component** on local draft | **`removeComponent`** (rehome or cascade after confirm) |

- **[`WMLComponentHeader`](../../WMLComponentHeader.tsx)** is **deprecated**, unused, and not mounted. Do not wire legacy purge UX.

## Exports

Public surface from [`index.ts`](./index.ts):

| Export | Role |
| --- | --- |
| **`materializeComponent`**, **`MaterializeSpec`** | Pure create/import on draft |
| **`materializeComponentInAsset`** | Awaitable Redux thunk for eager materialize |
| **`applyWorkbenchFlush`**, **`ApplyWorkbenchFlushEdit`** | Component-session flush pipeline |
| **`applyAssetMetaFlush`**, **`ApplyAssetMetaFlushEdit`**, **`WorkbenchAssetMetaWorking`** | Asset-meta session flush |
| **`confirmSiteDisassociateBeforeAssetMetaDisassociate`** | TopLevel row remove confirm |
| **`confirmSiteDisassociateBeforeComponentDisassociate`** | Component-site disassociate confirm |
| **`previewPurgeClosure`**, options/result types | Purge impact preview (rehome vs cascade) |
| **`confirmPurgeBeforeRemove`**, **`PurgeDisposition`** | Purge confirm dialog |
| **`purgeComponentInAsset`** | Awaitable Redux thunk for explicit purge |
| **`purgeComponentFromAssetFlow`** | Preview + confirm + dispatch orchestrator |

## Local vs global

| Layer | Operations | Mutates (typical) |
| --- | --- | --- |
| **Local** (sessions / list shells) | **Associate**, **disassociate** | `ReferenceList` (or facet slot) on **working**; scalars on **working** |
| **Global** (consistency layer) | **Materialize**, **flush assign**, **Purge** | `StandardForm` local draft via `updateStandard` |

**Associate / disassociate** mean: this **site** lists or unlists a key. They do **not** mean "delete component from asset."

## Orchestration timing

| Operation | When | Call site |
| --- | --- | --- |
| **`materializeComponentInAsset`** | Immediately on create/import | [`useWorkbenchAsset`](../useWorkbenchAsset.ts); list shells |
| **`applyWorkbenchFlush`** | Component-session flush | [`dispatchFlush`](../WorkbenchComponent/useWorkbenchComponent.tsx) via **`update`** (merged baseline) |
| **`applyAssetMetaFlush`** | Asset-meta session flush | [`useWorkbenchAssetMeta`](../WorkbenchAssetMeta/useWorkbenchAssetMeta.tsx) via **`updateLocal`** |
| **`confirmSiteDisassociateBefore*`** | Before list-row / site disassociate on **working** | [`TopLevelEditor`](../ReferenceList/TopLevelEditor.tsx), [`LensHeader`](../../LensEdit/LensHeader.tsx), [`RoomSituationsListEditor`](../../RoomEdit/RoomSituationsListEditor.tsx) |
| **`purgeComponentFromAssetFlow`** | TopLevel **Purge** action | [`TopLevelEditor`](../ReferenceList/TopLevelEditor.tsx) only (Phase 2c) |

## Stored WML vs displayed UI

- **Local form** ([`getLocalStandardForm`](../../../../slices/personalAssets/selectors.ts)) holds asset-layer edits.
- **Merged** [`getStandardForm`](../../../../slices/personalAssets/selectors.ts) is for **display** and confirm labels. Site-local **`referencedBy`** simulation uses the **local** draft only.

## `confirmSiteDisassociateBeforeLocalEdit`

Confirm before disassociating at one site. **Does not** simulate normalize or body deletion.

| Export | Used by |
| --- | --- |
| **`confirmSiteDisassociateBeforeAssetMetaDisassociate`** | [`TopLevelEditor`](../ReferenceList/TopLevelEditor.tsx) row **remove** |
| **`confirmSiteDisassociateBeforeComponentDisassociate`** | [`LensHeader`](../../LensEdit/LensHeader.tsx), [`RoomSituationsListEditor`](../../RoomEdit/RoomSituationsListEditor.tsx) |

**Dialog policy:** **Cancel** / **Remove link**. After simulating the disassociate on a local clone, if **`referencedBy(target)`** is non-empty, message lists remaining parents; otherwise message explains the body **remains** and may still appear at asset level (TopLevel copy mentions **Purge**). Skips dialog when the target has no non-empty local body.

**Implementation:** [`confirmSiteDisassociateBeforeLocalEdit.ts`](./confirmSiteDisassociateBeforeLocalEdit.ts).

## `materializeComponent`

Ensure `draft.byUniversalId` contains a component before a reference is meaningful. **Public spec:** `{ universalKey, fromAsset? }` only.

**Implementation:** [`materializeComponent.ts`](./materializeComponent.ts).

## `materializeComponentInAsset`

Eager global materialize for Workbench create/import.

**Implementation:** [`materializeComponentInAsset.ts`](./materializeComponentInAsset.ts).

## `applyWorkbenchFlush`

Apply component-session **`working`** to a `StandardForm` draft clone (assign only). Production flush passes a **merged** clone via **`type: 'update'`** in [`dispatchFlush`](../WorkbenchComponent/useWorkbenchComponent.tsx); the opcode determines diff baseline, not this helper.

**Implementation:** [`applyWorkbenchFlush.ts`](./applyWorkbenchFlush.ts).

### Imported component flush (linkage + merged `working`)

For **import + inline edit**, the local form may have a body with **no roster pin** (`_topLevel` without **`ref>=1`**) and **`referencedBy(room)` empty**. Flush **assign only** retains that body. Authors still **see** the component in the asset Components list via **display union** ([`topLevelDisplayAdapter`](../ReferenceList/topLevelDisplayAdapter.ts) + merged **`getChildrenOfParent`**). Merged **`shortName`** persist under inheritance uses **`type: 'update'`** flush (merged baseline).

## `applyAssetMetaFlush`

Apply asset-meta session **`working`** (`_shortName`, `_summary`, `_topLevel`) to the local draft (assign only).

**Implementation:** [`applyAssetMetaFlush.ts`](./applyAssetMetaFlush.ts).

## `previewPurgeClosure`

Simulate **`removeComponent`** on a **local** draft clone (rehome vs cascade).

**Implementation:** [`previewPurgeClosure.ts`](./previewPurgeClosure.ts).

## `confirmPurgeBeforeRemove`

Confirm explicit purge before dispatch. Returns **`'cancel' | 'rehome' | 'cascade'`**.

**Implementation:** [`confirmPurgeBeforeRemove.ts`](./confirmPurgeBeforeRemove.ts).

## `purgeComponentInAsset`

Awaitable thunk: **`updateStandard({ type: 'removeComponent', componentKey, cascade })`** plus **`setIntent`** / **`heartbeat`**.

**Implementation:** [`purgeComponentInAsset.ts`](./purgeComponentInAsset.ts).

## `purgeComponentFromAssetFlow`

Preview, confirm, and dispatch Purge for one component reference.

**Implementation:** [`purgeComponentFromAssetFlow.ts`](./purgeComponentFromAssetFlow.ts). Mounted from [`TopLevelEditor`](../ReferenceList/TopLevelEditor.tsx).

## Tests

Run from `charcoal-client/`: `npm run test:single -- src/components/Workbench/foundations/consistency`

| File | Coverage |
| --- | --- |
| [`confirmSiteDisassociateBeforeLocalEdit.test.ts`](./confirmSiteDisassociateBeforeLocalEdit.test.ts) | Site-local copy branches, cancel/confirm |
| [`materializeComponent.test.ts`](./materializeComponent.test.ts) | Create, idempotent materialize, import |
| [`materializeComponentInAsset.test.ts`](./materializeComponentInAsset.test.ts) | `updateLocal` dispatch, early exit |
| [`applyWorkbenchFlush.test.ts`](./applyWorkbenchFlush.test.ts) | Assign, imported Room body retention |
| [`applyAssetMetaFlush.test.ts`](./applyAssetMetaFlush.test.ts) | Assign asset-meta fields |
| [`previewPurgeClosure.test.ts`](./previewPurgeClosure.test.ts) | Rehome vs cascade |
| [`confirmPurgeBeforeRemove.test.ts`](./confirmPurgeBeforeRemove.test.ts) | Dialog branches |

## Related documentation

| Doc | Role |
| --- | --- |
| [Workbench AGENT.md](../../AGENT.md) | Workbench composition; sessions |
| [AGENT.reference-lists.md](../ReferenceList/AGENT.reference-lists.md) | List shells, associate/disassociate |
| [personalAssets AGENT.md](../../../../slices/personalAssets/AGENT.md) | `updateStandard`, Purge vs disassociate |
| [`standardForm.removeComponent.test.ts`](../../../../../../packages/mtw-wml/ts/standardize/integration/standardForm.removeComponent.test.ts) | Engine `removeComponent` |
