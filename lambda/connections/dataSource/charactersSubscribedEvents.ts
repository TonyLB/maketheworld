import { HeaderGuard, StreamingEventHeader, makeStreamingEnvelopeGuardFromHeaderGuard } from "@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses"
import type {
    ConnectionsCharacterRegisteredEvent,
    ConnectionsSessionDisconnectEvent
} from "@tonylb/mtw-interfaces/ts/eventBridge/connections"

export type ConnectionsCharactersSubscribedHeader =
    StreamingEventHeader & { dataSourceKey: "mtw.connections"; type: "Character Registered" | "Session Disconnect" }

export type ConnectionsCharactersIncomingEvent =
    | ConnectionsCharacterRegisteredEvent
    | ConnectionsSessionDisconnectEvent

const isConnectionsCharactersSubscribedHeader: HeaderGuard<ConnectionsCharactersSubscribedHeader> = (
    header
): header is ConnectionsCharactersSubscribedHeader =>
    header.dataSourceKey === "mtw.connections" && (
        header.type === "Character Registered" ||
        header.type === "Session Disconnect"
    )

export const isConnectionsCharactersSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsCharactersIncomingEvent,
    ConnectionsCharactersSubscribedHeader
>(isConnectionsCharactersSubscribedHeader)

