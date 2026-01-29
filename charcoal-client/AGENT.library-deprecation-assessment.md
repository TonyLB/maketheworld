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
| **WorkbenchCharacterEditor** | `Library/FileInputWrapper` | File input wrapper |
| **Workbench WMLComponentHeader** | `Library/Edit/AssetDataHeader` | Asset data header |
| **Workbench LinkDialog** | `Library/Edit/baseClasses` (`CustomFeatureLinkElement`, `CustomKnowledgeLinkElement`) | Link element types |
| **Workbench ImageHeader** | `Library/Edit/AssetDataHeader`, `Library/FileInputWrapper` | Header + file input |
| **AssetSelector** | `Library/AssetCard` | Asset cards in selector |

So the workbench depends on:

- **Library/Edit**: `ImageHeader`, `AssetDataHeader`, `baseClasses` (custom block + link elements), and the **StandardRenderEditor** internals (descendantsToRender/FromRender, components, constrainedWhitespace).
- **Library (root)**: `AssetCard`, `FileInputWrapper`.

**Resolved**: Workbench StandardRenderEditor no longer uses `Library/Edit/StandardFormContext` (`useStandardFormContext`). It was a bug (context was never provided in the workbench tree). Fixed by adding an optional `tag` prop to the editor and deriving the placeholder from it at call sites; see Jan 2026 fix.

To deprecate/remove Library without breaking the workbench you have two options:

1. **Move shared pieces**  
   Move the above into a neutral location (e.g. `components/shared/` or a dedicated “editor primitives” area) so that:
   - The workbench (and any future code) imports from there.
   - Library-edit, if kept temporarily, could also import from there; then Library-edit can be removed once unused.

2. **Copy into workbench**  
   Copy the minimal needed code into the Workbench tree and then delete Library. Simpler for a one-way deprecation but duplicates logic (e.g. StandardRenderEditor, StandardFormContext).

**Recommendation**: Prefer (1) for `baseClasses`, `AssetDataHeader`, `FileInputWrapper`, and the StandardRenderEditor utilities/components — they are generic editor building blocks. Move them once, point Workbench (and any other consumers) at the new location, then remove Library-edit. `AssetCard` and `ImageHeader` can either be moved to the same shared area or inlined into Workbench if they are thin wrappers.

---

## 4. Other call sites and routes

- **AppLayout** still mounts Library routes and components:
  - `Library` at `/Library/`
  - `EditAsset` at `/Library/Edit/Asset/:AssetId/*`
  - `EditCharacter` at `/Library/Edit/Character/:AssetId/*`
- **Explore** only navigates to `/Library/` (and `/Knowledge/`); it does not render edit UI.
- **Maps/index.tsx** defines `MapHome` with a route `Edit/:mapId/` → `MapEdit`, but **MapHome is not mounted anywhere** in AppLayout; the only way to reach `MapEdit` is via EditAsset’s nested route `Map/:MapId`. So removing Library also removes the only path to `MapEdit`.

---

## 5. Maps/View: play-spine surface, not authoring

**Maps/View** is the in-play map view: character-scoped, for providing spatial context during play. It is **not** an authoring page and does not belong to Library or the workbench.

### Current placement and routing

- **Route**: Mounted under **Character** in AppLayout: `/Character/:CharacterId/Map/` → `<MapView />` (inside `CharacterRouterSwitch` → `ActiveCharacter`). So it is already a **play-spine** surface.
- **Location**: Code lives under `components/Maps/View/` — i.e. as a sibling of `Maps/Edit/` (authoring) inside the same `Maps/` feature folder.
- **Data**: Uses `useActiveCharacter()` and character-scoped `maps`; renders with `MapDisplayController` + `MapArea` from `Maps/` in **view-only** mode (`editMode={false}`).
- **Coupling to authoring**: The only authoring touchpoint is the “Edit” affordance: it currently **navigates to Library** (`/Library/Edit/Asset/${draftAssetKey}/Map/${key}`) for “import and edit map.” That should be changed to open the **workbench** (per section 4).

So Maps/View is correctly **routed** as play-spine; the ambiguity is **structural**: it lives under **Maps/** alongside **Edit** (authoring), so one folder mixes “in-play viewing” and “map authoring.”

### Should Maps/View be its own separate sub-directory?

**Yes, it’s reasonable to give it its own surface.** That would make “play-spine map view” explicit and separate from “map authoring + shared rendering.”

- **Option A – Keep under Maps/View**  
  Leave structure as-is. Treat Maps/ as “all map-related UI” (View = play, Edit = authoring, Controller/Area = shared). Fix only the “Edit” action to open workbench instead of Library. Minimal change; the mix of modes stays in one folder.

- **Option B – Move to a dedicated play-spine surface**  
  Move the **page** that is “in-play map view” to its own top-level (or play-spine) directory, and keep **Maps/** for authoring + shared rendering only. For example:
  - **`components/MapView/`** (or **`components/PlaySpine/MapView/`**) – the screen at `/Character/:id/Map/`: pick map, show canvas, “Edit” opens workbench.
  - **`Maps/`** – shared map rendering (`Controller`, `Edit/Area`, `MapDThree`, etc.) and authoring-only entry points (e.g. what WorkbenchMapEditor uses). View would **import** from `Maps/` (e.g. `MapDisplayController`, `MapArea`) for the canvas, but the **page** and its character/play logic would live under MapView (or PlaySpine/MapView).

**Recommendation**: **Option B** if you want the directory layout to clearly separate play vs authoring: Maps/View is a play-spine surface and fits better as its own surface (e.g. `components/MapView/`) that uses Maps/ for rendering only. **Chosen: Option A** — keep Maps/View under Maps/, fix only the “Edit” action to open the workbench instead of Library (done Jan 2026). Full Map system revamp deferred.

### Summary

| Aspect | Current | Note |
|--------|--------|------|
| **Conceptually** | In-play map view | Correct; not Library or workbench. |
| **Routed** | Under Character (`/Character/:id/Map/`) | Correct; play-spine. |
| **Lives under** | `Maps/View/` next to `Maps/Edit/` | Mixes play surface with authoring in one feature folder. |
| **Uses Maps/** | MapDisplayController, MapArea from Maps/ | Shared rendering; would remain as imports if View moves. |
| **“Edit” action** | Navigates to Library | Should open workbench instead (see section 4). |

So: Maps/View is **not** in Library or workbench; it’s a play-spine page. Giving it its own sub-directory (e.g. `MapView/` or `PlaySpine/MapView/`) is a good way to make that explicit and keep Maps/ focused on shared rendering and authoring.

---

## 6. Summary and recommendations

| Question | Answer |
|----------|--------|
| **All Library edit (except WML) replicated in workbench?** | Yes. |
| **MapEdit independent of Library for workbench?** | Yes. Workbench map editing uses WorkbenchMapEditor + Workbench map components + shared Maps modules; no Library. |
| **Workbench → Library dependencies?** | Yes. Several Workbench components import from Library (AssetCard, ImageHeader, AssetDataHeader, FileInputWrapper, baseClasses, StandardRenderEditor internals). StandardFormContext has been removed (fixed Jan 2026). Remaining imports must be moved or inlined before deleting Library. |
| **Maps/View in Library or workbench?** | No. Maps/View is in-play (play-spine), routed under Character. Optionally move it to its own surface (e.g. `MapView/`) so Maps/ is authoring + shared rendering only; see section 5. |

**Before removing Library:**

1. **Maps/View “Edit” action**  
   ~~Replace the “import and edit map” navigation to `/Library/Edit/Asset/.../Map/...` with opening the workbench with the same asset and map (set workbench state and open workbench).~~ **Done (Jan 2026).** Maps/View now opens the workbench with the selected asset and map (setCurrentAssetId, setBreadcrumbStack, openWorkbench, putWorkbenchSettings) instead of navigating to Library.

2. **Workbench → Library imports**  
   Move (or copy) the shared editor primitives used by the workbench into a non-Library module and switch Workbench imports to that module. Then remove Library-edit and, if unused, the rest of Library.

3. **AppLayout**  
   Remove routes and imports for `Library`, `EditAsset`, and `EditCharacter` once the above are done and any remaining entry points (e.g. Explore “Library” link) are updated to open the workbench or another replacement flow.

After that, you can deprecate and remove the Library-edit components (and the Library-only map path) without losing workbench functionality or breaking map editing in the authoring workbench.
