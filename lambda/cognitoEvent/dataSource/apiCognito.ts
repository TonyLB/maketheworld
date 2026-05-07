import { HeaderGuard, StreamingEventHeader, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventMessage } from '../messageBus/baseClasses'

export type CognitoApiPayload = {
    type: 'New Player'
    player: string
}

export type CognitoApiSubscribedHeader = StreamingEventHeader & {
    dataSourceKey: 'api.cognito';
    type: CognitoApiPayload['type'];
}

const isApiCognitoHeader: HeaderGuard<CognitoApiSubscribedHeader> = (
    header
): header is CognitoApiSubscribedHeader => (
    header.dataSourceKey === 'api.cognito' &&
    header.type === 'New Player'
)

export const isApiCognitoEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    CognitoApiPayload,
    CognitoApiSubscribedHeader
>(isApiCognitoHeader)

type Bus = { send: (payload: StreamingEventMessage, laneId?: string) => void }

const apiCognitoSerializer = {
    serialize: ({ content }: { content: CognitoApiPayload; header: { type: string } }) => ({ ...content })
}

export const sendApiCognitoEvent = (
    bus: Bus,
    content: CognitoApiPayload,
    laneId?: string
) => {
    const timestamp = Date.now()
    const envelope = createInternalOriginEnvelope(
        {
            dataSourceKey: 'api.cognito',
            streamKey: 'ingress',
            timestamp,
            type: content.type
        },
        content,
        apiCognitoSerializer
    )
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'api.cognito',
        streamKey: 'ingress',
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp
    }, laneId)
}
