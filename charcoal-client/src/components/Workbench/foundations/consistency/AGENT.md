# Workbench consistency layer

**Status:** Stub (M1). Normative **D2** and **ref scrub** detail lives here; full module API, flush pipeline, and cross-links expand in M6. Active task plan: [AGENT.workbenchConsistencyLayer.planning.md](../../../../../../taskPlanning/charcoal-client/src/components/Workbench/AGENT.workbenchConsistencyLayer.planning.md).

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

Implementation and export from this module are in progress (M1). Call sites should use **local** `StandardForm` only.

- **Orphan (workbench):** `byUniversalId` entry whose reference satisfies **`!isReferencedInAssetLayer(localForm, ref)`** after disassociations (fixpoint normalize may remove many keys).
- **Precedent:** [`LensHeader.tsx`](../../LensEdit/LensHeader.tsx) already combines `referencedBy` + `_topLevel` when deciding whether clearing a lens removes the component.
- Do **not** confuse with persisted **`referencedBy`** on blueprint rows (Area topology / lambda); **D2** uses in-memory **`StandardForm.referencedBy()`** only.

**Examples and engine behavior:** [`standardForm.referencedBy.test.ts`](../../../../../../packages/mtw-wml/ts/standardize/integration/standardForm.referencedBy.test.ts).

### WML vs Workbench orphan policy

| Context | Unreferenced component with content |
| --- | --- |
| **WML / generic merge** | Retained (supports `ref={0}` / inline orphan editing) |
| **Authoring Workbench** | Removed by normalize when **`!isReferencedInAssetLayer`** on the local form; non-empty orphans are not left without UI to edit them |

## Ref scrub (belt-and-suspenders)

`normalizeWorkbenchDraft` (M1) runs a **fixpoint** loop; each pass includes a defensive **ref scrub** step after orphan body removal. Full fixpoint semantics (iteration cap, preview API, flush pipeline) are documented when implementation lands; this section defines scrub's role only.

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

When implementing `normalizeWorkbenchDraft`, add a short code comment pointing to this section.

## Related documentation

| Doc | Role |
| --- | --- |
| [Workbench consistency layer (task plan)](../../../../../../taskPlanning/charcoal-client/src/components/Workbench/AGENT.workbenchConsistencyLayer.planning.md) | Progress, decisions **D1-D8**, verification until archive |
| [Workbench AGENT.md](../../AGENT.md) | Workbench composition, component session |
| [AGENT.reference-lists.md](../ReferenceList/AGENT.reference-lists.md) | List shells, associate/disassociate sites |
| [personalAssets AGENT.md](../../../../slices/personalAssets/AGENT.md) | `updateStandard`, merge, diff |
| [`StandardForm` / `referencedBy`](../../../../../../packages/mtw-wml/ts/standardize/index.ts) | Engine reference graph |
| [`schemaOrganization.ts`](../../../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts) | Schema tree --- **not** **D2** |
| [`standardForm.removeComponent.test.ts`](../../../../../../packages/mtw-wml/ts/standardize/integration/standardForm.removeComponent.test.ts) | Engine `removeComponent` + scrub |
