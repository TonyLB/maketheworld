import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import internalCache from '../../../internalCache'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import { applyHostEffects, type ApplyHostEffectsDependencies } from '../manipulation/applyHostEffects'
import { planMembershipTransfer } from '../manipulation/adapters/planMembershipTransfer'
import {
    addCharacterToGraph,
    playPositionGraphToStoredTopology,
    removeCharacterFromGraph,
} from './positionGraphMerge'
import type {
    MembershipApplyArgs,
    MembershipDiff,
    RoomStackItem,
    UpdatePositionGraphsResult,
} from './types'

export { computeMembershipDiff } from '../manipulation/adapters/computeEndStateRoomDiff'

export type UpdatePositionGraphsDependencies = {
    getCharacterMeta?: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    getRoomAssets?: (roomId: EphemeraRoomId) => Promise<string[] | undefined>;
    getCanonAssets?: () => Promise<string[] | undefined>;
    getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
} & ApplyHostEffectsDependencies

const defaultGetMembershipContainers = async (characterId: EphemeraCharacterId): Promise<EphemeraRoomId[]> => {
    const containers = await internalCache.Positions.getMembershipContainers(characterId)
    return containers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
}

const normalizeCurrentRoomStack = (stack: RoomStackItem[] | undefined): RoomStackItem[] =>
    stack ?? []

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
): Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>> =>
    Object.entries(postApplyGraphs).reduce<Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>>(
        (result, [hostId, graph]) => {
            if (isEphemeraRoomId(hostId)) {
                result[hostId] = graph
            }
            return result
        },
        {}
    )

const affectedRoomsFromDiff = (froms: EphemeraRoomId[], to: EphemeraRoomId | null): EphemeraRoomId[] =>
    [...new Set([...froms, ...(to ? [to] : [])])]

export const computePostApplyRoomGraphs = async (
    characterId: EphemeraCharacterId,
    diff: MembershipDiff,
    getRoomPositionGraph: (roomId: EphemeraRoomId) => Promise<PlayPositionGraph>
): Promise<Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>> => {
    const postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>> = {}
    const affectedRooms = affectedRoomsFromDiff(diff.froms, diff.to)

    await Promise.all(
        affectedRooms.map(async (roomId) => {
            const priorStored = playPositionGraphToStoredTopology(await getRoomPositionGraph(roomId))
            if (diff.froms.includes(roomId)) {
                postApplyRoomGraphs[roomId] = removeCharacterFromGraph(priorStored, characterId)
            }
            if (diff.to === roomId) {
                postApplyRoomGraphs[roomId] = addCharacterToGraph(priorStored, characterId)
            }
        })
    )

    return postApplyRoomGraphs
}

export const updatePositionGraphs = async (
    args: MembershipApplyArgs,
    deps?: UpdatePositionGraphsDependencies
): Promise<UpdatePositionGraphsResult> => {
    const getCharacterMeta = deps?.getCharacterMeta ?? ((characterId) => internalCache.CharacterMeta.get(characterId))
    const getRoomAssets = deps?.getRoomAssets ?? ((roomId) => internalCache.RoomAssets.get(roomId))
    const getCanonAssets = deps?.getCanonAssets ?? (() => internalCache.Global.get('assets'))
    const getMembershipContainers = deps?.getMembershipContainers ?? defaultGetMembershipContainers

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
        return { ok: true, persisted: false, diff }
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
        deps
    )

    if (!kernelResult.ok) {
        return {
            ok: false,
            errorCode: 'MEMBERSHIP_TRANSACT_FAILED',
            errorMessage: kernelResult.errorMessage,
        }
    }

    if (!kernelResult.persisted) {
        return { ok: true, persisted: false, diff }
    }

    return {
        ok: true,
        persisted: true,
        diff,
        postApplyRoomGraphs: roomGraphsFromKernelResult(kernelResult.postApplyGraphs),
    }
}
