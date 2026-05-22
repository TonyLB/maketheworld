/**
 * Cross-layer integration: real orchestrateRenderRequest (streamEventFromMessageBus) + real
 * mtw.ephemera.renderCache DataSource subscription on the process message bus.
 * Complements renderCache/passThroughContract.scaffold.test.ts (synthetic sendRenderOrchestrationPublish)
 * and renderOrchestration/passThroughContract.scaffold.test.ts (orchestration without renderCache).
 */
jest.mock('./renderCache/putCacheRecord', () => ({
    __esModule: true,
    putCacheRecord: jest.fn(),
}))

jest.mock('./renderCache/perspectivePointer', () => ({
    resolvePerspectivePointer: jest.fn(async (_roomId, perspectiveKey, metaRoom) => {
        const id = metaRoom?.currentCacheByPerspective?.[perspectiveKey]
        return typeof id === 'string' && id.startsWith('CACHE#') ? id : undefined
    }),
    clearPerspectivePointer: jest.fn().mockResolvedValue(undefined),
    collectPerspectivePointerEntries: jest.fn().mockResolvedValue([]),
}))

import './renderCache/index'
import { putCacheRecord } from './renderCache/putCacheRecord'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import messageBus from '../messageBus'
import internalCache from '../internalCache'
import { orchestrateRenderRequest } from './renderOrchestration/orchestrationHandler'
import { streamEventFromMessageBus } from './renderOrchestration/publishedEvents'
import { RENDER_CACHE_DATA_SOURCE_KEY } from './renderCache/baseClasses'
import type { RenderRequested } from '../messageBus/baseClasses'
import {
    makePassThroughRenderGeneratedPayload,
    passThroughFixtureMinimalCacheId,
    passThroughFixtureMinimalDynamoItem,
    passThroughFixturePerspective,
    passThroughFixturePerspectiveKey,
    passThroughFixtureRoomId,
} from './passThroughContractFixtures'

const mockedPutCacheRecord = putCacheRecord as jest.MockedFunction<typeof putCacheRecord>

describe('passThrough orchestration -> renderCache (integration)', () => {
    const fixtureMetaRoom: EphemeraMetaRoom = {
        EphemeraId: passThroughFixtureRoomId,
        DataCategory: 'Meta::Room',
        state: { marks: passThroughFixtureMinimalDynamoItem.markState },
        currentCacheByPerspective: {
            [passThroughFixturePerspectiveKey]: passThroughFixtureMinimalCacheId,
        },
    }

    const fixtureCacheRow: typeof passThroughFixtureMinimalDynamoItem = {
        ...passThroughFixtureMinimalDynamoItem,
        perspectiveMatcher: {
            requiredAssetIds: ['ASSET#one'],
            forbiddenAssetIds: [],
        },
    }

    beforeEach(() => {
        messageBus.clear()
        internalCache.RenderCache.clear()
        jest.spyOn(internalCache.RenderCache, 'get').mockResolvedValue([fixtureCacheRow])
        mockedPutCacheRecord.mockReset()
        mockedPutCacheRecord.mockResolvedValue(passThroughFixtureMinimalCacheId)
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('Current Cache Valid from orchestrateRenderRequest leads to Render Pertains on renderCache (no putCacheRecord)', async () => {
        const received: unknown[] = []
        messageBus.subscribe({
            tag: 'integration-render-pertains-ccv',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent'
                && m.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                && m.header?.type === 'Render Pertains',
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    received.push(await p.getContent())
                }
            },
        })

        const payload: RenderRequested = {
            type: 'RenderRequested',
            componentId: passThroughFixtureRoomId,
            perspective: passThroughFixturePerspective,
            allowGeneration: false,
        }

        await orchestrateRenderRequest(
            { payload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(fixtureMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue(passThroughFixturePerspectiveKey),
                getCacheRecordById: jest.fn().mockResolvedValue(fixtureCacheRow),
                getExactMatch: jest.fn(),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn().mockReturnValue(true),
            }
        )
        await messageBus.flush()

        expect(mockedPutCacheRecord).not.toHaveBeenCalled()
        expect(received).toHaveLength(1)
        expect(received[0]).toMatchObject({
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            cacheId: passThroughFixtureMinimalCacheId,
        })
        expect((received[0] as { conversationId?: string }).conversationId).toBeUndefined()
    })

    it('Render Generated from orchestrateRenderRequest leads to putCacheRecord then Render Pertains then Cache Updated', async () => {
        const pertains: unknown[] = []
        const cacheUpdated: unknown[] = []
        const streamOrder: string[] = []
        messageBus.subscribe({
            tag: 'integration-render-pertains-gen',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent'
                && m.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                && m.header?.type === 'Render Pertains',
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    streamOrder.push('Render Pertains')
                    pertains.push(await p.getContent())
                }
            },
        })
        messageBus.subscribe({
            tag: 'integration-cache-updated-gen',
            priority: 21,
            filter: (m: any) =>
                m.type === 'StreamingEvent'
                && m.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                && m.header?.type === 'Cache Updated',
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    streamOrder.push('Cache Updated')
                    cacheUpdated.push(await p.getContent())
                }
            },
        })

        const generateRoomPreview = jest.fn().mockImplementation(async (
            _input: unknown,
            options: { publishOrchestration: (c: unknown) => void | Promise<void> }
        ) => {
            await options.publishOrchestration(makePassThroughRenderGeneratedPayload())
            return 'success' as const
        })

        const payload: RenderRequested = {
            type: 'RenderRequested',
            componentId: passThroughFixtureRoomId,
            perspective: passThroughFixturePerspective,
            allowGeneration: true,
            generationContextWml: '<Asset uuid=(test)><Room uuid=(room1) key=(room1)><ShortName>Test</ShortName></Room></Asset>',
        }

        await orchestrateRenderRequest(
            { payload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue({
                    ...fixtureMetaRoom,
                    currentCacheByPerspective: {},
                }),
                computePerspectiveKey: jest.fn().mockReturnValue(passThroughFixturePerspectiveKey),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
                generateRoomPreview,
            }
        )
        await messageBus.flush()

        expect(generateRoomPreview).toHaveBeenCalled()
        expect(mockedPutCacheRecord).toHaveBeenCalledTimes(1)
        expect(mockedPutCacheRecord).toHaveBeenCalledWith(
            passThroughFixtureRoomId,
            expect.objectContaining({
                markState: passThroughFixtureMinimalDynamoItem.markState,
                renderedContent: passThroughFixtureMinimalDynamoItem.renderedContent,
                provenance: passThroughFixtureMinimalDynamoItem.provenance,
                perspectiveId: passThroughFixtureMinimalDynamoItem.perspectiveId,
                perspectiveMatcher: passThroughFixtureMinimalDynamoItem.perspectiveMatcher,
            }),
            passThroughFixtureMinimalCacheId
        )
        expect(pertains).toHaveLength(1)
        expect(cacheUpdated).toHaveLength(1)
        expect(streamOrder).toEqual(['Render Pertains', 'Cache Updated'])
        expect(pertains[0]).toMatchObject({
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            cacheId: passThroughFixtureMinimalCacheId,
        })
        expect(cacheUpdated[0]).toMatchObject({
            type: 'Cache Updated',
            componentId: passThroughFixtureRoomId,
            dataCategory: passThroughFixtureMinimalCacheId,
            perspectiveId: passThroughFixtureMinimalDynamoItem.perspectiveId,
        })
    })

    it('Exact Match Found from orchestrateRenderRequest leads to Render Pertains on renderCache', async () => {
        const received: unknown[] = []
        messageBus.subscribe({
            tag: 'integration-render-pertains-emf',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent'
                && m.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                && m.header?.type === 'Render Pertains',
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    received.push(await p.getContent())
                }
            },
        })

        const payload: RenderRequested = {
            type: 'RenderRequested',
            componentId: passThroughFixtureRoomId,
            perspective: passThroughFixturePerspective,
            allowGeneration: false,
        }

        await orchestrateRenderRequest(
            { payload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue({
                    ...fixtureMetaRoom,
                    currentCacheByPerspective: {},
                }),
                computePerspectiveKey: jest.fn().mockReturnValue(passThroughFixturePerspectiveKey),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn().mockResolvedValue(fixtureCacheRow),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
            }
        )
        await messageBus.flush()

        expect(mockedPutCacheRecord).not.toHaveBeenCalled()
        expect(received).toHaveLength(1)
        expect(received[0]).toMatchObject({
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            cacheId: passThroughFixtureMinimalCacheId,
        })
    })
})
