# Publishing MVP - Agent Planning Guide

**Date**: Original planning document  
**Last Updated**: November 16, 2025  
**Status**: Planning / Implementation Phase

## Overview

This document outlines the implementation plan for the core publishing functionality needed during the Bootstrapping phase: **Publish to New Asset** and **Publish as Update**. These features will enable testing of the refactored WML system while building toward the long-term collaboration vision.

**Note**: This document has been updated to align with the multi-draft system. The multi-draft system core implementation is complete - multiple drafts per player using `ASSET#${uuid}` keys with zone-based identification.

## Current State Assessment

### ✅ Existing Infrastructure
- **Asset Zone System**: Personal → Library → Canon movement via `moveAsset`
- **Multi-Draft System**: Multiple drafts per player using `ASSET#${uuid}` keys with zone-based identification (core implementation complete)
- **ApplyWML System**: `applyEdit` functionality for asset updates
- **Zone Transitions**: `changeZone` and `moveAsset` support Draft → Personal/Library/Canon
- **Asset Workspace**: Complete S3/DynamoDB asset management
- **WML Editor**: Rich Slate-based editing interface

### 🎯 Bootstrapping Phase Focus
- **Direct Publishing**: No complex review workflows during initial testing
- **Simple Rollback**: Basic infrastructure operator rollback capability
- **Single User**: Optimized for solo development and testing

## MVP Features

### 1. Publish to New Asset
**Purpose**: Transform draft content into a standalone asset in target zone

**User Flow**:
```
Draft Editor → [Publish Button] → Zone Selector → Asset Name → Direct Publishing
```

**Technical Flow**:
- Use existing `moveAsset`/`changeZone` to move Draft → Target zone
- Add zone selection (Personal/Library/Canon)
- Asset naming and validation (via ShortName/Summary metadata)
- Direct asset creation and registration

**Multi-Draft Context**: 
- Works with any draft asset (not limited to single `ASSET#draft`)
- Each draft can be published independently
- Backend support exists (`moveAsset`, `changeZone`) - UI workflow needed

### 2. Publish as Update
**Purpose**: Apply draft changes as updates to existing assets

**User Flow**:
```
Draft Editor → [Update Button] → Target Asset Selector → Direct Application
```

**Technical Flow**:
- Leverage existing `applyEdit` system
- Content extraction and diff computation
- Target asset selection and validation
- Direct application of changes

## Implementation Plan

### Phase 0: Import Navigator (Week 1)
**Purpose**: Create a phase-appropriate import system for building content from scratch

**Problem Statement**:
- Current draft system relies on "recently visited" imports
- Bootstrapping phase needs access to all available content
- Empty world requires different import patterns than populated world
- Need phase-aware import UI that scales from Bootstrapping to later phases

**User Flow**:
```
Draft Editor → [Import Button] → Import Navigator → Content Selection → Import to Draft
```

**Technical Requirements**:
- Phase-aware import interface (Bootstrapping vs later phases)
- Content discovery and selection UI
- Integration with existing import system
- Navigation between Draft Editor and Import Navigator

**Current System Analysis**:
- **Recently Visited**: Client-side calculation from message cache, searches backward for distinct RoomHeader entries
- **Primitives Asset**: Auto-created on deployment with `VORTEX` room and `knowledgeRoot` knowledge item
- **Import Mechanism**: Uses `addImport` action with assetId, fromAsset, uuid, and tag
- **Current UI**: `RecentlyVisited.tsx` component with collapsible asset lists and download buttons

**Bootstrapping Phase Design Decisions**:
- **Content Scope**: Show ALL available content (primitives + any other assets)
- **Organization Structure**: Zone → Asset → Components (not by component type)
- **UI Layout**: Tabular layout with search/filter capability
- **Rationale**: Search/filter requires tabular layout; component nesting within rooms makes type-based sections impractical

**Detailed UI Design**:
- **Tab Structure**: Three tabs (Canon, Library, Personal) with separate page content
- **Table Columns**: Asset | Component Short Name | Type | Import Button
- **Component Nesting**: Nested components listed under parent with light styling differences
- **Data Requirements**: ✅ `shortName` now available for Features and Knowledge (Rooms already had ShortName, Maps have Name)
- **Data Source**: Filtered sub-source of Assets system with on-demand snapshots and subscription updates

**Open Questions** (to be resolved during implementation):
- **Data Source Architecture**: How to create filtered sub-source of Assets system
- **API Response Structure**: Exact format for zone/asset/component data
- **Subscription and Updates**: Real-time update handling across zones
- **Frontend Component Hierarchy**: Detailed component structure and organization
- **Integration Points**: Navigation from Draft Editor to Import Navigator
- **Phase Detection**: How to determine Bootstrapping vs later phases

## Short-Term Implementation Steps

### Step 1: Implement `shortName` for Features and Knowledge ✅ COMPLETED
**Purpose**: Enable display of meaningful component names in Import Navigator
**Scope**: Extend existing component schemas to include `shortName` field
**Dependencies**: None - can be implemented independently

**Implementation Details**:
- ✅ Added `shortName?: StandardEditableData<string>` to `StandardFeatureData` and `StandardKnowledgeData`
- ✅ Updated payload classes to implement `HasShortName` interface
- ✅ Added schema parsing for `<ShortName>` tags in WML
- ✅ Updated `toJSON`, `schema`, `merge`, `diff`, and `equals` methods
- ✅ Added comprehensive test coverage for all functionality
- ✅ Updated `hasShortName` function to include Feature and Knowledge components
- ✅ Updated client-side `WMLComponentDetail.tsx` to support editing shortName for Features and Knowledge
- ✅ All existing `hasShortName` usages now automatically work with Features and Knowledge

### Step 2: Backend Phase Information API ✅ COMPLETED
**Purpose**: Provide client with current collaboration phase information
**Scope**: New API endpoint or configuration mechanism
**Dependencies**: None - can be implemented independently

**Implementation Details**:
- ✅ Added `collaborationStatus` API message type to `mtw-interfaces`
- ✅ Created `AssetCollaborationStatusAPIMessage` and `AssetClientCollaborationStatus` types
- ✅ Implemented messageBus handler in `lambda/assets/collaborationStatus/`
- ✅ Added handler registration and API routing in main `app.ts`
- ✅ Created comprehensive unit tests following established patterns
- ✅ Returns `{ phase: 'Bootstrap' }` status as minimal implementation
- ✅ Ready for client integration and future phase expansion

### Step 3: Content Headers Data Sub-source
**Purpose**: Create filtered data stream for Import Navigator content
**Scope**: New backend service that aggregates asset/component data by zone
**Dependencies**: Step 1 (shortName implementation)
**Integration**: Subscribe to `mtw.assets` events (`Component Updated`, `Component Removed`) for real-time data updates

### Phase 1: Core Publishing UI (Week 2)
**Frontend Components**:
- Extend `WMLEdit.tsx` with publishing buttons
- Zone selector for new assets (Personal/Library/Canon)
- Target asset selector for updates
- Publishing status display

**Backend Integration**:
- Extend `publishWML` step function for new assets
- Add suggestion creation endpoints
- Integrate with existing asset movement

### Phase 2: Content Processing (Week 3)
**Content Extraction**:
- Diff computation between draft and target assets
- Smart filtering of publishable changes
- Import dependency analysis and validation

**Suggestion Management**:
- Simple suggestion storage in Personal zone
- Basic status tracking (Draft → Applied)
- Direct application during Bootstrapping phase

### Phase 3: Integration & Testing (Week 4)
**End-to-End Testing**:
- Test publishing workflows with refactored WML system
- Validate asset movement between zones
- Bug fixes and polish

## Technical Architecture

### Frontend Extensions
- **Location**: `charcoal-client/src/components/Library/Edit/WMLEdit.tsx`
- **Integration**: Extend existing `LibraryBanner` commands
- **State Management**: Leverage existing Redux personalAssets slice

### Backend Extensions
- **New Assets**: Extend `publishWML.asl.yaml` step function
- **Updates**: Leverage existing `applyEdit` system
- **Storage**: Use existing asset workspace and S3/DynamoDB infrastructure

### Data Flow
```
Draft Content → Publishing UI → Step Function/API → Asset Workspace → S3/DynamoDB
```

## Success Criteria

### Immediate (Bootstrapping Phase)
- [ ] Can publish draft content as new assets in any zone
- [ ] Can apply draft changes as updates to existing assets
- [ ] Publishing workflows work with refactored WML system
- [ ] Basic rollback capability for infrastructure operators

### Foundation for Future Phases
- [ ] Publishing infrastructure supports community evaluation workflows
- [ ] Suggestion system ready for review and approval processes
- [ ] Asset movement system scales to collaborative scenarios

## Risk Mitigation

### Low Risk Factors
- **Leverages Existing Infrastructure**: 80% of required functionality already exists
- **Incremental Implementation**: Can be built and tested piece by piece
- **Bootstrapping Focus**: No complex community workflows initially

### Mitigation Strategies
- **Start Simple**: Begin with basic publishing, add complexity gradually
- **Test Early**: Validate with existing systems before adding new features
- **Rollback Ready**: Maintain ability to revert changes during development

## Dependencies

### Prerequisites
1. **Current Systems Working**: Verify refactored WML system functions correctly
2. **Asset Movement Tested**: Ensure Personal/Library/Canon movement works
3. **Draft System Stable**: Confirm WML editing and parsing functions properly

### External Dependencies
- **Existing Step Functions**: `publishWML.asl.yaml` and `applyWMLEdit.asl.yaml`
- **Asset Workspace**: `@tonylb/mtw-asset-workspace` package
- **WML Processing**: `@tonylb/mtw-wml` package functionality

## Next Steps

1. **✅ Implement shortName for Features and Knowledge** (COMPLETED)
   - ✅ Extended component schemas to include shortName field
   - ✅ Updated existing Features and Knowledge components
   - ✅ Tested with existing asset system
   - ✅ Updated client-side editing interface

2. **✅ Implement Backend Phase Information API** (COMPLETED)
   - ✅ Created API endpoint for collaboration phase information
   - ✅ Added configuration mechanism for phase detection
   - ✅ Tested phase information delivery to client

3. **✅ Implement Content Headers Data Sub-source** (COMPLETED)
   - ✅ Created filtered data stream for Import Navigator content
   - ✅ Subscribe to `mtw.assets` events (`Component Updated`, `Component Removed`) for real-time updates
   - ✅ Test data aggregation across zones with event-driven updates

4. **Implement Client-Side Data Pattern Prototype** (2-3 days)
   - Create Redux pattern for receiving snapshot and stream information from backend
   - Implement materialized current-state management for client-side data
   - Design Redux selectors for easy access to aggregated content data
   - Test real-time updates and state synchronization with backend events

5. **Implement Import Navigator UI** (3-4 days)
   - Create tabbed interface (Canon/Library/Personal)
   - Implement filterable table with component nesting
   - Test import workflow with empty world

6. **Implement Publish to New Asset** (3-4 days)
   - Add publishing UI to draft editor
   - Extend `publishWML` step function
   - Test with Personal/Library/Canon zones

7. **Implement Publish as Update** (3-4 days)
   - Add update UI and target asset selection
   - Implement content extraction logic
   - Integrate with existing `applyEdit` system

8. **Integration Testing** (2-3 days)
   - End-to-end workflow testing
   - Bug fixes and polish
   - Documentation and handoff

## Multi-Draft Publishing Design Questions

**Status**: Open questions to be resolved during implementation

**Note**: These questions were moved from the multi-draft planning documents to consolidate publishing-related planning in this document.

These questions relate to publishing workflows from the multi-draft system:

1. **Publish Workflow Location**: Where should publish action be located?
   - Option A: Draft editor (inline with editing workflow)
   - Option B: Library card actions (bulk operations context)
   - Option C: Both locations (context-dependent)

2. **Publish Target Zones**: Should users be able to publish directly to Library/Canon, or only Personal?
   - Consideration: Personal zone may be a safer intermediate step
   - Consideration: Direct publishing to Library/Canon may be needed for power users
   - Consideration: Permissions model (owner vs elevated roles)

3. **Copy vs Move Behavior**: When publishing, should draft be copied (retained) or moved (deleted)?
   - Option A: Move (draft deleted after publishing) - simpler, cleaner
   - Option B: Copy (draft retained) - allows iteration and multiple publishes
   - Option C: User choice (checkbox or setting) - maximum flexibility

**Current State**: 
- Backend support exists (`moveAsset`, `changeZone` functions)
- No UI workflow implemented yet
- Multi-draft system core implementation complete (Phases 1, 3, 3.5)
- Publish workflow is the critical remaining gap

## Long-Term Vision Alignment

This MVP provides the foundation for the full collaboration system described in `AGENT.collaboration.md`:

- **Bootstrapping Phase**: Direct publishing with simple rollback
- **Future Phases**: Community evaluation, suggestion workflows, and consensus-building
- **Scalable Architecture**: Infrastructure supports evolution to collaborative scenarios

The implementation prioritizes immediate value for testing the refactored system while building toward the comprehensive collaboration vision.
