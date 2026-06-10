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
import { handleExampleInvalidated } from './handleExampleInvalidated'
import { handleRenderCacheFinding } from './handleRenderCacheFinding'

const handleExampleInvalidatedMock = handleExampleInvalidated as jest.MockedFunction<typeof handleExampleInvalidated>
const handleRenderCacheFindingMock = handleRenderCacheFinding as jest.MockedFunction<typeof handleRenderCacheFinding>
import {
    makePassThroughCurrentCacheValidPayload,
    passThroughFixtureMinimalDynamoItem,
    passThroughFixturePerspectiveKey,
    passThroughFixtureRoomId,
} from '../passThroughContractFixtures'
import { RENDER_ORCHESTRATION_DATA_SOURCE_KEY, sendRenderOrchestrationPublish } from '../renderOrchestration/publishedEvents'
import { RENDER_CACHE_DATA_SOURCE_KEY } from './baseClasses'

jest.mock('./putCacheRecord', () => ({
    putCacheRecord: jest.fn(),
}))
jest.mock('./deleteCacheRecord', () => ({
    deleteCacheRecord: jest.fn(),
}))
jest.mock('./handleExampleInvalidated', () => ({
    handleExampleInvalidated: jest.fn(),
}))
jest.mock('./handleRenderCacheFinding', () => ({
    handleRenderCacheFinding: jest.fn(),
}))

const putCacheRecordMock = putCacheRecord as jest.MockedFunction<typeof putCacheRecord>
const deleteCacheRecordMock = deleteCacheRecord as jest.MockedFunction<typeof deleteCacheRecord>
const originalMessageBusPublish = messageBus.publish.bind(messageBus)

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

    function spyPublish() {
        return jest.spyOn(messageBus, 'publish').mockImplementation((payload) => {
            originalMessageBusPublish(payload)
        })
    }

    it('uses publish outbound bus delivery', () => {
        expect(ephemeraRenderCacheDataSource.outboundBusDelivery).toBe('publish')
    })

    it('publishes Cache Updated StreamingEvent on Put Cache Record command path', async () => {
        const publishSpy = spyPublish()

        sendPutCacheRecord(messageBus, 'ROOM#room-one', minimalPutRecord)
        await messageBus.flushAndSettle()

        expect(
            publishSpy.mock.calls.some(
                (call) =>
                    call[0]?.type === 'StreamingEvent'
                    && call[0]?.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                    && call[0]?.header?.type === 'Cache Updated'
            )
        ).toBe(true)
        publishSpy.mockRestore()
    })

    it('publishes Render Pertains StreamingEvent on Current Cache Valid pass-through path', async () => {
        const publishSpy = spyPublish()
        jest.spyOn(internalCache.RenderCache, 'get').mockResolvedValue([passThroughFixtureMinimalDynamoItem])

        sendRenderOrchestrationPublish(messageBus, passThroughFixtureRoomId, makePassThroughCurrentCacheValidPayload())
        await messageBus.flushAndSettle()

        expect(
            publishSpy.mock.calls.some(
                (call) =>
                    call[0]?.type === 'StreamingEvent'
                    && call[0]?.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                    && call[0]?.header?.type === 'Render Pertains'
            )
        ).toBe(true)
        publishSpy.mockRestore()
        jest.restoreAllMocks()
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
        await messageBus.flushAndSettle()

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
        await messageBus.flushAndSettle()

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
        await messageBus.flushAndSettle()

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
        await messageBus.flushAndSettle()

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

    it('receiveEvents dispatches ExampleInvalidated to handleExampleInvalidated', async () => {
        handleExampleInvalidatedMock.mockResolvedValue(undefined)
        const invalidated = {
            type: 'ExampleInvalidated' as const,
            componentIds: ['ROOM#hall'],
            editAssetId: 'ASSET#overlay',
        }
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'mtw.assets.componentExamples',
                    streamKey: 'ASSET#overlay',
                    timestamp: Date.now(),
                    type: 'ExampleInvalidated',
                },
                getContent: () => Promise.resolve(invalidated),
            },
        ]

        await ephemeraRenderCacheDataSource.receiveEvents?.({
            events,
            streamEvent: jest.fn().mockResolvedValue(undefined),
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(handleExampleInvalidatedMock).toHaveBeenCalledTimes(1)
        expect(handleExampleInvalidatedMock).toHaveBeenCalledWith(invalidated)
    })

    it('receiveEvents dispatches situation-scoped ExampleInvalidated by situationId', async () => {
        handleExampleInvalidatedMock.mockResolvedValue(undefined)
        const invalidated = {
            type: 'ExampleInvalidated' as const,
            situationId: 'SITUATION#sit-1',
            editAssetId: 'ASSET#overlay',
        }
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'mtw.assets.componentExamples',
                    streamKey: 'ASSET#overlay',
                    timestamp: Date.now(),
                    type: 'ExampleInvalidated',
                },
                getContent: () => Promise.resolve(invalidated),
            },
        ]

        await ephemeraRenderCacheDataSource.receiveEvents?.({
            events,
            streamEvent: jest.fn().mockResolvedValue(undefined),
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(handleExampleInvalidatedMock).toHaveBeenCalledTimes(1)
        expect(handleExampleInvalidatedMock).toHaveBeenCalledWith(invalidated)
        expect(invalidated).not.toHaveProperty('componentIds')
    })

    it('receiveEvents dispatches Ephemera RenderCache Finding to handleRenderCacheFinding', async () => {
        handleRenderCacheFindingMock.mockResolvedValue(undefined)
        const finding = {
            type: 'Ephemera RenderCache Finding' as const,
            targetCatalogs: [
                { ephemeraId: 'ROOM#hall' as const, perspectiveKey: 'PERSPECTIVE#v1#abc' },
            ],
            status: 'missing' as const,
            diagnosticRunId: 'run-1',
            timestamp: '2025-01-01T00:00:00.000Z',
        }
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'global',
                    timestamp: Date.now(),
                    type: 'Ephemera RenderCache Finding',
                },
                getContent: () => Promise.resolve(finding),
            },
        ]

        await ephemeraRenderCacheDataSource.receiveEvents?.({
            events,
            streamEvent: jest.fn().mockResolvedValue(undefined),
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(handleRenderCacheFindingMock).toHaveBeenCalledTimes(1)
        expect(handleRenderCacheFindingMock).toHaveBeenCalledWith(finding)
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
