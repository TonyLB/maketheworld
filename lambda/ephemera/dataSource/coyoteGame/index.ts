/**
 * mtw.ephemera.coyoteGame DataSource.
 *
 * Bus-only. Subscribes to mtw.ephemera.objects Objects Changed for Coyote demo rooms; hypothesis stub path.
 */
import EphemeraDataSource from '../abstract'
import type { CoyoteGamePublishedPayload } from './publishedEvents'
import type { CoyoteGameSubscribedContent } from './subscribedEvents'
import { isCoyoteGameSubscribedEnvelope } from './subscribedEvents'
import { handleObjectsChangedForHypothesis } from './handleObjectsChangedForHypothesis'
import messageBus from '../../messageBus'

export const ephemeraCoyoteGameDataSource = new EphemeraDataSource<
    never,
    CoyoteGamePublishedPayload,
    CoyoteGameSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.coyoteGame',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isCoyoteGameSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (event) => {
            const raw = await event.getContent()
            await handleObjectsChangedForHypothesis(raw, { streamEvent, messageBus })
        }))
    },
})

ephemeraCoyoteGameDataSource.subscribe()

export default ephemeraCoyoteGameDataSource
