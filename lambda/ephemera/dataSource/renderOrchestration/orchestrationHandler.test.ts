import type { MessageBus as MessageBusType } from '../../messageBus/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import internalCache from '../../internalCache'
import { orchestrateRenderRequest } from './orchestrationHandler'
import {
    isRenderOrchestrationCurrentCacheValidPayload,
    isRenderOrchestrationExactMatchFoundPayload,
    isRenderOrchestrationGenerationDeferredPayload,
    isRenderOrchestrationOrchestrationErrorPayload,
    isRenderOrchestrationRenderGeneratedPayload,
    RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
    streamEventFromMessageBus,
} from './publishedEvents'
import type { RenderRequested } from './events'

describe('dataSource/renderOrchestration/orchestrationHandler', () => {
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
            'PERSPECTIVE#v1#abc': 'CACHE#valid'
        }
    }

    const baseCacheRecord: EphemeraCacheDynamoItem = {
        EphemeraId: 'ROOM#one',
        DataCategory: 'CACHE#valid',
        markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
        renderedContent: { description: [] },
        provenance: { type: 'authored' },
        perspectiveId: 'PERSPECTIVE#legacy',
        perspectiveMatcher: { requiredAssetIds: ['ASSET#base'], forbiddenAssetIds: [] }
    }

    const makeBus = (): MessageBusType & { send: jest.Mock; flush: jest.Mock } => (
        {
            send: jest.fn(),
            flush: jest.fn().mockResolvedValue(undefined),
        } as unknown as MessageBusType & { send: jest.Mock; flush: jest.Mock }
    )

    const findOrchestrationStreamingEvent = (send: jest.Mock): { getContent: () => Promise<unknown> } | undefined => {
        for (const call of send.mock.calls) {
            const msg = call[0] as { type?: string; dataSourceKey?: string; getContent?: () => Promise<unknown> }
            if (msg?.type === 'StreamingEvent' && msg?.dataSourceKey === RENDER_ORCHESTRATION_DATA_SOURCE_KEY && msg.getContent) {
                return msg as { getContent: () => Promise<unknown> }
            }
        }
        return undefined
    }

    it('emits Current Cache Valid on valid fast-path hit', async () => {
        const messageBus = makeBus()
        const getCacheRecordById = jest.fn().mockResolvedValue(baseCacheRecord)
        const getExactMatch = jest.fn()
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById,
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn().mockReturnValue(true)
            }
        )
        const stream = findOrchestrationStreamingEvent(messageBus.send)
        expect(stream).toBeDefined()
        const content = await stream!.getContent()
        expect(isRenderOrchestrationCurrentCacheValidPayload(content)).toBe(true)
        expect((content as { cacheId?: string }).cacheId).toBe('CACHE#valid')
        expect(getCacheRecordById).toHaveBeenCalledWith('ROOM#one', 'CACHE#valid')
        expect(getExactMatch).not.toHaveBeenCalled()
    })

    it('emits Generation Deferred when no pointer exists', async () => {
        const messageBus = makeBus()
        const getExactMatch = jest.fn().mockResolvedValue(null)
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, currentCacheByPerspective: {} }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn()
            }
        )
        const content = await findOrchestrationStreamingEvent(messageBus.send)!.getContent()
        expect(isRenderOrchestrationGenerationDeferredPayload(content)).toBe(true)
        expect(getExactMatch).toHaveBeenCalled()
    })

    it('clears pointer and emits Generation Deferred when record missing', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(undefined),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer,
                markStatesEqual: jest.fn()
            }
        )
        expect(clearPerspectivePointer).toHaveBeenCalledWith('ROOM#one', 'PERSPECTIVE#v1#abc')
        const content = await findOrchestrationStreamingEvent(messageBus.send)!.getContent()
        expect(isRenderOrchestrationGenerationDeferredPayload(content)).toBe(true)
    })

    it('emits Exact Match Found on exact-match hit when no pointer exists', async () => {
        const messageBus = makeBus()
        const getExactMatch = jest.fn().mockResolvedValue(baseCacheRecord)
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, currentCacheByPerspective: {} }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn()
            }
        )
        const content = await findOrchestrationStreamingEvent(messageBus.send)!.getContent()
        expect(isRenderOrchestrationExactMatchFoundPayload(content)).toBe(true)
        expect((content as { cacheId?: string }).cacheId).toBe('CACHE#valid')
        expect(getExactMatch).toHaveBeenCalled()
    })

    it('uses empty default marks when state marks missing (no lens) and does not call generation', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const generateRoomPreview = jest.fn()
        const messageBus = makeBus()
        const getExactMatch = jest.fn().mockResolvedValue(null)
        await orchestrateRenderRequest(
            { payload: { ...basePayload, allowGeneration: true }, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, state: undefined }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                computeDefaultMarksForRoom: jest.fn().mockResolvedValue({ markValue: [] }),
                getCacheRecordById: jest.fn().mockResolvedValue(baseCacheRecord),
                getExactMatch,
                clearPerspectivePointer,
                markStatesEqual: jest.fn().mockReturnValue(false),
                generateRoomPreview,
            }
        )
        expect(clearPerspectivePointer).toHaveBeenCalled()
        expect(generateRoomPreview).not.toHaveBeenCalled()
        const content = await findOrchestrationStreamingEvent(messageBus.send)!.getContent()
        expect(isRenderOrchestrationGenerationDeferredPayload(content)).toBe(true)
        expect(getExactMatch).toHaveBeenCalledWith(
            expect.objectContaining({
                componentId: 'ROOM#one',
                proposedMarkState: { markValue: [] },
            })
        )
    })

    it('uses empty default marks when Meta::Room row is missing and does not call generation', async () => {
        const generateRoomPreview = jest.fn()
        const messageBus = makeBus()
        const getExactMatch = jest.fn().mockResolvedValue(null)
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(undefined),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                computeDefaultMarksForRoom: jest.fn().mockResolvedValue({ markValue: [] }),
                getCacheRecordById: jest.fn(),
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
                generateRoomPreview,
            }
        )
        expect(generateRoomPreview).not.toHaveBeenCalled()
        const content = await findOrchestrationStreamingEvent(messageBus.send)!.getContent()
        expect(isRenderOrchestrationGenerationDeferredPayload(content)).toBe(true)
        expect(getExactMatch).toHaveBeenCalledWith(
            expect.objectContaining({
                componentId: 'ROOM#one',
                proposedMarkState: { markValue: [] },
            })
        )
    })

    it('clears pointer and emits Generation Deferred when markState mismatch', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(baseCacheRecord),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer,
                markStatesEqual: jest.fn().mockReturnValue(false)
            }
        )
        expect(clearPerspectivePointer).toHaveBeenCalled()
        const content = await findOrchestrationStreamingEvent(messageBus.send)!.getContent()
        expect(isRenderOrchestrationGenerationDeferredPayload(content)).toBe(true)
    })

    it('clears pointer and emits Generation Deferred when perspective mismatches', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        const cacheRecord = {
            ...baseCacheRecord,
            perspectiveMatcher: { requiredAssetIds: ['ASSET#other'], forbiddenAssetIds: [] }
        }
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(cacheRecord),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer,
                markStatesEqual: jest.fn().mockReturnValue(true)
            }
        )
        expect(clearPerspectivePointer).toHaveBeenCalled()
        const content = await findOrchestrationStreamingEvent(messageBus.send)!.getContent()
        expect(isRenderOrchestrationGenerationDeferredPayload(content)).toBe(true)
    })

    it('continues to Generation Deferred if pointer clearing fails', async () => {
        const messageBus = makeBus()
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(undefined),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer: jest.fn().mockRejectedValue(new Error('boom')),
                markStatesEqual: jest.fn()
            }
        )
        const content = await findOrchestrationStreamingEvent(messageBus.send)!.getContent()
        expect(isRenderOrchestrationGenerationDeferredPayload(content)).toBe(true)
    })

    it('emits Exact Match Found on exact-match hit after invalid pointer', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(undefined),
                getExactMatch: jest.fn().mockResolvedValue(baseCacheRecord),
                clearPerspectivePointer,
                markStatesEqual: jest.fn()
            }
        )
        expect(clearPerspectivePointer).toHaveBeenCalledWith('ROOM#one', 'PERSPECTIVE#v1#abc')
        const content = await findOrchestrationStreamingEvent(messageBus.send)!.getContent()
        expect(isRenderOrchestrationExactMatchFoundPayload(content)).toBe(true)
        expect((content as { cacheId?: string }).cacheId).toBe('CACHE#valid')
    })

    it('bypasses room fast-path for non-room componentIds', async () => {
        const messageBus = makeBus()
        const payload: RenderRequested = { ...basePayload, componentId: 'FEATURE#one' }
        const getMetaRoom = jest.fn()
        await orchestrateRenderRequest(
            { payload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
            {
                getMetaRoom,
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn(),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn()
            }
        )
        expect(getMetaRoom).not.toHaveBeenCalled()
        const content = await findOrchestrationStreamingEvent(messageBus.send)!.getContent()
        expect(isRenderOrchestrationOrchestrationErrorPayload(content)).toBe(true)
        expect((content as { errorCode?: string }).errorCode).toBe('NOT_ROOM')
    })

    it('runs generation and emits Render Generated when allowGeneration and no cache hit', async () => {
        const generatedRow: EphemeraCacheDynamoItem = {
            ...baseCacheRecord,
            DataCategory: 'CACHE#generated',
            provenance: { type: 'generated' },
        }
        const generateRoomPreview = jest.fn().mockImplementation(async (
            _input: unknown,
            options: { publishOrchestration: (c: unknown) => void | Promise<void> }
        ) => {
            await options.publishOrchestration({
                type: 'Generation Started',
                componentId: 'ROOM#one',
                perspective: { assetStack: ['ASSET#base'] },
                perspectiveKey: 'PERSPECTIVE#v1#abc',
                phase: 'generating',
            })
            await options.publishOrchestration({
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
            { payload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
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
        expect(generateRoomPreview).toHaveBeenCalled()
        expect(generateRoomPreview).toHaveBeenCalledWith(
            expect.not.objectContaining({ generationContextWml: expect.anything() }),
            expect.any(Object)
        )
        let sawRenderGenerated = false
        for (const call of messageBus.send.mock.calls) {
            const msg = call[0] as { type?: string; dataSourceKey?: string; getContent?: () => Promise<unknown> }
            if (msg?.type === 'StreamingEvent' && msg?.dataSourceKey === RENDER_ORCHESTRATION_DATA_SOURCE_KEY && msg.getContent) {
                const c = await msg.getContent()
                if (isRenderOrchestrationRenderGeneratedPayload(c)) {
                    sawRenderGenerated = true
                    expect((c as { cacheId?: string }).cacheId).toBe('CACHE#generated')
                }
            }
        }
        expect(sawRenderGenerated).toBe(true)
    })

    it('emits Orchestration Error when allowGeneration set but generation returns CONTEXT_REQUIRED', async () => {
        const generateRoomPreview = jest.fn().mockImplementation(async (
            _input: unknown,
            options: { publishOrchestration: (c: unknown) => void | Promise<void> }
        ) => {
            await options.publishOrchestration({
                type: 'Orchestration Error',
                componentId: 'ROOM#one',
                perspective: { assetStack: ['ASSET#base'] },
                perspectiveKey: 'PERSPECTIVE#v1#abc',
                errorCode: 'CONTEXT_REQUIRED',
                errorMessage: 'Generation context required',
            })
            return 'fail'
        })
        const messageBus = makeBus()
        const payload: RenderRequested = {
            ...basePayload,
            allowGeneration: true,
        }
        await orchestrateRenderRequest(
            { payload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
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
        expect(generateRoomPreview).toHaveBeenCalled()
        const content = await findOrchestrationStreamingEvent(messageBus.send)!.getContent()
        expect(isRenderOrchestrationOrchestrationErrorPayload(content)).toBe(true)
        expect((content as { errorCode?: string }).errorCode).toBe('CONTEXT_REQUIRED')
        expect((content as { errorMessage?: string }).errorMessage).toBe('Generation context required')
        expect((content as { componentId?: string }).componentId).toBe('ROOM#one')
    })
})
