/**
 * mtw.ephemera.perception DataSource.
 *
 * Bus-only, non-replayable. Subscribes to api.ephemera Character perception ingress. See AGENT.md and
 * taskPlanning/lambda/ephemera/dataSource/perception/AGENT.perceptionRefactor.planning.md
 */
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import EphemeraDataSource from '../abstract'
import type { PerceptionStubPublishedPayload } from './publishedEvents'
import type { PerceptionSubscribedContent } from './subscribedEvents'
import { isPerceptionSubscribedEnvelope } from './subscribedEvents'
import { isCharacterPerceptionRequestedCommand, isPerceptionThreadRegisteredCommand } from './localApiEvents'
import { handleCharacterPerceptionRequested } from './characterPerception'
import { orchestrateRoomDescriptionStreams } from './orchestrate'
import messageBus from '../../messageBus'
import internalCache from '../../internalCache'

export const ephemeraPerceptionDataSource = new EphemeraDataSource<
    never,
    PerceptionStubPublishedPayload,
    PerceptionSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.perception',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isPerceptionSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(events.map(async (event) => {
            const raw = await event.getContent()
            if (isCharacterPerceptionRequestedCommand(raw)) {
                await handleCharacterPerceptionRequested(raw, messageBus)
                return
            }
            if (isPerceptionThreadRegisteredCommand(raw)) {
                if (isEphemeraRoomId(raw.componentId)) {
                    internalCache.PerceptionThreads.register(raw, {
                        kind: 'roomDescription',
                        status: 'Initial',
                    })
                }
                else {
                    internalCache.PerceptionThreads.register(raw, { kind: 'stub' })
                }
                return
            }
            await orchestrateRoomDescriptionStreams(raw, messageBus)
        }))
    },
})

ephemeraPerceptionDataSource.subscribe()

export default ephemeraPerceptionDataSource
