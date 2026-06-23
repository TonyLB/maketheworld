import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { extractObjectIdsFromPlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import internalCache from '../../../internalCache'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../publishedEvents'
import { applyObjectRoomMembership } from './applyObjectRoomMembership'
import { syncObjectMembershipAdjacencyToRoom } from './syncObjectMembershipAdjacency'

export type RepairObjectPlacementDriftArgs = {
    roomId: EphemeraRoomId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

export type RepairObjectPlacementDriftDependencies = {
    getPositionGraph?: (roomId: EphemeraRoomId) => ReturnType<typeof internalCache.Positions.getPositionGraph>;
    getMembershipContainers?: (objectId: EphemeraObjectId) => Promise<EphemeraRoomId[]>;
    applyMembership?: typeof applyObjectRoomMembership;
    syncAdjacency?: typeof syncObjectMembershipAdjacencyToRoom;
}

const listGraphObjectIds = async (
    roomId: EphemeraRoomId,
    getPositionGraph: RepairObjectPlacementDriftDependencies['getPositionGraph']
): Promise<EphemeraObjectId[]> => {
    const loader = getPositionGraph ?? ((id) => internalCache.Positions.getPositionGraph(id))
    const positionGraph = await loader(roomId)
    return extractObjectIdsFromPlayPositionGraph(positionGraph)
        .filter(isEphemeraObjectId)
}

const containersIncludeRoom = (containers: EphemeraRoomId[], roomId: EphemeraRoomId): boolean =>
    containers.includes(roomId)

/**
 * Graph-forward object placement drift repair for one room.
 * Adjacency-only when graph lists object but index lags; end-state apply when multi-room drift.
 */
export const repairObjectPlacementDrift = async (
    args: RepairObjectPlacementDriftArgs,
    deps?: RepairObjectPlacementDriftDependencies
): Promise<{ multiRoomScrubbed: number; adjacencySynced: number }> => {
    const getMembershipContainers = deps?.getMembershipContainers
        ?? (async (objectId) => {
            const containers = await internalCache.Positions.getMembershipContainers(objectId)
            return containers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
        })
    const applyMembership = deps?.applyMembership ?? applyObjectRoomMembership
    const syncAdjacency = deps?.syncAdjacency ?? syncObjectMembershipAdjacencyToRoom

    const objectIds = await listGraphObjectIds(args.roomId, deps?.getPositionGraph)
    let multiRoomScrubbed = 0
    let adjacencySynced = 0

    for (const objectId of objectIds) {
        const containers = await getMembershipContainers(objectId)

        if (containers.length > 1) {
            const result = await applyMembership(
                { objectId, targetRoomId: args.roomId },
                { messageBus: args.messageBus, streamEvent: args.streamEvent }
            )
            if (result.ok && result.changed) {
                multiRoomScrubbed += 1
            }
            continue
        }

        if (containersIncludeRoom(containers, args.roomId)) {
            continue
        }

        const { synced } = await syncAdjacency({
            objectId,
            roomId: args.roomId,
        })
        if (synced) {
            adjacencySynced += 1
        }
    }

    return { multiRoomScrubbed, adjacencySynced }
}
