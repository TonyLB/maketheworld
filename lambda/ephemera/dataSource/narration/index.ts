/**
 * mtw.ephemera.narration DataSource: terminal character-voice depiction from actions Character Spoke.
 */
import EphemeraDataSource from '../abstract'
import messageBus from '../../messageBus'
import { isCharacterSpokePublishedPayload } from '../actions/publishedEvents'
import { handleCharacterSpoke } from './handleCharacterSpoke'
import type { NarrationPublishedPayload } from './publishedEvents'
import {
    isNarrationSubscribedEnvelope,
    type NarrationSubscribedContent,
} from './subscribedEvents'

export const ephemeraNarrationDataSource = new EphemeraDataSource<
    never,
    NarrationPublishedPayload,
    NarrationSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.narration',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isNarrationSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(events.map(async (event) => {
            const content = await event.getContent()
            if (!isCharacterSpokePublishedPayload(content)) {
                return
            }
            await handleCharacterSpoke(messageBus, content)
        }))
    },
})

ephemeraNarrationDataSource.subscribe()

export default ephemeraNarrationDataSource
