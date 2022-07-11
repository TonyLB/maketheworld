import { CacheBase, CacheGlobal, CacheLookup } from '.'

describe('Internal Cache', () => {
    it('should handle mixins', () => {
        const MixedCache = CacheLookup(CacheGlobal(CacheBase))
        const cache = new MixedCache()
        cache.set({ category: 'Global', key: 'test', value: 'Test' })
        expect(cache.get({ category: 'Global', key: 'test' })).toEqual('Test')
        expect(cache.get({ category: 'Lookup', key: 'Test' })).toEqual({ anotherTest: 2 })
    })
})