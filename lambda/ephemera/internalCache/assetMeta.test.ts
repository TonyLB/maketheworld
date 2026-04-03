jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import { AssetMetaData } from './assetMeta'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'

const assetMock = assetDB as jest.Mocked<typeof assetDB>

describe('AssetMetaData', () => {
    let cache: AssetMetaData

    beforeEach(() => {
        jest.clearAllMocks()
        cache = new AssetMetaData()
    })

    it('batches AssetIds into one getItems call and returns zone metadata', async () => {
        const a = 'ASSET#a' as AssetUUID
        const b = 'ASSET#b' as AssetUUID
        assetMock.getItems.mockResolvedValue([
            { AssetId: a, zone: 'Canon', shortName: 'A' },
            { AssetId: b, zone: 'Library', shortName: 'B' }
        ])

        const out = await cache.get([a, b])

        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
        expect(assetMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { AssetId: a, DataCategory: 'Meta::Asset' },
                { AssetId: b, DataCategory: 'Meta::Asset' }
            ],
            ProjectionFields: ['AssetId', 'zone', 'player', 'cached', 'shortName', 'summary']
        })
        expect(out).toEqual([
            { AssetId: a, zone: 'Canon', shortName: 'A' },
            { AssetId: b, zone: 'Library', shortName: 'B' }
        ])
    })

    it('filters out DB rows without zone; missing assets get defaultValue', async () => {
        const a = 'ASSET#a' as AssetUUID
        const b = 'ASSET#b' as AssetUUID
        assetMock.getItems.mockResolvedValue([
            { AssetId: a, zone: 'Canon' },
            { AssetId: b }
        ])

        const out = await cache.get([a, b])

        expect(out).toEqual([
            { AssetId: a, zone: 'Canon' },
            { AssetId: b }
        ])
    })

    it('reuses cached entries on second get without another fetch', async () => {
        const a = 'ASSET#a' as AssetUUID
        assetMock.getItems.mockResolvedValue([{ AssetId: a, zone: 'Personal', player: 'p1' }])

        await cache.get([a])
        await cache.get([a])

        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
    })

    it('clear drops cache so the next get refetches', async () => {
        const a = 'ASSET#a' as AssetUUID
        assetMock.getItems.mockResolvedValue([{ AssetId: a, zone: 'Draft' }])

        await cache.get([a])
        cache.clear()
        await cache.get([a])

        expect(assetMock.getItems).toHaveBeenCalledTimes(2)
    })

    it('invalidate drops a key so the next get refetches', async () => {
        const a = 'ASSET#a' as AssetUUID
        assetMock.getItems.mockResolvedValue([{ AssetId: a, zone: 'Canon' }])

        await cache.get([a])
        cache.invalidate(a)
        await cache.get([a])

        expect(assetMock.getItems).toHaveBeenCalledTimes(2)
    })
})
