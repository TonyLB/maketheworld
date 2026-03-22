import { CacheBase } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { ConversationId, ConversationRecord } from '../conversations/baseClasses'

/**
 * Invocation-scoped conversation rows. Cleared with InternalCache.clear().
 */
export class ConversationsData extends CacheBase {
    private readonly byId = new Map<ConversationId, ConversationRecord>()

    get(conversationId: ConversationId): ConversationRecord | undefined {
        return this.byId.get(conversationId)
    }

    set(record: ConversationRecord): void {
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
