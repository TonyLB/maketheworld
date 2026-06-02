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
- **StandardForm**: WML asset representation; the Workbench reads and mutates `StandardForm` via `updateStandard` from `useWorkbenchAsset`; per-component scalar editing uses a **working copy** via `useWorkbenchComponent` (see composition plan)

---

## Core Purpose

### Primary Function

Provide a form-based, component-centric editing experience for WML assets that:
- Uses Redux state for within-asset navigation instead of React Router
- Renders structured editors for Rooms, Areas, Features, Knowledge, Lenses, Marks, Maps, Situations, and Characters
- Supports rich text editing (`StandardRender`) and literal editing (`StandardLiteral`) through shared editor components

### Key Responsibilities

- **Navigation**: Maintain breadcrumb stack and route to asset, component, or component-layer views
- **Data Binding**: Connect `StandardForm` (from `personalAssets` slice) to form controls via `useWorkbenchAsset`; component editor sessions add a working `StandardComponent` copy via `useWorkbenchComponent` (two-tier model --- see composition plan)
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
- **`WorkbenchComponentProvider`** / **`useWorkbenchComponent()`** ([`foundations/WorkbenchComponent/`](./foundations/WorkbenchComponent/)): Component editing session --- holds `working`, `lastReceived`, and `committed` for one `componentId`; `updateComponent` mutates the working copy immediately; debounced flush to Redux is wired in a follow-on slice (see [`AGENT.workbenchComposition.planning.md`](../../../../taskPlanning/charcoal-client/src/components/Workbench/AGENT.workbenchComposition.planning.md))
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

- **personalAssets Slice**: Asset loading, `StandardForm` data, `updateStandard` reducer, `getStatus`, `getAssetZone`
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
- **WorkbenchAssetEditor**: Orchestrates view routing based on `getCurrentView`, `getCurrentComponentId`, `getCurrentComponentLayerId`; delegates to `AssetEditForm`, `AreaEditor`, `RoomEditor`, `FeatureEditor`, `KnowledgeEditor`, `LayeredContextView` (Room Situation/Guidance tabs), `MarkEditor`, `MapEditor`, `CharacterEditor`

---

## Usage Patterns

### Authoring Workflow

```typescript
// 1. Open workbench and set asset
dispatch(openWorkbench())
dispatch(setCurrentAssetId(assetId))

// 2. Navigate to a component
dispatch(navigateToComponent('ROOM#room-uuid'))

// 3. Edit via useWorkbenchAsset
const { updateStandard, standardForm, readonly } = useWorkbenchAsset()
updateStandard({
    type: 'update',
    update: (draft) => {
        const room = draft.byUniversalId['ROOM#room-uuid']
        if (room instanceof StandardRoom) {
            room._payload._shortName = new StandardLiteral('Updated Name')
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
// DEFAULT situation facet prose (Feature, Knowledge, or Room)
<DefaultRenderEditor parentId={universalKey} />

// Reference lists still used for Room Guidance, Room non-DEFAULT situations, Features in a Room, etc.
const items = referenceListToItems({ referenceList, standardForm, tag: 'Guidance' })
```

### Rich Text Editing

`StandardRenderEditor` and `MarkEditor` use Slate for rich text; `StandardLiteralEditor` for plain text. Both integrate with `updateStandard` and `useDebouncedOnChange` for persistence.

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
4. **Component Editing**: One editor per component type, each under its own `{Component}Edit` directory (e.g. `AreaEdit/AreaEditor.tsx`, `RoomEdit/RoomEditor.tsx`, `FeatureEdit/FeatureEditor.tsx`, `KnowledgeEdit/KnowledgeEditor.tsx`). **AreaEditor** edits `shortName`, heterogeneous **`positionGraph.nodes`** (Room / Feature / Character / Area participants), and uuid-keyed **`positionGraph.edges`** (`From` / `To` / `Forward` / `Back` per [D19/D29](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md)). RoomEditor composes `ExitEditor` (room-local facets --- **M6** removal), `LensHeader` (from LensEdit), `FeatureListEditor`, `DefaultRenderEditor`, situation list (non-DEFAULT), and Guidance; FeatureEditor and KnowledgeEditor show shortName + `DefaultRenderEditor` only.

### Key Files

| File / Directory | Purpose |
|------------------|---------|
| `WorkbenchContainer.tsx` | Responsive layout, breadcrumbs, AssetSelector, theme |
| `WorkbenchAssetEditor.tsx` | View routing (asset / component / componentLayer) |
| `WorkbenchAssetEditForm.tsx` | Asset-level metadata, component list, imports |
| `AreaEdit/` | AreaEditor, PositionGraphNodesEditor, ExitEdgeListEditor (D19 topology authoring) |
| `RoomEdit/` | RoomEditor, ExitEditor, FeatureListEditor (Lens via LensEdit/LensHeader) |
| `FeatureEdit/` | FeatureEditor (shortName + DefaultRenderEditor) |
| `KnowledgeEdit/` | KnowledgeEditor (shortName + DefaultRenderEditor) |
| `foundations/DefaultRenderEditor.tsx` | Inline DEFAULT situation facet prose (Room, Feature, Knowledge) |
| `foundations/SituationFacetRenderFieldsEditor.tsx` | Shared facet field editor (layered Room situations + DEFAULT inline) |
| ~~`ExampleEdit/`~~ | **Removed** (2026-05-19); F/K prose via **`DefaultRenderEditor`** |
| `foundations/LayeredContext/` | LayeredContextView (Room Situation/Guidance tabs), LayeredTabs |
| `MarkEdit/` | MarkEditor (full), InlineEditor (shortName only; used in LensMarkFacetsEditor) |
| `MapEdit/` | MapEditor, MapArea, MapController, MapLayers, UnshownRooms |
| `CharacterEdit/` | CharacterEditor |
| `foundations/StandardRender/StandardRenderEditor.tsx` | Rich text (Slate); shared with Editor components |
| `foundations/ReferenceList/referenceListAdapter.ts` | `referenceListToItems` for list display |

### Related Documentation

- [AGENT.reference-lists.md](./foundations/ReferenceList/AGENT.reference-lists.md) - `ReferenceListEditor` vs `InlineReferenceList`, `referenceListToItems`, Mark inline pattern
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
