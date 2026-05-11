import { createAuthoritativeComponentDataCacheHandler } from './authoritativeComponentDataCache'

describe('createAuthoritativeComponentDataCacheHandler', () => {
    it('returns default empty byAssets when partition query is empty', async () => {
        const assetDB = {
            query: jest.fn().mockResolvedValue([]),
        }
        const cache = createAuthoritativeComponentDataCacheHandler(assetDB)
        const id = 'ROOM#onlyDefault' as const
        const [row] = await cache.get([id])
        expect(row.ComponentId).toBe(id)
        expect(row.byAssets).toEqual([])
        expect(assetDB.query).toHaveBeenCalledWith({
            Key: { AssetId: id },
            allFields: true,
        })
    })

    it('invalidates a key so a subsequent get re-queries', async () => {
        const assetDB = {
            query: jest.fn().mockResolvedValue([]),
        }
        const cache = createAuthoritativeComponentDataCacheHandler(assetDB)
        const id = 'FEATURE#inv' as const
        await cache.get([id])
        expect(assetDB.query).toHaveBeenCalledTimes(1)
        cache.invalidate(id)
        await cache.get([id])
        expect(assetDB.query).toHaveBeenCalledTimes(2)
    })
})
