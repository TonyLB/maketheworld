# Feedback Lambda - Sessions/Connections Update Plan

## Overview

The Feedback Lambda is a utility service that processes SNS messages and delivers them to WebSocket clients. Currently, it only supports the legacy `ConnectionIds` message attribute pattern, but the system has evolved to use a modern Sessions/Connections infrastructure that provides better connection management, session persistence, and user experience.

This document outlines the plan to update the Feedback Lambda to accept incoming Session IDs and leverage the modern connection infrastructure.

## Current State

### **Legacy Implementation (Current)**
- **Message Format**: Uses `ConnectionIds` array in SNS MessageAttributes
- **Delivery Method**: Direct WebSocket delivery to individual connection IDs
- **Limitations**: 
  - No session persistence across reconnections
  - No connection validation or cleanup
  - Brittle connection management
  - No support for modern session-based targeting

### **Modern Infrastructure (Available)**
- **Session Management**: `SESSION#${sessionId}` based connection tracking
- **Connection Persistence**: Connections survive WebSocket reconnections
- **Dynamic Connection Resolution**: Real-time lookup of active connections for sessions
- **Better Error Handling**: Automatic connection cleanup and validation

## Problem Statement

The current Feedback Lambda is **out of sync** with the modern Sessions/Connections infrastructure:

1. **SNS Messages**: Other lambdas are sending `SessionId` in MessageAttributes
2. **Connection Resolution**: Modern system uses `SESSION#${sessionId}` pattern
3. **Delivery Method**: Should use session-based connection resolution instead of direct connection IDs
4. **Error Handling**: Missing modern connection validation and cleanup patterns

## Target Architecture

### **Updated Message Flow**
```
SNS Message → Feedback Lambda → Session Resolution → Connection Delivery
     ↓              ↓              ↓                    ↓
SessionId    Extract SessionId   Query Active      Deliver to All
+ RequestId   + RequestId        Connections       Session Connections
+ Type       + Message Type     for Session      + Handle Errors
```

### **New Message Structure**
```typescript
interface SNSMessageAttributes {
  SessionId: { DataType: 'String', StringValue: string }
  RequestId: { DataType: 'String', StringValue: string }
  Type: { DataType: 'String', StringValue: 'Success' | 'Error' }
  Error?: { DataType: 'String', StringValue: string }
}
```

### **Connection Resolution Strategy**
- **Primary**: Use `SessionId` to query active connections via `SESSION#${sessionId}` pattern
- **Fallback**: Maintain backward compatibility with `ConnectionIds` for legacy messages
- **Validation**: Ensure connections are active and valid before delivery

## Implementation Plan

### **Phase 1: Core Infrastructure Updates** 🔄 READY TO START
1. **Update SNS Message Parsing** ❌
   - Refactor `ConnectionIds` to accept `Targets`, which are either `CONNECTION#${string}` or `SESSION#${string}` (using `TargetResolver` class)
   - Fix all current publishing to the SNS Topic to use Targets instead of ConnectionIds
   - Update message format validation

2. **Connection Validation** ❌
   - Implement automatic connection cleanup if it's not already present
   - Handle connection errors gracefully

## SNS Publishing References to Update

The following files need to be updated to replace `ConnectionIds` with `Targets` when publishing to the `FEEDBACK_TOPIC`:

### **Lambda Functions** (8 files)
- `lambda/wml/parseWML.ts` - Lines 103, 116: ParseWML success/error messages
- `lambda/llm/app.ts` - Line 30: LLM generation success messages  
- `lambda/deliverMessageSync/app.ts` - Lines 34, 47: Message sync notifications
- `lambda/assets/app.ts` - Line 240: MetaData API responses
- `lambda/assets/fetchImportDefaults/index.ts` - Line 49: FetchImports responses
- `lambda/assets/returnValue/index.ts` - Line 19: ReturnValue messages
- `lambda/assets/player/info.ts` - Line 34: Player info responses
- `lambda/assets/libraryUpdate/index.ts` - Line 24: Library update notifications

### **Step Functions** (6 files)
- `stepFunctions/applyWMLEdit.asl.yaml` - Lines 136, 156: WML edit timeout/error notifications
- `stepFunctions/backupAsset.asl.yaml` - Line 112: Asset backup notifications
- `stepFunctions/publishWML.asl.yaml` - Line 79: WML publish notifications
- `stepFunctions/parseWML.asl.yaml` - Line 122: WML parse notifications
- `stepFunctions/llmGenerate.asl.yaml` - Line 79: LLM generation notifications
- `stepFunctions/cacheAssets.asl.yaml` - Line 112: Asset cache notifications

### **Update Pattern**
Each location follows this pattern:
```typescript
// Current (to be replaced):
ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([connectionId]) }

// New (using TargetResolver):
Targets: { DataType: 'String.Array', StringValue: JSON.stringify(['CONNECTION#' + connectionId]) }
```

### **Special Cases**
- `lambda/assets/player/info.ts`: Already resolves multiple connections per player, needs to convert to `CONNECTION#` format
- `lambda/assets/libraryUpdate/index.ts`: Already resolves multiple connections per library subscription, needs to convert to `CONNECTION#` format
- Step Functions: Use `States.JsonToString(States.Array('CONNECTION#' + $.args.connectionId))` pattern

## Existing Test Coverage

The following lambda functions have existing unit tests that verify SNS publishing behavior:

### **Tested Functions** (2 files)
- `lambda/assets/returnValue/index.test.ts` - Tests SNS message content validation
- `lambda/assets/fetchImportDefaults/index.test.ts` - Tests SNS message content with snapshots

### **Untested Functions** (6 files)
- `lambda/wml/parseWML.ts` - No existing tests
- `lambda/llm/app.ts` - No existing tests  
- `lambda/deliverMessageSync/app.ts` - No existing tests
- `lambda/assets/app.ts` - No existing tests
- `lambda/assets/player/info.ts` - No existing tests
- `lambda/assets/libraryUpdate/index.ts` - No existing tests

### **Test Update Strategy**
1. **Update existing tests** to verify new `Targets` format instead of `ConnectionIds`
2. **Add new tests** for untested functions to validate SNS publishing behavior
3. **Test both formats** during transition period to ensure backward compatibility

### **Phase 2: Delivery System Updates** ❌ NOT STARTED
3. **Modern Delivery Pipeline** ❌
   - Replace direct connection delivery with session-based delivery
   - Implement connection pooling for efficiency
   - Add delivery confirmation and retry logic

4. **Error Handling & Cleanup** ❌
   - Implement modern connection error handling
   - Add automatic connection cleanup for invalid sessions
   - Handle partial delivery failures

### **Phase 3: Testing & Validation** ❌ NOT STARTED
5. **Integration Testing** ❌
   - Test with modern SNS message formats
   - Validate session connection resolution
   - Test error scenarios and cleanup

6. **Backward Compatibility** ❌
   - Ensure legacy `ConnectionIds` messages still work
   - Test mixed message format scenarios
   - Validate no breaking changes

## Technical Implementation Details

### **Session Connection Resolution**
```typescript
const resolveSessionConnections = async (sessionId: string): Promise<string[]> => {
  const sessionConnections = await connectionDB.query<{ ConnectionId: string }>({
    Key: { ConnectionId: `SESSION#${sessionId}` },
    KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
    ExpressionAttributeValues: { ':dcPrefix': 'CONNECTION#' },
    ProjectionFields: ['ConnectionId']
  })
  
  return sessionConnections
    .map(({ ConnectionId }) => ConnectionId.replace('CONNECTION#', ''))
    .filter(Boolean)
}
```

### **Message Attribute Handling**
```typescript
const extractMessageInfo = (attributes: any) => {
  // Modern SessionId-based approach
  if (attributes.SessionId?.StringValue) {
    return {
      sessionId: attributes.SessionId.StringValue,
      requestId: attributes.RequestId?.StringValue,
      type: attributes.Type?.StringValue,
      error: attributes.Error?.StringValue
    }
  }
  
  // Legacy ConnectionIds approach
  if (attributes.ConnectionIds?.StringValue) {
    return {
      connectionIds: JSON.parse(attributes.ConnectionIds.StringValue),
      requestId: attributes.RequestId?.StringValue,
      type: attributes.Type?.StringValue,
      error: attributes.Error?.StringValue
    }
  }
  
  throw new Error('Invalid message format')
}
```

### **Connection Delivery Pipeline**
```typescript
const deliverMessage = async (targets: string[], message: any) => {
  const validConnections = await Promise.all(
    targets.map(async (connectionId) => {
      try {
        await apiClient.send({ ConnectionId: connectionId, Data: message })
        return connectionId
      } catch (error) {
        if (error.name === 'GoneException' || error.name === 'BadRequestException') {
          await cleanupInvalidConnection(connectionId)
        }
        throw error
      }
    })
  )
  
  return validConnections
}
```

## Dependencies & Integration Points

### **Required Services**
- **connectionDB**: For session connection resolution
- **apiClient**: For WebSocket message delivery
- **EventBridge**: For session disconnect notifications (future enhancement)

### **Integration Points**
- **SNS Topics**: `FEEDBACK_TOPIC` for incoming messages
- **WebSocket API**: For client message delivery
- **DynamoDB**: For connection state management

### **Dependencies to Add**
```typescript
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { apiClient } from '@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient'
```

## Migration Strategy

### **Phase 1: Dual Support** (Immediate)
- Add `SessionId` support alongside existing `ConnectionIds`
- Implement session connection resolution
- Maintain backward compatibility

### **Phase 2: Modern Default** (Short-term)
- Make `SessionId` the preferred method
- Deprecate `ConnectionIds` usage
- Update other lambdas to use new format

### **Phase 3: Legacy Removal** (Long-term)
- Remove `ConnectionIds` support
- Clean up legacy code paths
- Complete migration to session-based system

## Success Criteria

### **Functional Requirements**
- ✅ Accept SNS messages with `SessionId` attribute
- ✅ Resolve active connections for sessions
- ✅ Deliver messages to all session connections
- ✅ Handle connection errors gracefully
- ✅ Maintain backward compatibility

### **Performance Requirements**
- ✅ Process messages within 100ms
- ✅ Handle concurrent message processing
- ✅ Efficient connection resolution
- ✅ Minimal database queries

### **Reliability Requirements**
- ✅ Automatic connection cleanup
- ✅ Graceful error handling
- ✅ Message delivery confirmation
- ✅ Session state consistency

## Risk Assessment

### **Low Risk**
- **Backward Compatibility**: Legacy messages continue to work
- **Incremental Updates**: Can be implemented in phases
- **Testing Coverage**: Existing patterns can be validated

### **Medium Risk**
- **Session Resolution**: New database query patterns
- **Connection Management**: More complex connection lifecycle
- **Error Handling**: Additional error scenarios to handle

### **Mitigation Strategies**
- **Comprehensive Testing**: Test both old and new message formats
- **Gradual Rollout**: Implement in phases with monitoring
- **Fallback Mechanisms**: Maintain legacy support during transition
- **Monitoring**: Add metrics for new functionality

## Next Steps

1. **Immediate**: Review and approve this planning document
2. **Week 1**: Implement Phase 1 (SessionId support + backward compatibility)
3. **Week 2**: Implement Phase 2 (Modern delivery pipeline)
4. **Week 3**: Testing and validation
5. **Week 4**: Deployment and monitoring

## Questions for Discussion

- Should we implement connection pooling for efficiency?
- What monitoring metrics should we add for the new functionality?
- How should we handle session disconnection during message delivery?
- Should we add support for broadcast messages (all sessions)?
- What error reporting should we implement for failed deliveries?
