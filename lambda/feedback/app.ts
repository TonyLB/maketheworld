import { apiClient } from "./clients"
import { TargetResolver, isResolvableTarget } from '@tonylb/mtw-sessions/ts/targetResolver'
import internalCache from './internalCache'

const targetResolver = new TargetResolver(internalCache)

export const handler = async (event) => {

    await Promise.all(event.Records.map(async ({ Sns }) => {
        // Validate required MessageAttributes
        if (
            Sns.MessageAttributes.Targets?.Type !== 'String' ||
            !Array.isArray(JSON.parse(Sns.MessageAttributes.Targets.Value)) ||
            Sns.MessageAttributes.Type?.Type !== 'String'
        ) {
            throw new Error(`Incoming message format failure (${JSON.stringify(Sns.MessageAttributes, null, 4)})`)
        }
        
        // RequestId is optional for StreamEvent messages (subscription data, not request/response)
        const messageType = Sns.MessageAttributes.Type.Value
        if (messageType !== 'StreamEvent' && Sns.MessageAttributes.RequestId?.Type !== 'String') {
            throw new Error(`RequestId required for message type '${messageType}' (${JSON.stringify(Sns.MessageAttributes, null, 4)})`)
        }
        
        const targets = JSON.parse(Sns.MessageAttributes.Targets.Value) as any[]
        const RequestId = Sns.MessageAttributes.RequestId?.Value
        
        // Validate that all targets are valid ResolvableTargets
        if (!targets.every(isResolvableTarget)) {
            throw new Error(`Invalid targets format: ${JSON.stringify(targets)}`)
        }
        
        // Resolve targets to connection IDs using TargetResolver
        const resolvedTargets = await targetResolver.resolve(targets)
        const connectionIds = resolvedTargets
            .map(target => target.replace('CONNECTION#', ''))
            .filter(connectionId => connectionId.length > 0)
        
        switch(messageType) {
            case 'Success':
                const Data = JSON.stringify({
                    ...JSON.parse(Sns.Message),
                    RequestId  // Always present for Success messages
                })
                await Promise.all(connectionIds.map((ConnectionId) => (apiClient.send({
                    ConnectionId,
                    Data
                }))))
                break
            case 'Error':
                if (Sns.MessageAttributes.Error?.Type !== 'String') {
                    throw new Error(`Incoming message format failure (${JSON.stringify(Sns.MessageAttributes, null, 4)})`)
                }
                await Promise.all(connectionIds.map((ConnectionId) => (apiClient.send({
                    ConnectionId,
                    Data: JSON.stringify({
                        messageType: 'Error',
                        error: Sns.MessageAttributes.Error?.Value || '',
                        RequestId  // Always present for Error messages
                    })
                }))))
                break
            case 'StreamEvent':
                // DataSource subscription messages - already in correct format
                // Message structure: { messageType: 'StreamEvent', dataSourceKey, streamKey, timestamp, update }
                const StreamEventData = JSON.stringify(JSON.parse(Sns.Message))
                await Promise.all(connectionIds.map((ConnectionId) => (apiClient.send({
                    ConnectionId,
                    Data: StreamEventData
                }))))
                break
        }
    }))
}
