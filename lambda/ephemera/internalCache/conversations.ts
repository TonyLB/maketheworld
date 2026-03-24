import { CacheBase } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import {
    createConversationCompositeReadHandleStub,
    type ConversationId,
    type ConversationsCompositeGetResult,
    type StorableConversationRecord,
} from '../conversations/conversationTypes'

/**
 * Invocation-scoped conversation rows. Cleared with InternalCache.clear().
 *
 * **Storage (`set`):** map values are JSON-safe `StorableConversationRecord` only (no functions).
 * **Read (`get`):** runtime composite `{ record, handle }` where `record` is the stored row and
 * `handle` is a task-1 no-op stub (not a live `ConversationHandle`). See conversations/AGENT.md.
 */
export class ConversationsData extends CacheBase {
    private readonly byId = new Map<ConversationId, StorableConversationRecord>()

    get(conversationId: ConversationId): ConversationsCompositeGetResult | undefined {
        const record = this.byId.get(conversationId)
        if (record === undefined) {
            return undefined
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
