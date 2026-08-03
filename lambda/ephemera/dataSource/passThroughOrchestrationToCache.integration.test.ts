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

jest.mock('./renderCache/ensureAuthoredCatalog', () => ({
    ensureAuthoredCatalog: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./renderCache/catalogRow', () => ({
    ...jest.requireActual('./renderCache/catalogRow'),
    getCatalogRow: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./renderCache/perspectivePointer', () => ({
    resolvePerspectivePointer: jest.fn().mockResolvedValue(undefined),
    setPerspectivePointer: jest.fn().mockResolvedValue(undefined),
    clearPerspectivePointer: jest.fn().mockResolvedValue(undefined),
    collectPerspectivePointerEntries: jest.fn().mockResolvedValue([]),
}))

import './renderCache/index'
import { getCatalogRow } from './renderCache/catalogRow'
import { resolvePerspectivePointer, setPerspectivePointer } from './renderCache/perspectivePointer'
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
    passThroughFixtureAuthoredEmptyMarksDynamoItem,
    passThroughFixtureFeatureId,
    passThroughFixtureKnowledgeId,
    passThroughFixtureMinimalCacheId,
    passThroughFixtureMinimalDynamoItem,
    passThroughFixturePerspective,
    passThroughFixturePerspectiveKey,
    passThroughFixtureRoomId,
} from './passThroughContractFixtures'

const mockedPutCacheRecord = putCacheRecord as jest.MockedFunction<typeof putCacheRecord>
const getCatalogRowMock = getCatalogRow as jest.MockedFunction<typeof getCatalogRow>
const resolvePerspectivePointerMock = resolvePerspectivePointer as jest.Mock
const setPerspectivePointerMock = setPerspectivePointer as jest.Mock

describe('passThrough orchestration -> renderCache (integration)', () => {
    const fixtureMetaRoom: EphemeraMetaRoom = {
        EphemeraId: passThroughFixtureRoomId,
        DataCategory: 'Meta::Room',
        state: { marks: passThroughFixtureMinimalDynamoItem.markState },
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
        getCatalogRowMock.mockResolvedValue(undefined)
        mockedPutCacheRecord.mockReset()
        mockedPutCacheRecord.mockResolvedValue(passThroughFixtureMinimalCacheId)
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('Current Cache Valid from orchestrateRenderRequest leads to Render Pertains on renderCache (no putCacheRecord)', async () => {
        resolvePerspectivePointerMock.mockResolvedValueOnce(passThroughFixtureMinimalCacheId)
        getCatalogRowMock.mockResolvedValue({
            EphemeraId: passThroughFixtureRoomId,
            DataCategory: `Cache::${passThroughFixturePerspectiveKey}`,
            assetStack: ['ASSET#one'],
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
        })
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
            { payload, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(fixtureMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue(passThroughFixturePerspectiveKey),
                getCacheRecordById: jest.fn().mockResolvedValue({ ...fixtureCacheRow, catalogVersion: 1 }),
                getExactMatch: jest.fn(),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn().mockReturnValue(true),
            }
        )
        await messageBus.flushAndSettle()

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
            { payload, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(fixtureMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue(passThroughFixturePerspectiveKey),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
                generateRoomPreview,
            }
        )
        await messageBus.flushAndSettle()

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
            { payload, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(fixtureMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue(passThroughFixturePerspectiveKey),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn().mockResolvedValue(fixtureCacheRow),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
            }
        )
        await messageBus.flushAndSettle()

        expect(mockedPutCacheRecord).not.toHaveBeenCalled()
        expect(received).toHaveLength(1)
        expect(received[0]).toMatchObject({
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            cacheId: passThroughFixtureMinimalCacheId,
        })
    })

    it.each([
        ['FEATURE#', passThroughFixtureFeatureId],
        ['KNOWLEDGE#', passThroughFixtureKnowledgeId],
    ] as const)('Exact Match Found for %s host leads to Render Pertains on renderCache (authored CACHE# row)', async (_label, componentId) => {
        const fixtureCacheRow = passThroughFixtureAuthoredEmptyMarksDynamoItem(componentId)
        const received: unknown[] = []
        messageBus.subscribe({
            tag: `integration-render-pertains-emf-${componentId}`,
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

        jest.spyOn(internalCache.RenderCache, 'get').mockResolvedValue([fixtureCacheRow])

        const payload: RenderRequested = {
            type: 'RenderRequested',
            componentId,
            perspective: passThroughFixturePerspective,
            allowGeneration: false,
        }

        const getMetaRoom = jest.fn()
        await orchestrateRenderRequest(
            { payload, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom,
                computePerspectiveKey: jest.fn().mockReturnValue(passThroughFixturePerspectiveKey),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn().mockResolvedValue(fixtureCacheRow),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
            }
        )
        await messageBus.flushAndSettle()

        expect(getMetaRoom).not.toHaveBeenCalled()
        expect(mockedPutCacheRecord).not.toHaveBeenCalled()
        expect(received).toHaveLength(1)
        expect(received[0]).toMatchObject({
            componentId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            cacheId: passThroughFixtureMinimalCacheId,
        })
        expect((received[0] as { cacheRecord?: { provenance?: { type?: string } } }).cacheRecord).toMatchObject({
            provenance: { type: 'authored' },
            markState: { markValue: [] },
        })
    })

    it(
        'CP-2 payoff: a stale pointer (state changed) is cleared and falls through to exact-match, ' +
        'which then re-sets the pointer for the new state',
        async () => {
            resolvePerspectivePointerMock.mockResolvedValueOnce(passThroughFixtureMinimalCacheId)
            getCatalogRowMock.mockResolvedValue({
                EphemeraId: passThroughFixtureRoomId,
                DataCategory: `Cache::${passThroughFixturePerspectiveKey}`,
                assetStack: ['ASSET#one'],
                catalogVersion: 1,
                hydratedCatalogVersion: 1,
            })

            const newStateCacheId = 'CACHE#new-state' as const
            const newStateCacheRow: typeof fixtureCacheRow = {
                ...fixtureCacheRow,
                DataCategory: newStateCacheId,
                markState: { markValue: [{ mark: 'MARK#a', value: 'two' }] },
            }
            jest.spyOn(internalCache.RenderCache, 'get').mockResolvedValue([newStateCacheRow])

            const clearPerspectivePointer = jest.fn()
            const pertains: unknown[] = []
            messageBus.subscribe({
                tag: 'integration-render-pertains-stale-pointer',
                priority: 20,
                filter: (m: any) =>
                    m.type === 'StreamingEvent'
                    && m.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                    && m.header?.type === 'Render Pertains',
                callback: async ({ payloads }) => {
                    for (const p of payloads) {
                        pertains.push(await p.getContent())
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
                { payload, streamEvent: streamEventFromMessageBus(messageBus) },
                {
                    getMetaRoom: jest.fn().mockResolvedValue(fixtureMetaRoom),
                    computePerspectiveKey: jest.fn().mockReturnValue(passThroughFixturePerspectiveKey),
                    getCacheRecordById: jest.fn().mockResolvedValue({ ...fixtureCacheRow, catalogVersion: 1 }),
                    getExactMatch: jest.fn().mockResolvedValue(newStateCacheRow),
                    clearPerspectivePointer,
                    // State changed since the pointer was written: validation must fail.
                    markStatesEqual: jest.fn().mockReturnValue(false),
                }
            )
            await messageBus.flushAndSettle()

            expect(clearPerspectivePointer).toHaveBeenCalledWith(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)
            expect(mockedPutCacheRecord).not.toHaveBeenCalled()
            expect(pertains).toHaveLength(1)
            expect(pertains[0]).toMatchObject({
                componentId: passThroughFixtureRoomId,
                perspectiveKey: passThroughFixturePerspectiveKey,
                cacheId: newStateCacheId,
            })
            expect(setPerspectivePointerMock).toHaveBeenCalledWith(
                passThroughFixtureRoomId,
                passThroughFixturePerspectiveKey,
                newStateCacheId
            )
        }
    )
})
