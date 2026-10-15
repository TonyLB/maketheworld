import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../../internalCache'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { orchestrateCharacterMove } from '../../navigate/orchestrateCharacterMove'
import { readRoomCharacters } from '../../ludicCache/charactersRow'
import { migrateRoomBystanders } from './migrateRoomBystanders'
import { syncMembershipAdjacencyToRoom } from './syncMembershipAdjacency'

export type RepairRoomOccupancyDriftArgs = {
    roomId: EphemeraRoomId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

export type RepairRoomOccupancyDriftDependencies = {
    getRoomCharacters?: (roomId: EphemeraRoomId) => Promise<EphemeraCharacterId[]>;
    getCharacterSessions?: (characterId: EphemeraCharacterId) => Promise<string[]>;
    getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
    applyMembership?: typeof orchestrateCharacterMove;
    syncAdjacency?: typeof syncMembershipAdjacencyToRoom;
    migrateBystanders?: typeof migrateRoomBystanders;
}

const containersIncludeRoom = (containers: EphemeraRoomId[], roomId: EphemeraRoomId): boolean =>
    containers.includes(roomId)

/**
 * Roster-forward occupancy drift repair for one room (S2-6-DR). The room's characters come from its
 * `LudicCache::Characters` row (an index; each character's own pointer governs, so this heals the drift).
 * Sessions gate disconnect; in-play roster syncs adjacency only.
 */
export const repairRoomOccupancyDrift = async (
    args: RepairRoomOccupancyDriftArgs,
    deps?: RepairRoomOccupancyDriftDependencies
): Promise<{ ghostsPurged: number; adjacencySynced: number }> => {
    const getCharacterSessions = deps?.getCharacterSessions
        ?? ((characterId) => internalCache.CharacterSessions.get(characterId))
    const getMembershipContainers = deps?.getMembershipContainers
        ?? (async (characterId) => {
            const containers = await internalCache.Positions.getMembershipContainers(characterId)
            return containers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
        })
    const applyMembership = deps?.applyMembership ?? orchestrateCharacterMove
    const syncAdjacency = deps?.syncAdjacency ?? syncMembershipAdjacencyToRoom

    // A room graph written before bystanders left it still names its characters: hand them to the row first.
    await (deps?.migrateBystanders ?? migrateRoomBystanders)(args.roomId)

    const characterIds = await (deps?.getRoomCharacters ?? readRoomCharacters)(args.roomId)
    let ghostsPurged = 0
    let adjacencySynced = 0

    for (const characterId of characterIds) {
        const sessions = await getCharacterSessions(characterId)
        const hasSessions = (sessions ?? []).length > 0

        if (!hasSessions) {
            const result = await applyMembership({
                characterId,
                targetRoomId: null,
                intentKind: 'disconnect',
                messageBus: args.messageBus,
                streamEvent: args.streamEvent,
            })
            if (result.ok && result.changed) {
                ghostsPurged += 1
            }
            continue
        }

        const containers = await getMembershipContainers(characterId)
        if (containersIncludeRoom(containers, args.roomId)) {
            continue
        }

        const { synced } = await syncAdjacency({
            componentId: characterId,
            roomId: args.roomId,
        })
        if (synced) {
            adjacencySynced += 1
        }
    }

    return { ghostsPurged, adjacencySynced }
}
