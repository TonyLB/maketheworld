/**
 * mtw.ephemera.objects DataSource (v1).
 *
 * Bus-only, non-replayable. Subscribes to api.ephemera **Objects Change**; persists room object lists on `Meta::Room`.
 */
import EphemeraDataSource from '../abstract'
import { isObjectsSubscribedEnvelope } from './subscribedEvents'
import { isObjectsChangeCommand } from '../localApiEvents'
import {
    handleAcmeOrderAddObjects,
    handleApiObjectsChangeCommand,
    handleAwaitRoadRunnerClearObjects,
} from './handleApiObjectsChange'
import type { ObjectsChangedPayload } from './events'
import type { ObjectsSubscribedContent } from './subscribedEvents'
import { isAcmeOrderPublishedPayload, isAwaitRoadRunnerPublishedPayload } from '../actions/publishedEvents'

export const ephemeraObjectsDataSource = new EphemeraDataSource<never, ObjectsChangedPayload, ObjectsSubscribedContent>({
    dataSourceKey: 'mtw.ephemera.objects',
    replayable: false,
    publisherStrategy: 'busOnly',
    outboundBusDelivery: 'publish',
    subscribedEventTypeGuard: isObjectsSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (event) => {
            const cmd = await event.getContent()
            if (isObjectsChangeCommand(cmd)) {
                await handleApiObjectsChangeCommand(cmd, { streamEvent })
                return
            }
            if (isAwaitRoadRunnerPublishedPayload(cmd)) {
                await handleAwaitRoadRunnerClearObjects({ streamEvent })
                return
            }
            if (isAcmeOrderPublishedPayload(cmd)) {
                await handleAcmeOrderAddObjects(cmd, { streamEvent })
            }
        }))
    },
})

ephemeraObjectsDataSource.subscribe()

export default ephemeraObjectsDataSource
