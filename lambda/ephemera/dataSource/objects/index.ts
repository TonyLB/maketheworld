/**
 * mtw.ephemera.objects DataSource (v1).
 *
 * Bus-only, non-replayable. Subscribes to api.ephemera **Objects Change**; persists improvisation + graph placement.
 */
import { isOrphanedImprovisedObjectFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

import EphemeraDataSource from '../abstract'
import { isDiagnosticsOrphanedImprovisedObjectFindingEnvelope, isObjectsSubscribedEnvelope } from './subscribedEvents'
import { isObjectsChangeCommand } from '../localApiEvents'
import {
    handleAcmeOrderAddObjects,
    handleApiObjectsChangeCommand,
    handleAwaitRoadRunnerClearObjects,
} from './handleApiObjectsChange'
import { handleOrphanedImprovisedObjectFinding } from './handleOrphanedImprovisedObjectFinding'
import type { ObjectsChangedPayload } from './events'
import type { ObjectsSubscribedContent } from './subscribedEvents'
import { isAcmeOrderPublishedPayload, isAwaitRoadRunnerPublishedPayload } from '../actions/publishedEvents'

export const ephemeraObjectsDataSource = new EphemeraDataSource<never, ObjectsChangedPayload, ObjectsSubscribedContent>({
    dataSourceKey: 'mtw.ephemera.objects',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isObjectsSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (event) => {
            if (isDiagnosticsOrphanedImprovisedObjectFindingEnvelope(event)) {
                const finding = await event.getContent()
                if (!isOrphanedImprovisedObjectFindingEvent(finding)) {
                    return
                }
                await handleOrphanedImprovisedObjectFinding(finding)
                return
            }

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
