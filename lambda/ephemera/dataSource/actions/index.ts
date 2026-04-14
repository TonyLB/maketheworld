/**
 * mtw.ephemera.actions DataSource.
 *
 * Inert bus-only stub for local coordination scaffolding. Ingress wiring follows.
 */
import EphemeraDataSource from '../abstract'
import type { ActionsStubPublishedPayload } from './publishedEvents'
import type { ActionsSubscribedContent } from './subscribedEvents'
import { isActionsSubscribedEnvelope } from './subscribedEvents'
import messageBus from '../../messageBus'

export const ephemeraActionsDataSource = new EphemeraDataSource<
    never,
    ActionsStubPublishedPayload,
    ActionsSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.actions',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isActionsSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(events.map(async (event) => {
            const content = await event.getContent()
            if (content.requestId) {
                messageBus.send({
                    type: 'ReturnValue',
                    body: {
                        messageType: 'Success',
                        RequestId: content.requestId,
                        message: 'Parse request accepted',
                    },
                })
            }
        }))
    },
})

ephemeraActionsDataSource.subscribe()

export default ephemeraActionsDataSource
