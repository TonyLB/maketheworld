# Internal Cache Implementation Guide

This guide provides detailed code examples and implementation patterns for the Internal Cache system. For high-level concepts and navigation, see [`AGENT.md`](./AGENT.md).

## Core Infrastructure Usage

### Basic DeferredCache Setup

```typescript
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

type CacheDataType = {
    id: string;
    value: string;
}

const cache = new DeferredCache<CacheDataType>({
    callback: (key, value) => {
        console.log(`Cached: ${key}`, value)
    },
    defaultValue: (key) => ({
        id: key,
        value: 'default'
    })
})

// Add data to cache
cache.add({
    promiseFactory: () => fetchDataFromDatabase(),
    requiredKeys: ['key1', 'key2'],
    transform: (data) => ({
        key1: { id: 'key1', value: data.value1 },
        key2: { id: 'key2', value: data.value2 }
    })
})

// Get data (returns promise)
const data = await cache.get('key1')
```

### Dual Storage Pattern

```typescript
import { DualStorageCacheHandler } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

export class MyCacheHandler extends DualStorageCacheHandler<DataType> {
    constructor() {
        super({
            defaultValue: (key) => this._createDefault(key)
        })
    }

    async get(id: string): Promise<DataType> {
        const key = `item_${id}`
        
        if (!this.isCached(key)) {
            this._Cache.add({
                promiseFactory: () => this._fetchFromDatabase(id),
                requiredKeys: [key],
                transform: (data) => ({ [key]: data })
            })
        }
        
        return this._Cache.get(key)
    }

    private async _fetchFromDatabase(id: string): Promise<DataType> {
        // Database fetch logic
    }

    private _createDefault(key: string): DataType {
        // Default value creation
    }
}
```

## Pattern Utilities

### CacheKeyValidator Usage

```typescript
import { CacheKeyValidator } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

// Simple single-key validator
const simpleValidator = CacheKeyValidator.createSimpleValidator(
    (value): value is string => typeof value === 'string' && value.length > 0
)

const key = simpleValidator.generateKey('my-key')
const parsed = simpleValidator.parseKey('my-key')

// Delimited key validator
const delimitedValidator = CacheKeyValidator.createDelimitedValidator(
    '::',
    ['assetId', 'ephemeraId'],
    {
        assetId: (value) => isSchemaAssetUUID(value),
        ephemeraId: (value) => isSchemaComponentUUID(value)
    }
)

const complexKey = delimitedValidator.generateKey('asset-123', 'ephemera-456')
const { assetId, ephemeraId } = delimitedValidator.parseKey(complexKey)
```

### CacheMethodMixin Usage

```typescript
import { withCacheMethods } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

// Apply mixin to existing class
export class MyCacheHandler extends withCacheMethods<DataType, string>(
    (id) => `item_${id}`
) {
    private _Cache: DeferredCache<DataType>
    private _Store: Record<string, DataType> = {}

    constructor() {
        super()
        this._Cache = new DeferredCache<DataType>({
            callback: (key, value) => this._Store[key] = value
        })
    }

    // Mixin provides: clear(), flush(), invalidate(), set(), isCached()
    // You only need to implement domain-specific methods

    async get(id: string): Promise<DataType> {
        const key = `item_${id}`
        if (!this.isCached(key)) {
            this._Cache.add({
                promiseFactory: () => this._fetchData(id),
                requiredKeys: [key],
                transform: (data) => ({ [key]: data })
            })
        }
        return this._Cache.get(key)
    }

    private async _fetchData(id: string): Promise<DataType> {
        // Custom fetch logic
    }
}
```

## Common Implementation Patterns

### Database Integration

```typescript
export class DatabaseCacheHandler extends DualStorageCacheHandler<DatabaseItem> {
    constructor(private dbClient: DatabaseClient) {
        super()
    }

    async get(id: string): Promise<DatabaseItem> {
        const key = `db_item_${id}`
        
        if (!this.isCached(key)) {
            this._Cache.add({
                promiseFactory: () => this._fetchFromDatabase(id),
                requiredKeys: [key],
                transform: (data) => ({ [key]: data })
            })
        }
        
        return this._Cache.get(key)
    }

    private async _fetchFromDatabase(id: string): Promise<DatabaseItem> {
        const result = await this.dbClient.getItem({
            Key: { id }
        })
        
        if (!result) {
            throw new Error(`Item not found: ${id}`)
        }
        
        return this._transformDatabaseResult(result)
    }

    private _transformDatabaseResult(dbResult: any): DatabaseItem {
        // Transform database result to expected format
        return {
            id: dbResult.id,
            value: dbResult.value,
            metadata: dbResult.metadata
        }
    }
}
```

### Batch Processing

```typescript
export class BatchCacheHandler extends DualStorageCacheHandler<BatchItem> {
    async getBatch(ids: string[]): Promise<BatchItem[]> {
        const keys = ids.map(id => `batch_${id}`)
        const uncachedKeys = keys.filter(key => !this.isCached(key))
        
        if (uncachedKeys.length > 0) {
            this._Cache.add({
                promiseFactory: () => this._fetchBatch(uncachedKeys),
                requiredKeys: uncachedKeys,
                transform: (data) => this._transformBatchData(data)
            })
        }
        
        return Promise.all(keys.map(key => this._Cache.get(key)))
    }

    private async _fetchBatch(keys: string[]): Promise<BatchItem[]> {
        const ids = keys.map(key => key.replace('batch_', ''))
        
        const results = await this.dbClient.getItems({
            Keys: ids.map(id => ({ id }))
        })
        
        return results.map(this._transformDatabaseResult)
    }

    private _transformBatchData(data: BatchItem[]): Record<string, BatchItem> {
        return data.reduce((acc, item) => {
            acc[`batch_${item.id}`] = item
            return acc
        }, {} as Record<string, BatchItem>)
    }
}
```

### Conditional Caching

```typescript
export class ConditionalCacheHandler extends DualStorageCacheHandler<ConditionalItem> {
    async get(id: string, options?: { forceRefresh?: boolean }): Promise<ConditionalItem> {
        const key = `conditional_${id}`
        
        if (options?.forceRefresh) {
            this.invalidate(id)
        }
        
        if (!this.isCached(key)) {
            this._Cache.add({
                promiseFactory: () => this._fetchWithConditions(id, options),
                requiredKeys: [key],
                transform: (data) => ({ [key]: data })
            })
        }
        
        return this._Cache.get(key)
    }

    private async _fetchWithConditions(id: string, options?: any): Promise<ConditionalItem> {
        // Custom fetch logic based on conditions
        if (options?.includeMetadata) {
            return this._fetchWithMetadata(id)
        } else {
            return this._fetchBasic(id)
        }
    }
}
```

## Error Handling Patterns

### Validation Errors

```typescript
export class ValidatedCacheHandler extends DualStorageCacheHandler<ValidatedItem> {
    async get(id: string): Promise<ValidatedItem> {
        if (!this._isValidId(id)) {
            throw new Error(`Invalid ID format: ${id}`)
        }
        
        const key = `validated_${id}`
        
        if (!this.isCached(key)) {
            this._Cache.add({
                promiseFactory: () => this._fetchAndValidate(id),
                requiredKeys: [key],
                transform: (data) => ({ [key]: data })
            })
        }
        
        return this._Cache.get(key)
    }

    private _isValidId(id: string): boolean {
        return /^[a-zA-Z0-9-_]+$/.test(id)
    }

    private async _fetchAndValidate(id: string): Promise<ValidatedItem> {
        const data = await this._fetchFromSource(id)
        
        if (!this._isValidData(data)) {
            throw new Error(`Invalid data for ID: ${id}`)
        }
        
        return data
    }
}
```

### Graceful Degradation

```typescript
export class GracefulCacheHandler extends DualStorageCacheHandler<GracefulItem> {
    async get(id: string): Promise<GracefulItem | null> {
        const key = `graceful_${id}`
        
        try {
            if (!this.isCached(key)) {
                this._Cache.add({
                    promiseFactory: () => this._fetchWithFallback(id),
                    requiredKeys: [key],
                    transform: (data) => ({ [key]: data })
                })
            }
            
            return await this._Cache.get(key)
        } catch (error) {
            console.error(`Cache error for ${id}:`, error)
            return this._getFallbackValue(id)
        }
    }

    private async _fetchWithFallback(id: string): Promise<GracefulItem> {
        try {
            return await this._fetchFromPrimary(id)
        } catch (error) {
            console.warn(`Primary fetch failed for ${id}, trying fallback:`, error)
            return await this._fetchFromFallback(id)
        }
    }

    private _getFallbackValue(id: string): GracefulItem | null {
        // Return cached value or null
        const key = `graceful_${id}`
        return this._Store[key] || null
    }
}
```

## Performance Considerations

### Memory Management

```typescript
export class MemoryManagedCacheHandler extends DualStorageCacheHandler<ManagedItem> {
    private _maxSize: number = 1000
    private _accessCounts: Map<string, number> = new Map()

    async get(id: string): Promise<ManagedItem> {
        const key = `managed_${id}`
        
        // Track access for LRU
        this._accessCounts.set(key, (this._accessCounts.get(key) || 0) + 1)
        
        if (!this.isCached(key)) {
            this._ensureMemoryLimit()
            
            this._Cache.add({
                promiseFactory: () => this._fetchData(id),
                requiredKeys: [key],
                transform: (data) => ({ [key]: data })
            })
        }
        
        return this._Cache.get(key)
    }

    private _ensureMemoryLimit(): void {
        if (Object.keys(this._Store).length >= this._maxSize) {
            this._evictLeastRecentlyUsed()
        }
    }

    private _evictLeastRecentlyUsed(): void {
        const entries = Array.from(this._accessCounts.entries())
        entries.sort((a, b) => a[1] - b[1])
        
        const toEvict = entries.slice(0, Math.floor(this._maxSize * 0.1))
        toEvict.forEach(([key]) => {
            delete this._Store[key]
            this._accessCounts.delete(key)
        })
    }
}
```

### Batching Optimization

```typescript
export class BatchedCacheHandler extends DualStorageCacheHandler<BatchedItem> {
    private _pendingRequests: Map<string, Promise<BatchedItem>> = new Map()

    async get(id: string): Promise<BatchedItem> {
        const key = `batched_${id}`
        
        // Check if request is already pending
        if (this._pendingRequests.has(key)) {
            return this._pendingRequests.get(key)!
        }
        
        if (!this.isCached(key)) {
            const promise = this._fetchWithBatching(id)
            this._pendingRequests.set(key, promise)
            
            try {
                const result = await promise
                this._pendingRequests.delete(key)
                return result
            } catch (error) {
                this._pendingRequests.delete(key)
                throw error
            }
        }
        
        return this._Cache.get(key)
    }

    private async _fetchWithBatching(id: string): Promise<BatchedItem> {
        // Implement batching logic here
        // This could batch multiple requests into a single database call
        return this._fetchData(id)
    }
}
```

## Testing Patterns

### Mock Cache Handler

```typescript
export class MockCacheHandler extends DualStorageCacheHandler<MockItem> {
    private _mockData: Map<string, MockItem> = new Map()

    setMockData(key: string, data: MockItem): void {
        this._mockData.set(key, data)
    }

    async get(id: string): Promise<MockItem> {
        const key = `mock_${id}`
        
        if (this._mockData.has(key)) {
            const data = this._mockData.get(key)!
            this._Store[key] = data
            return data
        }
        
        throw new Error(`Mock data not found for key: ${key}`)
    }
}
```

### Cache Handler Testing

```typescript
import { MockCacheHandler } from './MockCacheHandler'

describe('CacheHandler', () => {
    let cacheHandler: MockCacheHandler

    beforeEach(() => {
        cacheHandler = new MockCacheHandler()
    })

    afterEach(() => {
        cacheHandler.clear()
    })

    it('should cache data correctly', async () => {
        const testData = { id: 'test', value: 'test-value' }
        cacheHandler.setMockData('mock_test', testData)
        
        const result = await cacheHandler.get('test')
        
        expect(result).toEqual(testData)
        expect(cacheHandler.isCached('mock_test')).toBe(true)
    })

    it('should handle cache invalidation', async () => {
        const testData = { id: 'test', value: 'test-value' }
        cacheHandler.setMockData('mock_test', testData)
        
        await cacheHandler.get('test')
        expect(cacheHandler.isCached('mock_test')).toBe(true)
        
        cacheHandler.invalidate('test')
        expect(cacheHandler.isCached('mock_test')).toBe(false)
    })
})
```

