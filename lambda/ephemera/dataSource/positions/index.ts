/**
 * `mtw.ephemera.positions` DataSource
 *
 * General-purpose ephemera lane for **positions in play** -- the home for any
 * "where is X right now" projection ephemera owns. This iteration is
 * deliberately narrow: only **character positions as already recorded today**
 * (`Meta::Room.activeCharacters`, character `RoomId`/`RoomStack`).
 *
 * External ingress: `mtw.connections.characters` (presence), `mtw.ephemera.actions`
 * (`Character Navigate`). Additional position-affecting subscriptions can be
 * added here without inventing another one-off DataSource module.
 *
 * Future iterations may extend the lane with new entity kinds and richer
 * position semantics; the wiring above (`dataSourceKey: 'mtw.ephemera.positions'`,
 * folder layout, guard registry in `subscribedEvents.ts`) is intentionally
 * named generally so that growth is additive.
 */
import EphemeraDataSource from '../abstract'
import messageBus from '../../messageBus'
import {
    ConnectionsCharactersConnectedEvent,
    ConnectionsCharactersDisconnectedEvent,
    ConnectionsCharactersEventUpdate
} from '@tonylb/mtw-interfaces/ts/eventBridge/connections/characters'
import type { CharacterNavigatePublishedPayload } from '../actions/publishedEvents'
import {
    isEphemeraPositionsActionsCharacterNavigateEnvelope,
    isEphemeraPositionsConnectionsCharactersEnvelope,
    isEphemeraPositionsSubscribedEnvelope,
    type EphemeraPositionsSubscribedContent
} from './subscribedEvents'
import {
    handleCharacterConnected,
    handleCharacterDisconnected
} from './handleConnectionsCharactersPresence'
import { executeCharacterNavigate } from '../../moveCharacter/executeCharacterNavigate'
import type { PositionsPublishedPayload } from './publishedEvents'

export const ephemeraPositionsDataSource = new EphemeraDataSource<
    never,
    PositionsPublishedPayload,
    EphemeraPositionsSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.positions',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isEphemeraPositionsSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (envelope) => {
            if (isEphemeraPositionsActionsCharacterNavigateEnvelope(envelope)) {
                const content = await envelope.getContent() as CharacterNavigatePublishedPayload
                if (!content || typeof content !== 'object') {
                    return
                }
                await executeCharacterNavigate({
                    characterId: content.characterId,
                    targetRoomId: content.toRoomId,
                    messageBus,
                    streamEvent,
                })
                return
            }
            if (!isEphemeraPositionsConnectionsCharactersEnvelope(envelope)) {
                return
            }
            const content = await envelope.getContent() as ConnectionsCharactersEventUpdate
            if (!content || typeof content !== 'object') {
                return
            }
            if (envelope.header.type === 'Character Connected') {
                await handleCharacterConnected(content as ConnectionsCharactersConnectedEvent, { messageBus })
                return
            }
            if (envelope.header.type === 'Character Disconnected') {
                await handleCharacterDisconnected(content as ConnectionsCharactersDisconnectedEvent, {
                    messageBus,
                    streamEvent,
                })
                return
            }
        }))
    }
})

ephemeraPositionsDataSource.subscribe()

export default ephemeraPositionsDataSource
