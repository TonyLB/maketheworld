# Workbench - Agent Navigation Guide

## Overview

The Workbench is the **form-based authoring interface** for creating and editing WML content in the Charcoal Client. It provides a responsive, overlay-style editing experience that enables authors to work on assets without leaving their current context (e.g., while viewing the playing interface). The Workbench is the primary UI for the **Authoring Mode** form-based editing path.

### Purpose

- **Asset Editing**: Edit WML assets through structured forms rather than raw markup
- **Component Navigation**: Navigate within an asset's component hierarchy (Rooms, Areas, Features, Knowledge, Situations, Lenses, Marks, etc.)
- **Contextual Overlay**: Present editing UI as a drawer (desktop) or full-screen overlay (mobile) relative to the viewport
- **Draft-Centric**: Optimized for editing assets in the Draft zone; read-only behavior for published assets

### Context

The Workbench sits within the Charcoal Client's [dual-mode architecture](../../../AGENT.md): it serves **Authoring Mode** alongside the Library system. Unlike the Library's `/Library/Edit/Asset/:AssetId/*` route-based editing, the Workbench uses **Redux state-based navigation** (breadcrumb stack) and can be opened from multiple entry points (e.g., from within the playing interface when in authoring mode).

### Key Concepts

- **Breadcrumb Stack**: Within-asset navigation history; `component` entries for parent components, `componentLayer` for layered sibling views (e.g., Room Situation facets, Guidance, Marks within a Lens)
- **Reference Lists**: WML `ReferenceList` fields (e.g. `features`, `guidance`, `lens`, `marks`) rendered as accordion lists with add/remove; see [AGENT.reference-lists.md](./foundations/ReferenceList/AGENT.reference-lists.md)
- **Layered Context**: Sibling-in-context editing for Room Situation facets and Guidance (Photoshop-layer style); see [AGENT.layered-context-patterns.md](./foundations/LayeredContext/AGENT.layered-context-patterns.md)
- **StandardForm**: WML asset representation; the Workbench reads and mutates `StandardForm` via `updateStandard` from `useWorkbenchAsset`; per-component editing uses **`useWorkbenchComponent`** ([Component editing session](#component-editing-session-two-tier-model)); asset root ShortName, Summary, and `_topLevel` use **`useWorkbenchAssetMeta`** ([Asset-meta editing session](#asset-meta-editing-session))
- **Consistency layer**: **`materializeComponentInAsset`** eager on Redux local draft (`updateLocal`); **`applyWorkbenchFlush`** at component session flush via **`update`** (merged baseline); **`applyAssetMetaFlush`** at asset-meta flush via **`updateLocal`**; **`confirmSiteDisassociateBefore*`** on list disassociates; TopLevel **Purge** via **`purgeComponentFromAssetFlow`** --- see [foundations/consistency/AGENT.md](./foundations/consistency/AGENT.md)

---

## Component editing session (two-tier model)

Workbench component editors use a **working `StandardComponent`** in React state (cheap `clone()` + mutate per change) and **debounced `updateStandard`** to Redux (whole-asset `clone` + diff + merge). UI reads **`working`** while editing; Redux `standardForm` is authoritative after flush and across navigation.

### Two tiers

| Tier | What | Cost | When |
| --- | --- | --- | --- |
| **Working copy** | `StandardRoom` (etc.) in session state from `useWorkbenchComponent` | Component `clone()` + payload mutate | Every field change via `updateComponent` |
| **Committed copy** | `standardForm.byUniversalId[id]` from `useWorkbenchAsset` | Asset `standardForm._clone()` + diff + merge into `edit` | Debounced **`flushToStandardForm`** (~1000ms default), plus **`flushNow`** on unmount / breadcrumb |

```text
User edit -> updateComponent (working = working.clone(); mutate) -> UI reads working.*
  ... debounce ...
  -> flushToStandardForm -> updateStandard assigns working to draft.byUniversalId[id]
```

**Per-component debounce (not per-field):** each `updateStandard` diffs the **entire asset**. One flush batches all pending edits on that component.

### Layering

```text
UI primitives (StandardLiteralEditor, StandardRenderEditor)
  <- field/section components (WorkbenchShortNameField, DefaultRenderEditor, ReferenceListSessionEditor)
      <- useWorkbenchComponent / WorkbenchComponentProvider
          <- workbenchMutations (prepareComponentForFlush shortName prep, reconcileCommittedComponent, applyWorkingComponentToDraft)
              <- updateStandard (asset clone -> diff -> merge)
```

### Composition rules

1. **One session per screen** editing a single component (`WorkbenchComponentProvider` + `useWorkbenchComponent`).
2. **Leaf editors** use **`value` / `onChange`** on **working** fields (or context-only field components). **No `updateStandard` on the edit path** inside primitives; **no persist debounce** in primitives under a provider.
3. **List shells on a provider screen** mutate parent **`working`** via **`updateComponent`** + session debounced flush. Optional **`flushNow`** after structural add/remove/import before navigation. See [AGENT.reference-lists.md](./foundations/ReferenceList/AGENT.reference-lists.md).
4. **Compose by sections** (shortName, DEFAULT prose, lists, topology) on the same parent **`working`** copy when they edit the same component.
5. **Row contract** at the **Standard*** slice; facet/exit rows use list + handler patterns documented in foundation AGENT files.

### Session API ([`foundations/WorkbenchComponent/`](./foundations/WorkbenchComponent/))

- **State:** `working` (editor copy), `lastReceived` (reconcile baseline), `committed` (live Redux selector view).
- **`updateComponent`:** immediate `working.clone()` then mutate; resets debounce timer.
- **`flushToStandardForm`:** debounced persist (default ~1000ms; `flushDelayMs` on provider). Flush dispatches **`update`** (merged baseline) and runs [`applyWorkbenchFlush`](./foundations/consistency/applyWorkbenchFlush.ts) (assign **`working`** via [`applyWorkingComponentToDraft`](./foundations/workbenchMutations.ts) / shortName prep only). Skips dispatch when `lastReceived.diff(working)` is undefined (semantic no-op at component scope).
- **Merged baseline under imports:** Session **`working`** / **`committed`** come from **`getStandardForm`** (inherited + local). Flush must use **`type: 'update'`** so `standardForm.diff(modified)` matches display-shaped fields (e.g. inherited `shortName` overlays). **`updateLocal`** flush caused wrong merged literals when assign targeted the edit layer only. See [personalAssets updateStandard perspectives](../../slices/personalAssets/AGENT.md#updatestandard-perspectives-workbench).
- **`flushNow`:** cancel pending debounce and flush immediately; runs on provider unmount and `componentId` change.
- **Create/import:** **`await materializeComponentInAsset`** on the Redux local draft, then associate on parent **`working`** via **`updateComponent`**; debounced flush (**`applyWorkbenchFlush`**) persists list edits.
- **DEFAULT situation:** when `working` references **SITUATION#DEFAULT**, flush may call [`assureDefaultSituationFromPrimitives`](../../slices/personalAssets/assureDefaultSituationFromPrimitives.ts) before assign.
- **External `committed` changes** (import, stream, other UI): [`reconcileCommittedComponent`](./foundations/workbenchMutations.ts) three-way merge (`lastReceived.diff(working)` then `incoming.merge(editDiff)`); echo of last flush skipped; merge failure supersedes with snackbar (`onSuperseded` override); cancel pending debounce before reconcile, reschedule after. Pure helpers in [`workbenchMutations.ts`](./foundations/workbenchMutations.ts); domain list accessors next to owning editor (e.g. [`roomReferenceListAccessors.ts`](./RoomEdit/roomReferenceListAccessors.ts) for guidance/features reference lists and **`roomSituationsFacetAccessor`** for Room situation facets).

### Session-bound field components

- **`WorkbenchShortNameField`**, **`DefaultRenderEditor`**, **`ReferenceListSessionEditor`**, **`FacetListSessionEditor`**, **`LensHeader`** (Room **`_lens`**), **`RoomSituationsListEditor`:** context-only; `updateComponent` on **`working`**; no per-action `updateStandard` on the edit path. Room **`_lens`**: create/reference/import via **`materializeComponentInAsset`** + **`onAssociateReference`**; remove via **`confirmSiteDisassociateBeforeComponentDisassociate`** then disassociate on **`working._lens`** only. Room non-DEFAULT situations: create/reference via **`materializeComponentInAsset`** + **`onAssociateReference`**; remove via **`confirmSiteDisassociateBeforeComponentDisassociate`** then disassociate on **`working.situations`** only (no eager `_topLevel` on create). Facet lists (Lens marks, Guidance marks): **`FacetListSessionEditor`** + domain accessors; see [AGENT.facet-list.md](./foundations/FacetList/AGENT.facet-list.md).
- **`debounce={false}`** on `StandardLiteralEditor` / `StandardRenderEditor` under a provider so only the session debounces flush.
- **`readonly`:** field prop **and** asset `readonly` from `useWorkbenchAsset` (non-Draft / published).

### Slate / rich text

`StandardRenderEditor` uses a local Slate buffer so parent `value` does not overwrite in-progress typing while Redux is stale. Under a session, commits go into **`working`**; only **`flushToStandardForm`** hits Redux.

**Client sync invariants:** Session reconcile must react to semantic changes only (**I2**). Slate props must not churn reference when domain is unchanged (**I3**). Session field editors must mount with bounded render work on an unchanged store (**I5**). See [../../slices/AGENT.client-sync-invariants.md](../../slices/AGENT.client-sync-invariants.md) and `DefaultRenderEditor.test.tsx` / `StandardRenderEditor.test.tsx`.

### Testing

Import session test utilities from [`foundations/WorkbenchComponent/testing/harness.tsx`](./foundations/WorkbenchComponent/testing/harness.tsx) and [`testing/mock.ts`](./foundations/WorkbenchComponent/testing/mock.ts), or [`foundations/WorkbenchAssetMeta/testing/harness.tsx`](./foundations/WorkbenchAssetMeta/testing/harness.tsx) for asset-meta sessions --- not from the production barrel. See [Development Notes](#development-notes) and [charcoal-client/AGENT.testing.md](../../AGENT.testing.md).

### Authoring operations (deletion and visibility)

Normative mapping from author intent to operation (asset root details in [AGENT.reference-lists.md#asset-root--_toplevel](./foundations/ReferenceList/AGENT.reference-lists.md#asset-root--_toplevel)):

| Author intent | Operation |
| --- | --- |
| Create / import local body | **Materialize** + associate at chosen site |
| See at asset root | **Display union** ([`topLevelDisplayAdapter`](./foundations/ReferenceList/topLevelDisplayAdapter.ts)) |
| List on asset Components roster | **Pin** (`ref={1}` on `_topLevel`) |
| Stop roster listing | **Unpin** (site-local disassociate on `_topLevel` only) |
| Remove one parent's link | **Disassociate** + [`confirmSiteDisassociateBefore*`](./foundations/consistency/AGENT.md#confirmsitedisassociatebeforelocaledit) |
| Remove from this asset's edit data | **Purge** (`removeComponent` via [`purgeComponentFromAssetFlow`](./foundations/consistency/purgeComponentFromAssetFlow.ts)) |

**Example:** A Room in two Areas, visible at asset via display union --- remove from both Areas and the body **remains** until **Purge**.

---

## Asset-meta editing session

The asset root ([`WorkbenchAssetEditForm`](./WorkbenchAssetEditForm.tsx)) uses the **same two-tier model** as component editors: a **working** asset-meta projection in React state and **debounced `updateLocal`** flush to Redux, not ad hoc per-field `updateStandard` or mixed debounce paths.

[`AssetEditForm`](./WorkbenchAssetEditForm.tsx) and [`TopLevelEditor`](./foundations/ReferenceList/TopLevelEditor.tsx) use **`useWorkbenchAssetMeta`** / **`WorkbenchAssetMetaProvider`** and **`applyAssetMetaFlush`** ([`foundations/WorkbenchAssetMeta/`](./foundations/WorkbenchAssetMeta/), [`foundations/consistency/`](./foundations/consistency/)): [`WorkbenchAssetShortNameField`](./foundations/WorkbenchAssetMeta/WorkbenchAssetShortNameField.tsx), [`WorkbenchAssetSummaryField`](./foundations/WorkbenchAssetMeta/WorkbenchAssetSummaryField.tsx), TopLevel list on **`working.topLevel`**: row **remove** via **`confirmSiteDisassociateBeforeAssetMetaDisassociate`**; row **purge** via **`purgeComponentFromAssetFlow`**.

### Two tiers

| Tier | What | Cost | When |
| --- | --- | --- | --- |
| **Working copy** | Asset-meta projection (`_shortName`, `_summary`, `_topLevel`) from **`useWorkbenchAssetMeta`** | Clone/mutate asset-meta fields on working | Every change via **`updateAssetMeta`** |
| **Committed copy** | `standardForm.shortName`, `summary`, `_topLevel` from **`useWorkbenchAsset`** | Asset `standardForm._clone()` + diff + merge into `edit` | Debounced **`flushToStandardForm`** (~1000ms default), plus **`flushNow`** on unmount |

```text
User edit -> updateAssetMeta (mutate working shortName / summary / topLevel) -> UI reads working.*
  ... debounce ...
  -> flushToStandardForm -> updateLocal + applyAssetMetaFlush on local draft clone
```

**Per-asset debounce (not per-field):** one flush batches ShortName, Summary, and `_topLevel` edits on the asset root.

### Session API ([`foundations/WorkbenchAssetMeta/`](./foundations/WorkbenchAssetMeta/))

Module home: **`foundations/WorkbenchAssetMeta/`**, mirroring [`WorkbenchComponent/`](./foundations/WorkbenchComponent/). Reconcile helpers: [`reconcileCommittedAssetMeta`](./foundations/workbenchMutations.ts).

- **State:** `working` (editor copy), `lastReceived` (reconcile baseline), `committed` (live Redux asset-meta view).
- **`updateAssetMeta`:** immediate working mutate; resets debounce timer.
- **`flushToStandardForm`:** debounced persist via **`updateLocal`** and [`applyAssetMetaFlush`](./foundations/consistency/AGENT.md#applyassetmetaflush) (assign **`_shortName`**, **`_summary`**, **`_topLevel`** from working only). **No** materialize or orphan GC in flush.
- **`flushNow`:** cancel pending debounce and flush immediately; runs on provider unmount.
- **Create/import:** **`await materializeComponentInAsset`** on the Redux local draft, then associate on **`working._topLevel`** (same as [`ReferenceListSessionEditor`](./foundations/ReferenceList/ReferenceListSessionEditor.tsx) on a component parent).
- **Top-level list:** **display union** (merged organization + pins on **`working.topLevel`**); **Pin** / **Unpin** / **Purge** per row kind; see [AGENT.reference-lists.md](./foundations/ReferenceList/AGENT.reference-lists.md#asset-root--_toplevel).
- **List row Unpin:** disassociate on **`working._topLevel`** + debounced flush; **never** `removeComponent` for list rows.
- **Reconcile:** mirror **`useWorkbenchComponent`** --- `lastReceived` / `committed` / supersede when Redux changes without local edits; eager materialize of a **new** key must not supersede open asset-meta **`working`** when committed asset-meta is unchanged.

### Session-bound fields

- **ShortName / Summary:** [`WorkbenchAssetShortNameField`](./foundations/WorkbenchAssetMeta/WorkbenchAssetShortNameField.tsx), [`WorkbenchAssetSummaryField`](./foundations/WorkbenchAssetMeta/WorkbenchAssetSummaryField.tsx) with **`debounce={false}`** on primitives so only the asset-meta session debounces flush.
- **Top-level component list:** [`TopLevelEditor`](./foundations/ReferenceList/TopLevelEditor.tsx) --- display union + Pin/Unpin/Purge; create/import/reference-existing **pin** on **`working.topLevel`** after **`materializeComponentInAsset`**. See [AGENT.reference-lists.md](./foundations/ReferenceList/AGENT.reference-lists.md#asset-root--_toplevel).

---

## Asset-level `updateStandard` (exceptions)

Use asset-level paths when there is no parent session or domain topology requires immediate draft surgery. Do not add per-keystroke `updateStandard` on provider screens for fields that belong on **`working`** (component or asset-meta).

| Area | Pattern |
| --- | --- |
| Area exit topology | `ExitEdgeListEditor` + `areaEditMutations` |
| Room exits | `ExitEditor` |
| Layered Room situation facets | `SituationFacetRenderFieldsEditor` (asset-mode per change) |
| Character, Situation, Map editors | Not on component session yet |
| Asset-mode reference list | `ReferenceListEditor` (`listContext` + `updateStandard`) |

---

## Core Purpose

### Primary Function

Provide a form-based, component-centric editing experience for WML assets that:
- Uses Redux state for within-asset navigation instead of React Router
- Renders structured editors for Rooms, Areas, Features, Knowledge, Lenses, Marks, Maps, Situations, and Characters
- Supports rich text editing (`StandardRender`) and literal editing (`StandardLiteral`) through shared editor components

### Key Responsibilities

- **Navigation**: Maintain breadcrumb stack and route to asset, component, or component-layer views
- **Data Binding**: Connect `StandardForm` (from `personalAssets` slice) to form controls via `useWorkbenchAsset`; component editor sessions add a working `StandardComponent` copy via `useWorkbenchComponent` ([two-tier model](#component-editing-session-two-tier-model)); asset root editing uses **`useWorkbenchAssetMeta`** ([asset-meta session](#asset-meta-editing-session))
- **Reference List Management**: Add/remove/reorder components in reference lists (Features, Guidance, Exits, Lenses, Marks)
- **Read-only for non-Draft assets**: Enforce via `readonly` from `useWorkbenchAsset`

---

## Technical Details

### Data Structures

**Workbench State** ([`src/slices/UI/workbench/index.ts`](../../slices/UI/workbench/index.ts)):
```typescript
interface WorkbenchState {
    open: boolean;
    authoringMode: 'play' | 'authoring';
    currentAssetId: AssetUUID | null;
    secondaryContext: string | null;
    breadcrumbStack: WorkbenchBreadcrumbEntry[];
}

type WorkbenchBreadcrumbEntry = {
    id: string;
    kind: 'component' | 'componentLayer';
    componentId: string | null;
}
```

**ReferenceListItem** (`foundations/ReferenceList/ReferenceListEditor.tsx`):
```typescript
{ id: string; title: string; subtitle?: string; icon?: ReactNode }
```

**referenceListAdapter** (`foundations/ReferenceList/referenceListAdapter.ts`): Converts WML `ReferenceList` + `StandardForm` + optional `tag` into `ReferenceListItem[]`.

### Core Methods

- **`useWorkbenchAsset()`**: Hook providing `standardForm`, `updateStandard`, `readonly`, and other asset context; derives `AssetId` from workbench Redux state
- **`WorkbenchComponentProvider`** / **`useWorkbenchComponent()`**: Component editing session for one `componentId`. See [Component editing session](#component-editing-session-two-tier-model).
- **`WorkbenchAssetMetaProvider`** / **`useWorkbenchAssetMeta()`**: Asset-meta editing session for asset root ShortName, Summary, and `_topLevel`. See [Asset-meta editing session](#asset-meta-editing-session).
- **`navigateToComponent(componentId)`**: Sets breadcrumb stack to a single component entry
- **`pushBreadcrumb(entry)`**: Pushes a component entry (e.g. when navigating to an Example or Guidance from Room)
- **`replaceTopBreadcrumb(newComponentId)`**: Replaces the top of the stack (e.g. when switching tabs in LayeredContextView)
- **`navigateViaBreadcrumbIndex(index)`**: Pops to a given breadcrumb index (index 0 = asset root)
- **`referenceListToItems({ referenceList, standardForm, tag })`**: Adapter for reference lists to list items

### Configuration

- **Workbench Theme** (`workbenchTheme.ts`): `createWorkbenchTheme(baseTheme)` extends MUI theme for distinctive Workbench appearance
- **Responsive Layout**: Desktop (min-width 1200px, landscape) uses right-side Drawer (~600px); smaller viewports use full-screen Dialog/Drawer

---

## Integration Points

### Dependencies

- **personalAssets Slice**: Asset loading, `StandardForm` data, `updateStandard` reducer, `getStatus`, `getAssetZone`. Workbench batches per-component edits via session flush; reducer diff semantics are unchanged ([`personalAssets/AGENT.md`](../../slices/personalAssets/AGENT.md)).
- **workbench Slice** ([`src/slices/UI/workbench/`](../../slices/UI/workbench/)): Navigation state, `currentAssetId`, breadcrumb stack, selectors (`getCurrentView`, `getCurrentComponentId`, `getCurrentComponentLayerId`, `getNavigationTrail`)
- **cacheDB**: Persists `CurrentAssetId` via `putWorkbenchSettings` / `loadWorkbenchSettings`
- **WML Standardize** ([`packages/mtw-wml/ts/standardize/`](../../../../packages/mtw-wml/ts/standardize/AGENT.md)): `StandardForm`, `StandardComponent`, `StandardRoom`, `StandardFeature`, `StandardSituation`, `StandardLens`, `StandardMark`, `StandardRender`, `StandardLiteral`, `ReferenceList`

### Cross-References

- **Client Architecture**: [`charcoal-client/AGENT.md`](../../../AGENT.md) - Authoring vs Playing modes, Library vs Workbench
- **Standard Form**: [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md) - Asset structure, merge/diff/subset
- **Standard Components**: [`packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.md) - Room, Feature, Example, Lens, Mark
- **Examples Cache**: [`lambda/ephemera/internalCache/examples.AGENT.md`](../../../../lambda/ephemera/internalCache/examples.AGENT.md) - Backend example storage and future vision

### API Contracts

- **useWorkbenchAsset**: Returns `{ assetKey, AssetId, standardForm, localStandardForm, inheritedStandardForm, updateStandard, readonly, ... }`; matches `LibraryAssetContext` interface for migration compatibility (excludes removed currentWML/draftWML)
- **updateStandard(UpdateStandardPayload)**: Dispatches to `personalAssets`; triggers `setIntent` and `heartbeat` for persistence

### System Relationships

- **AppLayout**: Renders `WorkbenchContainer` with `open`, `onClose`, `assetId`, `secondaryContext`; controls workbench visibility
- **WorkbenchAssetEditor**: Orchestrates view routing based on `getCurrentView`, `getCurrentComponentId`, `getCurrentComponentLayerId`; delegates to `AssetEditForm`, `AreaEditor`, `RoomEditor`, `FeatureEditor`, `KnowledgeEditor`, `LayeredContextView` (Room Situation/Guidance tabs), `GuidanceEditor`, `MarkEditor`, `LensDetail`, `MapEditor`, `CharacterEditor`

---

## Usage Patterns

### Authoring Workflow

```typescript
// 1. Open workbench and set asset
dispatch(openWorkbench())
dispatch(setCurrentAssetId(assetId))

// 2. Navigate to a component
dispatch(navigateToComponent('ROOM#room-uuid'))

// 3. Edit via useWorkbenchAsset (prefer WorkbenchComponentProvider + WorkbenchShortNameField for shortName)
const { updateStandard, standardForm, readonly } = useWorkbenchAsset()
updateStandard({
    type: 'update',
    update: (draft) => {
        const room = draft.byUniversalId['ROOM#room-uuid']
        if (room instanceof StandardRoom) {
            draft.byUniversalId['ROOM#room-uuid'] = room.withShortName(
                new StandardLiteral('Updated Name', { tag: 'ShortName' })
            )
        }
        return draft
    }
})

// 4. Navigate to component layer (e.g., Example)
dispatch(pushBreadcrumb({ id: exampleId, kind: 'component', componentId: exampleId }))
```

### Reference List Editing

Room, Feature, and Knowledge display prose use **Situation** facets (`situations` on the parent) and ephemera **`render`** payloads, not legacy **`examples`** reference lists (see [`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md)). **FeatureEditor** and **KnowledgeEditor** edit DEFAULT facet prose inline via **`DefaultRenderEditor`** (no Examples list).

```typescript
// DEFAULT situation facet prose (Feature, Knowledge, or Room) -- requires WorkbenchComponentProvider
<DefaultRenderEditor />

// Reference lists on WorkbenchComponentProvider screens (Room Guidance, Room Features)
<ReferenceListSessionEditor title="Guidance" listAccessor={roomGuidanceListAccessor} tag="Guidance" onItemClick={...} />

// Area position-graph participants (per tag) -- same session pattern as Room lists
<ReferenceListSessionEditor title="Rooms" listAccessor={areaPositionGraphNodesTagAccessor('Room')} tag="Room" />

// Facet lists on WorkbenchComponentProvider screens (Lens marks, Guidance marks)
// See AGENT.facet-list.md -- FacetListSessionEditor + facetListAccessor + renderFacetRow
```

### Rich Text Editing

`StandardRenderEditor` and `MarkEditor` use Slate for rich text; `StandardLiteralEditor` for plain text. Both integrate with `updateStandard` and `useDebouncedOnChange` for persistence when used outside a component session. Under `WorkbenchComponentProvider`, use **`debounce={false}`** on literal editors (or **`WorkbenchShortNameField`**) so only the session debounces flush to Redux.

### Best Practices

- Use `useWorkbenchAsset` instead of `useLibraryAsset` when in Workbench context
- Resolve components via `standardForm.byUniversalId[id]` and use `instanceof` checks (e.g. `StandardRoom`, `StandardFeature`)
- Prefer `referenceListToItems` for consistent list display across Features, Guidance, Lenses, Marks
- **`ComponentSelectorDialog`**: Does not list **Example** components (D4); use **Situation** for world-state entities. List labels use [`componentDisplayLabel`](../../lib/componentDisplayLabel.ts) (shortName, Character displayName, key, Situation marks-summary). Platform field semantics: [mtw-wml shortName contract](../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md#shortname-platform-contract).
- Handle `readonly` from `useWorkbenchAsset` before allowing edits (non-Draft assets)

### Error Handling

- `useWorkbenchAsset` returns uninitialized values when `currentAssetId` is null; `AssetId` becomes `'ASSET#uninitialized'`
- Loading state: `WorkbenchAssetEditor` shows `CircularProgress` until asset status is `FRESH` or `SCHEMADIRTY`

---

## Navigation Tips

### Getting Started

1. **Workbench Flow**: Start at [`WorkbenchContainer.tsx`](./WorkbenchContainer.tsx) for layout and breadcrumb header; then [`WorkbenchAssetEditor.tsx`](./WorkbenchAssetEditor.tsx) for view routing
2. **Asset Context**: Read [`foundations/useWorkbenchAsset.ts`](./foundations/useWorkbenchAsset.ts) to understand how asset data flows from `personalAssets` into Workbench components
3. **Navigation State**: Read [`src/slices/UI/workbench/index.ts`](../../slices/UI/workbench/index.ts) for breadcrumb model and selectors
4. **Component Editing**: One editor per component type under `{Component}Edit`. Session-wrapped editors and asset-level exceptions are listed in [Component editing session](#component-editing-session-two-tier-model), [Asset-meta editing session](#asset-meta-editing-session), and the Key Files table below. **GuidanceEditor** resolves `getCurrentComponentLayerId ?? getCurrentComponentId` for layered Room tabs.

### Key Files

| File / Directory | Purpose |
|------------------|---------|
| `WorkbenchContainer.tsx` | Responsive layout, breadcrumbs, AssetSelector, theme |
| `WorkbenchAssetEditor.tsx` | View routing (asset / component / componentLayer) |
| `WorkbenchAssetEditForm.tsx` | Asset root: **`WorkbenchAssetMetaProvider`**, ShortName/Summary session fields, **`TopLevelEditor`** |
| `AreaEdit/` | AreaEditor (`WorkbenchComponentProvider` + shortName; PositionGraphNodesEditor session reference lists; ExitEdgeListEditor) |
| `RoomEdit/` | RoomEditor (component session for shortName; ExitEditor, FeatureListEditor, Lens via LensEdit/LensHeader, **`RoomSituationsListEditor`** for non-DEFAULT situations) |
| `FeatureEdit/` | FeatureEditor (component session; shortName + DEFAULT prose via session fields) |
| `KnowledgeEdit/` | KnowledgeEditor (component session; shortName + DEFAULT prose via session fields) |
| `foundations/WorkbenchComponent/WorkbenchShortNameField.tsx` | Context-only shortName field (`useWorkbenchComponent` session) |
| `foundations/DefaultRenderEditor.tsx` | Context-only DEFAULT situation facet prose (Room, Feature, Knowledge); session `working` + `updateComponent` |
| `RoomEdit/roomReferenceListAccessors.ts` | Room Guidance/Features `listAccessor` for `ReferenceListSessionEditor` |
| `AreaEdit/areaPositionGraphNodesAccessors.ts` | Per-tag `positionGraph.nodes` slice accessors for `ReferenceListSessionEditor` |
| `foundations/ReferenceList/ReferenceListControlled.tsx` | Composable shell: `referenceList` + `onReferenceListChange` |
| `foundations/ReferenceList/ReferenceListSessionEditor.tsx` | Provider-screen wrapper over Controlled; `listAccessor` + session persist |
| `foundations/ReferenceList/ReferenceListEditor.tsx` | Asset-mode thin wrapper over Controlled (`listContext` + `updateStandard`) |
| `foundations/ReferenceList/TopLevelEditor.tsx` | Asset root component list (asset-meta session, eager materialize, site-local disassociate confirm, Purge) |
| `foundations/ReferenceList/referenceListMutations.ts` | List remove by ComponentUUID via `sameKey` |
| `foundations/FacetList/FacetListSessionEditor.tsx` | Provider-screen facet list shell (mirrors `ReferenceListSessionEditor`) |
| `foundations/SituationFacetRenderFieldsEditor.tsx` | Asset-mode facet field editor (layered Room situations); `updateStandard` per change |
| `foundations/SituationFacetRenderFieldsView.tsx` | Shared presentation for DEFAULT / situation facet prose fields |
| ~~`ExampleEdit/`~~ | **Removed** (2026-05-19); F/K prose via **`DefaultRenderEditor`** |
| `GuidanceEdit/` | GuidanceEditor (`WorkbenchComponentProvider`; layered + top-level; shortName, instructions; marks via **`MarkFacetsEditor`** + **`markFacetAccessors`**) |
| `MarkFacetsEditor/` | Guidance session marks (`FacetListSessionEditor`); controlled path for asset-mode **`SituationEditor`** |
| `foundations/LayeredContext/` | LayeredContextView (Room Situation/Guidance tabs), LayeredTabs |
| `LensEdit/` | LensDetail (component session: shortName, description); **`LensMarkFacetsEditor`** + **`lensMarkFacetAccessors`** via **`FacetListSessionEditor`**; **`LensHeader`** (Room **`_lens`** session create/import/reference/remove) |
| `WMLComponentHeader.tsx` | **Deprecated** --- unused Library migration artifact; not mounted. Do not import. |
| `MarkEdit/` | MarkEditor (full-screen session); `MarkInlineEditor` + `MarkInlineEditorWithSession` (per-row Mark shortName; Lens mark facet rows) |
| `MapEdit/` | MapEditor, MapArea, MapController, MapLayers, UnshownRooms |
| `CharacterEdit/` | CharacterEditor |
| `foundations/StandardRender/StandardRenderEditor.tsx` | Rich text (Slate); shared with Editor components |
| `foundations/ReferenceList/referenceListAdapter.ts` | `referenceListToItems` for list display |
| `foundations/consistency/` | Pure TS + Redux thunk: **`materializeComponent`**, **`materializeComponentInAsset`**, **`applyWorkbenchFlush`**, **`applyAssetMetaFlush`**, **`confirmSiteDisassociateBefore*`**, **`purgeComponentFromAssetFlow`**, **`previewPurgeClosure`** |

### Component identity (client)

When wiring list rows, navigation, `byUniversalId`, or reference remove/match in charcoal-client (especially Workbench):

| Use case | Rule |
| --- | --- |
| List row `id`, breadcrumb / `navigateToComponent`, `byUniversalId[...]` | **`ComponentUUID`** = `ref.universalKey` only. Throw or skip the row when missing (see [`referenceListAdapter.ts`](./foundations/ReferenceList/referenceListAdapter.ts)). |
| Remove or find a row in a `ReferenceList` | `new StandardReference(id)` + **`sameKey`** ([`referenceListMutations.ts`](./foundations/ReferenceList/referenceListMutations.ts)); never `universalKey === id \|\| ref.key === id`. |
| Human-readable labels | [`componentDisplayLabel`](../../lib/componentDisplayLabel.ts) or a parent-provided display name (e.g. `referenceDisplayName`). Do not chain `ref.key` / `ref.universalKey` as label fallbacks. |
| WML semantics | [`packages/mtw-wml/.../AGENT.implementation.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (`universalKey`); list UI: [AGENT.reference-lists.md](./foundations/ReferenceList/AGENT.reference-lists.md). |

Playing-mode exit chips ([`Message/RoomExit`](../Message/RoomExit.tsx), map ephemera) navigate only when `exit.reference.universalKey` is a valid ephemera room id.

### Related Documentation

- [foundations/consistency/AGENT.md](./foundations/consistency/AGENT.md) - Materialize, flush assign, site-local confirm, Purge
- [AGENT.reference-lists.md](./foundations/ReferenceList/AGENT.reference-lists.md) - `ReferenceListControlled`, session vs asset wrappers, `InlineReferenceList`, Mark inline pattern
- [AGENT.facet-list.md](./foundations/FacetList/AGENT.facet-list.md) - Facet list handlers, Lens mark hybrid rows
- [AGENT.layered-context-patterns.md](./foundations/LayeredContext/AGENT.layered-context-patterns.md) - Layer strip, index bar, split-pane, MUI Tabs; Room layered views
- [charcoal-client/AGENT.testing.slate.md](../../../AGENT.testing.slate.md) - Slate/rich text testing if modifying StandardRenderEditor

---

## Development Notes

### Current State

- **Form-Based Editing**: Primary path for WML authoring in overlay context
- **Breadcrumb Navigation**: Redux-driven; no React Router within Workbench
- **Responsive**: Drawer on desktop, full-screen on mobile
- **Reference Lists**: `ReferenceListEditor` and `InlineReferenceList` with adapter
- **Layered Room contexts**: `LayeredTabs` (MUI Tabs) for non-DEFAULT Situation facets and Guidance on Room
- **Read-only for non-Draft assets**: Enforced via `readonly` from `useWorkbenchAsset`
- **Room runtime-state affordance**: `RoomEdit/RoomStateAffordance.tsx` is rendered from `RoomEditor` when `hasLens` is true; it uses the drop-in API `<RoomStateAffordance RoomId={roomId} />`, resolves Room/Lens/mark data via `useWorkbenchAsset`, validates outbound `markState` with `isEphemeraCacheMarkState`, and sends ack-only updates through `sendRoomEphemeraStateChange` (no live read-back subscription in this iteration)

### Future Plans

- Chat-based editing integration (Workbench designed to accommodate multiple content types)
- Live editing indicators and collaborative editing (foundation via WebSocket)
- Additional "layer-like" sibling groups (Lenses, Marks) using layered-context pattern

### Technical Debt

- **RoomEdit/ExitEditor**: May need further review for error handling, UX, accessibility (see [charcoal-client/AGENT.md](../../AGENT.md) Technical Debt)
- **Component Complexity**: Some components mix layout, navigation, and editing concerns
- **Testing Coverage**: Expand tests for Workbench components; follow [AGENT.testing.md](../../AGENT.testing.md) for Vitest patterns. For `useWorkbenchComponent` session tests, import from [`foundations/WorkbenchComponent/testing/harness.tsx`](./foundations/WorkbenchComponent/testing/harness.tsx) (and [`testing/mock.ts`](./foundations/WorkbenchComponent/testing/mock.ts) for `seedWorkbenchAsset` / `updateStandardMock`); do not import test utilities from the production barrel.
- **Non-Workbench authoring paths**: Maps, Library route editors, and other legacy `updateStandard` call sites outside the Workbench consistency layer; see [consistency AGENT.md](./foundations/consistency/AGENT.md) for Workbench norms.
