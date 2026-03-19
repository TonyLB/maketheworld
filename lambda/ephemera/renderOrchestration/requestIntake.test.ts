import type { MessageBus } from '../messageBus/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import { requestIntakeMessage } from './requestIntake'
import type { RenderRequested } from './events'

describe('renderOrchestration/requestIntake', () => {
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
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(baseCacheRecord),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn().mockReturnValue(true)
            }
        )

        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderReady',
            cacheId: 'CACHE#valid'
        }))
        expect(messageBus.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderLookupRequested' }))
    })

    it('emits lookup handoff when no pointer exists', async () => {
        const messageBus = makeBus()
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, currentCacheByPerspective: {} }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn()
            }
        )
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderLookupRequested' }))
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
                clearPerspectivePointer,
                markStatesEqual: jest.fn()
            }
        )
        expect(clearPerspectivePointer).toHaveBeenCalledWith('ROOM#one', 'PERSPECTIVE#v1#abc')
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderLookupRequested' }))
    })

    it('clears pointer and emits lookup handoff when state marks missing', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, state: undefined }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(baseCacheRecord),
                clearPerspectivePointer,
                markStatesEqual: jest.fn().mockReturnValue(false)
            }
        )
        expect(clearPerspectivePointer).toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderLookupRequested' }))
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
                clearPerspectivePointer,
                markStatesEqual: jest.fn().mockReturnValue(false)
            }
        )
        expect(clearPerspectivePointer).toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderLookupRequested' }))
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
                clearPerspectivePointer,
                markStatesEqual: jest.fn().mockReturnValue(true)
            }
        )
        expect(clearPerspectivePointer).toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderLookupRequested' }))
    })

    it('continues to lookup handoff if pointer clearing fails', async () => {
        const messageBus = makeBus()
        await requestIntakeMessage(
            { payloads: [basePayload], messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(undefined),
                clearPerspectivePointer: jest.fn().mockRejectedValue(new Error('boom')),
                markStatesEqual: jest.fn()
            }
        )
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderLookupRequested' }))
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
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn()
            }
        )
        expect(getMetaRoom).not.toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderLookupRequested' }))
    })
})

