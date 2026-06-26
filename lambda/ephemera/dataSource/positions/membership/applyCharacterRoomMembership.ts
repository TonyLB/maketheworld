import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { projectComponentGraphFromStoredPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import internalCache from '../../../internalCache'
import { getRoomCharacterList } from '../../../internalCache/hydrateRoomRoster'
import getCurrentTimestamp from '../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../publishedEvents'
import { applyHostEffects, type ApplyHostEffectsDependencies } from '../manipulation/applyHostEffects'
import { planMembershipTransfer } from '../manipulation/adapters/planMembershipTransfer'
import { buildCharacterMovedFact } from './buildCharacterMovedFact'
import { streamMembershipFact } from './streamMembershipFact'
import type { RoomCharacterListItem } from '../../../internalCache/baseClasses'
import type { MembershipApplyArgs, MembershipApplyResult, MembershipDiff, RoomStackItem } from './types'

export type ApplyCharacterRoomMembershipDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
    getCharacterMeta?: typeof internalCache.CharacterMeta.get;
    getRoomAssets?: (roomId: EphemeraRoomId) => Promise<string[] | undefined>;
    getCanonAssets?: () => Promise<string[] | undefined>;
    kernelPersist?: ApplyHostEffectsDependencies;
    getSessionId?: () => Promise<string | undefined>;
}

const defaultGetMembershipContainers = async (characterId: EphemeraCharacterId): Promise<EphemeraRoomId[]> => {
    const containers = await internalCache.Positions.getMembershipContainers(characterId)
    return containers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
}

const normalizeCurrentRoomStack = (stack: RoomStackItem[] | undefined): RoomStackItem[] =>
    stack ?? []

const seedPositionsGraphMemos = (
    postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>
): void => {
    for (const [roomId, storedGraph] of Object.entries(postApplyRoomGraphs) as [EphemeraRoomId, EphemeraPlayPositionGraph][]) {
        internalCache.ComponentEphemeraMeta.invalidate(roomId)
        internalCache.AffordanceRoomDeliverable.invalidate(roomId)
        internalCache.Positions.set({
            componentId: roomId,
            graph: projectComponentGraphFromStoredPositionGraph(storedGraph),
        })
    }
}

const buildRoomRosterSnapshots = async (
    affectedRooms: EphemeraRoomId[]
): Promise<Partial<Record<EphemeraRoomId, RoomCharacterListItem[]>>> => {
    const entries = await Promise.all(
        affectedRooms.map(async (roomId) => [roomId, await getRoomCharacterList(roomId)] as const)
    )
    return Object.fromEntries(entries) as Partial<Record<EphemeraRoomId, RoomCharacterListItem[]>>
}

const affectedRoomsFromDiff = (froms: EphemeraRoomId[], to: EphemeraRoomId | null): EphemeraRoomId[] =>
    [...new Set([...froms, ...(to ? [to] : [])])]

const membershipDiffFromProjection = (projection: {
    froms: EphemeraRoomId[];
    to: EphemeraRoomId | null;
    changed: boolean;
}): MembershipDiff => ({
    froms: projection.froms,
    to: projection.to,
    changed: projection.changed,
})

const roomGraphsFromKernelResult = (
    postApplyGraphs: Partial<Record<string, EphemeraPlayPositionGraph>>
): Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>> => {
    const result: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>> = {}
    for (const [hostId, graph] of Object.entries(postApplyGraphs)) {
        if (isEphemeraRoomId(hostId)) {
            result[hostId] = graph
        }
    }
    return result
}

export const applyCharacterRoomMembership = async (
    args: MembershipApplyArgs,
    deps: ApplyCharacterRoomMembershipDependencies
): Promise<MembershipApplyResult> => {
    const getMembershipContainers = deps.getMembershipContainers ?? defaultGetMembershipContainers
    const getCharacterMeta = deps.getCharacterMeta ?? ((characterId) => internalCache.CharacterMeta.get(characterId))
    const getRoomAssets = deps.getRoomAssets ?? ((roomId) => internalCache.RoomAssets.get(roomId))
    const getCanonAssets = deps.getCanonAssets ?? (() => internalCache.Global.get('assets'))

    const priorContainers = await getMembershipContainers(args.characterId)
    const plan = planMembershipTransfer({
        entityId: args.characterId,
        entityKind: 'character',
        applyMode: 'end-state',
        target: args.targetRoomId,
        priorContainers,
    })

    const diff = membershipDiffFromProjection({
        froms: plan.projection.froms.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id)),
        to: plan.projection.to !== null && isEphemeraRoomId(plan.projection.to) ? plan.projection.to : null,
        changed: plan.projection.changed,
    })

    if (!diff.changed) {
        return { ok: true, ...diff }
    }

    const characterMeta = await getCharacterMeta(args.characterId)

    const [roomAssets = [], canonAssets = []] = diff.to
        ? await Promise.all([
            getRoomAssets(diff.to),
            getCanonAssets(),
        ])
        : [[], []]

    const characterRowEffects = diff.to !== null
        ? [{
            characterId: characterMeta.EphemeraId,
            targetRoomId: diff.to,
            characterAssets: characterMeta.assets || [],
            roomAssets,
            canonAssets,
            currentRoomStack: normalizeCurrentRoomStack(characterMeta.RoomStack),
        }]
        : []

    const kernelResult = await applyHostEffects(
        {
            hostEffects: plan.hostEffects,
            characterRowEffects,
        },
        deps.kernelPersist
    )

    if (!kernelResult.ok) {
        console.error(`[mtw.ephemera.positions] applyHostEffects failed: ${kernelResult.errorMessage}`)
        return {
            ok: false,
            errorCode: kernelResult.errorCode,
            errorMessage: kernelResult.errorMessage,
        }
    }

    if (!kernelResult.persisted) {
        return { ok: true, ...diff }
    }

    const beatAnchorTime = getCurrentTimestamp()
    const getSessionId = deps.getSessionId ?? (() => internalCache.Global.get('SessionId'))
    const sessionId = await getSessionId()
    const postApplyRoomGraphs = roomGraphsFromKernelResult(kernelResult.postApplyGraphs)

    const fact = buildCharacterMovedFact({
        characterId: args.characterId,
        diff,
        beatAnchorTime,
        characterName: characterMeta.Name,
    })
    if (fact) {
        await streamMembershipFact(fact, { streamEvent: deps.streamEvent })
    }

    const affectedRooms = affectedRoomsFromDiff(diff.froms, diff.to)
    seedPositionsGraphMemos(postApplyRoomGraphs)
    const roomRosterSnapshots = await buildRoomRosterSnapshots(affectedRooms)
    internalCache.Positions.setMembershipContainers({
        componentId: args.characterId,
        containers: diff.to ? [diff.to] : [],
    })
    internalCache.CharacterMeta.invalidate(args.characterId)

    affectedRooms.forEach((roomId) => {
        deps.messageBus.publish({
            type: 'RoomUpdate',
            roomId,
        })
    })

    deps.messageBus.publish({
        type: 'EphemeraUpdate',
        updates: [{
            type: 'CharacterInPlay',
            CharacterId: characterMeta.EphemeraId,
            Connected: true,
            RoomId: diff.to ?? characterMeta.HomeId,
            connectionTargets: ['GLOBAL', `SESSION#${sessionId}`],
        }],
    })

    return {
        ok: true,
        ...diff,
        beatAnchorTime,
        roomRosterSnapshots,
    }
}
