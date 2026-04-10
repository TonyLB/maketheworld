# MessageBus Implementation Guide

This guide provides detailed code examples and implementation patterns for the MessageBus system. For high-level concepts and navigation, see [`AGENT.md`](./AGENT.md).

## Virtual lanes (`InternalMessageBus`)

Ephemera and other lambdas use **virtual lanes** on a **single** `InternalMessageBus` instance: queue items may carry optional **`laneId`**, and **`flush()`** / **`flush(laneId)`** drain only items in the matching lane. Implementation: [`index.ts`](./index.ts).

### API (summary)

- **Queue cell:** `{ processedBy, payload, laneId? }`. **Default lane:** omit `laneId` on the cell (use `send(payload)` or `send(payload, laneId)` with `laneId` absent / empty string; empty string is treated as default).
- **`send(payload, laneId?)`:** second argument is a **non-empty string** for a named lane.
- **`flush()`:** drains **default-lane** items only. **`flush(laneId)`:** drains only that named lane.
- **Subscriptions:** callbacks receive **`InternalMessageBusCallbackProps`**: `payloads`, `messageBus`, and **`activeFlushLane`** (`undefined` = default lane drain, `string` = named lane being drained). Lane id stays on the queue cell for routing; payload types are unchanged.

### Drain behavior

**`flushLane`** re-invokes itself with the **same** `activeLane` until no matching work remains, so a single outer `flush` / `flush(laneId)` runs that lane to quiescence for the current wave of matching items. Nested or concurrent `flush` calls are the same class of concern as any shared async resource; see tests in [`index.test.ts`](./index.test.ts). For tests that `await` slow work while asserting bus side effects, see [`AGENT.testing.md`](./AGENT.testing.md) (`createAsyncGate` with `flush()` / `flush(laneId)`).

### Naming and architecture

- Use **`laneId`**, not **`busId`**: one physical bus and one subscription graph; lanes partition the **queue**, not process identity. A second `MessageBus` instance was rejected to avoid duplicate subscriptions and because `DataSource` is constructed against a single bus reference.
- **DataSource outbound** events (`streamEvent` / `streamEnvelope`) inherit or override lanes from inbound drains; see **Message bus lanes** in [`../dataSource/AGENT.implementation.md`](../dataSource/AGENT.implementation.md).

### Non-goals and follow-ons (product)

- No **cross-lane ordering** guarantees beyond an explicit later pattern (e.g. hand off with `send` on the default lane and `flush()`).
- Lanes do **not** change external EventBridge contracts.

### Open questions

- **`clear()`** is **global** (entire stream) in the current implementation; a lane-scoped clear is not defined.
- **Performance:** each `flush` scans `_stream` for matching lanes; acceptable at typical Lambda scale; revisit if profiling says otherwise.
- If **`send`** gains more per-send options, a single overload such as `send(payload, options?: { laneId?: string })` is an acceptable evolution from the positional second argument.

## Generic InternalMessageBus Usage

### Basic Setup

```ts
import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'

type MessagePayloadOne = {
    type: 'payloadOne';
    glueId: string;
    blahBlahBlah: Record<string, number>;
}

type MessagePayloadTwo = {
    type: 'payloadTwo';
    conferenceKey: string;
    values: string[];
}

type MessagePayloads = MessagePayloadOne | MessagePayloadTwo

const messageBus = new InternalMessageBus<MessagePayloads>()

const filterOne = (payload: MessagePayloads): payload is MessagePayloadOne => 
    (payload.type === 'payloadOne')

const computeOne = async ({
    payloads,
    messageBus
}: {
    payloads: MessagePayloadOne[];
    messageBus: InternalMessageBus<MessagePayloads>
}): Promise<void> => {
    // Process payloads
}

messageBus.subscribe({
    tag: 'functionOne',
    filter: filterOne,
    callback: computeOne,
    priority: 5
})

messageBus.send({
    type: 'payloadOne',
    glueId: 'test',
    blahBlahBlah: {}
})

await messageBus.flush()
```

## Domain-Specific MessageBus Pattern

### File Structure

Each lambda that uses messageBus follows this pattern:

```
lambda/[service]/messageBus/
├── baseClasses.ts    # Message type definitions and type guards
└── index.ts         # MessageBus instance and subscriptions
```

### Message Type Definitions (`baseClasses.ts`)

```ts
import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'

// Message type definitions
export type FetchLibraryMessage = {
    type: 'FetchLibrary';
}

export type FetchAssetMessage = {
    type: 'FetchAsset';
    AssetId?: string;
    fileName?: string;
}

export type CollaborationStatusMessage = {
    type: 'CollaborationStatus';
    RequestId?: string;
}

// Union type of all messages
export type MessageType = 
    | FetchLibraryMessage
    | FetchAssetMessage
    | CollaborationStatusMessage

// Type guard functions
export const isFetchLibraryMessage = (prop: MessageType): prop is FetchLibraryMessage => 
    (prop.type === 'FetchLibrary')

export const isFetchAssetMessage = (prop: MessageType): prop is FetchAssetMessage => 
    (prop.type === 'FetchAsset')

export const isCollaborationStatusMessage = (prop: MessageType): prop is CollaborationStatusMessage => 
    (prop.type === 'CollaborationStatus')

// Domain-specific MessageBus class
export class MessageBus extends InternalMessageBus<MessageType> {}
```

### MessageBus Setup (`index.ts`)

```ts
import {
    MessageBus,
    isFetchLibraryMessage,
    isFetchAssetMessage,
    isCollaborationStatusMessage
} from "./baseClasses"

// Import handler functions
import fetchLibraryHandler from "../fetchLibrary"
import fetchAssetHandler from "../fetch"
import collaborationStatusHandler from "../collaborationStatus"

// Create messageBus instance
export const messageBus = new MessageBus()

// Register all handlers with appropriate priorities
messageBus.subscribe({
    tag: 'FetchLibrary',
    priority: 5,
    filter: isFetchLibraryMessage,
    callback: fetchLibraryHandler
})

messageBus.subscribe({
    tag: 'FetchAsset',
    priority: 5,
    filter: isFetchAssetMessage,
    callback: fetchAssetHandler
})

messageBus.subscribe({
    tag: 'CollaborationStatus',
    priority: 5,
    filter: isCollaborationStatusMessage,
    callback: collaborationStatusHandler
})

export default messageBus
```

## Handler Function Patterns

### Standard Handler Signature

```ts
export const handlerName = async ({ 
    payloads, 
    messageBus 
}: { 
    payloads: MessageType[], 
    messageBus: MessageBus 
}): Promise<void> => {
    // Handler implementation
}
```

### Real-World Handler Example

```ts
import { snsClient } from "../clients"
import { CollaborationStatusMessage, MessageBus } from "../messageBus/baseClasses"
import { PublishCommand } from "@aws-sdk/client-sns"
import { ConnectionKey } from "@tonylb/mtw-utilities/ts/types"
import internalCache from '../internalCache'

const { FEEDBACK_TOPIC } = process.env

export const collaborationStatusMessage = async ({ 
    payloads, 
    messageBus 
}: { 
    payloads: CollaborationStatusMessage[], 
    messageBus: MessageBus 
}): Promise<void> => {
    const ConnectionId = await internalCache.Connection.get('connectionId')
    const RequestId = await internalCache.Connection.get('RequestId')

    if (ConnectionId) {
        // Process each payload
        await Promise.all(payloads.map(async (payload) => {
            // Handler-specific logic
            const status = { phase: 'Bootstrap' as const }
            
            await snsClient.send(new PublishCommand({
                TopicArn: FEEDBACK_TOPIC,
                Message: JSON.stringify({
                    messageType: 'CollaborationStatus',
                    status
                }),
                MessageAttributes: {
                    RequestId: { DataType: 'String', StringValue: RequestId || '' },
                    Targets: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionKey(ConnectionId)]) },
                    Type: { DataType: 'String', StringValue: 'Success' }
                }
            }))
        }))
    }
}

export default collaborationStatusMessage
```

## Usage in Lambda Handlers

### Sending Messages

```ts
import { messageBus } from './messageBus'

export const handler = async (event: any, context: any) => {
    // Clear messageBus for new request
    messageBus.clear()
    
    // Send messages based on API requests
    if (isSomeAPIMessage(request)) {
        messageBus.send({
            type: 'SomeMessage',
            // ... message-specific data
        })
    }
    
    // Process all messages
    await messageBus.flush()
    
    return { statusCode: 200, body: JSON.stringify({ messageType: 'Success' }) }
}
```

## Common Implementation Patterns

### Conditional Processing

```ts
export const handlerName = async ({ payloads, messageBus }: HandlerProps): Promise<void> => {
    const connectionId = await internalCache.Connection.get('connectionId')
    
    if (!connectionId) {
        // Skip processing if no connection
        return
    }
    
    // Process payloads
    await Promise.all(payloads.map(processPayload))
}
```

### Batch Processing

```ts
export const handlerName = async ({ payloads, messageBus }: HandlerProps): Promise<void> => {
    // Group payloads by some criteria
    const groupedPayloads = payloads.reduce((groups, payload) => {
        const key = payload.someProperty
        if (!groups[key]) groups[key] = []
        groups[key].push(payload)
        return groups
    }, {} as Record<string, MessageType[]>)
    
    // Process each group
    await Promise.all(
        Object.entries(groupedPayloads).map(([key, groupPayloads]) => 
            processGroup(key, groupPayloads)
        )
    )
}
```

### Sending Follow-up Messages

```ts
export const handlerName = async ({ payloads, messageBus }: HandlerProps): Promise<void> => {
    await Promise.all(payloads.map(async (payload) => {
        // Process the message
        const result = await processMessage(payload)
        
        // Send follow-up message
        messageBus.send({
            type: 'FollowUpMessage',
            result,
            originalId: payload.id
        })
    }))
}
```

## Error Handling Patterns

### Handler-Level Errors

```ts
export const handlerName = async ({ payloads, messageBus }: HandlerProps): Promise<void> => {
    try {
        // Handler logic
    } catch (error) {
        console.error('Handler error:', error)
        // Log error but don't throw - other handlers should still execute
    }
}
```

### Graceful Degradation

```ts
export const handlerName = async ({ payloads, messageBus }: HandlerProps): Promise<void> => {
    const results = await Promise.allSettled(
        payloads.map(processPayload)
    )
    
    // Handle partial failures
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`Failed to process payload ${index}:`, result.reason)
        }
    })
}
```

## Type Safety Best Practices

### Message Type Design

```ts
// Use descriptive, action-oriented message types
export type FetchAssetMessage = {
    type: 'FetchAsset';
    AssetId?: string;
    fileName?: string;
}

// Include all necessary data in the message payload
export type MoveAssetMessage = {
    type: 'MoveAsset';
    AssetId: string;
    fromZone: Zone;
    toZone: Zone;
}

// Use optional fields for data that might not always be present
export type PlayerInfoMessage = {
    type: 'PlayerInfo';
    player?: string;
    sessionId?: string;
    RequestId?: string;
}
```

### Type Guard Patterns

```ts
// Use descriptive type guard names
export const isFetchAssetMessage = (prop: MessageType): prop is FetchAssetMessage => 
    (prop.type === 'FetchAsset')

// Leverage TypeScript's discriminated unions
export const isPlayerInfoMessage = (prop: MessageType): prop is PlayerInfoMessage => 
    (prop.type === 'PlayerInfo')

// Use type guards in handlers for additional safety
export const handlerName = async ({ payloads, messageBus }: HandlerProps): Promise<void> => {
    const validPayloads = payloads.filter(isValidMessage)
    // Process only valid payloads
}
```

## Performance Considerations

### Memory Management

```ts
// Always clear messageBus between requests
export const handler = async (event: any, context: any) => {
    messageBus.clear() // Important: prevents memory leaks
    
    // ... process messages
    
    await messageBus.flush()
}
```

### Batch Processing

```ts
// Process multiple messages efficiently
export const handlerName = async ({ payloads, messageBus }: HandlerProps): Promise<void> => {
    // Use Promise.all for parallel processing
    await Promise.all(payloads.map(processPayload))
    
    // Or batch database operations
    const dbPromises = payloads.map(payload => 
        database.putItem(createItem(payload))
    )
    await Promise.all(dbPromises)
}
```

### Priority Optimization

```ts
// Group related operations at the same priority
messageBus.subscribe({
    tag: 'AssetOperations',
    priority: 5, // All asset operations at same priority
    filter: isAssetMessage,
    callback: assetHandler
})

// Use higher priorities for cleanup operations
messageBus.subscribe({
    tag: 'Cleanup',
    priority: 9, // Cleanup after all business logic
    filter: isCleanupMessage,
    callback: cleanupHandler
})
```
