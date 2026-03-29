import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { EphemeraCacheDynamoItem } from '../../../renderCache/baseClasses'
import type { ConversationCompositeReadHandleGenerateRoomPreview } from '../compositeRead'
import type { RenderPreviewRequested } from '../../../renderOrchestration/events'
import { RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION } from '../../../renderOrchestration/baseClasses'
import { deliverRenderResolveForPreview } from './deliverRenderResolveForPreview'

describe('deliverRenderResolveForPreview', () => {
    const baseCacheRecord: EphemeraCacheDynamoItem = {
        EphemeraId: 'ROOM#one',
        DataCategory: 'CACHE#valid',
        markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
        renderedContent: { description: [] },
        provenance: { type: 'authored' },
        perspectiveId: 'PERSPECTIVE#legacy',
        perspectiveMatcher: { requiredAssetIds: ['ASSET#base'], forbiddenAssetIds: [] },
    }

    const makeBus = (): MessageBus => ({ send: jest.fn() } as unknown as MessageBus)

    const basePreviewPayload: RenderPreviewRequested = {
        type: 'RenderPreviewRequested',
        componentId: 'ROOM#one',
        perspective: { assetStack: ['ASSET#base'] },
        markState: { markValue: [] },
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
    }

    const makeHandle = (): ConversationCompositeReadHandleGenerateRoomPreview => ({
        kind: 'conversationCompositeReadGenerateRoomPreview',
        sendMessage: jest.fn().mockResolvedValue(undefined),
    })

    it('does nothing when handle is undefined', async () => {
        const messageBus = makeBus()
        await deliverRenderResolveForPreview(
            {
                type: 'resolved',
                renderedContent: baseCacheRecord.renderedContent,
                cacheId: 'CACHE#valid' as EphemeraCacheId,
                cacheRecord: baseCacheRecord,
            },
            undefined,
            messageBus,
            basePreviewPayload
        )
    })

    it('sendMessage with RenderResolveOutput resolved', async () => {
        const handle = makeHandle()
        const messageBus = makeBus()
        const output = {
            type: 'resolved' as const,
            renderedContent: baseCacheRecord.renderedContent,
            cacheId: 'CACHE#valid' as EphemeraCacheId,
            cacheRecord: baseCacheRecord,
        }
        await deliverRenderResolveForPreview(output, handle, messageBus, basePreviewPayload)
        expect(handle.sendMessage).toHaveBeenCalledWith(output)
    })

    it('sendMessage with RenderResolveOutput failed', async () => {
        const handle = makeHandle()
        const messageBus = makeBus()
        const output = {
            type: 'failed' as const,
            errorCode: 'CONTEXT_REQUIRED' as const,
            errorMessage: 'Generation context required',
        }
        await deliverRenderResolveForPreview(output, handle, messageBus, basePreviewPayload)
        expect(handle.sendMessage).toHaveBeenCalledWith(output)
    })

    it('sends RenderInvalidate on messageBus on invalidate and forwards sendMessage with same output', async () => {
        const handle = makeHandle()
        const messageBus = makeBus()
        const output = {
            type: 'invalidate' as const,
            reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
        }
        await deliverRenderResolveForPreview(output, handle, messageBus, basePreviewPayload)
        expect(handle.sendMessage).toHaveBeenCalledWith(output)
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderInvalidate',
            reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
            componentId: 'ROOM#one',
        }))
    })

    it('forwards META_ROOM_MARKS_MISSING to sendMessage', async () => {
        const handle = makeHandle()
        const messageBus = makeBus()
        const output = {
            type: 'failed' as const,
            errorCode: 'META_ROOM_MARKS_MISSING' as const,
            errorMessage: 'x',
        }
        await deliverRenderResolveForPreview(output, handle, messageBus, basePreviewPayload)
        expect(handle.sendMessage).toHaveBeenCalledWith(output)
    })

    it('forwards resolved missing cacheId to sendMessage', async () => {
        const handle = makeHandle()
        const messageBus = makeBus()
        const output = {
            type: 'resolved' as const,
            renderedContent: baseCacheRecord.renderedContent,
        }
        await deliverRenderResolveForPreview(output, handle, messageBus, basePreviewPayload)
        expect(handle.sendMessage).toHaveBeenCalledWith(output)
    })
})
