# WML Lambda - MoveAsset Development Priorities

## Overview

This document outlines development priorities, known issues, and implementation order for the moveAsset functionality in the WML lambda.

## Critical Issues

### 🚨 Archive Zone Implementation (High Priority)

**Problem**: The current Archive zone functionality is misleading and potentially destructive.

**Current Behavior**:
- Files are deleted from source location
- No backup or archive copy is created
- Data is permanently lost
- Misleading "archived" terminology

**Expected Behavior**:
- Copy files to Archive location with backupId
- Delete source files only after successful copy
- Preserve data for potential future restoration
- Use accurate terminology

**Impact**: Users may lose data when "archiving" assets, thinking they're being preserved.

**Implementation Plan**:
1. Update `performS3Move()` to copy files to Archive location first
2. Only delete source files after successful copy
3. Update error handling for Archive operations
4. Revise terminology and documentation
5. Add tests for Archive zone data preservation

## Implementation Priorities

### Phase 1: Archive Zone Fix (Immediate)
- **Priority**: Critical
- **Effort**: Medium
- **Dependencies**: None
- **Risk**: High (data loss prevention)

### Phase 2: Event Streaming Integration (Next)
- **Priority**: High
- **Effort**: High
- **Dependencies**: Archive zone fix
- **Risk**: Medium

### Phase 3: Zone Authority Migration (Future)
- **Priority**: Medium
- **Effort**: High
- **Dependencies**: Event streaming
- **Risk**: Low

## Technical Debt

### Code Quality Issues
- **Archive zone logic**: Misleading implementation (see Critical Issues)
- **Error handling**: Could be more granular for different failure modes
- **Logging**: Limited visibility into S3 operation details
- **Testing**: Archive zone tests don't verify data preservation

### Architecture Improvements
- **Event streaming**: Not yet implemented for assets lambda communication
- **Zone validation**: Limited validation of zone transition rules
- **Monitoring**: No metrics for move operations
- **Rollback**: No mechanism to undo failed moves

## Development Guidelines

### Before Making Changes
1. **Read existing tests**: Understand current behavior
2. **Check assets lambda**: Compare with original implementation
3. **Review zone documentation**: Understand zone system requirements
4. **Plan error handling**: Consider all failure scenarios

### Testing Requirements
- **Archive zone**: Must verify data preservation
- **Error cases**: Test all failure modes
- **S3 operations**: Mock and verify correct commands
- **Zone transitions**: Validate all supported transitions

### Code Standards
- **Follow assets lambda patterns**: Maintain consistency
- **Use proper mocking**: Follow established test patterns
- **Document changes**: Update relevant AGENT.md files
- **Error messages**: Provide meaningful user feedback

## Related Systems

### Dependencies
- **S3 operations**: Via `internalCache.Connection.get('s3Client')`
- **Asset workspaces**: `@tonylb/mtw-asset-workspace/ts/readOnly`
- **Event system**: WML dataSource event handling

### Integration Points
- **Assets lambda**: Future event streaming integration
- **Zone system**: Zone transition rules and validation
- **S3 storage**: File organization and metadata

## Future Considerations

### Long-term Goals
- **Complete zone authority**: WML lambda as single source of truth
- **Event-driven architecture**: Reactive updates across systems
- **Enhanced monitoring**: Comprehensive operation tracking
- **Data integrity**: Robust backup and recovery mechanisms

### Technical Evolution
- **Metadata-driven zones**: Move away from folder-based organization
- **S3 object tags**: Enhanced metadata storage
- **Performance optimization**: Efficient bulk operations
- **Audit trails**: Complete operation history
