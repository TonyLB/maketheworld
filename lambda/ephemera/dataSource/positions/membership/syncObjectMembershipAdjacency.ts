import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'

export type SyncObjectMembershipAdjacencyToRoomArgs = {
    objectId: EphemeraObjectId;
    roomId: EphemeraRoomId;
}

export type SyncObjectMembershipAdjacencyToRoomDependencies = {
    getMembershipContainers?: (objectId: EphemeraObjectId) => Promise<EphemeraRoomId[]>;
    transactWrite?: typeof ephemeraDB.transactWrite;
}

const normalizeContainers = (containers: EphemeraRoomId[], roomId: EphemeraRoomId): boolean =>
    containers.length === 1 && containers[0] === roomId

export const syncObjectMembershipAdjacencyToRoom = async (
    args: SyncObjectMembershipAdjacencyToRoomArgs,
    deps?: SyncObjectMembershipAdjacencyToRoomDependencies
): Promise<{ synced: boolean }> => {
    const getMembershipContainers = deps?.getMembershipContainers
        ?? (async (objectId) => {
            const containers = await internalCache.Positions.getMembershipContainers(objectId)
            return containers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
        })
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    const priorContainers = await getMembershipContainers(args.objectId)
    if (normalizeContainers(priorContainers, args.roomId)) {
        return { synced: false }
    }

    const transactItems: Parameters<typeof transactWrite>[0] = [
        {
            Put: {
                EphemeraId: args.objectId,
                DataCategory: buildPositionAdjacencyDataCategory(args.roomId),
            },
        },
    ]

    for (const hostRoomId of priorContainers) {
        if (hostRoomId !== args.roomId) {
            transactItems.push({
                Delete: {
                    EphemeraId: args.objectId,
                    DataCategory: buildPositionAdjacencyDataCategory(hostRoomId),
                },
            })
        }
    }

    await exponentialBackoffWrapper(async () => {
        await transactWrite(transactItems)
    }, { retryErrors: ['TransactionCanceledException'] })

    internalCache.Positions.setMembershipContainers({
        componentId: args.objectId,
        containers: [args.roomId],
    })

    return { synced: true }
}
