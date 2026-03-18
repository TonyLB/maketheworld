import { getOrStartRoomRenderForState } from './getOrStartRoomRenderForState'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'

describe('state/getOrStartRoomRenderForState (TDD scaffold)', () => {
    const roomId = 'ROOM#TDD' as EphemeraRoomId
    const perspective = { assetStack: ['ASSET#base' as AssetUUID] }

    const baseMetaRoom = (overrides: Partial<EphemeraMetaRoom> = {}): EphemeraMetaRoom => ({
        EphemeraId: roomId,
        DataCategory: 'Meta::Room',
        ...overrides
    })

    const baseCacheRecord = (overrides: Partial<EphemeraCacheDynamoItem> = {}): EphemeraCacheDynamoItem => ({
        EphemeraId: roomId,
        DataCategory: 'CACHE#tdd',
        markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
        renderedContent: { description: [] },
        provenance: { type: 'authored' },
        perspectiveId: 'PERSPECTIVE#tdd',
        perspectiveMatcher: { requiredAssetIds: ['ASSET#base'], forbiddenAssetIds: [] },
        ...overrides
    })

    it('returns ready when Meta::Room.currentCacheId points at a valid matching cache record', async () => {
        const cacheRecord = baseCacheRecord()
        const metaRoom = baseMetaRoom({
            state: { marks: cacheRecord.markState },
            currentCacheId: cacheRecord.DataCategory
        })

        const getMetaRoom = jest.fn().mockResolvedValue(metaRoom)
        const getCacheRecordById = jest.fn().mockResolvedValue(cacheRecord)

        const result = await getOrStartRoomRenderForState(
            { roomId, perspective },
            { getMetaRoom, getCacheRecordById }
        )

        expect(getMetaRoom).toHaveBeenCalledWith(roomId)
        expect(getCacheRecordById).toHaveBeenCalledWith(roomId, cacheRecord.DataCategory)
        expect(result).toEqual({ status: 'ready', cacheRecord })
    })

    it('falls back to exact-match search when currentCacheId missing', async () => {
        const metaRoom = baseMetaRoom({
            state: { marks: { markValue: [{ mark: 'MARK#a', value: 'one' }] } }
        })

        const getMetaRoom = jest.fn().mockResolvedValue(metaRoom)

        const result = await getOrStartRoomRenderForState(
            { roomId, perspective },
            { getMetaRoom }
        )

        expect(result).toEqual(
            expect.objectContaining({
                status: 'ready'
            })
        )
    })

    it('computes default marks when Meta::Room.state is missing', async () => {
        const metaRoom = baseMetaRoom()
        const getMetaRoom = jest.fn().mockResolvedValue(metaRoom)

        const result = await getOrStartRoomRenderForState(
            { roomId, perspective },
            { getMetaRoom }
        )

        expect(result.status).not.toEqual('error')
    })

    it('returns generating when no match exists and generation is allowed', async () => {
        const metaRoom = baseMetaRoom({
            state: { marks: { markValue: [{ mark: 'MARK#a', value: 'one' }] } }
        })
        const getMetaRoom = jest.fn().mockResolvedValue(metaRoom)

        const result = await getOrStartRoomRenderForState(
            { roomId, perspective, options: { allowGeneration: true, generationContextWml: '<Asset uuid=(t) />' } },
            { getMetaRoom }
        )

        expect(result).toEqual({ status: 'generating' })
    })
})

