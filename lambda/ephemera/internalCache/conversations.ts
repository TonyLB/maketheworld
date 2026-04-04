import { CacheBase } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import {
    CONVERSATION_TYPE_ROOM_STATE_RENDER,
    createConversationCompositeReadHandleStub,
    type ConversationId,
    type ConversationsCompositeGetResult,
    type StorableConversationRecord,
} from '../conversations/conversationTypes'
import { materializeRoomStateRender } from '../conversations/conversationTypes/roomStateRender'
import type { MessageBus } from '../messageBus/baseClasses'
import CacheGlobalData from './global'

/**
 * Invocation-scoped conversation rows. Cleared with InternalCache.clear().
 *
 * **Storage (`set`):** map values are JSON-safe `StorableConversationRecord` only (no functions).
 * **Read (`get`):** runtime composite `{ record, handle }` where `record` is the stored row and
 * `handle` is discriminated by `kind`: live `sendMessage` for known pipeline types, or a stub for
 * unknown rows. See conversations/AGENT.md.
 */
export class ConversationsData extends CacheBase {
    private readonly byId = new Map<ConversationId, StorableConversationRecord>()

    constructor(
        private readonly globals: CacheGlobalData,
        private readonly messageBus: MessageBus
    ) {
        super()
    }

    get(
        conversationId: ConversationId,
        options?: { messageBus?: MessageBus }
    ): ConversationsCompositeGetResult | undefined {
        const record = this.byId.get(conversationId)
        if (record === undefined) {
            return undefined
        }
        const busForMaterialize = options?.messageBus ?? this.messageBus
        if (record.type === CONVERSATION_TYPE_ROOM_STATE_RENDER) {
            const live = materializeRoomStateRender(record, {
                messageBus: busForMaterialize,
            })
            return {
                record,
                handle: {
                    kind: 'conversationCompositeReadRoomStateRender',
                    sendMessage: live.sendMessage,
                },
            }
        }
        return {
            record,
            handle: createConversationCompositeReadHandleStub(),
        }
    }

    set(record: StorableConversationRecord): void {
        this.byId.set(record.conversationId, record)
    }

    delete(conversationId: ConversationId): boolean {
        return this.byId.delete(conversationId)
    }

    override clear(): void {
        this.byId.clear()
        super.clear()
    }
}

export default ConversationsData
