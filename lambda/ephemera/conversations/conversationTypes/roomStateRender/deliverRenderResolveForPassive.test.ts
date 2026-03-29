import type { MessageBus } from '../../../messageBus/baseClasses'
import type { EphemeraCacheDynamoItem } from '../../../renderCache/baseClasses'
import type { RenderRequested } from '../../../renderOrchestration/events'
import { RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION } from '../../../renderOrchestration/baseClasses'
import { deliverRenderResolveForPassive } from './deliverRenderResolveForPassive'

describe('deliverRenderResolveForPassive', () => {
    const basePayload: RenderRequested = {
        type: 'RenderRequested',
        componentId: 'ROOM#one',
        perspective: { assetStack: ['ASSET#base'] }
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

    it('sends RenderReady when resolved with cacheId and cacheRecord', () => {
        const messageBus = makeBus()
        deliverRenderResolveForPassive(
            basePayload,
            messageBus,
            {
                type: 'resolved',
                renderedContent: baseCacheRecord.renderedContent,
                cacheId: 'CACHE#valid',
                cacheRecord: baseCacheRecord,
            }
        )
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderReady',
            cacheId: 'CACHE#valid',
        }))
    })

    it('sends RenderInvalidate on invalidate', () => {
        const messageBus = makeBus()
        deliverRenderResolveForPassive(basePayload, messageBus, {
            type: 'invalidate',
            reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
        })
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderInvalidate',
            reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
        }))
    })

    it('sends Error for META_ROOM_MARKS_MISSING', () => {
        const messageBus = makeBus()
        deliverRenderResolveForPassive(
            basePayload,
            messageBus,
            {
                type: 'failed',
                errorCode: 'META_ROOM_MARKS_MISSING',
                errorMessage: 'marks missing',
            }
        )
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'Error',
            body: expect.objectContaining({
                error: expect.stringContaining('Meta::Room.state.marks'),
            }),
        }))
    })

    it('sends Error with errorCode prefix for other failures', () => {
        const messageBus = makeBus()
        deliverRenderResolveForPassive(
            basePayload,
            messageBus,
            {
                type: 'failed',
                errorCode: 'CONTEXT_REQUIRED',
                errorMessage: 'Generation context required',
            }
        )
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'Error',
            body: expect.objectContaining({
                error: expect.stringContaining('CONTEXT_REQUIRED'),
            }),
        }))
    })

    it('does not send when resolved is missing cacheId and logs', () => {
        const messageBus = makeBus()
        const err = jest.spyOn(console, 'error').mockImplementation(() => {})
        deliverRenderResolveForPassive(
            basePayload,
            messageBus,
            {
                type: 'resolved',
                renderedContent: baseCacheRecord.renderedContent,
            }
        )
        expect(messageBus.send).not.toHaveBeenCalled()
        expect(err).toHaveBeenCalled()
        err.mockRestore()
    })
})
