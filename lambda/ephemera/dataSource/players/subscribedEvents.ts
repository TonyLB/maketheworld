/**
 * Ingress for mtw.ephemera.players: Player Connected envelopes crossing EventBridge from
 * lambda/authentication (connect.ts), serialized via PlayersEventSerializer.
 */
import type { PlayerConnectedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/players'
import {
    makeStreamingEnvelopeGuardFromHeaderGuard,
    type HeaderGuard,
    type StreamingEventHeader,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

type PlayersPlayerConnectedHeader = StreamingEventHeader & {
    dataSourceKey: 'mtw.players'
    type: 'Player Connected'
}

const isPlayersPlayerConnectedHeader: HeaderGuard<PlayersPlayerConnectedHeader> = (
    header
): header is PlayersPlayerConnectedHeader =>
    header.dataSourceKey === 'mtw.players' && header.type === 'Player Connected'

export const isPlayersPlayerConnectedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    PlayerConnectedEvent,
    PlayersPlayerConnectedHeader
>(isPlayersPlayerConnectedHeader)
