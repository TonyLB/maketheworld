jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: { getItem: jest.fn(), query: jest.fn() },
}))

import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { CacheRoomAssetsData } from './assetRooms'

describe('CacheRoomAssetsData', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it.each([
        ['ROOM#cafe', 'Meta::Room'],
        ['AREA#overworld', 'Meta::Area'],
        ['FEATURE#sign', 'Meta::Feature'],
    ])('reads %s from %s', async (hostId, dataCategory) => {
        ;(assetDB.getItem as jest.Mock).mockResolvedValue({ cached: ['ASSET#base'] })
        const cache = new CacheRoomAssetsData()
        expect(await cache.get(hostId as any)).toEqual(['ASSET#base'])
        expect(assetDB.getItem).toHaveBeenCalledWith(expect.objectContaining({ Key: { AssetId: hostId, DataCategory: dataCategory } }))
    })

    it('returns an empty list for a missing row, and memoizes the read', async () => {
        ;(assetDB.getItem as jest.Mock).mockResolvedValue(undefined)
        const cache = new CacheRoomAssetsData()
        expect(await cache.get('FEATURE#sign' as any)).toEqual([])
        await cache.get('FEATURE#sign' as any)
        expect(assetDB.getItem).toHaveBeenCalledTimes(1)
    })
})
