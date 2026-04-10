# MessageBus Testing Guide

This guide provides testing strategies and examples for the MessageBus system. For high-level concepts and implementation details, see [`AGENT.md`](./AGENT.md) and [`AGENT.implementation.md`](./AGENT.implementation.md).

## Testing Philosophy

### Async boundaries and message bus drains

When code under test `await`s a dependency (for example a mocked long render) and you need to assert **before** and **after** that await, use [`createAsyncGate`](../testing/asyncGate.ts) from `ts/testing/asyncGate.ts`: run the subject, assert pre-await side effects, call `resolve()`, then `await Promise.resolve()` (or similar) before post-await assertions. The same discipline applies when pairing with lane-scoped [`flush()` / `flush(laneId)`](./index.ts) so continuations and bus drains line up with your test steps.

### Unit Testing Handlers
- Test individual handlers in isolation
- Mock external dependencies (internalCache, AWS services)
- Verify handler behavior with different message types
- Test error handling and edge cases

### Integration Testing
- Test messageBus subscription and execution flow
- Verify priority ordering works correctly
- Test message persistence across handlers
- Validate type safety and error propagation

## Unit Testing Handlers

### Basic Handler Test

```ts
import { collaborationStatusMessage } from '../collaborationStatus'
import { MessageBus } from '../messageBus/baseClasses'

describe('collaborationStatusMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should process collaboration status requests', async () => {
        const mockMessageBus = new MessageBus()
        const payloads = [{
            type: 'CollaborationStatus' as const,
            RequestId: 'test-request-id'
        }]
        
        // Mock dependencies
        jest.spyOn(internalCache.Connection, 'get')
            .mockResolvedValueOnce('test-connection-id')
            .mockResolvedValueOnce('test-request-id')
        
        await collaborationStatusMessage({ payloads, messageBus: mockMessageBus })
        
        // Assert expected behavior
        expect(snsClient.send).toHaveBeenCalledWith(expect.any(PublishCommand))
    })

    it('should skip processing when no connection', async () => {
        const mockMessageBus = new MessageBus()
        const payloads = [{
            type: 'CollaborationStatus' as const,
            RequestId: 'test-request-id'
        }]
        
        // Mock no connection
        jest.spyOn(internalCache.Connection, 'get')
            .mockResolvedValueOnce(null)
        
        await collaborationStatusMessage({ payloads, messageBus: mockMessageBus })
        
        // Should not call SNS
        expect(snsClient.send).not.toHaveBeenCalled()
    })
})
```

### Testing Error Handling

```ts
describe('handlerName error handling', () => {
    it('should handle handler errors gracefully', async () => {
        const mockMessageBus = new MessageBus()
        const payloads = [{
            type: 'TestMessage' as const,
            data: 'test'
        }]
        
        // Mock handler to throw error
        jest.spyOn(console, 'error').mockImplementation(() => {})
        
        // This should not throw
        await expect(handlerName({ payloads, messageBus: mockMessageBus }))
            .resolves.not.toThrow()
        
        expect(console.error).toHaveBeenCalledWith(
            'Handler error:', 
            expect.any(Error)
        )
    })
})
```

### Testing with Mocked Dependencies

```ts
describe('handlerName with mocked dependencies', () => {
    let mockInternalCache: jest.Mocked<typeof internalCache>
    let mockSnsClient: jest.Mocked<typeof snsClient>

    beforeEach(() => {
        mockInternalCache = {
            Connection: {
                get: jest.fn()
            }
        } as any

        mockSnsClient = {
            send: jest.fn()
        } as any
    })

    it('should process messages with mocked dependencies', async () => {
        mockInternalCache.Connection.get
            .mockResolvedValueOnce('connection-id')
            .mockResolvedValueOnce('request-id')

        const payloads = [{ type: 'TestMessage' as const }]
        const mockMessageBus = new MessageBus()

        await handlerName({ payloads, messageBus: mockMessageBus })

        expect(mockSnsClient.send).toHaveBeenCalledWith(
            expect.objectContaining({
                TopicArn: 'test-topic',
                Message: expect.stringContaining('TestMessage')
            })
        )
    })
})
```

## Integration Testing

### MessageBus Flow Testing

```ts
import { messageBus } from '../messageBus'

describe('MessageBus Integration', () => {
    beforeEach(() => {
        messageBus.clear()
        jest.clearAllMocks()
    })

    it('should process messages in priority order', async () => {
        const executionOrder: string[] = []
        
        // Mock handlers to track execution order
        const handler1 = jest.fn().mockImplementation(async () => {
            executionOrder.push('handler1')
        })
        const handler2 = jest.fn().mockImplementation(async () => {
            executionOrder.push('handler2')
        })

        // Subscribe handlers with different priorities
        messageBus.subscribe({
            tag: 'Handler1',
            priority: 1,
            filter: (msg) => msg.type === 'Message1',
            callback: handler1
        })

        messageBus.subscribe({
            tag: 'Handler2',
            priority: 2,
            filter: (msg) => msg.type === 'Message2',
            callback: handler2
        })

        // Send messages
        messageBus.send({ type: 'Message1' })
        messageBus.send({ type: 'Message2' })

        await messageBus.flush()

        expect(executionOrder).toEqual(['handler1', 'handler2'])
    })

    it('should process messages at same priority in parallel', async () => {
        const startTimes: number[] = []
        const endTimes: number[] = []
        
        const handler1 = jest.fn().mockImplementation(async () => {
            startTimes.push(Date.now())
            await new Promise(resolve => setTimeout(resolve, 100))
            endTimes.push(Date.now())
        })

        const handler2 = jest.fn().mockImplementation(async () => {
            startTimes.push(Date.now())
            await new Promise(resolve => setTimeout(resolve, 100))
            endTimes.push(Date.now())
        })

        // Both handlers at same priority
        messageBus.subscribe({
            tag: 'Handler1',
            priority: 5,
            filter: (msg) => msg.type === 'Message1',
            callback: handler1
        })

        messageBus.subscribe({
            tag: 'Handler2',
            priority: 5,
            filter: (msg) => msg.type === 'Message2',
            callback: handler2
        })

        messageBus.send({ type: 'Message1' })
        messageBus.send({ type: 'Message2' })

        await messageBus.flush()

        // Should start at roughly the same time
        expect(Math.abs(startTimes[0] - startTimes[1])).toBeLessThan(50)
    })
})
```

### Testing Message Persistence

```ts
describe('MessageBus message persistence', () => {
    it('should allow multiple handlers to process same message', async () => {
        const handler1 = jest.fn()
        const handler2 = jest.fn()

        messageBus.subscribe({
            tag: 'Handler1',
            priority: 1,
            filter: (msg) => msg.type === 'SharedMessage',
            callback: handler1
        })

        messageBus.subscribe({
            tag: 'Handler2',
            priority: 2,
            filter: (msg) => msg.type === 'SharedMessage',
            callback: handler2
        })

        messageBus.send({ type: 'SharedMessage', data: 'test' })

        await messageBus.flush()

        // Both handlers should have processed the message
        expect(handler1).toHaveBeenCalledWith({
            payloads: [{ type: 'SharedMessage', data: 'test' }],
            messageBus
        })
        expect(handler2).toHaveBeenCalledWith({
            payloads: [{ type: 'SharedMessage', data: 'test' }],
            messageBus
        })
    })
})
```

## Testing Error Scenarios

### Handler Failure Testing

```ts
describe('Handler failure scenarios', () => {
    it('should continue processing other handlers when one fails', async () => {
        const successfulHandler = jest.fn()
        const failingHandler = jest.fn().mockRejectedValue(new Error('Handler failed'))

        messageBus.subscribe({
            tag: 'SuccessfulHandler',
            priority: 1,
            filter: (msg) => msg.type === 'Message1',
            callback: successfulHandler
        })

        messageBus.subscribe({
            tag: 'FailingHandler',
            priority: 1,
            filter: (msg) => msg.type === 'Message2',
            callback: failingHandler
        })

        messageBus.send({ type: 'Message1' })
        messageBus.send({ type: 'Message2' })

        // Should not throw
        await expect(messageBus.flush()).resolves.not.toThrow()

        // Successful handler should still run
        expect(successfulHandler).toHaveBeenCalled()
    })
})
```

### Priority Violation Testing

```ts
describe('Priority violation handling', () => {
    it('should warn when handlers create messages at lower priorities', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

        const handler1 = jest.fn().mockImplementation(async ({ messageBus }) => {
            // Create message at lower priority (violation)
            messageBus.send({ type: 'LowerPriorityMessage' })
        })

        messageBus.subscribe({
            tag: 'Handler1',
            priority: 2,
            filter: (msg) => msg.type === 'Message1',
            callback: handler1
        })

        messageBus.subscribe({
            tag: 'Handler2',
            priority: 1,
            filter: (msg) => msg.type === 'LowerPriorityMessage',
            callback: jest.fn()
        })

        messageBus.send({ type: 'Message1' })
        await messageBus.flush()

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('priority violation')
        )

        consoleSpy.mockRestore()
    })
})
```

## Testing Utilities

### MessageBus Test Helper

```ts
export class MessageBusTestHelper {
    private messageBus: MessageBus
    private handlers: Map<string, jest.Mock> = new Map()

    constructor(messageBus: MessageBus) {
        this.messageBus = messageBus
    }

    mockHandler(tag: string, priority: number, filter: (msg: any) => boolean) {
        const handler = jest.fn()
        this.handlers.set(tag, handler)
        
        this.messageBus.subscribe({
            tag,
            priority,
            filter,
            callback: handler
        })
        
        return handler
    }

    async sendAndFlush(message: any) {
        this.messageBus.send(message)
        await this.messageBus.flush()
    }

    getHandler(tag: string) {
        return this.handlers.get(tag)
    }

    clear() {
        this.messageBus.clear()
        this.handlers.clear()
    }
}

// Usage in tests
describe('Using MessageBusTestHelper', () => {
    let helper: MessageBusTestHelper
    let messageBus: MessageBus

    beforeEach(() => {
        messageBus = new MessageBus()
        helper = new MessageBusTestHelper(messageBus)
    })

    it('should test handler interactions', async () => {
        const handler1 = helper.mockHandler('Handler1', 1, (msg) => msg.type === 'Message1')
        const handler2 = helper.mockHandler('Handler2', 2, (msg) => msg.type === 'Message2')

        await helper.sendAndFlush({ type: 'Message1' })
        await helper.sendAndFlush({ type: 'Message2' })

        expect(handler1).toHaveBeenCalledTimes(1)
        expect(handler2).toHaveBeenCalledTimes(1)
    })
})
```

### Mock Data Factories

```ts
export const createTestMessage = (overrides: Partial<MessageType> = {}): MessageType => ({
    type: 'TestMessage',
    ...overrides
})

export const createCollaborationStatusMessage = (overrides: Partial<CollaborationStatusMessage> = {}): CollaborationStatusMessage => ({
    type: 'CollaborationStatus',
    RequestId: 'test-request-id',
    ...overrides
})

// Usage in tests
describe('Using mock data factories', () => {
    it('should process test messages', async () => {
        const message = createTestMessage({ data: 'custom-data' })
        const handler = jest.fn()

        messageBus.subscribe({
            tag: 'TestHandler',
            priority: 1,
            filter: (msg) => msg.type === 'TestMessage',
            callback: handler
        })

        messageBus.send(message)
        await messageBus.flush()

        expect(handler).toHaveBeenCalledWith({
            payloads: [message],
            messageBus
        })
    })
})
```

## Performance Testing

### Load Testing Handlers

```ts
describe('Handler performance', () => {
    it('should handle large numbers of messages efficiently', async () => {
        const handler = jest.fn()
        
        messageBus.subscribe({
            tag: 'PerformanceHandler',
            priority: 1,
            filter: (msg) => msg.type === 'PerformanceMessage',
            callback: handler
        })

        const startTime = Date.now()
        const messageCount = 1000

        // Send many messages
        for (let i = 0; i < messageCount; i++) {
            messageBus.send({ type: 'PerformanceMessage', id: i })
        }

        await messageBus.flush()
        const endTime = Date.now()

        expect(handler).toHaveBeenCalledTimes(messageCount)
        expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })
})
```

## Best Practices

### Test Organization

```ts
describe('MessageBus Handler Tests', () => {
    // Group related tests
    describe('collaborationStatusMessage', () => {
        // Test happy path
        it('should process valid requests')
        
        // Test error cases
        it('should handle missing connection')
        it('should handle SNS errors')
        
        // Test edge cases
        it('should handle empty payloads')
        it('should handle malformed requests')
    })
})
```

### Mock Management

```ts
describe('Proper mock management', () => {
    let mockInternalCache: jest.Mocked<typeof internalCache>
    let mockSnsClient: jest.Mocked<typeof snsClient>

    beforeEach(() => {
        // Set up mocks
        mockInternalCache = createMockInternalCache()
        mockSnsClient = createMockSnsClient()
    })

    afterEach(() => {
        // Clean up mocks
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })
})
```

### Assertion Patterns

```ts
describe('Assertion patterns', () => {
    it('should verify handler behavior', async () => {
        const handler = jest.fn()
        
        // Test handler was called
        expect(handler).toHaveBeenCalled()
        
        // Test handler was called with correct arguments
        expect(handler).toHaveBeenCalledWith({
            payloads: expect.arrayContaining([
                expect.objectContaining({
                    type: 'ExpectedMessage'
                })
            ]),
            messageBus: expect.any(MessageBus)
        })
        
        // Test handler was called correct number of times
        expect(handler).toHaveBeenCalledTimes(1)
    })
})
```
