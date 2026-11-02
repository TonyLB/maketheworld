/**
 * Test fixture for the actor's cache (ISS8314): the Kitchen world, defined once in `sceneFixtures/kitchen.ts` (where its
 * shape is described) and shared with the scene fixtures, as loaded graphs.
 */
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { EphemeraLudicGraph } from '../ludicGraph'
import { kitchenCrossingGraphs, kitchenGraphs } from './sceneFixtures/kitchen'

export {
    actorId,
    actorInRoom,
    bagHeld,
    bagId,
    coinId,
    coinInBag,
    lampId,
    lampOnTable,
    leashHeld,
    leashId,
    leashPort,
    otherId,
    otherInRoom,
    ropeAtTable,
    ropeHeld,
    ropeId,
    roomId,
    tableId,
    tableInRoom,
    tetherPort,
} from './sceneFixtures/kitchen'

const loaded = (payloads: [EphemeraMembershipHostId, EphemeraLudicGraphFieldPayload][]): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => (
    new Map(payloads.map(([hostId, payload]) => [hostId, EphemeraLudicGraph.fromFieldPayload(hostId, payload)]))
)

/** The room row's world: what a room-seeded walk reads. The actor's graph is deliberately absent from the room's nodes. */
export const actorCacheGraphs = (): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => loaded(kitchenGraphs())

/** `actorCacheGraphs` with two character-to-room crossings (the actor's composes; the other character's stays an open leg). */
export const actorCrossingGraphs = (): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => loaded(kitchenCrossingGraphs())

export const graphReader = (graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>) => async (hostId: EphemeraMembershipHostId): Promise<EphemeraLudicGraph> => {
    const graph = graphs.get(hostId)
    if (!graph) {
        throw new Error(`No fixture graph for ${hostId}`)
    }
    return graph
}
