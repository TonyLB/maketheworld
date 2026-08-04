/**
 * mtw.ephemera.players DataSource: confirms/repairs a guest character's Meta::Character row
 * (and, when Coyote Game is enabled, its improvisation situation facet) on every Player Connected.
 */
import type { PlayerConnectedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/players'
import { isPlayerConnectedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/players'

import EphemeraDataSource from '../abstract'
import messageBus from '../../messageBus'
import { confirmGuestCharacter } from '../../guestCharacter'
import { isPlayersPlayerConnectedEnvelope } from './subscribedEvents'

/** Placeholder publish payload; this DataSource is subscribe-only. */
type PlayersPublishedPayload = { type: 'Players noop' }

export const ephemeraPlayersDataSource = new EphemeraDataSource<
    never,
    PlayersPublishedPayload,
    PlayerConnectedEvent
>({
    dataSourceKey: 'mtw.ephemera.players',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isPlayersPlayerConnectedEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(
            events.map(async (event) => {
                const raw = await event.getContent()
                if (isPlayerConnectedEvent(raw)) {
                    await confirmGuestCharacter(raw.player, messageBus)
                }
            })
        )
    },
})

ephemeraPlayersDataSource.subscribe()

export default ephemeraPlayersDataSource
