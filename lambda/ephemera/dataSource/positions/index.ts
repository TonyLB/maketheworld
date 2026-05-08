/**
 * `mtw.ephemera.positions` DataSource
 *
 * General-purpose ephemera lane for **positions in play** -- the home for any
 * "where is X right now" projection ephemera owns. This iteration is
 * deliberately narrow: only **character positions as already recorded today**
 * (`Meta::Room.activeCharacters`, character `RoomId`/`RoomStack`).
 *
 * First external ingress: `mtw.connections.characters` (`Character Connected`,
 * `Character Disconnected`). Additional position-affecting subscriptions can
 * be added here without inventing another one-off DataSource module.
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
import {
    isEphemeraPositionsConnectionsCharactersEnvelope,
    isEphemeraPositionsSubscribedEnvelope,
    type EphemeraPositionsSubscribedContent
} from './subscribedEvents'
import {
    handleCharacterConnected,
    handleCharacterDisconnected
} from './handleConnectionsCharactersPresence'

export const ephemeraPositionsDataSource = new EphemeraDataSource<
    never,
    never,
    EphemeraPositionsSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.positions',
    replayable: false,
    subscribedEventTypeGuard: isEphemeraPositionsSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(events.map(async (envelope) => {
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
                await handleCharacterDisconnected(content as ConnectionsCharactersDisconnectedEvent, { messageBus })
                return
            }
        }))
    }
})

ephemeraPositionsDataSource.subscribe()

export default ephemeraPositionsDataSource
