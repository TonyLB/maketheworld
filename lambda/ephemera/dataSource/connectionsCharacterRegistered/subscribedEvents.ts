/**
 * Shared subscription surface for `mtw.connections` / `Character Registered`.
 *
 * This folder is not a DataSource (no `index.ts` or message-bus subscriber). Guards
 * here are imported by multiple orchestration DataSources that share the same external
 * ingress:
 *   - `mtw.ephemera.renderOrchestration` (see ../renderOrchestration/subscribedEvents.ts)
 *   - `mtw.ephemera.affordanceOrchestration` (see ../affordanceOrchestration/subscribedEvents.ts)
 *
 * Contrast `../positions/subscribedEvents.ts`, which owns `mtw.connections.characters`
 * presence for `mtw.ephemera.positions` only. Session orientation kick logic lives in
 * `handleCharacterRegisteredOrientation.ts`; orchestration DataSources call it per channel.
 */
import {
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ConnectionsCharacterRegisteredEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'

export type ConnectionsCharacterRegisteredHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.connections'; type: 'Character Registered' }

export type ConnectionsCharacterRegisteredSubscribedContent = ConnectionsCharacterRegisteredEvent

export type ConnectionsCharacterRegisteredEnvelope = {
    header: ConnectionsCharacterRegisteredHeader
    getContent: () => Promise<ConnectionsCharacterRegisteredEvent>
}

const isConnectionsCharacterRegisteredHeader: HeaderGuard<ConnectionsCharacterRegisteredHeader> = (
    header
): header is ConnectionsCharacterRegisteredHeader => (
    header.dataSourceKey === 'mtw.connections' && header.type === 'Character Registered'
)

export const isConnectionsCharacterRegisteredEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsCharacterRegisteredSubscribedContent,
    ConnectionsCharacterRegisteredHeader
>(isConnectionsCharacterRegisteredHeader)
