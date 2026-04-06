/**
 * Skipped contract tests: when streamEvent wiring lands, orchestration should emit
 * mtw.ephemera.renderOrchestration StreamingEvents (six outbounds) instead of legacy
 * conversation / messageBus terminals for these outcomes.
 * Un-skip with stream skeleton (phase B).
 */
import type { MessageBus as MessageBusType } from '../../messageBus/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem } from '../../renderCache/baseClasses'
import internalCache from '../../internalCache'
import { orchestrateRenderRequest } from './orchestrationHandler'
import type { RenderRequested } from './events'
import {
    isRenderOrchestrationCurrentCacheValidPayload,
    isRenderOrchestrationExactMatchFoundPayload,
    isRenderOrchestrationGenerationDeferredPayload,
    isRenderOrchestrationGenerationStartedPayload,
    isRenderOrchestrationOrchestrationErrorPayload,
    isRenderOrchestrationRenderGeneratedPayload,
    RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
} from './publishedEvents'

const makeBus = (): MessageBusType & { send: jest.Mock } => ({ send: jest.fn() } as unknown as MessageBusType & { send: jest.Mock })

const findOrchestrationStreamingEvent = (send: jest.Mock): { getContent: () => Promise<unknown> } | undefined => {
    for (const call of send.mock.calls) {
        const msg = call[0] as { type?: string; dataSourceKey?: string; getContent?: () => Promise<unknown> }
        if (msg?.type === 'StreamingEvent' && msg?.dataSourceKey === RENDER_ORCHESTRATION_DATA_SOURCE_KEY && msg.getContent) {
            return msg as { getContent: () => Promise<unknown> }
        }
    }
    return undefined
}

describe.skip('renderOrchestration stream outcomes (until streamEvent wired in pipeline)', () => {
    beforeEach(() => {
        internalCache.clear()
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
        currentCacheByPerspective: {
            'PERSPECTIVE#v1#abc': 'CACHE#valid',
        },
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
        const getCacheRecordById = jest.fn().mockResolvedValue(baseCacheRecord)
        const getExactMatch = jest.fn()
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById,
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn().mockReturnValue(true),
            }
        )
        const stream = findOrchestrationStreamingEvent(messageBus.send)
        expect(stream).toBeDefined()
        const content = await stream!.getContent()
        expect(isRenderOrchestrationCurrentCacheValidPayload(content)).toBe(true)
        expect((content as { type: string }).type).toBe('Current Cache Valid')
    })

    it('exact match hit emits Exact Match Found on mtw.ephemera.renderOrchestration', async () => {
        const messageBus = makeBus()
        const getExactMatch = jest.fn().mockResolvedValue(baseCacheRecord)
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, currentCacheByPerspective: {} }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
            }
        )
        const stream = findOrchestrationStreamingEvent(messageBus.send)
        expect(stream).toBeDefined()
        const content = await stream!.getContent()
        expect(isRenderOrchestrationExactMatchFoundPayload(content)).toBe(true)
    })

    it('generation slow path emits Generation Started on mtw.ephemera.renderOrchestration', async () => {
        const generateRoomPreview = jest.fn().mockImplementation(async (_input: unknown, options: { sendMessage?: (m: unknown) => Promise<void> }) => {
            await options?.sendMessage?.('generating')
            await options?.sendMessage?.({
                type: 'resolved',
                renderedContent: { description: [{ tag: 'String', value: 'Generated' }] },
                cacheId: 'CACHE#generated',
                cacheRecord: { ...baseCacheRecord, DataCategory: 'CACHE#generated', provenance: { type: 'generated' } },
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
            { payload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, currentCacheByPerspective: {} }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
                generateRoomPreview,
            }
        )
        const sends = messageBus.send.mock.calls.map((c) => c[0])
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
        const generateRoomPreview = jest.fn().mockImplementation(async (_input: unknown, options: { sendMessage?: (m: unknown) => Promise<void> }) => {
            await options?.sendMessage?.({
                type: 'resolved',
                renderedContent: { description: [{ tag: 'String', value: 'Generated' }] },
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
            { payload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, currentCacheByPerspective: {} }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
                generateRoomPreview,
            }
        )
        const stream = findOrchestrationStreamingEvent(messageBus.send)
        expect(stream).toBeDefined()
        const content = await stream!.getContent()
        expect(isRenderOrchestrationRenderGeneratedPayload(content)).toBe(true)
    })

    it('intake / resolve failure emits Orchestration Error on mtw.ephemera.renderOrchestration', async () => {
        const messageBus = makeBus()
        const payload: RenderRequested = { ...basePayload, componentId: 'FEATURE#one' }
        await orchestrateRenderRequest(
            { payload, messageBus },
            {
                getMetaRoom: jest.fn(),
                computePerspectiveKey: jest.fn(),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn(),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
            }
        )
        const stream = findOrchestrationStreamingEvent(messageBus.send)
        expect(stream).toBeDefined()
        const content = await stream!.getContent()
        expect(isRenderOrchestrationOrchestrationErrorPayload(content)).toBe(true)
        expect((content as { errorCode?: string }).errorCode).toBe('NOT_ROOM')
    })

    it('defer when no cache and allowGeneration false emits Generation Deferred on mtw.ephemera.renderOrchestration', async () => {
        const messageBus = makeBus()
        const getExactMatch = jest.fn().mockResolvedValue(null)
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, currentCacheByPerspective: {} }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
            }
        )
        const stream = findOrchestrationStreamingEvent(messageBus.send)
        expect(stream).toBeDefined()
        const content = await stream!.getContent()
        expect(isRenderOrchestrationGenerationDeferredPayload(content)).toBe(true)
    })
})
