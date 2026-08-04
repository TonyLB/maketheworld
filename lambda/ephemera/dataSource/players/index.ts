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
        //
        // The bus-level structure guard is payload-agnostic, so this fires for every streaming
        // event and `events` is empty whenever the envelope guard filtered them all out. Return
        // before logging: an `eventCount: 0` line on every unrelated bus event is pure noise.
        //
        if (events.length === 0) {
            return
        }
        console.log('[mtw.ephemera.players] receiveEvents', { eventCount: events.length })
        await Promise.all(
            events.map(async (event) => {
                const raw = await event.getContent()
                if (isPlayerConnectedEvent(raw)) {
                    await confirmGuestCharacter(raw.player, messageBus)
                }
                else {
                    console.error('[mtw.ephemera.players] payload failed isPlayerConnectedEvent', { raw })
                }
            })
        )
    },
})

ephemeraPlayersDataSource.subscribe()

export default ephemeraPlayersDataSource
