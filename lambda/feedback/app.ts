import { apiClient } from "./clients"
import { TargetResolver, isResolvableTarget } from '@tonylb/mtw-sessions/ts/targetResolver'
import internalCache from './internalCache'

const targetResolver = new TargetResolver(internalCache)

export const handler = async (event) => {

    await Promise.all(event.Records.map(async ({ Sns }) => {
        if (
            Sns.MessageAttributes.Targets?.Type !== 'String' ||
            !Array.isArray(JSON.parse(Sns.MessageAttributes.Targets.Value)) ||
            Sns.MessageAttributes.RequestId?.Type !== 'String' ||
            Sns.MessageAttributes.Type?.Type !== 'String'
        ) {
            throw new Error(`Incoming message format failure (${JSON.stringify(Sns.MessageAttributes, null, 4)})`)
        }
        const targets = JSON.parse(Sns.MessageAttributes.Targets.Value) as any[]
        const RequestId = Sns.MessageAttributes.RequestId.Value
        
        // Validate that all targets are valid ResolvableTargets
        if (!targets.every(isResolvableTarget)) {
            throw new Error(`Invalid targets format: ${JSON.stringify(targets)}`)
        }
        
        // Resolve targets to connection IDs using TargetResolver
        const resolvedTargets = await targetResolver.resolve(targets)
        const connectionIds = resolvedTargets.map(target => target.replace('CONNECTION#', ''))
        
        switch(Sns.MessageAttributes.Type.Value) {
            case 'Success':
                const Data = JSON.stringify({
                    ...JSON.parse(Sns.Message),
                    RequestId
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
                        RequestId
                    })
                }))))
                break
        }
    }))
}
