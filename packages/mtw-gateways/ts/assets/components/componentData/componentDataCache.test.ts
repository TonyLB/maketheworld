import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { createComponentDataCacheHandler } from './componentDataCache'

describe('createComponentDataCacheHandler', () => {
    it('get resolves via getItems batch path', async () => {
        const assetDB = {
            getItems: jest.fn().mockResolvedValue([]),
            getItem: jest.fn(),
        }
        const cache = createComponentDataCacheHandler(assetDB)
        const ephemeraId = 'ROOM#cachePkgTest' as ComponentUUID
        const assetId = 'ASSET#cachePkgAsset' as AssetUUID
        await cache.get(ephemeraId, assetId)
        expect(assetDB.getItems).toHaveBeenCalled()
    })

    it('clear allows a subsequent get to batch-fetch again', async () => {
        const assetDB = {
            getItems: jest.fn().mockResolvedValue([]),
            getItem: jest.fn(),
        }
        const cache = createComponentDataCacheHandler(assetDB)
        const ephemeraId = 'ROOM#clearTest' as ComponentUUID
        const assetId = 'ASSET#clearAsset' as AssetUUID
        await cache.get(ephemeraId, assetId)
        expect(assetDB.getItems).toHaveBeenCalledTimes(1)
        cache.clear()
        await cache.get(ephemeraId, assetId)
        expect(assetDB.getItems).toHaveBeenCalledTimes(2)
    })

    it('getPairs batches pair reads', async () => {
        const assetDB = {
            getItems: jest.fn().mockResolvedValue([]),
            getItem: jest.fn(),
        }
        const cache = createComponentDataCacheHandler(assetDB)
        await cache.getPairs([
            { universalKey: 'ROOM#a', assetId: 'ASSET#1' },
            { universalKey: 'ROOM#a', assetId: 'ASSET#2' },
        ])
        expect(assetDB.getItems).toHaveBeenCalled()
    })
})
