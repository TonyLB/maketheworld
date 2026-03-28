import type { MessageBus } from '../messageBus/baseClasses'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import type { ConversationCompositeReadHandleGenerateRoomPreview } from '../conversations/conversationTypes'
import type { RenderPreviewRequested, RenderRequested } from './events'
import { RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION } from './baseClasses'
import { deliverRenderResolveForPassive, deliverRenderResolveForPreview } from './deliverRenderResolve'

describe('deliverRenderResolve', () => {
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

    const basePreviewPayload: RenderPreviewRequested = {
        type: 'RenderPreviewRequested',
        componentId: 'ROOM#one',
        perspective: { assetStack: ['ASSET#base'] },
        markState: { markValue: [] },
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
    }

    describe('deliverRenderResolveForPassive', () => {
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

    describe('deliverRenderResolveForPreview', () => {
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
                    cacheId: 'CACHE#valid',
                    cacheRecord: baseCacheRecord,
                },
                undefined,
                messageBus,
                basePreviewPayload
            )
        })

        it('sendMessage success payload on resolved', async () => {
            const handle = makeHandle()
            const messageBus = makeBus()
            await deliverRenderResolveForPreview(
                {
                    type: 'resolved',
                    renderedContent: baseCacheRecord.renderedContent,
                    cacheId: 'CACHE#valid',
                    cacheRecord: baseCacheRecord,
                },
                handle,
                messageBus,
                basePreviewPayload
            )
            expect(handle.sendMessage).toHaveBeenCalledWith({
                success: true,
                renderedContent: baseCacheRecord.renderedContent,
                cacheId: 'CACHE#valid',
                cacheRecord: baseCacheRecord,
            })
        })

        it('sendMessage failure payload on failed generation', async () => {
            const handle = makeHandle()
            const messageBus = makeBus()
            await deliverRenderResolveForPreview(
                {
                    type: 'failed',
                    errorCode: 'CONTEXT_REQUIRED',
                    errorMessage: 'Generation context required',
                },
                handle,
                messageBus,
                basePreviewPayload
            )
            expect(handle.sendMessage).toHaveBeenCalledWith({
                success: false,
                errorCode: 'CONTEXT_REQUIRED',
                errorMessage: 'Generation context required',
            })
        })

        it('sends RenderInvalidate on messageBus on invalidate and does not sendMessage', async () => {
            const handle = makeHandle()
            const messageBus = makeBus()
            await deliverRenderResolveForPreview(
                {
                    type: 'invalidate',
                    reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
                },
                handle,
                messageBus,
                basePreviewPayload
            )
            expect(handle.sendMessage).not.toHaveBeenCalled()
            expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
                type: 'RenderInvalidate',
                reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
                componentId: 'ROOM#one',
            }))
        })

        it('logs and does not sendMessage on META_ROOM_MARKS_MISSING', async () => {
            const handle = makeHandle()
            const err = jest.spyOn(console, 'error').mockImplementation(() => {})
            const messageBus = makeBus()
            await deliverRenderResolveForPreview(
                {
                    type: 'failed',
                    errorCode: 'META_ROOM_MARKS_MISSING',
                    errorMessage: 'x',
                },
                handle,
                messageBus,
                basePreviewPayload
            )
            expect(handle.sendMessage).not.toHaveBeenCalled()
            expect(err).toHaveBeenCalled()
            err.mockRestore()
        })

        it('does not send when resolved missing cacheId and logs', async () => {
            const handle = makeHandle()
            const err = jest.spyOn(console, 'error').mockImplementation(() => {})
            const messageBus = makeBus()
            await deliverRenderResolveForPreview(
                {
                    type: 'resolved',
                    renderedContent: baseCacheRecord.renderedContent,
                },
                handle,
                messageBus,
                basePreviewPayload
            )
            expect(handle.sendMessage).not.toHaveBeenCalled()
            expect(err).toHaveBeenCalled()
            err.mockRestore()
        })
    })
})
