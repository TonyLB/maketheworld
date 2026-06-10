//
// API Gateway Websockets deliver a maximum of 32KB per data frame (with a maximum of 128k across multiple frames,
// but I don't think that's needed for an application with a large number of individually small messages)
//
const MAX_BATCH_SIZE = 20000

export const batchMessages = (messages: any[] = []) => {
    const lengthOfMessage = (message: unknown) => (JSON.stringify(message).length)
    const { batchedMessages = [], currentBatch = [] } = messages.reduce((previous, message) => {
        const newLength = lengthOfMessage(message)
        const proposedLength = previous.currentLength + newLength
        if (proposedLength > MAX_BATCH_SIZE) {
            return {
                batchedMessages: [...previous.batchedMessages, previous.currentBatch],
                currentBatch: [message],
                currentLength: newLength
            }
        }
        else {
            return {
                batchedMessages: previous.batchedMessages,
                currentBatch: [...previous.currentBatch, message],
                currentLength: proposedLength
            }
        }
    }, { batchedMessages: [] as any[][], currentBatch: [] as any[], currentLength: 0 })
    return currentBatch.length ? [...batchedMessages, currentBatch] : batchedMessages
}

export const normalizeConnectionId = (connectionId: string): string => (
    connectionId.startsWith('CONNECTION#') ? connectionId.slice(11) : connectionId
)
