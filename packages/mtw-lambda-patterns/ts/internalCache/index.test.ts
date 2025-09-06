import { 
    DeferredCache, 
    CacheKeyValidator, 
    withCacheMethods,
    DualStorageCacheHandler 
} from './index'

describe('Internal Cache System', () => {
    describe('DeferredCache', () => {
        it('should cache and retrieve data', async () => {
            const cache = new DeferredCache<string>()
            
            cache.add({
                promiseFactory: () => Promise.resolve('test-data'),
                requiredKeys: ['key1'],
                transform: (data) => ({ key1: data })
            })
            
            const result = await cache.get('key1')
            expect(result).toBe('test-data')
        })

        it('should handle cache invalidation', async () => {
            const cache = new DeferredCache<string>()
            
            cache.add({
                promiseFactory: () => Promise.resolve('test-data'),
                requiredKeys: ['key1'],
                transform: (data) => ({ key1: data })
            })
            
            await cache.get('key1')
            expect(cache.isCached('key1')).toBe(true)
            
            cache.invalidate('key1')
            expect(cache.isCached('key1')).toBe(false)
        })
    })

    describe('CacheKeyValidator', () => {
        it('should create delimited validator', () => {
            const validator = CacheKeyValidator.createDelimitedValidator(
                '::',
                ['assetId', 'ephemeraId'],
                {
                    assetId: (value) => value.startsWith('asset-'),
                    ephemeraId: (value) => value.startsWith('ephemera-')
                }
            )
            
            const key = validator.generateKey('asset-123', 'ephemera-456')
            expect(key).toBe('asset-123::ephemera-456')
            
            const parsed = validator.parseKey(key)
            expect(parsed).toEqual({
                assetId: 'asset-123',
                ephemeraId: 'ephemera-456'
            })
        })

        it('should validate keys correctly', () => {
            const validator = CacheKeyValidator.createDelimitedValidator(
                '::',
                ['assetId', 'ephemeraId'],
                {
                    assetId: (value) => value.startsWith('asset-'),
                    ephemeraId: (value) => value.startsWith('ephemera-')
                }
            )
            
            expect(() => validator.parseKey('invalid-key')).toThrow('Invalid cache key format')
            expect(() => validator.parseKey('asset-123::invalid-ephemera')).toThrow('Invalid ephemeraId')
        })
    })

    describe('CacheMethodMixin', () => {
        it('should provide standard cache methods', () => {
            class BaseHandler {
                _Cache = new DeferredCache<string>()
                _Store: Record<string, string> = {}
            }
            
            class TestHandler extends withCacheMethods<string>((id) => `key_${id}`)(BaseHandler) {
                // Mixin provides the methods
            }
            
            const handler = new TestHandler()
            
            // Test set
            handler.set('test', 'test-value')
            expect(handler._Store['key_test']).toBe('test-value')
            
            // Test isCached
            expect(handler.isCached('test')).toBe(true)
            
            // Test invalidate
            handler.invalidate('test')
            expect(handler.isCached('test')).toBe(false)
            
            // Test clear
            handler.set('test2', 'test-value-2')
            handler.clear()
            expect(Object.keys(handler._Store)).toHaveLength(0)
        })
    })

    describe('DualStorageCacheHandler', () => {
        it('should provide dual storage pattern', async () => {
            class TestHandler extends DualStorageCacheHandler<string> {
                async get(id: string): Promise<string> {
                    const key = `test_${id}`
                    
                    if (!this.isCached(key)) {
                        this._Cache.add({
                            promiseFactory: () => Promise.resolve(`data-${id}`),
                            requiredKeys: [key],
                            transform: (data) => ({ [key]: data })
                        })
                    }
                    
                    return this._Cache.get(key)
                }
            }
            
            const handler = new TestHandler()
            
            // Test basic functionality
            expect(handler.isCached('test_1')).toBe(false)
            
            // Test that get works
            const result = await handler.get('1')
            expect(result).toBe('data-1')
            expect(handler.isCached('test_1')).toBe(true)
            
            // Test clear
            handler.clear()
            expect(handler.isCached('test_1')).toBe(false)
        })
    })
})
