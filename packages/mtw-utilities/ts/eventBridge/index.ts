import { EventBridgeClient, PutEventsCommand, PutEventsCommandOutput } from "@aws-sdk/client-eventbridge"

const { EVENT_BUS_NAME, EVENT_BRIDGE_SOURCE_NAME, AWS_REGION } = process.env

let eventBridgeClientSingleton: EventBridgeClient | undefined = undefined

const ebClientFactory = () => {
    if (!eventBridgeClientSingleton) {
        eventBridgeClientSingleton = new EventBridgeClient({ region: AWS_REGION })
    }
    return eventBridgeClientSingleton
}

type EventBridgeClientUtilitySendArgument = {
    DetailType: string;
    Detail: Record<string, any>;
}

export const eventBridgeClient = {
    send: (events: EventBridgeClientUtilitySendArgument[]): Promise<PutEventsCommandOutput> => {
        const client = ebClientFactory()
        return client.send(new PutEventsCommand({
            Entries: events.map(({ DetailType, Detail }) => ({
                EventBusName: EVENT_BUS_NAME,
                Source: EVENT_BRIDGE_SOURCE_NAME,
                DetailType,
                Detail: JSON.stringify(Detail)
            }))
        }))
    }
}

export default eventBridgeClient
