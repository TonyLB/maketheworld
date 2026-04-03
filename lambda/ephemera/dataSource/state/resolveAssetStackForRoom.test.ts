import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { resolveCanonAssetStackForRoom, type CanonAssetStackCache } from './resolveAssetStackForRoom'

describe('resolveCanonAssetStackForRoom', () => {
    const roomId = 'ROOM#r1' as EphemeraRoomId

    const makeCache = (roomAssetsGet: jest.Mock, assetMetaGet: jest.Mock): CanonAssetStackCache =>
        ({
            RoomAssets: { get: roomAssetsGet },
            AssetMetaData: { get: assetMetaGet },
        }) as unknown as CanonAssetStackCache

    it('returns empty when RoomAssets has no ids', async () => {
        const roomAssetsGet = jest.fn().mockResolvedValue([])
        const assetMetaGet = jest.fn()
        const cache = makeCache(roomAssetsGet, assetMetaGet)
        await expect(resolveCanonAssetStackForRoom(roomId, cache)).resolves.toEqual([])
        expect(assetMetaGet).not.toHaveBeenCalled()
    })

    it('returns empty when RoomAssets is undefined', async () => {
        const roomAssetsGet = jest.fn().mockResolvedValue(undefined)
        const assetMetaGet = jest.fn()
        const cache = makeCache(roomAssetsGet, assetMetaGet)
        await expect(resolveCanonAssetStackForRoom(roomId, cache)).resolves.toEqual([])
        expect(assetMetaGet).not.toHaveBeenCalled()
    })

    it('keeps only Canon assets in RoomAssets order', async () => {
        const a = 'ASSET#a' as AssetUUID
        const b = 'ASSET#b' as AssetUUID
        const c = 'ASSET#c' as AssetUUID
        const roomAssetsGet = jest.fn().mockResolvedValue([a, b, c])
        const assetMetaGet = jest.fn().mockResolvedValue([
            { AssetId: a, zone: 'Library' },
            { AssetId: b, zone: 'Canon' },
            { AssetId: c, zone: 'Canon' },
        ])
        const cache = makeCache(roomAssetsGet, assetMetaGet)
        await expect(resolveCanonAssetStackForRoom(roomId, cache)).resolves.toEqual([b, c])
        expect(roomAssetsGet).toHaveBeenCalledWith(roomId)
        expect(assetMetaGet).toHaveBeenCalledWith([a, b, c])
    })

    it('returns empty when no Canon assets', async () => {
        const a = 'ASSET#a' as AssetUUID
        const roomAssetsGet = jest.fn().mockResolvedValue([a])
        const assetMetaGet = jest.fn().mockResolvedValue([{ AssetId: a, zone: 'Library' }])
        const cache = makeCache(roomAssetsGet, assetMetaGet)
        await expect(resolveCanonAssetStackForRoom(roomId, cache)).resolves.toEqual([])
    })

    it('returns all ids when all Canon', async () => {
        const a = 'ASSET#a' as AssetUUID
        const b = 'ASSET#b' as AssetUUID
        const roomAssetsGet = jest.fn().mockResolvedValue([a, b])
        const assetMetaGet = jest.fn().mockResolvedValue([
            { AssetId: a, zone: 'Canon' },
            { AssetId: b, zone: 'Canon' },
        ])
        const cache = makeCache(roomAssetsGet, assetMetaGet)
        await expect(resolveCanonAssetStackForRoom(roomId, cache)).resolves.toEqual([a, b])
    })

    it('skips entries without zone Canon (e.g. default MetaCache)', async () => {
        const a = 'ASSET#a' as AssetUUID
        const b = 'ASSET#b' as AssetUUID
        const roomAssetsGet = jest.fn().mockResolvedValue([a, b])
        const assetMetaGet = jest.fn().mockResolvedValue([
            { AssetId: a },
            { AssetId: b, zone: 'Canon' },
        ])
        const cache = makeCache(roomAssetsGet, assetMetaGet)
        await expect(resolveCanonAssetStackForRoom(roomId, cache)).resolves.toEqual([b])
    })
})
