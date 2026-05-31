/**
 * mtw.ephemera.affordanceCache: colocated Affordance:: topology rows;
 * subscribe TopologyInvalidated + affordanceOrchestration outbounds;
 * emit Affordances Pertain on slice ready.
 */
import EphemeraDataSource from '../abstract'
import { isTopologyInvalidatedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/componentTopology'
import {
    isAffordanceOrchestrationPublishedPayload,
    isAffordanceOrchestrationPublishedStreamEnvelope,
} from '../affordanceOrchestration/publishedEvents'
import { handleAffordanceOrchestrationInbound } from './handleAffordanceOrchestrationInbound'
import { handleTopologyInvalidated } from './handleTopologyInvalidated'
import type { AffordanceCacheUpdatePayload } from './publishedEvents'
import {
    isAffordanceCacheSubscribedEnvelope,
    isComponentTopologyInvalidatedEnvelope,
    type AffordanceCacheSubscribedContent,
} from './subscribedEvents'

export const ephemeraAffordanceCacheDataSource = new EphemeraDataSource<
    never,
    AffordanceCacheUpdatePayload,
    AffordanceCacheSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.affordanceCache',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isAffordanceCacheSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(
            events.map(async (evt) => {
                if (isAffordanceOrchestrationPublishedStreamEnvelope(evt)) {
                    const raw = await evt.getContent()
                    if (!isAffordanceOrchestrationPublishedPayload(raw)) {
                        console.error('[mtw.ephemera.affordanceCache] invalid orchestration stream payload', {
                            headerType: evt.header.type,
                            streamKey: evt.header.streamKey,
                        })
                        return
                    }
                    await handleAffordanceOrchestrationInbound({ content: raw, streamEvent })
                    return
                }

                if (isComponentTopologyInvalidatedEnvelope(evt)) {
                    const invalidated = await evt.getContent()
                    if (!isTopologyInvalidatedEvent(invalidated)) {
                        return
                    }
                    await handleTopologyInvalidated(invalidated)
                }
            })
        )
    },
})

ephemeraAffordanceCacheDataSource.subscribe()

export default ephemeraAffordanceCacheDataSource
