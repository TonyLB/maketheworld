import type { MessageBus } from '../messageBus/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import internalCache from '../internalCache'
import { intakePassiveRenderRequested } from './requestIntake'
import { requestIntakeMessage } from './passiveRenderOrchestration'
import type { RenderRequested } from './events'

describe('renderOrchestration/intakePassiveRenderRequested', () => {
    const basePayload: RenderRequested = {
        type: 'RenderRequested',
        componentId: 'ROOM#one',
        perspective: { assetStack: ['ASSET#base'] }
    }

    const baseMetaRoom = {
        EphemeraId: 'ROOM#one',
        DataCategory: 'Meta::Room' as const,
        state: { marks: { markValue: [{ mark: 'MARK#a', value: 'one' }] } },
        currentCacheByPerspective: { 'PERSPECTIVE#v1#abc': 'CACHE#valid' as const },
    }

    it('returns not_room for non-room componentId', async () => {
        const payload: RenderRequested = { ...basePayload, componentId: 'FEATURE#x' }
        const r = await intakePassiveRenderRequested(payload)
        expect(r).toEqual({ type: 'not_room', payload })
    })

    it('returns marks_missing when Meta has no marks', async () => {
        const r = await intakePassiveRenderRequested(basePayload, {
            getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, state: undefined }),
            computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
        })
        expect(r).toEqual({ type: 'marks_missing', payload: basePayload })
    })

    it('returns ok with RenderResolveInput including pointerHint when Meta has pointer', async () => {
        const r = await intakePassiveRenderRequested(basePayload, {
            getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
            computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
        })
        expect(r.type).toBe('ok')
        if (r.type === 'ok') {
            expect(r.input.roomId).toBe('ROOM#one')
            expect(r.input.markProvenance).toBe('meta')
            expect(r.input.pointerHint).toBe('CACHE#valid')
        }
    })
})

describe('renderOrchestration/passive shell (requestIntakeMessage)', () => {
    beforeEach(() => {
        internalCache.clear()
    })
    const basePayload: RenderRequested = {
        type: 'RenderRequested',
        componentId: 'ROOM#one',
        perspective: { assetStack: ['ASSET#base'] }
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

    const makeBus = (): MessageBus => ({ send: jest.fn() } as unknown as MessageBus)

    it('emits RenderReady on valid fast-path hit', async () => {
        const messageBus = makeBus()
        const getCacheRecordById = jest.fn().mockResolvedValue(baseCacheRecord)
        const getExactMatch = jest.fn()
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById,
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn().mockReturnValue(true)
            }
        )
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderReady',
            cacheId: 'CACHE#valid'
        }))
        expect(messageBus.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
        expect(getCacheRecordById).toHaveBeenCalledWith('ROOM#one', 'CACHE#valid')
        expect(getExactMatch).not.toHaveBeenCalled()
    })

    it('emits lookup handoff when no pointer exists', async () => {
        const messageBus = makeBus()
        const getExactMatch = jest.fn().mockResolvedValue(null)
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, currentCacheByPerspective: {} }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn()
            }
        )
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
        expect(getExactMatch).toHaveBeenCalled()
    })

    it('clears pointer and emits lookup handoff when record missing', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
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
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
    })

    it('emits RenderReady on exact-match hit when no pointer exists', async () => {
        const messageBus = makeBus()
        const getExactMatch = jest.fn().mockResolvedValue(baseCacheRecord)
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, currentCacheByPerspective: {} }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn()
            }
        )
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderReady',
            cacheId: 'CACHE#valid'
        }))
        expect(messageBus.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
        expect(getExactMatch).toHaveBeenCalled()
    })

    it('emits RenderError and does not clear pointer when state marks missing', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, state: undefined }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(baseCacheRecord),
                getExactMatch: jest.fn(),
                clearPerspectivePointer,
                markStatesEqual: jest.fn().mockReturnValue(false)
            }
        )
        expect(clearPerspectivePointer).not.toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderError',
            errorCode: 'META_ROOM_MARKS_MISSING',
            errorMessage: expect.stringContaining('Meta::Room.state.marks'),
            componentId: 'ROOM#one',
        }))
    })

    it('emits RenderError when Meta::Room is missing', async () => {
        const messageBus = makeBus()
        const getCacheRecordById = jest.fn()
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue(undefined),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById,
                getExactMatch: jest.fn(),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn()
            }
        )
        expect(getCacheRecordById).not.toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderError',
            errorCode: 'META_ROOM_MARKS_MISSING',
            errorMessage: expect.stringContaining('Meta::Room.state.marks'),
            componentId: 'ROOM#one',
        }))
    })

    it('clears pointer and emits lookup handoff when markState mismatch', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
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
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
    })

    it('clears pointer and emits lookup handoff when perspective mismatches', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        const cacheRecord = {
            ...baseCacheRecord,
            perspectiveMatcher: { requiredAssetIds: ['ASSET#other'], forbiddenAssetIds: [] }
        }
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
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
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
    })

    it('continues to lookup handoff if pointer clearing fails', async () => {
        const messageBus = makeBus()
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(undefined),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer: jest.fn().mockRejectedValue(new Error('boom')),
                markStatesEqual: jest.fn()
            }
        )
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
    })

    it('emits RenderReady on exact-match hit after invalid pointer', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
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
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderReady',
            cacheId: 'CACHE#valid'
        }))
        expect(messageBus.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
    })

    it('bypasses room fast-path for non-room componentIds', async () => {
        const messageBus = makeBus()
        const payload: RenderRequested = { ...basePayload, componentId: 'FEATURE#one' }
        const getMetaRoom = jest.fn()
        await requestIntakeMessage(
            { payloads: [payload], messageBus },
            {
                getMetaRoom,
                computePerspectiveKey: jest.fn(),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn(),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn()
            }
        )
        expect(getMetaRoom).not.toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderError',
            errorCode: 'RENDER_REQUESTED_NOT_ROOM',
        }))
    })

    it('runs generation and emits RenderReady when allowGeneration and no cache hit', async () => {
        const generatedRow: EphemeraCacheDynamoItem = {
            ...baseCacheRecord,
            DataCategory: 'CACHE#generated',
            provenance: { type: 'generated' },
        }
        const generateRoomPreview = jest.fn().mockImplementation(async (_input, options) => {
            await options?.sendMessage?.('generating')
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
        await requestIntakeMessage(
            { payloads: [payload], messageBus },
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
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderReady',
            cacheId: 'CACHE#generated',
        }))
        expect(messageBus.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
    })

    it('emits RenderError when allowGeneration set but generation returns CONTEXT_REQUIRED', async () => {
        const generateRoomPreview = jest.fn().mockImplementation(async (_input, options) => {
            await options?.sendMessage?.({
                type: 'failed',
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
        await requestIntakeMessage(
            { payloads: [payload], messageBus },
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
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderError',
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
            componentId: 'ROOM#one',
        }))
    })
})

