import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'

export type SyncMembershipAdjacencyToRoomArgs = {
    characterId: EphemeraCharacterId;
    roomId: EphemeraRoomId;
}

export type SyncMembershipAdjacencyToRoomDependencies = {
    getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
    transactWrite?: typeof ephemeraDB.transactWrite;
}

const normalizeContainers = (containers: EphemeraRoomId[], roomId: EphemeraRoomId): boolean =>
    containers.length === 1 && containers[0] === roomId

export const syncMembershipAdjacencyToRoom = async (
    args: SyncMembershipAdjacencyToRoomArgs,
    deps?: SyncMembershipAdjacencyToRoomDependencies
): Promise<{ synced: boolean }> => {
    const getMembershipContainers = deps?.getMembershipContainers
        ?? ((characterId) => internalCache.Positions.getMembershipContainers(characterId))
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    const priorContainers = await getMembershipContainers(args.characterId)
    if (normalizeContainers(priorContainers, args.roomId)) {
        return { synced: false }
    }

    const transactItems: Parameters<typeof transactWrite>[0] = [
        {
            Put: {
                EphemeraId: args.characterId,
                DataCategory: buildPositionAdjacencyDataCategory(args.roomId),
            },
        },
    ]

    for (const hostRoomId of priorContainers) {
        if (hostRoomId !== args.roomId) {
            transactItems.push({
                Delete: {
                    EphemeraId: args.characterId,
                    DataCategory: buildPositionAdjacencyDataCategory(hostRoomId),
                },
            })
        }
    }

    await exponentialBackoffWrapper(async () => {
        await transactWrite(transactItems)
    }, { retryErrors: ['TransactionCanceledException'] })

    internalCache.Positions.setMembershipContainers({
        componentId: args.characterId,
        containers: [args.roomId],
    })

    return { synced: true }
}
