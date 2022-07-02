import { v4 as uuidv4 } from 'uuid'
import { PublishMessage } from "../messageBus/baseClasses"
import MessageBus from "../messageBus"
import { publishMessage as publishMessageDynamoDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

export const publishMessage = async ({ payloads }: { payloads: PublishMessage[], messageBus?: MessageBus }): Promise<void> => {
    const CreatedTime = Date.now()
    await Promise.all(payloads.map(async (payload) => {
        if (!payload.global) {
            //
            // TODO: Fold the entirety of the messaging functionality in here, rather than have it hang off of
            // DynamoDB events (with all the associated latency and possible runaway error loops)
            //
            await publishMessageDynamoDB({
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime,
                Targets: payload.targets,
                Message: payload.message,
                DisplayProtocol: payload.displayProtocol
            })
        }
    }))
}

export default publishMessage
