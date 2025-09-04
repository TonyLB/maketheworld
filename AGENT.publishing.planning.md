# Publishing MVP - Agent Planning Guide

## Overview

This document outlines the implementation plan for the core publishing functionality needed during the Bootstrapping phase: **Publish to New Asset** and **Publish as Update**. These features will enable testing of the refactored WML system while building toward the long-term collaboration vision.

## Current State Assessment

### ✅ Existing Infrastructure
- **Asset Zone System**: Personal → Library → Canon movement via `moveAsset`
- **Draft System**: `ASSET#draft` with full WML editing interface
- **ApplyWML System**: `applyEdit` functionality for asset updates
- **Publishing Step Function**: `publishWML.asl.yaml` handles Draft → Target zone
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
- Extend existing `publishWML` step function
- Add zone selection (Personal/Library/Canon)
- Asset naming and validation
- Direct asset creation and registration

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

### Phase 1: Core Publishing UI (Week 1)
**Frontend Components**:
- Extend `WMLEdit.tsx` with publishing buttons
- Zone selector for new assets (Personal/Library/Canon)
- Target asset selector for updates
- Publishing status display

**Backend Integration**:
- Extend `publishWML` step function for new assets
- Add suggestion creation endpoints
- Integrate with existing asset movement

### Phase 2: Content Processing (Week 2)
**Content Extraction**:
- Diff computation between draft and target assets
- Smart filtering of publishable changes
- Import dependency analysis and validation

**Suggestion Management**:
- Simple suggestion storage in Personal zone
- Basic status tracking (Draft → Applied)
- Direct application during Bootstrapping phase

### Phase 3: Integration & Testing (Week 3)
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

1. **Validate Current Systems** (1-2 days)
   - Test refactored WML system with existing `applyEdit`
   - Verify `publishWML` step function works correctly
   - Confirm asset movement between zones functions

2. **Implement Publish to New Asset** (3-4 days)
   - Add publishing UI to draft editor
   - Extend `publishWML` step function
   - Test with Personal/Library/Canon zones

3. **Implement Publish as Update** (3-4 days)
   - Add update UI and target asset selection
   - Implement content extraction logic
   - Integrate with existing `applyEdit` system

4. **Integration Testing** (2-3 days)
   - End-to-end workflow testing
   - Bug fixes and polish
   - Documentation and handoff

## Long-Term Vision Alignment

This MVP provides the foundation for the full collaboration system described in `AGENT.collaboration.md`:

- **Bootstrapping Phase**: Direct publishing with simple rollback
- **Future Phases**: Community evaluation, suggestion workflows, and consensus-building
- **Scalable Architecture**: Infrastructure supports evolution to collaborative scenarios

The implementation prioritizes immediate value for testing the refactored system while building toward the comprehensive collaboration vision.
