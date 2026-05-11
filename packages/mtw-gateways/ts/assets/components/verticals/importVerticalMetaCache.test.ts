import { createImportVerticalMetaCacheHandler } from './importVerticalMetaCache'

describe('createImportVerticalMetaCacheHandler', () => {
    it('returns default empty hops when no Meta::Import rows', async () => {
        const assetDB = {
            query: jest.fn().mockResolvedValue([]),
        }
        const cache = createImportVerticalMetaCacheHandler(assetDB)
        const id = 'ROOM#metaDefault' as const
        const [row] = await cache.get([id])
        expect(row).toEqual({ universalKey: id, hops: [] })
        expect(assetDB.query).toHaveBeenCalled()
    })

    it('invalidate forces re-fetch', async () => {
        const assetDB = {
            query: jest.fn().mockResolvedValue([]),
        }
        const cache = createImportVerticalMetaCacheHandler(assetDB)
        const id = 'ROOM#metaInv' as const
        await cache.get([id])
        expect(assetDB.query).toHaveBeenCalledTimes(1)
        cache.invalidate(id)
        await cache.get([id])
        expect(assetDB.query).toHaveBeenCalledTimes(2)
    })
})
