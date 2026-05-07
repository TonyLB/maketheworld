import { DataSource } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { CognitoEventSerializer, CognitoEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/cognito'
import messageBus from '../messageBus'
import { isApiCognitoEnvelope, type CognitoApiPayload } from './apiCognito'
import { isCognitoSubscribedEnvelope, CognitoSubscribedContent } from './subscribedEvents'

type StreamEventFn = (params: { update: CognitoEventUpdate; streamKey: string; header: { type: string } }) => Promise<void>

export const processCognitoSubscribedEvents = async (
    events: any[],
    streamEvent: StreamEventFn
) => {
    await Promise.all(events.map(async (event) => {
        if (!isApiCognitoEnvelope(event as any)) {
            return
        }
        const content = await event.getContent() as CognitoApiPayload
        if (!content?.player || typeof content.player !== 'string') {
            return
        }
        await streamEvent({
            update: { type: 'New Player', player: content.player },
            streamKey: content.player,
            header: { type: 'New Player' }
        })
    }))
}

export const cognitoDataSource = new DataSource<
    never,
    CognitoEventUpdate,
    CognitoSubscribedContent,
    any,
    'ConnectionId'
>({
    dynamo: connectionDB as any,
    sns: {
        send: async () => undefined
    },
    messageBus: messageBus,
    primaryKeyName: 'ConnectionId',
    dataSourceKey: 'mtw.cognito',
    feedbackTopicArn: process.env.FEEDBACK_TOPIC ?? '',
    replayable: false,
    eventSerializer: new CognitoEventSerializer(createNodeDataSourceEnvironment()),
    subscribedEventTypeGuard: isCognitoSubscribedEnvelope as any,
    receiveEvents: async ({ events, streamEvent }) => {
        await processCognitoSubscribedEvents(events, streamEvent as StreamEventFn)
    }
})

cognitoDataSource.subscribe()
