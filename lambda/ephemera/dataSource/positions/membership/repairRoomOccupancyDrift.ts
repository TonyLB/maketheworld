import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { v4 as uuidv4 } from 'uuid'
import internalCache from '../../../internalCache'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../publishedEvents'
import { applyCharacterRoomMembership } from './applyCharacterRoomMembership'
import { buildMembershipMoveOp } from './buildMembershipMoveOp'
import { orchestrateCharacterDisconnect } from './orchestrateCharacterDisconnect'
import { compilePositionKernelOp } from '../manipulation/kernel/compile/compilePositionKernelOp'
import { isKernelMutationStep } from '../manipulation/kernel/kernelStep'
import type { MembershipDiff } from './types'
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
    getCharacterMeta?: typeof internalCache.CharacterMeta.get;
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
    const getCharacterMeta = deps?.getCharacterMeta ?? ((characterId) => internalCache.CharacterMeta.get(characterId))
    const applyMembership = deps?.applyMembership ?? applyCharacterRoomMembership
    const syncAdjacency = deps?.syncAdjacency ?? syncMembershipAdjacencyToRoom

    const characterIds = await listGraphCharacterIds(args.roomId, deps?.getPositionGraph)
    let ghostsPurged = 0
    let adjacencySynced = 0

    for (const characterId of characterIds) {
        const sessions = await getCharacterSessions(characterId)
        const hasSessions = (sessions ?? []).length > 0

        if (!hasSessions) {
            const characterMeta = await getCharacterMeta(characterId)
            const bundleId = uuidv4()

            const compileMutationSteps = (diff: MembershipDiff) => compilePositionKernelOp(
                buildMembershipMoveOp({
                    characterId,
                    characterName: characterMeta.Name,
                    froms: diff.froms,
                    to: diff.to,
                    bundleId,
                    intentKind: 'disconnect',
                    headerSlot: null,
                })
            ).steps.filter(isKernelMutationStep)

            const result = await applyMembership(
                { characterId, targetRoomId: null, compileMutationSteps, narrationHandledInline: true },
                { messageBus: args.messageBus, streamEvent: args.streamEvent }
            )
            if (result.ok && result.changed) {
                ghostsPurged += 1
                if (result.froms.length > 0) {
                    await orchestrateCharacterDisconnect({
                        characterId,
                        characterName: characterMeta.Name,
                        froms: result.froms,
                        bundleId,
                        captures: result.captures,
                        messageBus: args.messageBus,
                    })
                }
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
