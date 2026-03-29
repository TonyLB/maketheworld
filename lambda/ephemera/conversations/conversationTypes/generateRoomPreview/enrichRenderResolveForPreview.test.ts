import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem } from '../../../renderCache/baseClasses'
import type { ConversationCompositeReadHandleGenerateRoomPreview } from '../compositeRead'
import { enrichRenderResolveForPreview } from './enrichRenderResolveForPreview'

describe('enrichRenderResolveForPreview', () => {
    const baseCacheRecord: EphemeraCacheDynamoItem = {
        EphemeraId: 'ROOM#one',
        DataCategory: 'CACHE#valid',
        markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
        renderedContent: { description: [] },
        provenance: { type: 'authored' },
        perspectiveId: 'PERSPECTIVE#legacy',
        perspectiveMatcher: { requiredAssetIds: ['ASSET#base'], forbiddenAssetIds: [] },
    }

    const makeHandle = (): ConversationCompositeReadHandleGenerateRoomPreview => ({
        kind: 'conversationCompositeReadGenerateRoomPreview',
        sendMessage: jest.fn().mockResolvedValue(undefined),
    })

    it('does nothing when handle is undefined', async () => {
        await enrichRenderResolveForPreview(
            {
                type: 'resolved',
                renderedContent: baseCacheRecord.renderedContent,
                cacheId: 'CACHE#valid' as EphemeraCacheId,
                cacheRecord: baseCacheRecord,
            },
            undefined
        )
    })

    it('sendMessage with RenderResolveOutput resolved', async () => {
        const handle = makeHandle()
        const output = {
            type: 'resolved' as const,
            renderedContent: baseCacheRecord.renderedContent,
            cacheId: 'CACHE#valid' as EphemeraCacheId,
            cacheRecord: baseCacheRecord,
        }
        await enrichRenderResolveForPreview(output, handle)
        expect(handle.sendMessage).toHaveBeenCalledWith(output)
    })

    it('sendMessage with RenderResolveOutput failed', async () => {
        const handle = makeHandle()
        const output = {
            type: 'failed' as const,
            errorCode: 'CONTEXT_REQUIRED' as const,
            errorMessage: 'Generation context required',
        }
        await enrichRenderResolveForPreview(output, handle)
        expect(handle.sendMessage).toHaveBeenCalledWith(output)
    })

    it('forwards invalidate to sendMessage with same output', async () => {
        const handle = makeHandle()
        const output = {
            type: 'invalidate' as const,
            reason: 'NO_CACHE_MATCH_AND_GENERATION_NOT_RUN',
        }
        await enrichRenderResolveForPreview(output, handle)
        expect(handle.sendMessage).toHaveBeenCalledWith(output)
    })

    it('forwards META_ROOM_MARKS_MISSING to sendMessage', async () => {
        const handle = makeHandle()
        const output = {
            type: 'failed' as const,
            errorCode: 'META_ROOM_MARKS_MISSING' as const,
            errorMessage: 'x',
        }
        await enrichRenderResolveForPreview(output, handle)
        expect(handle.sendMessage).toHaveBeenCalledWith(output)
    })

    it('forwards resolved missing cacheId to sendMessage', async () => {
        const handle = makeHandle()
        const output = {
            type: 'resolved' as const,
            renderedContent: baseCacheRecord.renderedContent,
        }
        await enrichRenderResolveForPreview(output, handle)
        expect(handle.sendMessage).toHaveBeenCalledWith(output)
    })
})
