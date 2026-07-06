import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../publishedEvents'
import { applyCharacterRoomMembership } from './applyCharacterRoomMembership'
import { syncMembershipAdjacencyToRoom } from './syncMembershipAdjacency'

export type RepairRoomOccupancyDriftArgs = {
    roomId: EphemeraRoomId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

export type RepairRoomOccupancyDriftDependencies = {
    getPositionGraph?: (roomId: EphemeraRoomId) => ReturnType<typeof internalCache.Positions.getPositionGraph>;
    getCharacterSessions?: (characterId: EphemeraCharacterId) => Promise<string[]>;
    getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
    applyMembership?: typeof applyCharacterRoomMembership;
    syncAdjacency?: typeof syncMembershipAdjacencyToRoom;
}

const listGraphCharacterIds = async (
    roomId: EphemeraRoomId,
    getPositionGraph: RepairRoomOccupancyDriftDependencies['getPositionGraph']
): Promise<EphemeraCharacterId[]> => {
    const loader = getPositionGraph ?? ((id) => internalCache.Positions.getPositionGraph(id))
    const positionGraph = await loader(roomId)
    return [...positionGraph.characterIds].filter(isEphemeraCharacterId)
}

const containersIncludeRoom = (containers: EphemeraRoomId[], roomId: EphemeraRoomId): boolean =>
    containers.includes(roomId)

/**
 * Graph-forward occupancy drift repair for one room (S2-6-DR).
 * Sessions gate disconnect; in-play graph syncs adjacency only.
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
    const applyMembership = deps?.applyMembership ?? applyCharacterRoomMembership
    const syncAdjacency = deps?.syncAdjacency ?? syncMembershipAdjacencyToRoom

    const characterIds = await listGraphCharacterIds(args.roomId, deps?.getPositionGraph)
    let ghostsPurged = 0
    let adjacencySynced = 0

    for (const characterId of characterIds) {
        const sessions = await getCharacterSessions(characterId)
        const hasSessions = (sessions ?? []).length > 0

        if (!hasSessions) {
            const result = await applyMembership(
                { characterId, targetRoomId: null },
                { messageBus: args.messageBus, streamEvent: args.streamEvent }
            )
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
            characterId,
            roomId: args.roomId,
        })
        if (synced) {
            adjacencySynced += 1
        }
    }

    return { ghostsPurged, adjacencySynced }
}
