import type { EphemeraCacheDynamoItem } from '../../../dataSource/renderCache/baseClasses'
import type { RenderComponentId } from '../../../messageBus/baseClasses'
import { RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION } from '../../../dataSource/renderOrchestration/baseClasses'
import type { MessageBus } from '../../../messageBus/baseClasses'
import { CONVERSATION_PAYLOAD_STUB } from '../baseClasses'
import {
    CONVERSATION_TYPE_ROOM_STATE_RENDER,
    type StorableConversationRecordRoomStateRender,
} from './baseClasses'
import { materializeRoomStateRender } from './materialize'

describe('materializeRoomStateRender', () => {
    describe('enrichRenderResolveForPassive (inlined in materialize)', () => {
        const componentId = 'ROOM#one' as RenderComponentId

        const baseRecord: StorableConversationRecordRoomStateRender = {
            conversationId: 'conv-rsr-materialize-1',
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: {
                componentId,
                perspectiveId: 'P#1',
                passiveBusDelivery: {
                    perspective: { assetStack: ['ASSET#base'] },
                },
            },
            payload: CONVERSATION_PAYLOAD_STUB,
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

        const makeBus = (): MessageBus => ({ publish: jest.fn() } as unknown as MessageBus)

        it('publishes RenderReady when resolved with cacheId and cacheRecord', async () => {
            const messageBus = makeBus()
            const handle = materializeRoomStateRender(baseRecord, { messageBus })
            await handle.sendMessage({
                type: 'resolved',
                renderedContent: baseCacheRecord.renderedContent,
                cacheId: 'CACHE#valid',
                cacheRecord: baseCacheRecord,
            })
            expect(messageBus.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'RenderReady',
                    cacheId: 'CACHE#valid',
                })
            )
        })

        it('publishes RenderInvalidate on invalidate', async () => {
            const messageBus = makeBus()
            const handle = materializeRoomStateRender(baseRecord, { messageBus })
            await handle.sendMessage({
                type: 'invalidate',
                reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
            })
            expect(messageBus.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'RenderInvalidate',
                    reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
                })
            )
        })

        it('publishes RenderError for META_ROOM_MARKS_MISSING', async () => {
            const messageBus = makeBus()
            const handle = materializeRoomStateRender(baseRecord, { messageBus })
            await handle.sendMessage({
                type: 'failed',
                errorCode: 'META_ROOM_MARKS_MISSING',
                errorMessage: 'RenderRequested requires Meta::Room.state.marks for ROOM#one',
            })
            expect(messageBus.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'RenderError',
                    errorCode: 'META_ROOM_MARKS_MISSING',
                    errorMessage: 'RenderRequested requires Meta::Room.state.marks for ROOM#one',
                    componentId: 'ROOM#one',
                })
            )
        })

        it('publishes RenderError for other failures', async () => {
            const messageBus = makeBus()
            const handle = materializeRoomStateRender(baseRecord, { messageBus })
            await handle.sendMessage({
                type: 'failed',
                errorCode: 'CONTEXT_REQUIRED',
                errorMessage: 'Generation context required',
            })
            expect(messageBus.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'RenderError',
                    errorCode: 'CONTEXT_REQUIRED',
                    errorMessage: 'Generation context required',
                    componentId: 'ROOM#one',
                })
            )
        })

        it('does not publish when resolved is missing cacheId and logs', async () => {
            const messageBus = makeBus()
            const err = jest.spyOn(console, 'error').mockImplementation(() => {})
            const handle = materializeRoomStateRender(baseRecord, { messageBus })
            await handle.sendMessage({
                type: 'resolved',
                renderedContent: baseCacheRecord.renderedContent,
            })
            expect(messageBus.publish).not.toHaveBeenCalled()
            expect(err).toHaveBeenCalled()
            err.mockRestore()
        })
    })
})
