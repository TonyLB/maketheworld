# MessageBus Implementation Guide

This guide provides detailed code examples and implementation patterns for the MessageBus system. For high-level concepts and navigation, see [`AGENT.md`](./AGENT.md).

## `publish` / `settle` steady state

Implementation: [`index.ts`](./index.ts). Each lambda uses a single `InternalMessageBus` instance. Producers call **`publish`**; handler work is tracked in **`_inFlight`** and drained by **`settle()`**. Lambda boundaries call **`flushAndSettle()`** (settle loop + **`runDeferrals()`** tail).

| Method | Returns | Behavior |
| --- | --- | --- |
| `publish(payload)` | `void` | Schedules all matching subscribers **concurrently** (ignores `priority`). Each callback receives `payloads: [payload]`. Handler promises tracked in `_inFlight` with subscription `tag`. |
| `settle()` | `Promise<boolean>` | Inner quiescence loop: snapshot `_inFlight`, `Promise.allSettled`, log rejections with `tag`, repeat until empty. Returns `true` if any handler was scheduled; `false` if `_inFlight` empty throughout. **Does not reject** on handler failures. |
| `flushAndSettle()` | `Promise<void>` | Outer loop: `while (await settle()) {}`, then `await runDeferrals()`. **Lambda boundary drain only** -- do not split `settle()` and `runDeferrals()` in `app.ts`. |
| `registerDeferral(tag, hooks)` | `void` | Registers `{ onClear?, afterSettled }`; throws on duplicate `tag`. Registrations persist across invocations. |
| `runDeferrals()` | `Promise<void>` | `Promise.allSettled` over all `afterSettled` hooks; logs rejections; does not reject. Called only from **`flushAndSettle` tail**, not from producer-side mid-invocation drain. |
| `clear()` | `void` | Clears `_inFlight` tracking; invokes each deferral's `onClear`. Does not cancel detached async work. |

**Subscription `priority`:** retained on the subscribe type for documentation; **`publish` does not enforce priority ordering**. Matching subscribers run concurrently.

**Defer buffer (orchestration outbound coalescing):** not a second subscriber queue. **`registerDeferral`** + per-need aggregators at module load; **`afterSettled`** hooks are **IO-only** (no `publish` from registrants). Examples: ephemera [`publishMessage/coalescer.ts`](../../../lambda/ephemera/publishMessage/coalescer.ts) (`deliveryMode: 'deferred'` **character move only**), [`checkLocation/coalescer.ts`](../../../lambda/ephemera/checkLocation/coalescer.ts), [`returnValue/collector.ts`](../../../lambda/ephemera/returnValue/collector.ts). DataSource fan-in stores ([`FanInClusterStore`](../dataSource/fanInClusterStore.ts)) also register deferrals for settle-time incomplete clusters; see [Fan-in cluster pattern](../dataSource/AGENT.implementation.md#fan-in-cluster-pattern-multi-leg-ingress-correlation).

## Boundary response collector

Implementation: [`boundaryResponseCollector.ts`](./boundaryResponseCollector.ts). Use at **lambda module load** when handlers publish `ReturnValue` / `Error` messages that must be assembled into an HTTP or invoke response after `flushAndSettle()`.

**Contract:**

- **`ReturnValue`:** spread-merge `body` objects across the invocation (later keys overwrite earlier keys).
- **`Error`:** first error wins; subsequent errors are ignored until `reset` / `onClear`.
- **Subscriptions:** priority **16** by default (`ReturnValueCollector`, `ErrorCollector`).
- **Deferral:** registers `onClear: reset` so `messageBus.clear()` at ingress resets per-invocation buffers.

**`extractReturnValue` stays per-lambda.** The package collects fragments; each lambda owns HTTP/API Gateway shaping (RequestId, default Success, WebSocket route-response passthrough, etc.). Reference consumers: [`lambda/diagnostics/returnValue/`](../../../lambda/diagnostics/returnValue/), [`lambda/ephemera/returnValue/`](../../../lambda/ephemera/returnValue/).

```ts
import {
    createBoundaryResponseCollector,
    type ReturnValueMessage,
    type ErrorMessage,
    isReturnValueMessage,
    isErrorMessage,
} from '@tonylb/mtw-lambda-patterns/ts/messageBus'

// baseClasses.ts: compose into MessageType union
export type MessageType = ReturnValueMessage | ErrorMessage | StreamingEventMessage

// returnValue/collector.ts: one factory call per lambda (module singleton)
export const {
    register: registerReturnValueCollector,
    getCollectedReturnValueBody,
    getCollectedError,
    reset: resetReturnValueCollector,
} = createBoundaryResponseCollector<MessageType>()
```

Use default `includeError: true` when the lambda publishes bus `Error` messages for boundary assembly. Ephemera uses both bus `Error` (infrastructure) and `ReturnValue` bodies with `messageType: 'Error'` (WebSocket app contract); only the former is collected as bus `Error`.

## Lambda roll-out checklist

Mechanical steps to migrate a lambda from hand-rolled `returnValue/collector.ts` to the shared factory. **All production lambdas below are migrated** (diagnostics pilot, ephemera boundary rework, then assets/wml/connections).

| Step | Action |
| --- | --- |
| 1 | Replace `returnValue/collector.ts` with a thin `createBoundaryResponseCollector<MessageType>()` wrapper; preserve public exports (`registerReturnValueCollector`, `getCollected*`, `reset`, test helpers). |
| 2 | Import/re-export `ReturnValueMessage`, `ErrorMessage`, `isReturnValueMessage`, `isErrorMessage` from `@tonylb/mtw-lambda-patterns/ts/messageBus` in `messageBus/baseClasses.ts`. |
| 3 | Ensure `extractReturnValue` checks `getCollectedError()` before ReturnValue body assembly (lambda-specific response shaping stays local). |
| 4 | Grep `messageBus.publish({ type: 'Error'` and verify each boundary exit calls `extractReturnValue` after `flushAndSettle`. |
| 5 | Slim `returnValue/collector.test.ts` to integration-only (`extractReturnValue` policy); generic merge/reset/register tests live in [`boundaryResponseCollector.test.ts`](./boundaryResponseCollector.test.ts). |
| 6 | Run lambda tests + package `boundaryResponseCollector.test.ts`. |

**Reference consumers:** [`lambda/diagnostics/returnValue/`](../../../lambda/diagnostics/returnValue/), [`lambda/ephemera/returnValue/`](../../../lambda/ephemera/returnValue/), [`lambda/assets/returnValue/`](../../../lambda/assets/returnValue/), [`lambda/wml/returnValue/`](../../../lambda/wml/returnValue/), [`lambda/connections/returnValue/`](../../../lambda/connections/returnValue/).

**Per-lambda notes:** assets keeps SNS side-effect `ReturnValue` handler at priority 9; connections `extractReturnValue` has WebSocket route-response passthrough; ephemera keeps `ReturnValue`-encoded app errors separate from bus `Error`; diagnostics returns raw invoke bodies without default Success.

```ts
// Publish path (immediate scheduling)
messageBus.publish({ type: 'SomeEvent', ... })
await messageBus.settle()  // test harness drain only; not production handler bodies

// Lambda boundary drain
await messageBus.flushAndSettle()  // settle loop, then runDeferrals()

// Deferral registration (module load)
publishMessageCoalescer.registerDeferral(messageBus)
checkLocationCoalescer.registerDeferral(messageBus)
```

**DataSource outbounds:** [`streamEvent` / `streamEnvelope`](../dataSource/index.ts) always call `messageBus.publish` for bus delivery. See **Message bus integration** in [`../dataSource/AGENT.implementation.md`](../dataSource/AGENT.implementation.md).

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

messageBus.publish({
    type: 'payloadOne',
    glueId: 'test',
    blahBlahBlah: {}
})

await messageBus.flushAndSettle()
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
        messageBus.publish({
            type: 'SomeMessage',
            // ... message-specific data
        })
    }
    
    // Process all messages
    await messageBus.flushAndSettle()
    
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
        messageBus.publish({
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
    
    await messageBus.flushAndSettle()
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
