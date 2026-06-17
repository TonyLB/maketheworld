/**
 * mtw.ephemera.affordanceOrchestration DataSource.
 *
 * Canonical home for affordance-channel orchestration (Area topology exits, M4).
 * See ./AGENT.md for semantics and constraints.
 *
 * Ingress: api.ephemera Affordances Requested; mtw.ephemera.positions Object Moved (fan-out);
 * mtw.assets.componentTopology TopologyInvalidated (fan-out, reason: topology).
 * Outbounds: five-type stream on this DataSource via streamEvent (v1-active: Slice Ready, Orchestration Error).
 * replayable: false.
 */
import EphemeraDataSource from '../abstract'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isRoomScopedTopologyInvalidated } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/componentTopology'
import { isTopologyInvalidatedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/componentTopology'
import { isConnectionsCharacterRegisteredEnvelope } from '../connectionsCharacterRegistered/subscribedEvents'
import { handleCharacterRegisteredOrientation } from '../connectionsCharacterRegistered/handleCharacterRegisteredOrientation'
import {
    isAffordanceOrchestrationIngressEnvelope,
    isAffordanceOrchestrationSubscribedEnvelope,
    isAffordancesRequestedIngressEnvelope,
    isEphemeraPositionsObjectMovedIngressEnvelope,
    type AffordanceOrchestrationIngressEvent,
    type AffordanceOrchestrationSubscribedContent,
} from './subscribedEvents'
import { isComponentTopologyInvalidatedEnvelope } from '../affordanceCache/subscribedEvents'
import { handleTopologyInvalidated } from '../affordanceCache/handleTopologyInvalidated'
import { isAffordancesRequestedCommand } from './localApiEvents'
import { orchestrateAffordanceRequest } from './orchestrationHandler'
import { fanOutAffordanceRefreshForRoom } from './fanOutAffordanceRefreshForRoom'
import { roomsAffectedByObjectMoved } from './roomsAffectedByObjectMoved'
import { isObjectMovedPublishedPayload } from '../positions/publishedEvents'
import type { AffordanceOrchestrationPublishedPayload } from './publishedEvents'
import messageBus from '../../messageBus'

const toLegacyPayload = async (event: AffordanceOrchestrationIngressEvent) => {
    const content = await event.getContent()
    if (!isAffordancesRequestedIngressEnvelope(event)) {
        return undefined
    }
    if (!isAffordancesRequestedCommand(content)) {
        return undefined
    }
    return {
        type: 'AffordancesRequested' as const,
        ...content,
    }
}

export const affordanceOrchestrationDataSource = new EphemeraDataSource<
    never,
    AffordanceOrchestrationPublishedPayload,
    AffordanceOrchestrationSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.affordanceOrchestration',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isAffordanceOrchestrationSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (event) => {
            if (isComponentTopologyInvalidatedEnvelope(event)) {
                const invalidated = await event.getContent()
                if (!isTopologyInvalidatedEvent(invalidated)) {
                    return
                }
                if (!isRoomScopedTopologyInvalidated(invalidated)) {
                    return
                }
                await handleTopologyInvalidated(invalidated)
                for (const roomIdRaw of invalidated.roomIds) {
                    if (!isEphemeraRoomId(roomIdRaw)) {
                        continue
                    }
                    await fanOutAffordanceRefreshForRoom({
                        roomId: roomIdRaw,
                        reason: 'topology',
                        streamEvent,
                    })
                }
                return
            }
            if (isEphemeraPositionsObjectMovedIngressEnvelope(event)) {
                const raw = await event.getContent()
                if (!isObjectMovedPublishedPayload(raw)) {
                    return
                }
                const affectedRooms = roomsAffectedByObjectMoved(raw)
                for (const roomId of affectedRooms) {
                    await fanOutAffordanceRefreshForRoom({
                        roomId,
                        reason: 'objects',
                        streamEvent,
                    })
                }
                return
            }
            if (isConnectionsCharacterRegisteredEnvelope(event)) {
                const payload = await event.getContent()
                await handleCharacterRegisteredOrientation(messageBus, payload, 'affordances', undefined, streamEvent)
                return
            }
            if (!isAffordanceOrchestrationIngressEnvelope(event)) {
                return
            }
            const payload = await toLegacyPayload(event as AffordanceOrchestrationIngressEvent)
            if (!payload) {
                return
            }
            await orchestrateAffordanceRequest({
                payload,
                streamEvent,
            })
        }))
    },
})

affordanceOrchestrationDataSource.subscribe()

export default affordanceOrchestrationDataSource
