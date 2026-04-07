import { sendPutCacheRecord } from '../apiEphemera'
import messageBus from '../../messageBus'
import { putCacheRecord } from './putCacheRecord'
import { deleteCacheRecord } from './deleteCacheRecord'
import {
    isRenderCacheCacheUpdatedPayload,
    isRenderCacheCacheErrorPayload,
} from './baseClasses'
import { sendDeleteCacheRecords } from '../apiEphemera'
import { isRenderCacheCacheDeletedPayload } from './baseClasses'
import internalCache from '../../internalCache'
import { ephemeraRenderCacheDataSource } from './index'
import {
    makePassThroughCurrentCacheValidPayload,
    passThroughFixtureMinimalDynamoItem,
    passThroughFixturePerspectiveKey,
    passThroughFixtureRoomId,
} from '../passThroughContractFixtures'
import { RENDER_ORCHESTRATION_DATA_SOURCE_KEY } from '../renderOrchestration/publishedEvents'

jest.mock('./putCacheRecord', () => ({
    putCacheRecord: jest.fn(),
}))
jest.mock('./deleteCacheRecord', () => ({
    deleteCacheRecord: jest.fn(),
}))

const putCacheRecordMock = putCacheRecord as jest.MockedFunction<typeof putCacheRecord>
const deleteCacheRecordMock = deleteCacheRecord as jest.MockedFunction<typeof deleteCacheRecord>

describe('mtw.ephemera.renderCache DataSource', () => {
    const minimalPutRecord = {
        componentId: 'ROOM#room-one' as const,
        record: {
            markState: { markValue: [] },
            renderedContent: { description: [] },
            provenance: { type: 'authored' as const },
            perspectiveId: 'PERSPECTIVE#v1#abc',
            perspectiveMatcher: { requiredAssetIds: ['ASSET#one'] as `ASSET#${string}`[], forbiddenAssetIds: [] },
        },
    }

    beforeEach(() => {
        messageBus.clear()
        jest.clearAllMocks()
        putCacheRecordMock.mockResolvedValue('CACHE#written')
        internalCache.RenderCache.clear()
    })

    it('putCacheRecord then emits Cache Updated on the bus', async () => {
        const received: unknown[] = []
        messageBus.subscribe({
            tag: 'test-render-cache-out',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent' &&
                m.dataSourceKey === 'mtw.ephemera.renderCache' &&
                m.header?.type === 'Cache Updated',
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    received.push(await p.getContent())
                }
            },
        })

        sendPutCacheRecord(messageBus, 'ROOM#room-one', minimalPutRecord)
        await messageBus.flush()

        expect(putCacheRecordMock).toHaveBeenCalledTimes(1)
        expect(putCacheRecordMock).toHaveBeenCalledWith(
            'ROOM#room-one',
            minimalPutRecord.record,
            undefined
        )
        expect(received).toHaveLength(1)
        expect(isRenderCacheCacheUpdatedPayload(received[0])).toBe(true)
        expect(received[0]).toMatchObject({
            type: 'Cache Updated',
            componentId: 'ROOM#room-one',
            dataCategory: 'CACHE#written',
            perspectiveId: 'PERSPECTIVE#v1#abc',
        })
    })

    it('echoes conversationId on Cache Updated when present on Put Cache Record command', async () => {
        const received: unknown[] = []
        messageBus.subscribe({
            tag: 'test-render-cache-out-conv',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent' &&
                m.dataSourceKey === 'mtw.ephemera.renderCache' &&
                m.header?.type === 'Cache Updated',
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    received.push(await p.getContent())
                }
            },
        })

        const withConv = {
            ...minimalPutRecord,
            conversationId: 'conv-prototype-1',
        }
        sendPutCacheRecord(messageBus, 'ROOM#room-one', withConv)
        await messageBus.flush()

        expect(received).toHaveLength(1)
        expect(isRenderCacheCacheUpdatedPayload(received[0])).toBe(true)
        expect(received[0]).toMatchObject({
            type: 'Cache Updated',
            componentId: 'ROOM#room-one',
            dataCategory: 'CACHE#written',
            perspectiveId: 'PERSPECTIVE#v1#abc',
            conversationId: 'conv-prototype-1',
        })
    })

    it('emits Cache Error when putCacheRecord rejects', async () => {
        putCacheRecordMock.mockRejectedValue(new Error('dynamo failed'))

        const received: unknown[] = []
        messageBus.subscribe({
            tag: 'test-render-cache-err',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent' &&
                m.dataSourceKey === 'mtw.ephemera.renderCache' &&
                m.header?.type === 'Cache Error',
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    received.push(await p.getContent())
                }
            },
        })

        sendPutCacheRecord(messageBus, 'ROOM#room-one', minimalPutRecord)
        await messageBus.flush()

        expect(received).toHaveLength(1)
        expect(isRenderCacheCacheErrorPayload(received[0])).toBe(true)
        expect(received[0]).toMatchObject({
            type: 'Cache Error',
            componentId: 'ROOM#room-one',
            errorCode: 'PUT_FAILED',
            errorMessage: 'dynamo failed',
            perspectiveId: 'PERSPECTIVE#v1#abc',
        })
    })

    it('deleteCacheRecord then emits Cache Deleted on the bus', async () => {
        const received: unknown[] = []
        messageBus.subscribe({
            tag: 'test-render-cache-del',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent' &&
                m.dataSourceKey === 'mtw.ephemera.renderCache' &&
                m.header?.type === 'Cache Deleted',
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    received.push(await p.getContent())
                }
            },
        })

        sendDeleteCacheRecords(messageBus, 'ROOM#room-one', {
            componentId: 'ROOM#room-one' as const,
            dataCategories: ['CACHE#one', 'CACHE#two'],
        })
        await messageBus.flush()

        expect(deleteCacheRecordMock).toHaveBeenCalledTimes(2)
        expect(deleteCacheRecordMock).toHaveBeenCalledWith('ROOM#room-one', 'CACHE#one')
        expect(deleteCacheRecordMock).toHaveBeenCalledWith('ROOM#room-one', 'CACHE#two')
        expect(received).toHaveLength(1)
        expect(isRenderCacheCacheDeletedPayload(received[0])).toBe(true)
        expect(received[0]).toMatchObject({
            type: 'Cache Deleted',
            componentId: 'ROOM#room-one',
            dataCategories: ['CACHE#one', 'CACHE#two'],
        })
    })

    it('receiveEvents handles Current Cache Valid with refetch and Render Pertains', async () => {
        const streamEvent = jest.fn().mockResolvedValue(undefined)
        const getSpy = jest
            .spyOn(internalCache.RenderCache, 'get')
            .mockResolvedValue([passThroughFixtureMinimalDynamoItem])
        const content = makePassThroughCurrentCacheValidPayload()
        const events: any[] = [
            {
                header: {
                    dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
                    streamKey: passThroughFixtureRoomId,
                    timestamp: Date.now(),
                    type: 'Current Cache Valid',
                },
                getContent: () => Promise.resolve(content),
            },
        ]

        try {
            await ephemeraRenderCacheDataSource.receiveEvents?.({
                events,
                streamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined),
            })

            expect(putCacheRecordMock).not.toHaveBeenCalled()
            expect(getSpy).toHaveBeenCalledWith(passThroughFixtureRoomId)
            expect(streamEvent).toHaveBeenCalledTimes(1)
            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: passThroughFixtureRoomId,
                header: { type: 'Render Pertains' },
                update: {
                    type: 'Render Pertains',
                    componentId: passThroughFixtureRoomId,
                    perspectiveKey: passThroughFixturePerspectiveKey,
                    cacheId: passThroughFixtureMinimalDynamoItem.DataCategory,
                    cacheRecord: passThroughFixtureMinimalDynamoItem,
                },
            })
        } finally {
            getSpy.mockRestore()
        }
    })
})
