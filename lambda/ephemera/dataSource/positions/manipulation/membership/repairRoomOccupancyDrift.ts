import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { v4 as uuidv4 } from 'uuid'
import internalCache from '../../../../internalCache'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { orchestrateCharacterRoomMembership } from './orchestrateCharacterRoomMembership'
import { orchestrateCharacterDisconnect } from './orchestrateCharacterDisconnect'
import { syncMembershipAdjacencyToRoom } from './syncMembershipAdjacency'

export type RepairRoomOccupancyDriftArgs = {
    roomId: EphemeraRoomId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

export type RepairRoomOccupancyDriftDependencies = {
    getLudicGraph?: (roomId: EphemeraRoomId) => ReturnType<typeof internalCache.Positions.getLudicGraph>;
    getCharacterSessions?: (characterId: EphemeraCharacterId) => Promise<string[]>;
    getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
    applyMembership?: typeof orchestrateCharacterRoomMembership;
    syncAdjacency?: typeof syncMembershipAdjacencyToRoom;
}

const listGraphCharacterIds = async (
    roomId: EphemeraRoomId,
    getLudicGraph: RepairRoomOccupancyDriftDependencies['getLudicGraph']
): Promise<EphemeraCharacterId[]> => {
    const loader = getLudicGraph ?? ((id) => internalCache.Positions.getLudicGraph(id))
    const ludicGraph = await loader(roomId)
    return [...ludicGraph.characterIds].filter(isEphemeraCharacterId)
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
    const applyMembership = deps?.applyMembership ?? orchestrateCharacterRoomMembership
    const syncAdjacency = deps?.syncAdjacency ?? syncMembershipAdjacencyToRoom

    const characterIds = await listGraphCharacterIds(args.roomId, deps?.getLudicGraph)
    let ghostsPurged = 0
    let adjacencySynced = 0

    for (const characterId of characterIds) {
        const sessions = await getCharacterSessions(characterId)
        const hasSessions = (sessions ?? []).length > 0

        if (!hasSessions) {
            const bundleId = uuidv4()

            const result = await applyMembership(
                { characterId, targetRoomId: null, bundleId, intentKind: 'disconnect' },
                { messageBus: args.messageBus, streamEvent: args.streamEvent }
            )
            if (result.ok && result.changed) {
                ghostsPurged += 1
                await orchestrateCharacterDisconnect({
                    characterId,
                    bundleId,
                    plan: result.plan,
                    captures: result.captures,
                    messageBus: args.messageBus,
                })
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
