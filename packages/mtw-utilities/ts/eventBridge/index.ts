import { EventBridgeClient, PutEventsCommand, PutEventsCommandOutput } from "@aws-sdk/client-eventbridge"
import AWSXRay from 'aws-xray-sdk'

const { EVENT_BUS_NAME, EVENT_BRIDGE_SOURCE_NAME, AWS_REGION } = process.env

let eventBridgeClientSingleton: EventBridgeClient | undefined = undefined

const ebClientFactory = () => {
    if (!eventBridgeClientSingleton) {
        eventBridgeClientSingleton = AWSXRay.captureAWSv3Client(new EventBridgeClient({ region: AWS_REGION }))
    }
    return eventBridgeClientSingleton
}

type EventBridgeClientUtilitySendArgument = {
    DetailType: string;
    Detail: Record<string, any>;
    Source?: string;
}

export const eventBridgeClient = {
    send: (events: EventBridgeClientUtilitySendArgument[]): Promise<PutEventsCommandOutput> => {
        const client = ebClientFactory()
        return client.send(new PutEventsCommand({
            Entries: events.map(({ DetailType, Detail, Source = EVENT_BRIDGE_SOURCE_NAME }) => ({
                EventBusName: EVENT_BUS_NAME,
                Source,
                DetailType,
                Detail: JSON.stringify(Detail)
            }))
        }))
    }
}

export default eventBridgeClient
