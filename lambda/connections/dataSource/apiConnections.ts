import { HeaderGuard, StreamingEventHeader, makeStreamingEnvelopeGuardFromHeaderGuard } from "@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses"
import { createInternalOriginEnvelope } from "@tonylb/mtw-lambda-patterns/ts/dataSource"
import type { StreamingEventMessage } from "../messageBus/baseClasses"

export type ConnectionsAPIPayload =
    | { type: '$disconnect'; connectionId: string }
    | { type: 'validateInvitation'; invitationCode: string }
    | { type: 'signIn'; userName: string; password: string }
    | { type: 'signUp'; userName: string; inviteCode: string; password: string }
    | { type: 'accessToken'; RefreshToken: string }
    | { type: 'dropConnection'; sessionId: string; connectionId: string }
    | { type: 'checkSession'; sessionId: string }
    | { type: 'generateInvitation' }

export type ConnectionsApiSubscribedHeader = StreamingEventHeader & {
    dataSourceKey: 'api.connections';
    type: ConnectionsAPIPayload['type'];
}

const isApiConnectionsHeader: HeaderGuard<ConnectionsApiSubscribedHeader> = (
    header
): header is ConnectionsApiSubscribedHeader => (
    header.dataSourceKey === 'api.connections' &&
    ['$disconnect', 'validateInvitation', 'signIn', 'signUp', 'accessToken', 'dropConnection', 'checkSession', 'generateInvitation'].includes(header.type)
)

export const isApiConnectionsEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsAPIPayload,
    ConnectionsApiSubscribedHeader
>(isApiConnectionsHeader)

type Bus = { send: (payload: StreamingEventMessage, laneId?: string) => void }

const apiConnectionsSerializer = {
    serialize: ({ content }: { content: ConnectionsAPIPayload; header: { type: string } }) => ({ ...content })
}

export const sendApiConnectionsEvent = (
    bus: Bus,
    content: ConnectionsAPIPayload,
    laneId?: string
) => {
    const timestamp = Date.now()
    const envelope = createInternalOriginEnvelope(
        {
            dataSourceKey: 'api.connections',
            streamKey: 'ingress',
            timestamp,
            type: content.type
        },
        content,
        apiConnectionsSerializer
    )
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'api.connections',
        streamKey: 'ingress',
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp
    }, laneId)
}
