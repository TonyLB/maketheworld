# Library Deprecation Assessment

**Date**: January 29, 2026  
**Context**: Post Phase 2 (authoring workbench). Legacy Library-edit is reachable only via `/Explore` → Library. Assessing whether we can deprecate and remove Library-edit without losing functionality or breaking the workbench.

---

## 1. Have we replicated all Library edit functionality (except direct WML)?

**Yes.** The workbench replicates all Library edit surfaces except raw WML editing.

| Library surface | Workbench equivalent | Notes |
|-----------------|----------------------|--------|
| **EditAsset** (asset-level form) | **WorkbenchAssetEditForm** | ShortName, Summary, component list, add component, imports; uses `useWorkbenchAsset`. |
| **WMLComponentDetail** (Room/Feature/Knowledge) | **WorkbenchComponentDetail** | Component-level editing; state-based navigation. |
| **EditCharacter** | **WorkbenchCharacterEditor** | Character editing; Cards-based UI. |
| **MapEdit** (Map component) | **WorkbenchMapEditor** | Map editing; uses Workbench MapController/MapArea/MapLayers + `useWorkbenchAsset`. |
| **WMLEdit** | *(none)* | Raw WML source (Slate). Explicitly out of scope per planning; only in Library. |

**Conclusion**: All structured editing (asset form, components, character, map) is in the workbench. The only unreplicated surface is **direct WML display/edit** (WMLEdit), which you have already excluded from scope.

---

## 2. Is MapEdit independent of Library so we can remove Library without breaking workbench maps?

**Yes.** Map editing in the workbench does not depend on Library or on the legacy `MapEdit` component.

- **Legacy path (Library only)**  
  - Route: `EditAsset` → `LibraryAsset` → `Route path={'Map/:MapId'} element={<MapEdit />}`.  
  - `MapEdit` (`Maps/Edit/index.tsx`) uses **`useLibraryAsset`** and is only rendered under that route.  
  - It uses: `Maps/Controller`, `Maps/Edit/Area` (MapArea), `Maps/Edit/MapLayers` — all of which use **`useLibraryAsset`**.

- **Workbench path**  
  - `WorkbenchAssetEditor` → `WorkbenchMapEditor` (when component is a Map).  
  - `WorkbenchMapEditor` uses **`useWorkbenchAsset`** and workbench-specific components:  
    - **Workbench** `MapController.tsx` (uses `useWorkbenchAsset`, re-exports MapContext from `Maps/Controller`).  
    - **Workbench** `MapArea.tsx` (uses `useWorkbenchAsset` + `useMapContext`).  
    - **Workbench** `MapLayers.tsx` (workbench version).  
  - It also uses shared **Maps** pieces that do **not** import Library:  
    - `Maps/Edit/useMapStyles`, `Maps/Edit/Area/ToolSelect`, `Maps/Edit/Area/MapDisplay`, `Maps/Controller` (baseClasses, addExit, addRoom, MapContext), `Maps/Edit/MapDThree`, `Maps/Edit/MapLayers/RenameIcon`, `Maps/exitExtraction`.

So:

- **Workbench map editing** = WorkbenchMapEditor + Workbench MapController/MapArea/MapLayers + shared Maps building blocks. No dependency on Library or `MapEdit`.
- **Library map editing** = MapEdit + LibraryAsset-backed Maps/Edit components. Only used when visiting `/Library/Edit/Asset/:AssetId/...` and navigating to a map.

Removing Library (and the EditAsset route) would remove the only consumer of `MapEdit` and the Library-coupled `Maps/Edit` Area/MapLayers. Those can be deleted; the shared Maps modules used by the workbench stay and remain sufficient for workbench map editing.

**Caveat**: **Maps/View** (play-spine map view) currently links into Library for editing:

- `Maps/View/index.tsx` (around line 92) does `navigate(\`/Library/Edit/Asset/${draftAssetKey}/Map/${key}\`)` for the “import and edit map” flow.
- Before removing Library, that flow must be changed to open the **workbench** with the same asset and map (e.g. set `currentAssetId`, `currentView`, `currentComponentId` and open the workbench) instead of navigating to the Library edit URL.

---

## 3. Dependencies from authoring workbench into the legacy (Library) system

The workbench currently imports from Library in these places:

| Consumer | Import from Library | Purpose |
|----------|---------------------|--------|
| **WorkbenchAssetEditForm** | `Library/Edit/ImageHeader` | Image header UI |
| **Workbench StandardRenderEditor** | `Library/Edit/baseClasses` (`isCustomBlock`) | Block type |
| **Workbench StandardRenderEditor** | `Library/Edit/StandardRenderEditor/` (`descendantsToRender`, `descendantsFromRender`, `components`, `constrainedWhitespace`) | Slate/render transform and presentational components |
| **Workbench StandardRenderEditor** | `Library/Edit/StandardFormContext` (`useStandardFormContext`) | Component key + tag context |
| **WorkbenchCharacterEditor** | `Library/FileInputWrapper` | File input wrapper |
| **Workbench WMLComponentHeader** | `Library/Edit/AssetDataHeader` | Asset data header |
| **Workbench LinkDialog** | `Library/Edit/baseClasses` (`CustomFeatureLinkElement`, `CustomKnowledgeLinkElement`) | Link element types |
| **Workbench ImageHeader** | `Library/Edit/AssetDataHeader`, `Library/FileInputWrapper` | Header + file input |
| **AssetSelector** | `Library/AssetCard` | Asset cards in selector |

So the workbench depends on:

- **Library/Edit**: `ImageHeader`, `AssetDataHeader`, `baseClasses` (custom block + link elements), `StandardFormContext`, and the **StandardRenderEditor** internals (descendantsToRender/FromRender, components, constrainedWhitespace).
- **Library (root)**: `AssetCard`, `FileInputWrapper`.

To deprecate/remove Library without breaking the workbench you have two options:

1. **Move shared pieces**  
   Move the above into a neutral location (e.g. `components/shared/` or a dedicated “editor primitives” area) so that:
   - The workbench (and any future code) imports from there.
   - Library-edit, if kept temporarily, could also import from there; then Library-edit can be removed once unused.

2. **Copy into workbench**  
   Copy the minimal needed code into the Workbench tree and then delete Library. Simpler for a one-way deprecation but duplicates logic (e.g. StandardRenderEditor, StandardFormContext).

**Recommendation**: Prefer (1) for `StandardFormContext`, `baseClasses`, `AssetDataHeader`, `FileInputWrapper`, and the StandardRenderEditor utilities/components — they are generic editor building blocks. Move them once, point Workbench (and any other consumers) at the new location, then remove Library-edit. `AssetCard` and `ImageHeader` can either be moved to the same shared area or inlined into Workbench if they are thin wrappers.

---

## 4. Other call sites and routes

- **AppLayout** still mounts Library routes and components:
  - `Library` at `/Library/`
  - `EditAsset` at `/Library/Edit/Asset/:AssetId/*`
  - `EditCharacter` at `/Library/Edit/Character/:AssetId/*`
- **Explore** only navigates to `/Library/` (and `/Knowledge/`); it does not render edit UI.
- **Maps/index.tsx** defines `MapHome` with a route `Edit/:mapId/` → `MapEdit`, but **MapHome is not mounted anywhere** in AppLayout; the only way to reach `MapEdit` is via EditAsset’s nested route `Map/:MapId`. So removing Library also removes the only path to `MapEdit`.

---

## 5. Summary and recommendations

| Question | Answer |
|----------|--------|
| **All Library edit (except WML) replicated in workbench?** | Yes. |
| **MapEdit independent of Library for workbench?** | Yes. Workbench map editing uses WorkbenchMapEditor + Workbench map components + shared Maps modules; no Library. |
| **Workbench → Library dependencies?** | Yes. Several Workbench components import from Library (AssetCard, ImageHeader, AssetDataHeader, FileInputWrapper, baseClasses, StandardFormContext, StandardRenderEditor internals). These must be moved or inlined before deleting Library. |

**Before removing Library:**

1. **Maps/View**  
   Replace the “import and edit map” navigation to `/Library/Edit/Asset/.../Map/...` with opening the workbench with the same asset and map (set workbench state and open workbench).

2. **Workbench → Library imports**  
   Move (or copy) the shared editor primitives used by the workbench into a non-Library module and switch Workbench imports to that module. Then remove Library-edit and, if unused, the rest of Library.

3. **AppLayout**  
   Remove routes and imports for `Library`, `EditAsset`, and `EditCharacter` once the above are done and any remaining entry points (e.g. Explore “Library” link) are updated to open the workbench or another replacement flow.

After that, you can deprecate and remove the Library-edit components (and the Library-only map path) without losing workbench functionality or breaking map editing in the authoring workbench.
