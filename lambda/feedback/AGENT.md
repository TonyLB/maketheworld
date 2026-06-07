# Feedback Lambda - AI Navigation Guide

## Overview

The Feedback Lambda is a utility service that processes SNS messages and delivers them to WebSocket clients. It serves as the central message distribution hub for the system, accepting messages with `Targets` (either `CONNECTION#${string}` or `SESSION#${string}` IDs) and delivering them to the appropriate WebSocket connections.

### Key Concepts
- **Targets**: JSON array of connection or session identifiers in the format `CONNECTION#${string}` or `SESSION#${string}`
- **TargetResolver**: Utility class that expands `SESSION#` targets to all associated connections
- **Dual protocol**: SNS `Type` attribute selects handler --- `StreamEvent` uses formatTransform (SNS -> CoreExternalFormat -> WebSocket); `Success` / `Error` are RPC-style passthrough (not CoreExternalFormat)

## Core Purpose

**Primary Function**: Process SNS messages and deliver them to WebSocket clients via connection resolution and fan-out delivery.

**Key Responsibilities**:
- Parse SNS messages with `Targets` attribute
- Resolve session targets to individual connections
- For **StreamEvent**: normalize SNS Feedback wire to canonical flat WebSocket (`fromSNSFeedbackFormat` -> `toWebSocketFormat`)
- For **Success** / **Error**: passthrough or build RPC ack payloads with `RequestId`
- Handle connection errors gracefully

## Technical Details

### Data Structures
```typescript
// SNS Message Attributes
interface SNSMessageAttributes {
  Targets: { DataType: 'String.Array', StringValue: string }  // JSON array of targets
  RequestId: { DataType: 'String', StringValue: string }
  Type: { DataType: 'String', StringValue: string }
  Error?: { DataType: 'String', StringValue: string }
}

// Target Resolution
type Target = `CONNECTION#${string}` | `SESSION#${string}`
```

### Core Methods
- **Message Processing**: Extracts targets from SNS message attributes
- **Target Resolution**: Uses `TargetResolver` to expand session targets to connections
- **Connection Delivery**: Sends messages to resolved connection IDs
- **Error Handling**: Filters invalid targets and handles delivery failures

### Configuration
- **Internal Cache**: Uses `CacheSessionConnectionsData` for session-to-connection lookups
- **Target Validation**: Uses `isResolvableTarget` typeguard to validate target format
- **Connection Filtering**: Automatically filters out empty or invalid connection IDs

## Integration Points

### Dependencies
- **`@tonylb/mtw-sessions`**: For `TargetResolver` and session connection management
- **`@tonylb/mtw-utilities`**: For internal cache implementation
- **AWS SNS**: Receives messages from various system components
- **AWS API Gateway**: Delivers messages to WebSocket clients

### Cross-References
- **Lambda Functions**: All lambdas now publish to SNS using `Targets` format
- **Step Functions**: All step functions publish to SNS using `Targets` format
- **Client System**: Receives messages via WebSocket connections

### System Relationships
- **Message Consumer**: Receives SNS messages from all system components
- **Connection Manager**: Resolves session targets to active connections
- **Message Router**: Delivers messages to appropriate WebSocket clients

## Usage Patterns

### SNS Message Publishing
```typescript
// Lambda functions publish with Targets format
const snsMessage = {
  MessageAttributes: {
    Targets: { 
      DataType: 'String.Array', 
      StringValue: JSON.stringify([ConnectionKey(connectionId)]) 
    },
    Type: { DataType: 'String', StringValue: 'Success' },
    RequestId: { DataType: 'String', StringValue: requestId }
  }
}

// Step functions use States.JsonToString pattern
Targets: { 
  DataType: 'String.Array', 
  StringValue: "States.JsonToString(States.Array('CONNECTION#' + $.args.connectionId))" 
}
```

### Target Resolution
- **Direct Connections**: `CONNECTION#abc123` → delivered directly
- **Session Expansion**: `SESSION#xyz789` → expanded to all session connections
- **Mixed Targets**: Can handle arrays with both connection and session targets

## Navigation Tips

### Getting Started
1. **`app.ts`**: Main lambda handler and message processing logic
2. **`internalCache/index.ts`**: Session connection cache implementation
3. **`clients.ts`**: WebSocket client management utilities

### Key Files
- **`app.ts`**: Core message processing and delivery logic
- **`internalCache/index.ts`**: Session connection resolution cache
- **`package.json`**: Dependencies and build configuration

### Related Documentation
- **Project Overview**: See [`../../AGENT.md`](../../AGENT.md) for system architecture
- **Sessions Package**: See [`../../packages/mtw-sessions/AGENT.md`](../../packages/mtw-sessions/AGENT.md) for target resolution
- **Utilities Package**: See [`../../packages/mtw-utilities/AGENT.md`](../../packages/mtw-utilities/AGENT.md) for cache utilities

## Development Notes

### Current State
- **Migration Complete**: Successfully migrated from `ConnectionIds` to `Targets` format
- **StreamEvent alignment**: Replay StreamEvents use `streamEventSnsMessageToWebSocketData` (`fromSNSFeedbackFormat` -> `toWebSocketFormat`) before WebSocket send
- **Session Support**: Full support for `SESSION#` target expansion
- **Tests**: [`app.test.ts`](./app.test.ts) covers StreamEvent transform and Success/Error passthrough

### Known Limitations
- **Connection Validation**: Relies on WebSocket API for connection validity
- **Error Handling**: Basic error filtering without retry mechanisms
- **Performance**: No connection pooling or delivery optimization

### Technical Debt
- **Legacy Support**: `ConnectionIds` fallback could be removed in future
- **Error Handling**: Could benefit from more sophisticated retry logic
- **Monitoring**: No metrics for message delivery success/failure rates
