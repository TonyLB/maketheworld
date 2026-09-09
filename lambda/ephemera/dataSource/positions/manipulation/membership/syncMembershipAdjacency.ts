import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../../internalCache'

export type SyncMembershipAdjacencyToRoomArgs = {
    componentId: EphemeraCharacterId | EphemeraObjectId;
    roomId: EphemeraRoomId;
}

export type SyncMembershipAdjacencyToRoomDependencies = {
    getMembershipContainers?: (componentId: EphemeraCharacterId | EphemeraObjectId) => Promise<EphemeraRoomId[]>;
    transactWrite?: typeof ephemeraDB.transactWrite;
}

const normalizeContainers = (containers: EphemeraRoomId[], roomId: EphemeraRoomId): boolean =>
    containers.length === 1 && containers[0] === roomId

/**
 * Merged from the former character/object twins (Phase 1b). Filtering to `EphemeraRoomId`
 * is only known-correct for the character case --- see AGENT.presence.discussion.planning.md's
 * PR-2 row ("the dedup has a shelf life") for whether room-only filtering is already wrong for a
 * boxed object. Both current callers are room-driven repair sweeps, so it isn't live yet.
 */
export const syncMembershipAdjacencyToRoom = async (
    args: SyncMembershipAdjacencyToRoomArgs,
    deps?: SyncMembershipAdjacencyToRoomDependencies
): Promise<{ synced: boolean }> => {
    const getMembershipContainers = deps?.getMembershipContainers
        ?? (async (componentId) => {
            const containers = await internalCache.Positions.getMembershipContainers(componentId)
            return containers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
        })
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    const priorContainers = await getMembershipContainers(args.componentId)
    if (normalizeContainers(priorContainers, args.roomId)) {
        return { synced: false }
    }

    const transactItems: Parameters<typeof transactWrite>[0] = [
        {
            Put: {
                EphemeraId: args.componentId,
                DataCategory: buildPositionAdjacencyDataCategory(args.roomId),
            },
        },
    ]

    for (const hostRoomId of priorContainers) {
        if (hostRoomId !== args.roomId) {
            transactItems.push({
                Delete: {
                    EphemeraId: args.componentId,
                    DataCategory: buildPositionAdjacencyDataCategory(hostRoomId),
                },
            })
        }
    }

    await exponentialBackoffWrapper(async () => {
        await transactWrite(transactItems)
    }, { retryErrors: ['TransactionCanceledException'] })

    internalCache.Positions.setMembershipContainers({
        componentId: args.componentId,
        containers: [args.roomId],
    })

    return { synced: true }
}
