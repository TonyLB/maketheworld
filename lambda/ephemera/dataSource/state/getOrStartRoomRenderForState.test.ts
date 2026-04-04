/**
 * Tests for getOrStartRoomRenderForState --- a TDD scaffold scheduled for removal (no production callers).
 * When you delete getOrStartRoomRenderForState.ts and this file per the tracker issue, also delete
 * ./AGENT.declutter.md so we do not keep a planning doc for removed code.
 *
 * @see ./AGENT.declutter.md
 */
import { getOrStartRoomRenderForState } from './getOrStartRoomRenderForState'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom, EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem } from '../../renderCache/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'

describe('dataSource/state/getOrStartRoomRenderForState (TDD scaffold)', () => {
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
            currentCacheId: cacheRecord.DataCategory as EphemeraCacheId
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

    it('clears currentCacheId when cache record is missing', async () => {
        const cacheRecord = baseCacheRecord()
        const metaRoom = baseMetaRoom({
            state: { marks: cacheRecord.markState },
            currentCacheId: cacheRecord.DataCategory as EphemeraCacheId
        })

        const getMetaRoom = jest.fn().mockResolvedValue(metaRoom)
        const getCacheRecordById = jest.fn().mockResolvedValue(undefined)
        const setMetaRoomState = jest.fn().mockResolvedValue(undefined)

        const result = await getOrStartRoomRenderForState(
            { roomId, perspective },
            { getMetaRoom, getCacheRecordById, setMetaRoomState }
        )

        expect(setMetaRoomState).toHaveBeenCalledWith(roomId, { state: metaRoom.state, currentCacheId: undefined })
        expect(result).toEqual(expect.objectContaining({ status: 'error', errorCode: 'FAST_PATH_INVALID' }))
    })

    it('clears currentCacheId when markState mismatches state.marks', async () => {
        const cacheRecord = baseCacheRecord({
            markState: { markValue: [{ mark: 'MARK#a', value: 'different' }] }
        })
        const metaRoom = baseMetaRoom({
            state: { marks: { markValue: [{ mark: 'MARK#a', value: 'one' }] } },
            currentCacheId: cacheRecord.DataCategory as EphemeraCacheId
        })

        const getMetaRoom = jest.fn().mockResolvedValue(metaRoom)
        const getCacheRecordById = jest.fn().mockResolvedValue(cacheRecord)
        const setMetaRoomState = jest.fn().mockResolvedValue(undefined)

        const result = await getOrStartRoomRenderForState(
            { roomId, perspective },
            { getMetaRoom, getCacheRecordById, setMetaRoomState }
        )

        expect(setMetaRoomState).toHaveBeenCalledWith(roomId, { state: metaRoom.state, currentCacheId: undefined })
        expect(result).toEqual(expect.objectContaining({ status: 'error', errorCode: 'FAST_PATH_INVALID' }))
    })

    it('clears currentCacheId when cache record does not match perspective', async () => {
        const cacheRecord = baseCacheRecord({
            perspectiveMatcher: { requiredAssetIds: ['ASSET#other'], forbiddenAssetIds: [] }
        })
        const metaRoom = baseMetaRoom({
            state: { marks: cacheRecord.markState },
            currentCacheId: cacheRecord.DataCategory as EphemeraCacheId
        })

        const getMetaRoom = jest.fn().mockResolvedValue(metaRoom)
        const getCacheRecordById = jest.fn().mockResolvedValue(cacheRecord)
        const setMetaRoomState = jest.fn().mockResolvedValue(undefined)

        const result = await getOrStartRoomRenderForState(
            { roomId, perspective },
            { getMetaRoom, getCacheRecordById, setMetaRoomState }
        )

        expect(setMetaRoomState).toHaveBeenCalledWith(roomId, { state: metaRoom.state, currentCacheId: undefined })
        expect(result).toEqual(expect.objectContaining({ status: 'error', errorCode: 'FAST_PATH_INVALID' }))
    })

    it('returns not implemented when currentCacheId missing (slow path not built yet)', async () => {
        const metaRoom = baseMetaRoom({
            state: { marks: { markValue: [{ mark: 'MARK#a', value: 'one' }] } }
        })

        const getMetaRoom = jest.fn().mockResolvedValue(metaRoom)

        const result = await getOrStartRoomRenderForState(
            { roomId, perspective },
            { getMetaRoom }
        )

        expect(result).toEqual({
            status: 'error',
            errorCode: 'NOT_IMPLEMENTED',
            errorMessage: 'Slow path not implemented',
        })
    })

    it('returns not implemented when Meta::Room.state is missing and no currentCacheId', async () => {
        const metaRoom = baseMetaRoom()
        const getMetaRoom = jest.fn().mockResolvedValue(metaRoom)

        const result = await getOrStartRoomRenderForState(
            { roomId, perspective },
            { getMetaRoom }
        )

        expect(result).toEqual({
            status: 'error',
            errorCode: 'NOT_IMPLEMENTED',
            errorMessage: 'Slow path not implemented',
        })
    })

    it('returns not implemented when generation allowed but slow path not built', async () => {
        const metaRoom = baseMetaRoom({
            state: { marks: { markValue: [{ mark: 'MARK#a', value: 'one' }] } }
        })
        const getMetaRoom = jest.fn().mockResolvedValue(metaRoom)

        const result = await getOrStartRoomRenderForState(
            { roomId, perspective, options: { allowGeneration: true, generationContextWml: '<Asset uuid=(t) />' } },
            { getMetaRoom }
        )

        expect(result).toEqual({
            status: 'error',
            errorCode: 'NOT_IMPLEMENTED',
            errorMessage: 'Slow path not implemented',
        })
    })
})

