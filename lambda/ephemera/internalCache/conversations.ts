import { CacheBase } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { ConversationId, StorableConversationRecord } from '../conversations/conversationTypes'

/**
 * Invocation-scoped conversation rows. Cleared with InternalCache.clear().
 * Values are JSON-safe only (no functions); see conversations/AGENT.md.
 */
export class ConversationsData extends CacheBase {
    private readonly byId = new Map<ConversationId, StorableConversationRecord>()

    get(conversationId: ConversationId): StorableConversationRecord | undefined {
        return this.byId.get(conversationId)
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
