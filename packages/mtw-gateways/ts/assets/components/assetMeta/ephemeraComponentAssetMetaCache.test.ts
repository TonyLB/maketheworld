import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { createEphemeraComponentAssetMetaCacheHandler } from './ephemeraComponentAssetMetaCache'

describe('createEphemeraComponentAssetMetaCacheHandler', () => {
    it('get resolves via getItems batch path', async () => {
        const assetDB = {
            getItems: jest.fn().mockResolvedValue([]),
            getItem: jest.fn(),
        }
        const cache = createEphemeraComponentAssetMetaCacheHandler(assetDB)
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
        const cache = createEphemeraComponentAssetMetaCacheHandler(assetDB)
        const ephemeraId = 'ROOM#clearTest' as ComponentUUID
        const assetId = 'ASSET#clearAsset' as AssetUUID
        await cache.get(ephemeraId, assetId)
        expect(assetDB.getItems).toHaveBeenCalledTimes(1)
        cache.clear()
        await cache.get(ephemeraId, assetId)
        expect(assetDB.getItems).toHaveBeenCalledTimes(2)
    })
})
