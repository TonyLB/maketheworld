import type { MessageBus } from '../messageBus/baseClasses'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import type { ConversationCompositeReadHandleGenerateRoomPreview } from '../conversations/conversationTypes'
import type { RenderRequested } from './events'
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

        it('sends RenderLookupRequested on lookup_handoff', () => {
            const messageBus = makeBus()
            deliverRenderResolveForPassive(basePayload, messageBus, { type: 'lookup_handoff' })
            expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
                type: 'RenderLookupRequested',
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
            await deliverRenderResolveForPreview(
                {
                    type: 'resolved',
                    renderedContent: baseCacheRecord.renderedContent,
                    cacheId: 'CACHE#valid',
                    cacheRecord: baseCacheRecord,
                },
                undefined
            )
        })

        it('sendMessage success payload on resolved', async () => {
            const handle = makeHandle()
            await deliverRenderResolveForPreview(
                {
                    type: 'resolved',
                    renderedContent: baseCacheRecord.renderedContent,
                    cacheId: 'CACHE#valid',
                    cacheRecord: baseCacheRecord,
                },
                handle
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
            await deliverRenderResolveForPreview(
                {
                    type: 'failed',
                    errorCode: 'CONTEXT_REQUIRED',
                    errorMessage: 'Generation context required',
                },
                handle
            )
            expect(handle.sendMessage).toHaveBeenCalledWith({
                success: false,
                errorCode: 'CONTEXT_REQUIRED',
                errorMessage: 'Generation context required',
            })
        })

        it('logs and does not sendMessage on lookup_handoff', async () => {
            const handle = makeHandle()
            const err = jest.spyOn(console, 'error').mockImplementation(() => {})
            await deliverRenderResolveForPreview({ type: 'lookup_handoff' }, handle)
            expect(handle.sendMessage).not.toHaveBeenCalled()
            expect(err).toHaveBeenCalled()
            err.mockRestore()
        })

        it('logs and does not sendMessage on META_ROOM_MARKS_MISSING', async () => {
            const handle = makeHandle()
            const err = jest.spyOn(console, 'error').mockImplementation(() => {})
            await deliverRenderResolveForPreview(
                {
                    type: 'failed',
                    errorCode: 'META_ROOM_MARKS_MISSING',
                    errorMessage: 'x',
                },
                handle
            )
            expect(handle.sendMessage).not.toHaveBeenCalled()
            expect(err).toHaveBeenCalled()
            err.mockRestore()
        })

        it('does not send when resolved missing cacheId and logs', async () => {
            const handle = makeHandle()
            const err = jest.spyOn(console, 'error').mockImplementation(() => {})
            await deliverRenderResolveForPreview(
                {
                    type: 'resolved',
                    renderedContent: baseCacheRecord.renderedContent,
                },
                handle
            )
            expect(handle.sendMessage).not.toHaveBeenCalled()
            expect(err).toHaveBeenCalled()
            err.mockRestore()
        })
    })
})
