# Workbench consistency layer

**Status:** M1 complete (**D2**, **D9** `materializeComponent`, **D3/D4** `normalizeWorkbenchDraft`, **D5** `previewOrphanClosure`, unit tests). Normative **D2**, **normalize**, **preview**, and **ref scrub** detail lives here; flush pipeline wiring is **M2**; cross-links expand in M6. Active task plan: [AGENT.workbenchConsistencyLayer.planning.md](../../../../../../taskPlanning/charcoal-client/src/components/Workbench/AGENT.workbenchConsistencyLayer.planning.md).

## Purpose

The consistency layer centralizes **global** operations on the **local** asset `StandardForm` during Workbench authoring: **materialize** (ensure `byUniversalId` entries exist) and **normalize** (workbench orphan GC and defensive ref scrub). Editors and list shells own **local** **associate** / **disassociate** on **working** state and call the layer at flush boundaries. Planned pure-TS exports land in this folder (no React imports).

## Local vs global

| Layer | Operations | Mutates (typical) |
| --- | --- | --- |
| **Local** (sessions / list shells) | **Associate**, **disassociate** | `ReferenceList` (or facet slot) on **working** component or asset-meta projection; scalar fields on **working** |
| **Global** (consistency layer) | **Materialize**, **normalize** | `StandardForm` draft: `byUniversalId`, workbench orphan GC (**D2**); defensive ref scrub (below) |

**Associate / disassociate** mean: this **site** (e.g. `room.features`, `asset._topLevel`) does or does not list a key. They do **not** mean "delete component from asset."

## Stored WML vs displayed UI

- **Local form** ([`getLocalStandardForm`](../../../../slices/personalAssets/selectors.ts): base + edit + pendingEdits) holds asset-layer edits: `ref={0}` top-level import stubs, negative refs, etc.
- **Merged** [`getStandardForm`](../../../../slices/personalAssets/selectors.ts) (inherited + local) is for **display** only. Inherited ancestry does **not** count as a local reference for orphan GC or preview.

Workbench normalize runs on the **local** draft, not the merged view.

## `isReferencedInAssetLayer` (D2)

**Question:** Is this component still **linked in this asset's edit data** (any ref sign), not "where does it appear in the schema tree?"

| API | Use for workbench orphan GC? |
| --- | --- |
| [`SchemaOrganization.isReferenced`](../../../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts) | **No** --- schema-tree / graph-tier semantics; can miss nested `ref={0}` Direct refs. |
| [`StandardForm.referencedBy`](../../../../../../packages/mtw-wml/ts/standardize/index.ts) alone | **No** --- scans component `referencedKeys()` only; **misses `_topLevel`** (e.g. import side-effect `ref={0}` stubs). |
| **`isReferencedInAssetLayer` (D2)** | **Yes** --- **`_topLevel` union `referencedBy`** on the **local** `StandardForm`. |

**Normative (D2):**

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
- **Precedent:** [`LensHeader.tsx`](../../LensEdit/LensHeader.tsx) already combines `referencedBy` + `_topLevel` when deciding whether clearing a lens removes the component.
- Do **not** confuse with persisted **`referencedBy`** on blueprint rows (Area topology / lambda); **D2** uses in-memory **`StandardForm.referencedBy()`** only.

**Examples and engine behavior:** [`standardForm.referencedBy.test.ts`](../../../../../../packages/mtw-wml/ts/standardize/integration/standardForm.referencedBy.test.ts).

### WML vs Workbench orphan policy

| Context | Unreferenced component with content |
| --- | --- |
| **WML / generic merge** | Retained (supports `ref={0}` / inline orphan editing) |
| **Authoring Workbench** | Removed by normalize when **`!isReferencedInAssetLayer`** on the local form; non-empty orphans are not left without UI to edit them |

## `materializeComponent` (D9)

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

## `normalizeWorkbenchDraft` (D3, D4)

Workbench orphan GC on the **local** draft after local disassociations. **Mutates `draft` in place** (same pattern as `materializeComponent` and `updateStandard` callbacks); returns `draft` for chaining.

```typescript
function normalizeWorkbenchDraft(draft: StandardForm): StandardForm
```

**Implementation:** [`normalizeWorkbenchDraft.ts`](./normalizeWorkbenchDraft.ts), exported from [`index.ts`](./index.ts).

**Fixpoint algorithm** (each pass):

1. **Orphan detection (load-bearing):** `_components` entries where **`!isReferencedInAssetLayer`** (**D2**).
2. **Body removal (load-bearing):** drop those keys from `_components` (empty **and** non-empty --- unlike WML merge, which retains orphans with content).
3. **Ref scrub (defensive):** `removeReferences` on survivors + strip matching keys from `_topLevel` (see [Ref scrub](#ref-scrub-belt-and-suspenders) below).
4. Repeat until a pass removes zero bodies, or **50 iterations** (**D4** cap --- throw in dev, `console.warn` in prod).

Transitive removal (e.g. Area disassociate -> Room orphan -> Feature orphan) requires the fixpoint loop; one pass is not enough. Workbench authoring uses this fixpoint, **not** [`removeComponent({ cascade: true })`](../../../../../../packages/mtw-wml/ts/standardize/index.ts) (**D7**).

Internal helpers (`findOrphanComponents`, `scrubReferences`, `normalizeSinglePass`) live in [`normalizeWorkbenchDraft.ts`](./normalizeWorkbenchDraft.ts) and are shared with **`previewOrphanClosure`**.

## `previewOrphanClosure` (D5)

Simulate fixpoint orphan closure on a **local** draft **without mutating** the input. Uses the same passes as **`normalizeWorkbenchDraft`** via **`normalizeSinglePass`**.

```typescript
function previewOrphanClosure(
  localDraft: StandardForm,
  options?: { applyLocal?: (draft: StandardForm) => void }
): { removedKeys: ComponentUUID[]; includesNonEmpty: boolean }
```

**Implementation:** [`previewOrphanClosure.ts`](./previewOrphanClosure.ts), exported from [`index.ts`](./index.ts).

- **`applyLocal`:** run pending disassociates (or other local edits) on an internal **`_clone()`** before simulating normalize. Typed **`afterDisassociate: { site; ref }[]`** waits until **`AssociationSite`** / **`disassociateAtSite`** exist (M2+).
- **`removedKeys`:** `universalKey` of each body removed across fixpoint passes, in pass order.
- **`includesNonEmpty`:** `true` if any removed body had **`!isEmpty()`** at removal time. UI should confirm before flush when `true` (e.g. list row or header delete in **M3** / **M4**). Empty-only closure may proceed without that dialog.

Does **not** mutate `localDraft`. Preview on **merged** `getStandardForm` is incorrect (inherited refs do not count for **D2**).

## Ref scrub (belt-and-suspenders)

`normalizeWorkbenchDraft` runs a **fixpoint** loop; each pass includes a defensive **ref scrub** step after orphan body removal. Flush pipeline wiring lands in M2+; this section defines scrub's role.

Per pass, after **D2** orphan detection and body removal:

1. **Orphan detection (load-bearing):** keys where **`!isReferencedInAssetLayer`** on the current local draft.
2. **Body removal (load-bearing):** drop those keys from `_components`.
3. **Ref scrub (defensive):** `removeReferences` on survivors + strip matching keys from `_topLevel`.
4. If step 2 removed any keys, repeat from 1; else done.

### Why scrub is not the main GC path

After **D2**, any key `K` removed in step 2 was **not** on `_topLevel` and had **empty** [`referencedBy(K)`](../../../../../../packages/mtw-wml/ts/standardize/index.ts) --- so no surviving component's `referencedKeys()` and no asset top-level slot should still mention `K`. In a correct disassociate-then-normalize flow, step 3 should be a **no-op**.

**Keep step 3 anyway** (mirror hygiene in [`removeComponent`](../../../../../../packages/mtw-wml/ts/standardize/index.ts), cheap invariant enforcement). **Do not** treat scrub as proof that authors routinely leave dangling list slots after disassociate; transitive GC comes from **step 1 on the next iteration**, not from scrub "finding" new orphans.

| Situation | Scrub role |
| --- | --- |
| Happy path (local disassociate + **D2** + normalize) | Expected **no-op** |
| Legacy/broken draft (e.g. body removed without disassociate, flush ordering bugs) | Repairs inconsistency; log/dev assert optional |
| [`removeComponent`](../../../../../../packages/mtw-wml/ts/standardize/index.ts) (engine) | Scrub is **load-bearing** --- removes component bodies first, then `removeReferences` on survivors and strips `_topLevel` (different API, not workbench normalize) |

See [`normalizeWorkbenchDraft.ts`](./normalizeWorkbenchDraft.ts) (`scrubReferences`) for implementation; code comment points here.

## Tests

Run from `charcoal-client/`: `npm run test:single -- src/components/Workbench/foundations/consistency`

| File | Coverage |
| --- | --- |
| [`isReferencedInAssetLayer.test.ts`](./isReferencedInAssetLayer.test.ts) | **D2** matrix: `_topLevel`-only, `ref={0}` stub, nested list ref, inherited-only vs merged (`inherited.merge(local)`), `sameKey` matching |
| [`materializeComponent.test.ts`](./materializeComponent.test.ts) | Create, idempotent materialize, import (`fromAsset`) |
| [`normalizeWorkbenchDraft.test.ts`](./normalizeWorkbenchDraft.test.ts) | Fixpoint orphan GC (D3/D4), `_topLevel` transitive removal, Area-participant transitive path, happy-path scrub no-op, `scrubReferences` defensive fixtures |
| [`previewOrphanClosure.test.ts`](./previewOrphanClosure.test.ts) | Non-mutation, `includesNonEmpty`, `applyLocal`, parity with `normalizeWorkbenchDraft` |

## Related documentation

| Doc | Role |
| --- | --- |
| [Workbench consistency layer (task plan)](../../../../../../taskPlanning/charcoal-client/src/components/Workbench/AGENT.workbenchConsistencyLayer.planning.md) | Progress, decisions **D1-D9**, verification until archive |
| [Workbench AGENT.md](../../AGENT.md) | Workbench composition, component session |
| [AGENT.reference-lists.md](../ReferenceList/AGENT.reference-lists.md) | List shells, associate/disassociate sites |
| [personalAssets AGENT.md](../../../../slices/personalAssets/AGENT.md) | `updateStandard`, merge, diff |
| [`StandardForm` / `referencedBy`](../../../../../../packages/mtw-wml/ts/standardize/index.ts) | Engine reference graph |
| [`schemaOrganization.ts`](../../../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts) | Schema tree --- **not** **D2** |
| [`standardForm.removeComponent.test.ts`](../../../../../../packages/mtw-wml/ts/standardize/integration/standardForm.removeComponent.test.ts) | Engine `removeComponent` + scrub |
