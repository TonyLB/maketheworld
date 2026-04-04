# Chat Spine + Authoring Workbench - Strategic Planning Document

**Date**: January 24, 2026  
**Status**: STRATEGIC PLANNING  
**Related Documents**: 
- Handoff: [`src/ui_refactor_handoff_chat_spine_authoring_workbench.md`](src/ui_refactor_handoff_chat_spine_authoring_workbench.md)
- Client Architecture: [`AGENT.md`](AGENT.md)

---

## Overview

This document provides the strategic plan for refactoring the Charcoal Client UI to establish a **chat-focused play spine** as the primary system anchor, with an **authoring workbench** as a side-track overlay. This represents a deliberate architectural shift from feature-based navigation to a narrative-first, worldview-centered interface.

### Core Architectural Shift

**From**: Feature-based navigation with ad-hoc panels and competing primary modes  
**To**: Chat-focused play spine as the system anchor, with authoring as a clear side-track

### Design Axiom

> **The user edits assets while standing inside a worldview; visibility determines which worldviews experience those edits.**

This sentence should remain true as the system evolves.

### Success Criterion (Iteration 1)

> A single user can play, step aside to author, return to play, and immediately experience the results — all within a coherent chat-first UI.

---

## Current System State

### Existing UI Architecture

The current client implements a **dual-mode architecture** with clear separation between:

1. **Authoring Mode** (`/Library/` routes):
   - Asset browser and management
   - WML editing interfaces
   - Character creation tools
   - Map editors

2. **Playing Mode** (`/Character/:CharacterId/*` routes):
   - Character-scoped messaging interface
   - Character map views
   - Perception-filtered world information

### Current Navigation Patterns

- **Tab-based primary navigation**: Multiple competing surfaces (Library, Character, etc.)
- **Feature-specific panels**: Ad-hoc UI surfaces for different capabilities
- **Weak spatial orientation**: Users may not have clear sense of "where they are" in the system
- **Mode switching**: Explicit routing between authoring and playing contexts

### Current Character Selection

- **URL-based selection**: Character is determined by route parameter `/Character/:CharacterId/*`
- **No persistence**: Character selection is not stored across sessions
- **Settings infrastructure exists**: `clientSettings` table in IndexedDB already persists other preferences (TextEntryLines, ShowNeighborhoodHeaders, etc.)
- **Missing**: No `currentCharacterId` preference stored or loaded on app startup
- **Implication for refactor**: Play spine needs to know which character to render on initial load, requiring persistence mechanism

### Current Message System

The client already has:
- ✅ Message persistence system with dual-layer client/server storage
- ✅ IndexedDB caching for offline support
- ✅ Real-time WebSocket synchronization
- ✅ Message types: `SayMessage`, `NarrateMessage`, `OOCMessage`, `RoomDescription`, `FeatureDescription`, `KnowledgeDescription`
- ✅ Sticky room summary capability (mentioned in handoff)

### Current Asset Editing System

- ✅ WML editor with Slate-based rich text editing
- ✅ Asset workspace management
- ✅ Draft system with multi-draft support
- ✅ Import/export capabilities
- ✅ Component-level editing (Rooms, Features, Knowledge, Maps, Characters)

---

## Target Architecture

### Surface A: Play Spine (Always Present)

**Role**: System anchor and primary user surface

**Responsibilities**:
- Render exactly **one worldview** at a time
- Maintain scrolling transcript of story events
- Provide immediate experiential feedback for authored changes
- Display sticky room summary (exactly one, anchored at top, continuously updated)

**Message Types Supported**:
- World events ("Night falls")
- Character actions
- Dialogue (screenplay style)
- OOC comments
- Perception/knowledge messages
- Room descriptions (explicit look)
- Sticky room summary

**Constraints**:
- Must never show multiple worldviews simultaneously
- Must not surface asset mechanics directly
- Must maintain narrative immersion

**Layout**:
- Primary surface (full viewport or dominant panel)
- Sticky room summary at top
- Scrolling message transcript below

### Surface B: Authoring Workbench (Side-Track / Overlay)

**Role**: Non-chat editing surface opened from play spine

**Characteristics**:
- Edits exactly **one asset at a time**
- Clear "Return to Story" affordance
- Reusable container for future features (side-threads, deliberation, tutorials, collaboration)

**Layout**:
- Desktop: Side panel or overlay
- Mobile: Full-screen sheet

**Workbench Header** (Critical):
- **Asset name** (primary)
- **Visibility state** (informational only, not editable in iteration 1)
  - e.g., "Private draft"
- Optional secondary context:
  - e.g., "Viewed in: Current location"

**Key Principle**: Header must be asset-first, not worldview-first

### Entry Ritual (Play → Authoring)

**Intent**: Focus shift, not mode switch

**Requirements**:
1. Select an **asset** to work on
2. Establish (or confirm) the asset's **current visibility state**

**UI Language** (Iteration 1):
- Use: "Work on this place"
- Avoid: "Edit this room"

**Default Behavior**:
- Default to creating/opening asset in user's **private draft worldview**
- Do not require visibility choice UI yet (keeps loop tight)

### Exit Ritual (Authoring → Play)

**Intent**: Acknowledge authorship and resolve attention, not governance

**Correct Framing**:
- ❌ Do NOT ask: Where changes apply, which worldview to update, whether to publish
- ✅ DO: Restate asset's current visibility state, allow user to accept or defer to deeper configuration

**UI Shape** (Iteration 1):
```
You've made changes to {Asset Name}.

Current visibility: Private draft

- Looks good — return to the world
- Manage visibility… (stub / not implemented yet)
```

**Behavior**:
- "Manage visibility" may be disabled or informational
- Returning simply resumes the play spine

### Development Default: Draft Worldview

**Purpose**: Enable fast iteration without implementing full visibility management

**Agreed Defaults**:
- Each player has **one personal draft worldview**
- By default:
  - Any new or edited asset is included in that draft worldview
  - No other worldviews include those assets
- The play spine for the dev user can render:
  - Canon worldview + personal draft overlay, OR
  - Directly render the draft worldview

**UI Requirement**:
- Somewhere visible (placard or header): label the current view as **Draft**

---

## Strategic Phases

### Phase 1: Foundation - Play Spine Establishment ✅ **COMPLETED**

**Goal**: Establish chat-focused play spine as primary surface

**Key Tasks**:
1. **Implement current character persistence** ✅ **COMPLETED**
   - ✅ Added `currentCharacterId` to `ClientSettings` interface in `settings/index.ts`
   - ✅ Added `CurrentCharacterIdType` to `ClientSettingType` union in `cacheDB/index.ts`
   - ✅ Stored as `EphemeraCharacterId | null` (null if no character selected)
   - ✅ Load persisted character on app startup via existing `loadClientSettings`
   - ✅ Update stored character when user switches characters (via `putClientSettings`)
   - ✅ Use persisted character for initial play spine routing via `InitialCharacterNavigation` component in `AppLayout`
   - **Rationale**: Play spine needs to know which character's worldview to render on initial load
   - **Implementation Note**: Navigation logic placed in `InitialCharacterNavigation` component inside Router context to avoid `useNavigate()` context errors

2. **Refactor layout structure** ✅ **COMPLETED**
   - ✅ Created `PlaySpineRoot` component in `AppLayout` to conditionally render `MessagePanel` (wrapped in `ActiveCharacter`) or `CharacterSelectionModal`
   - ✅ Created `CharacterSelectionModal` component as modal overlay for character selection
   - ✅ Moved Library and Knowledge access to new `/Explore` placeholder route
   - ✅ Made chat messaging primary in root navigation path (`/`)
   - ✅ Added character selection button (person icon) in `MessagePanel` top-right corner
   - ✅ Implemented auto-selection: when only one character option exists (Guest or single character), automatically select it without showing modal
   - ✅ Preserved sticky room summary functionality (existing `MessagePanel` behavior)
   - ✅ Maintained existing message types and rendering (no changes to message rendering logic)
   - **Rationale**: Chat-focused play spine requires messaging to be the primary surface, with character selection as a secondary action
   - **Implementation Note**: Auto-selection logic in `PlaySpineRoot` checks `totalOptions === 1` and dispatches `putClientSettings` to select the single available character

3. **Remove tab-based primary navigation** ✅ **COMPLETED**
   - ✅ Removed `NavigationTabs` component from `AppLayout`
   - ✅ Updated grid layout to remove tabs area (landscape: `"content"` or `"content sidebar"`, portrait: `"content"`)
   - ✅ Removed all `useAutoPin` hook calls from components
   - ✅ Deleted `navigationTabs` slice (`slices/UI/navigationTabs/index.ts` and `useAutoPin.ts`)
   - ✅ Deleted `NavigationContext` component
   - ✅ Removed navigation tabs from store reducer
   - ✅ Removed test mocks for navigation tabs
   - ✅ Settings, Who, Onboarding remain accessible via direct routes
   - **Rationale**: Play spine should be the single, stable primary surface. Tab-based navigation competed with play spine for user attention.
   - **Implementation Note**: All routes remain functional via direct navigation. Components no longer auto-pin tabs when mounted.

4. **Wire draft worldview rendering** (UI Placeholder) ✅ **COMPLETED**
   - ✅ Added "Draft" label/placard in play spine UI (`DraftLabel` component)
   - ✅ Integrated into `LineEntry` component as `leftIcon` in `MessageComponent`, aligned vertically with input field
   - ✅ Sized appropriately: font size matches input field (`1rem`), `minWidth: 80px` to accommodate future select element
   - ✅ Added `LanguageIcon` from Material-UI icons to the left of "Draft" text
   - ✅ Documented placeholder nature in component comments and code
   - ✅ Styled with Typography (body1 variant) matching input field visual weight
   - ✅ Implementation: Created `src/components/Message/DraftLabel.tsx` and integrated into `LineEntry/index.tsx` with `leftGutter={100}`
   - **Note**: Play spine currently receives messages from backend based on player Authorization settings. Full draft worldview rendering requires backend changes to message crafting system. For Phase 1, we add UI indicator only. The label currently always displays "Draft" as a placeholder; future backend integration will make this conditional based on worldview state and convert it to a select/dropdown element for worldview switching.

**Success Criteria**:
- ✅ Current character selection persists across sessions
- ✅ App loads with correct character's play spine (or character selection if none stored)
- ✅ Character switching updates persisted selection
- ✅ Play spine is the primary surface users see (root path `/` shows chat interface)
- ✅ Character selection available via modal overlay (accessible from message panel or when no character selected)
- ✅ Auto-selection when only one character option exists (improves UX for single-character scenarios)
- ✅ Library and Knowledge moved to `/Explore` placeholder route
- ✅ Tab-based navigation removed (play spine is now single, stable primary surface)
- ✅ All routes remain accessible via direct navigation (Settings, Who, Onboarding, Library, etc.)
- ✅ One worldview rendered at a time (UI indicator added; full rendering requires backend refactor)
- ✅ Sticky room summary preserved and functional (existing `MessagePanel` behavior maintained)
- ✅ Draft worldview UI indicator added (integrated into LineEntry, aligned with input, includes LanguageIcon, UI placeholder only; full rendering requires backend refactor)
- ✅ All existing message types display properly (no changes to message rendering logic)

**Dependencies**: None (can start immediately)

**Risk Level**: Low-Medium (layout refactoring, but core functionality exists)

---

### Phase 2: Authoring Workbench - Side-Track Implementation

**Goal**: Create non-chat authoring workbench as overlay/side-panel

**Key Tasks**:
1. **Create workbench container** ✅ **COMPLETED**
   - ✅ Implemented overlay/panel/sheet layout (responsive: side panel on desktop, full-screen on mobile)
   - ✅ Designed reusable container structure for future features
   - ✅ Stored `currentAssetId` persistently in Redux state and IndexedDB (following `currentCharacterId` pattern)
   - ✅ Added `CurrentAssetIdType` to `cacheDB/index.ts` ClientSettingType union
   - ✅ Added `loadWorkbenchSettings()` and `putWorkbenchSettings()` thunks for persistence
   - ✅ Loaded persisted `currentAssetId` on app startup in `AppController`
   - ✅ Created `WorkbenchContainer` component with responsive Drawer (desktop) and Dialog (mobile) layouts
   - ✅ Created `WorkbenchContent` flexible wrapper component
   - ✅ Integrated workbench into `AppLayout` at viewport level (positioned relative to content grid area, not MessagePanel)
   - ✅ Workbench state slice created with `authoringMode` support for future chat-based editing
   - **Implementation Notes**:
     - Workbench state slice: `slices/UI/workbench/index.ts` with Redux slice, selectors, and persistence functions
     - Container component: `components/Workbench/WorkbenchContainer.tsx` uses Material-UI Drawer (desktop) and Dialog (mobile)
     - Content wrapper: `components/Workbench/WorkbenchContent.tsx` provides flexible content area
     - Asset data derivation: AppLayout uses `getStandardForm` and `getAssetZone` selectors directly (following plan's alternative approach)
     - Workbench positioned at AppLayout level to overlay entire content area, independent of main content type
   
1a. **Create asset selector UI** (when `currentAssetId` is undefined) ✅ **COMPLETED**
   - ✅ Display asset selection interface when workbench opens without a selected asset
   - ✅ Show list/grid of available assets (similar to Library component's asset cards)
   - ✅ Allow user to select an asset to work on
   - ✅ Update `currentAssetId` when asset is selected
   - **Implementation Notes**:
     - Created `AssetSelector` component in `components/Workbench/AssetSelector.tsx`
     - Reuses `AssetCard` component from Library for consistency
     - Displays draft and personal assets in responsive grid layout (xs: 12, sm: 6, md: 4)
     - Shows empty state message when no assets are available
     - Integrated into `WorkbenchContainer` with conditional rendering (shows selector when `assetId` is null)
     - Asset selection updates `currentAssetId` via `setCurrentAssetId` action and persists via `putWorkbenchSettings`
     - Uses `AssetKey` utility to normalize asset IDs to proper format
   
1b. **Add "Return to asset selection" affordance** ✅ **COMPLETED**
   - ✅ Add UI control (button/link) in workbench header or actions area
   - ✅ Allows user to clear `currentAssetId` and return to asset selector
   - ✅ Useful when user wants to switch to a different asset
   - **Implementation Notes**:
     - Added "Change asset" button in workbench header (both desktop and mobile layouts)
     - Button positioned in header area on the right side, aligned with asset name
     - Uses Material-UI `Button` with `variant="text"` and `size="small"` for secondary action styling
     - Includes `SwapHorizIcon` from Material-UI icons for visual clarity
     - Button only visible when `assetId !== null` (conditional rendering)
     - Handler function `handleReturnToSelection` dispatches `setCurrentAssetId(null)` and `putWorkbenchSettings({ currentAssetId: null })` to clear selection and persist change
     - Mobile version includes `minHeight: 44` for touch-friendly interaction
     - Button text: "Change asset" (aligned with design principles, avoids "edit" language)
   
1c. **Add "Add asset" button on selector** ✅ **COMPLETED**
   - ✅ Added "Add asset" button/card UI to AssetSelector component
   - ✅ Integrated with existing asset creation flow (reused Library's `handleCreateDraft` pattern)
   - ✅ After creation, automatically sets as `currentAssetId` and proceeds to editing
   - **Implementation Notes**:
     - Created `handleCreateAsset` function following Library's `handleCreateDraft` pattern
     - Uses UUID generation, WML structure creation via `Schema` and `schemaToWML`, and `socketDispatchPromise` API call
     - Implements optimistic UI updates with `draftAssetIdBeingAdded` state
     - Auto-selection via `useEffect` watching for new asset in `DraftAssets`
     - Includes error handling with user feedback via feedback slice
     - Includes timeout fallback (10 seconds) to clear optimistic state
     - Prevents duplicate creation requests by checking `draftAssetIdBeingAdded` state
     - "Add asset" button displayed at top of asset list (full-width card with dashed border)
     - Shows loading spinner during creation, disabled state prevents duplicate clicks
     - Empty state also includes "Add asset" button for better UX
     - Implementation: `src/components/Workbench/AssetSelector.tsx`

2. **Implement workbench header** ✅ **COMPLETED**
   - ✅ Asset name (primary) - displayed prominently in header
   - ✅ Visibility state label (static, informational) - shows "Private draft", "Personal", "Library", or "Canon"
   - ✅ Optional secondary context display - infrastructure in place, will be set in Phase 3
   - **Implementation Notes**:
     - Refactored `AppLayout` to use `getWorkbenchAssetInfo` selector instead of duplicating logic
     - Removed duplicate asset name and visibility state derivation code from `AppLayout/index.tsx`
     - Header structure finalized in `WorkbenchContainer.tsx` (removed placeholder comments)
     - Header displays asset name prominently (bold, 1.25rem font size)
     - Visibility state shown as secondary text (0.875rem, muted color)
     - Secondary context shown as tertiary text (0.75rem, muted color) when set
     - Header works correctly on both desktop (Drawer) and mobile (Dialog) layouts
     - Edge cases handled: shows "Select an Asset" when no asset selected, "Untitled" for missing names
     - Implementation: `src/components/AppLayout/index.tsx` uses `getWorkbenchAssetInfo` selector, `src/components/Workbench/WorkbenchContainer.tsx` displays header

3a. **Create `useWorkbenchAsset` hook** (Preliminary sub-task - **MUST BE COMPLETED FIRST**) ✅ **COMPLETED**
   - ✅ Create a `useWorkbenchAsset` hook that can be used as a drop-in replacement for `useLibraryAsset`
   - ✅ The hook does NOT require an AssetId parameter provided by the calling code
   - ✅ The hook uses `currentAssetId` from the workbench Redux slice (`getCurrentAssetId` selector)
   - ✅ The hook provides the same interface/API as `useLibraryAsset` to enable seamless migration
   - **Rationale**: Existing editing interfaces use `useLibraryAsset` which requires an `assetKey` prop passed to the `LibraryAsset` context provider. To migrate these interfaces to the workbench context, we need a hook that automatically derives the asset ID from the workbench state rather than requiring it to be passed explicitly.
   - **Implementation Notes**:
     - ✅ Hook reads `currentAssetId` from workbench slice using `getCurrentAssetId` selector
     - ✅ Hook derives `AssetId` from `currentAssetId` using `AssetKey` utility to normalize the format
     - ✅ Hook uses the same selectors and logic as `LibraryAsset` component to provide identical context values
     - ✅ Hook handles the case where `currentAssetId` is null by returning default values matching `LibraryAssetContext` default context
     - ✅ Hook located at `src/components/Workbench/useWorkbenchAsset.ts`
     - ✅ Hook exported from `src/components/Workbench/index.ts`
     - ✅ Workbench header refactored to use the hook as a test case (removed `assetName` and `visibilityState` props from `WorkbenchContainer`, now derives them from hook)
     - ✅ `AppLayout` updated to remove `getWorkbenchAssetInfo` selector usage and removed `assetName`/`visibilityState` props from `WorkbenchContainer`
     - **Implementation Details**:
       - Hook returns the same type as `LibraryAssetContextType` for drop-in compatibility
       - When `currentAssetId` is null, hook returns default values (empty strings, default StandardForm instances, readonly: true, etc.)
       - Asset name derived from `standardForm.shortName?.toJSON()` (StandardLiteral API)
       - Visibility state derived from `zone` using `getAssetZone` selector (same logic as `getWorkbenchAssetInfo`)
       - All selectors and callbacks mirror `LibraryAsset` component implementation

3. **Migrate existing editing interfaces** (Depends on 3a) ✅ **COMPLETED**
   - **Prerequisite**: Task 3a (`useWorkbenchAsset` hook) must be completed first ✅
   - ✅ Move asset editing components into workbench
   - ✅ Normalize authoring UI with consistent sections/cards
   - ✅ Ensure single-asset editing constraint
   - ✅ Replace `useLibraryAsset` calls with `useWorkbenchAsset` in migrated components
   - **Implementation Notes**:
     - ✅ Added navigation state to workbench Redux slice (`currentView: 'asset' | 'component' | null`, `currentComponentId: string | null`) with actions (`setCurrentView`, `setCurrentComponentId`) and selectors
     - ✅ Created `WorkbenchAssetEditor` component as main orchestrator that routes based on Redux state (replaces React Router)
     - ✅ Created `WorkbenchAssetEditForm` component (migrated from `EditAsset`'s `AssetEditForm`, removed `LibraryBanner`, normalized UI with Material-UI `Card` components, uses state-based navigation)
     - ✅ Created `WorkbenchComponentDetail` component (migrated from `WMLComponentDetail`, removed `LibraryBanner`, removed React Router dependencies, uses `currentComponentId` from Redux state, added "Back to Asset" button)
     - ✅ Created `WorkbenchCharacterEditor` component (migrated from `EditCharacter`, removed `LibraryBanner`, normalized UI with Cards) - `EditCharacter` was evaluated and determined to be aligned with Characters-as-components architecture
     - ✅ Created `WorkbenchMapEditor` component (migrated from `MapEdit`, removed React Router dependencies, uses `currentComponentId` from Redux state, added "Back to Asset" button)
     - ✅ Updated `AppLayout` to use `WorkbenchAssetEditor` instead of placeholder content
     - ✅ Migrated all supporting components to use `useWorkbenchAsset`: Created workbench-specific versions of `WMLComponentHeader`, `StandardRenderEditor`, `StandardLiteralEditor`, `RoomLensEditor`, `RoomExitEditor`, `ExampleEditor`, `ImageHeader`, `ImportComponentDialog`, `DraftLockout`, `RecentlyVisited`, `LinkDialog`, and all map-related components (`MapController`, `MapLayers`, `UnshownRooms`, `MapArea`)
     - ✅ Component type (Room, Feature, Knowledge, Map, Character) is derived from `standardForm.byUniversalId[componentId]`, not stored separately in state
     - ✅ All navigation uses Redux state actions (`setCurrentView`, `setCurrentComponentId`) instead of `navigate()` calls
     - ✅ Workbench header replaces `LibraryBanner` navigation throughout
     - ✅ UI normalized with consistent Material-UI `Card` components for major sections
     - ✅ Single-asset editing constraint maintained via `currentAssetId` in workbench state
     - ✅ When `currentAssetId` changes, navigation state automatically resets to asset view

4. **Add "Return to Story" affordance** ✅ **COMPLETED**
   - ✅ Clear, prominent action to exit workbench
   - ✅ Returns to play spine
   - **Implementation Notes**:
     - Added "Return to Story" button in workbench actions area (bottom section)
     - Button uses Material-UI `Button` with `variant="contained"` and `color="primary"` for prominence
     - Includes `ArrowBackIcon` to emphasize returning to story
     - Desktop: Button centered with `minWidth: 200px`
     - Mobile: Button full width for better touch target
     - Button calls `onClose` prop which dispatches `closeWorkbench()` action
     - Button is always visible in actions area when workbench is open

**Architectural Considerations for Future Chat-Based Editing**:

Phase 2 implements a workbench overlay while the play spine remains visible. However, the future iteration will replace the play spine chat with an authoring chat in the main content area during authoring mode. To avoid painting ourselves into a corner, Phase 2 must:

1. **State Management Design**:
   - Implement mode state (`authoringMode: 'play' | 'authoring'`) even if Phase 2 doesn't use it fully
   - Keep `workbenchOpen` state independent of `authoringMode`
   - Design entry ritual as a mode transition, not just "open workbench"
   - **Rationale**: Future iteration will swap main content area based on mode; state model must support this

2. **Workbench Positioning**:
   - Position workbench relative to `gridArea: "content"` container, not `MessagePanel` specifically
   - Workbench should work identically whether main area shows play chat or authoring chat
   - **Rationale**: Main content area will swap between play spine and authoring chat; workbench must be independent

3. **Layout Structure**:
   - Workbench should overlay/attach to the content grid area container
   - Avoid coupling workbench layout to MessagePanel structure
   - **Rationale**: Same workbench must coexist with different main content (play chat → authoring chat)

4. **Entry Ritual Design**:
   - Entry ritual should set `authoringMode: 'authoring'` (even if Phase 2 still renders play spine)
   - In Phase 2: `authoringMode: 'authoring'` renders play spine + workbench overlay
   - In future: `authoringMode: 'authoring'` renders authoring chat + workbench overlay
   - **Rationale**: Makes future change a rendering swap, not an architectural refactor

**Key Principle**: Workbench must be designed to coexist with either play chat or authoring chat in the main content area, without knowing or caring which one is present.

**Success Criteria**:
- ✅ Workbench opens as overlay/side-panel
- ✅ Header displays asset name and visibility state correctly
- ✅ Existing editing functionality works within workbench (Task 3 completed)
- ✅ "Return to Story" action functions correctly
- ✅ Responsive layout works on desktop and mobile
- ✅ State-based navigation works (no URL routing in workbench)
- ✅ All editing components use `useWorkbenchAsset` hook
- ✅ UI normalized with consistent Card sections
- ✅ Component selection uses Redux state actions
- ✅ "Back" buttons navigate correctly via workbench state

**Dependencies**: Phase 1 (play spine must exist as return target)

**Risk Level**: Medium (requires careful migration of existing editing UI)

---

### Phase 3: Entry Ritual - Play to Authoring Transition

**Goal**: Implement smooth entry from play spine to authoring workbench

**Key Tasks**:
1. **Add entry affordances in play spine**
   - "Work on this place" actions/buttons
   - Context-aware asset selection
   - Language aligned with design principles

2. **Implement asset selection logic**
   - Identify asset from play context
   - Default to draft worldview
   - Establish visibility state

3. **Wire entry flow**
   - Open workbench with selected asset
   - Populate workbench header
   - Maintain play spine context

**Success Criteria**:
- Users can initiate authoring from play spine
- Asset selection works correctly
- Workbench opens with correct asset loaded
- Visibility state established and displayed
- Language uses "work on" not "edit"

**Dependencies**: Phase 2 (workbench must exist)

**Risk Level**: Low-Medium (requires context extraction from play state)

---

### Phase 4: Exit Ritual - Authoring to Play Transition

**Goal**: Implement clear exit from authoring back to play

**Key Tasks**:
1. **Implement exit confirmation dialog/inline**
   - Display asset name
   - Show current visibility state
   - Provide "return to world" action
   - Include "manage visibility" stub (disabled/informational)

2. **Wire exit flow**
   - Close workbench
   - Return to play spine
   - Resume worldview rendering

3. **Handle change detection**
   - Detect if changes were made
   - Show exit ritual only if changes exist (or always, per design)

**Success Criteria**:
- Exit ritual displays correctly
- Visibility state shown accurately
- "Return to world" returns to play spine
- Play spine resumes correctly
- Changes are visible in play spine immediately

**Dependencies**: Phase 3 (entry ritual must exist)

**Risk Level**: Low (straightforward UI flow)

---

### Phase 5: Integration & Polish

**Goal**: Ensure complete workflow functions smoothly

**Key Tasks**:
1. **End-to-end workflow testing**
   - Play → Author → Return → See changes
   - Test with multiple asset types
   - Verify draft worldview updates

2. **Stub non-core features**
   - Tutorials: Links or placeholders
   - Settings: Links or placeholders
   - Admin/moderation: Links or placeholders
   - No full reintegration in iteration 1

3. **Polish and refinement**
   - UI/UX consistency
   - Responsive behavior
   - Error handling
   - Loading states

**Success Criteria**:
- Complete workflow functions end-to-end
- Single user can play → author → return → see results
- Non-core features stubbed appropriately
- UI is polished and consistent
- No regressions in existing functionality

**Dependencies**: Phases 1-4 (all core functionality)

**Risk Level**: Low (integration and polish)

---

## What Is Explicitly Out of Scope (Iteration 1)

These features are **intentionally de-scoped** for the first iteration:

### Not Required to Reimplement
- **Tutorials**: Can be stubs, links, or placeholders
- **Account/Settings management**: Can be stubs, links, or placeholders
- **Admin/moderation dashboards**: Can be stubs, links, or placeholders

### Not Implemented Yet
- Asset inclusion toggles
- Worldview selection UI
- Collaboration/invitations
- Side-thread messaging
- Moderation flows
- Canon promotion workflows

**Rationale**: These are meta-system concerns that don't need continuous access to the play spine. They can temporarily live behind simple links, placeholders, or legacy routes. The priority is stabilizing play, authoring, and transition rituals.

**Important**: The UI must only leave **space** for these features, not implement them.

---

## Critical Invariants (Do Not Break)

1. **The play spine represents one worldview at a time**
   - Never show multiple worldviews simultaneously
   - Worldview switching (if needed) is explicit and clear

2. **The workbench edits one asset at a time**
   - Never imply editing multiple assets
   - Never imply direct worldview editing

3. **Entry selects what you are shaping**
   - Focus on asset selection, not worldview manipulation
   - Language emphasizes "work on" not "edit"

4. **Exit confirms current visibility, not final authority**
   - Acknowledge visibility state
   - Don't ask governance questions (where to publish, etc.)

5. **Assets are never implied to be owned by a single room**
   - Assets can contain multiple rooms, features, maps, knowledge items
   - UI must reflect asset-level thinking, not room-level thinking

---

## Dependencies

### Prerequisites
- ✅ Message persistence system exists and functions
- ✅ Asset editing system exists and functions
- ✅ Draft worldview concept exists (backend support)
- ✅ Sticky room summary functionality exists

### External Dependencies
- **Backend**: Draft worldview rendering support
- **Backend**: Asset visibility state information
- **Backend**: Worldview composition logic

### Internal Dependencies
- **Phase 1 → Phase 2**: Play spine must exist before workbench
- **Phase 2 → Phase 3**: Workbench must exist before entry ritual
- **Phase 3 → Phase 4**: Entry ritual must exist before exit ritual
- **Phase 4 → Phase 5**: All phases must complete before integration

---

## Risk Mitigation

### High-Risk Areas

1. **Layout Refactoring** (Phase 1)
   - **Risk**: Breaking existing functionality during layout changes
   - **Mitigation**: Incremental refactoring, preserve existing components, extensive testing

2. **UI Migration** (Phase 2)
   - **Risk**: Losing functionality when moving editing UI to workbench
   - **Mitigation**: Careful component migration, maintain existing patterns, test each component

3. **Context Extraction** (Phase 3)
   - **Risk**: Difficulty identifying correct asset from play context
   - **Mitigation**: Clear context markers in play state, fallback to explicit selection

### Medium-Risk Areas

1. **State Management**
   - **Risk**: Complex state coordination between play spine and workbench
   - **Mitigation**: Clear state boundaries, Redux patterns, well-defined interfaces

2. **Responsive Design**
   - **Risk**: Workbench layout issues on mobile vs desktop
   - **Mitigation**: Mobile-first design, test on multiple screen sizes

### Low-Risk Areas

1. **Exit Ritual** (Phase 4)
   - **Risk**: Low - straightforward UI flow
   - **Mitigation**: Simple confirmation pattern, clear user feedback

2. **Integration** (Phase 5)
   - **Risk**: Low - primarily testing and polish
   - **Mitigation**: Comprehensive testing, incremental refinement

---

## Getting Started

This section guides AI agents (and human collaborators) through context gathering before beginning implementation work.

### 1. Understand Project Foundations

**Read these documents in order**:

- **[Root AGENT.md](../AGENT.md)**: Project overview, documentation standards, navigation patterns
  - **Why**: Understand the project's documentation conventions and architectural philosophy
  - **Focus**: Pay attention to the "Getting Started" pattern for complex tasks (section 7-step template)

- **[Client Architecture](AGENT.md)**: Current client system structure
  - **Why**: Understand existing dual-mode architecture (authoring vs playing)
  - **Focus**: Current routing patterns, message system, asset editing capabilities

- **[Architectural Philosophy](../AGENT.architecture.philosophy.md)**: Core design principles
  - **Why**: Understand perception-driven processing and worldview concepts
  - **Focus**: How worldviews relate to assets, the "tree falls in forest" principle

- **[Handoff Document](src/ui_refactor_handoff_chat_spine_authoring_workbench.md)**: Original requirements
  - **Why**: This is the source of truth for design intent and constraints
  - **Focus**: Key conceptual distinctions, entry/exit rituals, critical invariants

### 2. Read Current Planning Document

**This document structure**:
- **Overview**: High-level direction and success criteria
- **Current System State**: What exists today
- **Target Architecture**: What we're building toward
- **Strategic Phases**: Five phases with dependencies
- **Critical Invariants**: Must-not-break rules
- **Getting Started**: This section (context gathering)

**Recommended reading order**:
1. Overview (understand the shift)
2. Current System State (what we're starting from)
3. Target Architecture (what we're building)
4. Strategic Phases (how we'll get there)
5. Critical Invariants (what we must preserve)

### 3. Understand Core Integration Points

**Primary code areas to modify**:

- **Play Spine Surface**:
  - Current: Character play routes (`/Character/:CharacterId/Play`)
  - Message rendering components
  - Sticky room summary implementation
  - **Future**: Primary surface, always present

- **Authoring Workbench**:
  - Current: Library routes (`/Library/Edit/*`)
  - Asset editing components
  - WML editor interfaces
  - **Future**: Overlay/side-panel opened from play spine

- **Navigation/Routing**:
  - Current: Tab-based navigation, explicit mode switching
  - **Future**: Play spine as anchor, workbench as overlay

**Key files to examine**:
- `src/components/Character/` - Current play interface
- `src/components/Library/Edit/` - Current authoring interface
- `src/slices/messages/` - Message persistence (see [AGENT.md](src/slices/messages/AGENT.md))
- `src/slices/personalAssets/` - Asset management
- `src/slices/settings/` - Client settings (includes IndexedDB persistence pattern for character selection)
- `src/cacheDB/index.ts` - IndexedDB schema (clientSettings table structure)

### 4. Review Implemented Code

**Study existing patterns**:

- **Message Rendering**: How messages are currently displayed in play mode
  - Look for: Message type handling, room summary rendering, transcript scrolling

- **Asset Editing**: How assets are currently edited
  - Look for: Component editing patterns, WML editor usage, asset state management

- **Layout Patterns**: How the current UI is structured
  - Look for: Panel layouts, responsive patterns, navigation components

**Concrete files to examine**:
- Message display components in `src/components/Character/`
- Asset editing components in `src/components/Library/Edit/`
- Layout/navigation components (search for tab/navigation components)

### 5. Check Testing Patterns

**Testing standards**:
- See **[Client Testing Standards](AGENT.testing.md)** for Vitest patterns and React component testing
- Client tests: `npm test` (watch) or `npm run test:single` (single run)

**Test files to review**:
- Existing component tests in `src/components/`
- Message system tests in `src/slices/messages/`
- Asset editing tests (if they exist)

### 6. Identify Next Task

**How to find current task**:
1. Check this document's **Strategic Phases** section
2. Identify which phase is current (or start with Phase 1)
3. Review phase-specific tasks and success criteria
4. Break phase into tactical implementation steps (using Cursor Plan mode)

**Progress tracking**:
- Update phase status in this document as work progresses
- Mark tasks complete with checkboxes
- Note any blockers or decisions needed

**Task prioritization**:
- Follow phase sequence (1 → 2 → 3 → 4 → 5)
- Within a phase, prioritize foundational tasks first
- Test incrementally after each major change

### 7. Run Tests Before Starting

**Baseline verification**:
```bash
cd charcoal-client
npm run test:single
```

**Expected**: All existing tests should pass before making changes

**Purpose**: Establish baseline to detect regressions during refactoring

---

## Success Metrics

### Iteration 1 Success Criteria

- ✅ Play spine is the primary surface users see
- ✅ Users can initiate authoring from play spine ("Work on this place")
- ✅ Authoring workbench opens as overlay/side-panel
- ✅ Users can return from authoring to play spine
- ✅ Changes made in authoring are immediately visible in play spine
- ✅ Complete workflow: Play → Author → Return → See results
- ✅ Draft worldview renders correctly
- ✅ All existing message types display properly
- ✅ No regressions in existing functionality

### Quality Metrics

- All existing tests pass
- No console errors or warnings
- Responsive design works on desktop and mobile
- UI is consistent and polished
- Error states handled gracefully

---

## Future Considerations (Post-Iteration 1)

These features are explicitly deferred but should be considered in the architecture:

### Visibility Management
- Asset inclusion toggles
- Worldview selection UI
- Multi-worldview support

### Collaboration Features
- Side-thread messaging
- Invitations and sharing
- Collaboration workflows

### Governance Features
- Canon promotion workflows
- Moderation flows
- Review and approval processes

### Meta-System Features
- Tutorials (as side-tracks returning to play spine)
- Settings (as side-tracks returning to play spine)
- Admin/moderation dashboards

**Architecture Note**: The workbench container is designed to be reusable for these future features (side-threads, deliberation, tutorials, collaboration).

### Chat-Based Authoring (Future Iteration)

**Future Architecture**: In a future iteration, entering authoring mode will replace the play spine chat with an authoring chat interface in the main content area. The authoring chat will provide a conversational interface for collaborating with AI on asset editing, using the same screen real estate currently occupied by the play spine.

**Key Design Points**:
- **Main Content Area Swap**: During authoring mode, the main content area (`gridArea: "content"`) switches from play spine (`MessagePanel`) to authoring chat interface
- **Workbench Coexistence**: The workbench overlay/side-panel remains visible alongside the authoring chat, positioned relative to the content grid area (not the specific chat component)
- **Mode-Based Rendering**: State management tracks `authoringMode: 'play' | 'authoring'` to determine which chat interface renders in the main area
- **Entry/Exit Rituals**: Entry ritual transitions to `authoringMode: 'authoring'` (swapping main content), exit ritual returns to `authoringMode: 'play'` (restoring play spine)

**Phase 2 Preparation**: Phase 2 must design state management and layout structure to support this future swap without architectural refactoring. See Phase 2 "Architectural Considerations" section for implementation guidance.

---

## Related Documentation

- **[Handoff Document](src/ui_refactor_handoff_chat_spine_authoring_workbench.md)**: Original requirements and design intent
- **[Client Architecture](AGENT.md)**: Current client system documentation
- **[Message Persistence](src/slices/messages/AGENT.md)**: Message storage and synchronization
- **[Client Testing Standards](AGENT.testing.md)**: Testing patterns and guidelines
- **[Development Roadmap](../AGENT.development.md)**: Overall project migration planning

---

## Document Maintenance

**Update this document when**:
- Phase status changes (mark phases as in-progress, completed)
- Tasks are completed (update checkboxes)
- Blockers are identified (add to risk mitigation)
- Decisions are made (document in relevant phase)
- Architecture evolves (update target architecture section)

**Keep this document**:
- Current with implementation progress
- Aligned with handoff document requirements
- Clear about what's in/out of scope
- Useful for breaking into tactical plans
