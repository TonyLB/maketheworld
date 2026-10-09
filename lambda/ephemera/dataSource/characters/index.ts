/**
 * mtw.ephemera.characters DataSource: character play state. First tenant: the eviction
 * ladder (`Meta::Character.RoomStack`), maintained on positions' Character Moved, which also announces the mover as in play.
 */
import EphemeraDataSource from '../abstract'
import { isCharacterMovedPublishedPayload } from '../positions/publishedEvents'
import { handleCharacterMoved } from './handleCharacterMoved'
import { publishCharacterInPlay } from './publishCharacterInPlay'
import type { CharactersPublishedPayload } from './publishedEvents'
import {
    isCharactersSubscribedEnvelope,
    type CharactersSubscribedContent,
} from './subscribedEvents'

export const ephemeraCharactersDataSource = new EphemeraDataSource<
    never,
    CharactersPublishedPayload,
    CharactersSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.characters',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isCharactersSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(events.map(async (event) => {
            const content = await event.getContent()
            if (!isCharacterMovedPublishedPayload(content)) {
                return
            }
            await Promise.all([handleCharacterMoved(content), publishCharacterInPlay(content)])
        }))
    },
})

ephemeraCharactersDataSource.subscribe()

export default ephemeraCharactersDataSource
