/**
 * Contract tests: orchestration emits mtw.ephemera.renderOrchestration StreamingEvents
 * (six outbounds); passive orchestration is stream-only (no legacy conversation bus).
 */
jest.mock('../renderCache/ensureAuthoredCatalog', () => ({
    ensureAuthoredCatalog: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../renderCache/catalogRow', () => ({
    ...jest.requireActual('../renderCache/catalogRow'),
    getCatalogRow: jest.fn().mockResolvedValue(undefined),
}))

import type { MessageBus as MessageBusType } from '../../messageBus/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheCatalogRow, EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import { buildCacheCatalogDataCategory } from '../renderCache/baseClasses'
import internalCache from '../../internalCache'
import { getCatalogRow } from '../renderCache/catalogRow'
import { orchestrateRenderRequest } from './orchestrationHandler'
import type { RenderRequested } from '../../messageBus/baseClasses'
import {
    isRenderOrchestrationCurrentCacheValidPayload,
    isRenderOrchestrationExactMatchFoundPayload,
    isRenderOrchestrationGenerationDeferredPayload,
    isRenderOrchestrationGenerationStartedPayload,
    isRenderOrchestrationOrchestrationErrorPayload,
    isRenderOrchestrationRenderGeneratedPayload,
    RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
    streamEventFromMessageBus,
} from './publishedEvents'

const makeBus = (): MessageBusType & { publish: jest.Mock } => (
    {
        publish: jest.fn(),
    } as unknown as MessageBusType & { publish: jest.Mock }
)

const getCatalogRowMock = getCatalogRow as jest.MockedFunction<typeof getCatalogRow>

const readyCatalogForPerspective = (perspectiveKey: string, catalogVersion = 1): EphemeraCacheCatalogRow => ({
    EphemeraId: 'ROOM#one',
    DataCategory: buildCacheCatalogDataCategory(perspectiveKey),
    assetStack: ['ASSET#base'],
    catalogVersion,
    hydratedCatalogVersion: catalogVersion,
})

const findOrchestrationStreamingEvent = (publish: jest.Mock): { getContent: () => Promise<unknown> } | undefined => {
    for (const call of publish.mock.calls) {
        const msg = call[0] as { type?: string; dataSourceKey?: string; getContent?: () => Promise<unknown> }
        if (msg?.type === 'StreamingEvent' && msg?.dataSourceKey === RENDER_ORCHESTRATION_DATA_SOURCE_KEY && msg.getContent) {
            return msg as { getContent: () => Promise<unknown> }
        }
    }
    return undefined
}

describe('renderOrchestration stream outcomes (pass-through six outbounds)', () => {
    beforeEach(() => {
        internalCache.clear()
        getCatalogRowMock.mockResolvedValue(undefined)
    })

    const basePayload: RenderRequested = {
        type: 'RenderRequested',
        componentId: 'ROOM#one',
        perspective: { assetStack: ['ASSET#base'] },
        allowGeneration: false,
    }

    const baseMetaRoom: EphemeraMetaRoom = {
        EphemeraId: 'ROOM#one',
        DataCategory: 'Meta::Room',
        state: { marks: { markValue: [{ mark: 'MARK#a', value: 'one' }] } },
    }

    const baseCacheRecord: EphemeraCacheDynamoItem = {
        EphemeraId: 'ROOM#one',
        DataCategory: 'CACHE#valid',
        markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
        renderedContent: { description: [] },
        provenance: { type: 'authored' },
        perspectiveId: 'PERSPECTIVE#legacy',
        perspectiveMatcher: { requiredAssetIds: ['ASSET#base'], forbiddenAssetIds: [] },
    }

    it('pointer fast-path emits Current Cache Valid on mtw.ephemera.renderOrchestration', async () => {
        const messageBus = makeBus()
        const perspectiveKey = 'PERSPECTIVE#v1#abc'
        getCatalogRowMock.mockResolvedValue(readyCatalogForPerspective(perspectiveKey))
        const getCacheRecordById = jest.fn().mockResolvedValue({ ...baseCacheRecord, catalogVersion: 1 })
        const getExactMatch = jest.fn()
        await orchestrateRenderRequest(
            { payload: basePayload, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                resolvePerspectivePointer: jest.fn().mockResolvedValue('CACHE#valid'),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById,
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn().mockReturnValue(true),
            }
        )
        const stream = findOrchestrationStreamingEvent(messageBus.publish)
        expect(stream).toBeDefined()
        const content = await stream!.getContent()
        expect(isRenderOrchestrationCurrentCacheValidPayload(content)).toBe(true)
        expect((content as { type: string }).type).toBe('Current Cache Valid')
    })

    it('exact match hit emits Exact Match Found on mtw.ephemera.renderOrchestration', async () => {
        const messageBus = makeBus()
        const getExactMatch = jest.fn().mockResolvedValue(baseCacheRecord)
        await orchestrateRenderRequest(
            { payload: basePayload, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                resolvePerspectivePointer: jest.fn().mockResolvedValue(undefined),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
            }
        )
        const stream = findOrchestrationStreamingEvent(messageBus.publish)
        expect(stream).toBeDefined()
        const content = await stream!.getContent()
        expect(isRenderOrchestrationExactMatchFoundPayload(content)).toBe(true)
    })

    it('generation slow path emits Generation Started on mtw.ephemera.renderOrchestration', async () => {
        const generateRoomPreview = jest.fn().mockImplementation(async (_input: unknown, options: {
            publishOrchestration?: (c: unknown) => void;
        }) => {
            options?.publishOrchestration?.({
                type: 'Generation Started',
                componentId: 'ROOM#one',
                perspective: { assetStack: ['ASSET#base'] },
                perspectiveKey: 'PERSPECTIVE#v1#abc',
                phase: 'generating',
            })
            return 'success'
        })
        const messageBus = makeBus()
        const payload: RenderRequested = {
            ...basePayload,
            allowGeneration: true,
            generationContextWml: '<Asset key=(Test) />',
        }
        await orchestrateRenderRequest(
            { payload, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                resolvePerspectivePointer: jest.fn().mockResolvedValue(undefined),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
                generateRoomPreview,
            }
        )
        const sends = messageBus.publish.mock.calls.map((c) => c[0])
        let sawGenerationStarted = false
        for (const m of sends) {
            const msg = m as { type?: string; dataSourceKey?: string; getContent?: () => Promise<unknown> }
            if (msg?.type === 'StreamingEvent' && msg?.dataSourceKey === RENDER_ORCHESTRATION_DATA_SOURCE_KEY && msg.getContent) {
                const c = await msg.getContent()
                if (isRenderOrchestrationGenerationStartedPayload(c)) {
                    sawGenerationStarted = true
                    break
                }
            }
        }
        expect(sawGenerationStarted).toBe(true)
    })

    it('generation success emits Render Generated on mtw.ephemera.renderOrchestration', async () => {
        const generatedRow: EphemeraCacheDynamoItem = {
            ...baseCacheRecord,
            DataCategory: 'CACHE#generated',
            provenance: { type: 'generated' },
        }
        const generateRoomPreview = jest.fn().mockImplementation(async (_input: unknown, options: {
            publishOrchestration?: (c: unknown) => void;
        }) => {
            options?.publishOrchestration?.({
                type: 'Render Generated',
                componentId: 'ROOM#one',
                perspective: { assetStack: ['ASSET#base'] },
                perspectiveKey: 'PERSPECTIVE#v1#abc',
                cacheId: 'CACHE#generated',
                cacheRecord: generatedRow,
            })
            return 'success'
        })
        const messageBus = makeBus()
        const payload: RenderRequested = {
            ...basePayload,
            allowGeneration: true,
            generationContextWml: '<Asset key=(Test) />',
        }
        await orchestrateRenderRequest(
            { payload, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                resolvePerspectivePointer: jest.fn().mockResolvedValue(undefined),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
                generateRoomPreview,
            }
        )
        const stream = findOrchestrationStreamingEvent(messageBus.publish)
        expect(stream).toBeDefined()
        const content = await stream!.getContent()
        expect(isRenderOrchestrationRenderGeneratedPayload(content)).toBe(true)
    })

    it('intake / resolve failure emits Orchestration Error on mtw.ephemera.renderOrchestration', async () => {
        const messageBus = makeBus()
        const payload: RenderRequested = { ...basePayload, componentId: 'MAP#one' }
        await orchestrateRenderRequest(
            { payload, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn(),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn(),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
            }
        )
        const stream = findOrchestrationStreamingEvent(messageBus.publish)
        expect(stream).toBeDefined()
        const content = await stream!.getContent()
        expect(isRenderOrchestrationOrchestrationErrorPayload(content)).toBe(true)
        expect((content as { errorCode?: string }).errorCode).toBe('NOT_ROOM')
    })

    it('defer when no cache and allowGeneration false emits Generation Deferred on mtw.ephemera.renderOrchestration', async () => {
        const messageBus = makeBus()
        const getExactMatch = jest.fn().mockResolvedValue(null)
        await orchestrateRenderRequest(
            { payload: basePayload, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                resolvePerspectivePointer: jest.fn().mockResolvedValue(undefined),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
            }
        )
        const stream = findOrchestrationStreamingEvent(messageBus.publish)
        expect(stream).toBeDefined()
        const content = await stream!.getContent()
        expect(isRenderOrchestrationGenerationDeferredPayload(content)).toBe(true)
    })
})
