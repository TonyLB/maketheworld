import { MessageBus } from '../messageBus/baseClasses'
import { apiClient } from '../apiClient'
import { batchMessages, normalizeConnectionId } from './batchMessages'

export type DeferredWireRow = Record<string, unknown> & {
    CreatedTime: number;
}

class PublishMessageCoalescer {
    private messagesByConnectionId: Record<string, DeferredWireRow[]> = {}

    enqueue(connectionId: string, row: DeferredWireRow): void {
        if (!(connectionId in this.messagesByConnectionId)) {
            this.messagesByConnectionId[connectionId] = []
        }
        this.messagesByConnectionId[connectionId].push(row)
    }

    reset(): void {
        this.messagesByConnectionId = {}
    }

    async flushDeferred(): Promise<void> {
        await Promise.all(
            Object.entries(this.messagesByConnectionId)
                .map(async ([connectionId, messageList]) => {
                    const sortedMessages = messageList
                        .sort(({ CreatedTime: a }, { CreatedTime: b }) => (a - b))
                    if (!sortedMessages.length) {
                        return
                    }
                    await Promise.all(
                        batchMessages(sortedMessages).map((messageBatch) => (
                            apiClient.send(
                                normalizeConnectionId(connectionId),
                                {
                                    messageType: 'Messages',
                                    messages: messageBatch
                                }
                            )
                        ))
                    )
                })
        )
        this.reset()
    }

    registerDeferral(messageBus: MessageBus): void {
        messageBus.registerDeferral('publishMessage', {
            onClear: () => this.reset(),
            afterSettled: () => this.flushDeferred(),
        })
    }
}

export const publishMessageCoalescer = new PublishMessageCoalescer()
