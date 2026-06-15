import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import { applyRoomStackToCharacterDraft, computeRoomStackUpdate } from './membershipRoomStack'
import {
    addCharacterToGraph,
    effectiveRoomPositionGraph,
    removeCharacterFromGraph,
} from './positionGraphMerge'
import type {
    MembershipApplyArgs,
    MembershipDiff,
    UpdatePositionGraphsResult,
} from './types'
import type { RoomStackItem } from './types'

export type UpdatePositionGraphsDependencies = {
    getCharacterMeta?: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    getRoomAssets?: (roomId: EphemeraRoomId) => Promise<string[] | undefined>;
    getCanonAssets?: () => Promise<string[] | undefined>;
    getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
    transactWrite?: typeof ephemeraDB.transactWrite;
}

const defaultGetMembershipContainers = async (characterId: EphemeraCharacterId): Promise<EphemeraRoomId[]> =>
    internalCache.Positions.getMembershipContainers(characterId)

const containersChanged = (priorContainers: EphemeraRoomId[], targetRoomId: EphemeraRoomId | null): boolean => {
    const priorSet = new Set(priorContainers)
    const endSet = new Set(targetRoomId ? [targetRoomId] : [])
    if (priorSet.size !== endSet.size) {
        return true
    }
    for (const roomId of priorSet) {
        if (!endSet.has(roomId)) {
            return true
        }
    }
    return false
}

export const computeMembershipDiff = (
    priorContainers: EphemeraRoomId[],
    targetRoomId: EphemeraRoomId | null
): MembershipDiff => {
    const to = targetRoomId
    const froms = priorContainers.filter((roomId) => roomId !== to)
    return {
        froms,
        to,
        changed: containersChanged(priorContainers, targetRoomId),
    }
}

const normalizeCurrentRoomStack = (stack: RoomStackItem[] | undefined): RoomStackItem[] =>
    stack ?? []

export const updatePositionGraphs = async (
    args: MembershipApplyArgs,
    deps?: UpdatePositionGraphsDependencies
): Promise<UpdatePositionGraphsResult> => {
    const getCharacterMeta = deps?.getCharacterMeta ?? ((characterId) => internalCache.CharacterMeta.get(characterId))
    const getRoomAssets = deps?.getRoomAssets ?? ((roomId) => internalCache.RoomAssets.get(roomId))
    const getCanonAssets = deps?.getCanonAssets ?? (() => internalCache.Global.get('assets'))
    const getMembershipContainers = deps?.getMembershipContainers ?? defaultGetMembershipContainers
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    const priorContainers = await getMembershipContainers(args.characterId)
    const diff = computeMembershipDiff(priorContainers, args.targetRoomId)

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

    try {
        let persisted = false
        await exponentialBackoffWrapper(async () => {
            const transactItems: Parameters<typeof transactWrite>[0] = []

            if (diff.to !== null) {
                const targetRoomId = diff.to
                const characterAssets = characterMeta.assets || []
                transactItems.push({
                    Update: {
                        Key: {
                            EphemeraId: characterMeta.EphemeraId,
                            DataCategory: 'Meta::Character',
                        },
                        updateKeys: ['RoomStack'],
                        updateReducer: (draft) => {
                            const { destinationChain } = computeRoomStackUpdate({
                                targetRoomId,
                                currentRoomStack: normalizeCurrentRoomStack(
                                    draft.RoomStack as RoomStackItem[] | undefined
                                ),
                                characterAssets,
                                roomAssets,
                                canonAssets,
                            })
                            applyRoomStackToCharacterDraft(draft, {
                                targetRoomId,
                                destinationChain,
                            })
                        },
                    },
                })
            }

            for (const departureRoomId of diff.froms) {
                transactItems.push({
                    Update: {
                        Key: {
                            EphemeraId: departureRoomId,
                            DataCategory: 'Meta::Room',
                        },
                        updateKeys: ['positionGraph'],
                        updateReducer: (draft) => {
                            const graph = effectiveRoomPositionGraph(draft)
                            draft.positionGraph = removeCharacterFromGraph(graph, characterMeta.EphemeraId)
                        },
                    },
                })
                transactItems.push({
                    Delete: {
                        EphemeraId: characterMeta.EphemeraId,
                        DataCategory: buildPositionAdjacencyDataCategory(departureRoomId),
                    },
                })
            }

            if (diff.to) {
                transactItems.push({
                    Update: {
                        Key: {
                            EphemeraId: diff.to,
                            DataCategory: 'Meta::Room',
                        },
                        updateKeys: ['positionGraph'],
                        updateReducer: (draft) => {
                            const graph = effectiveRoomPositionGraph(draft)
                            draft.positionGraph = addCharacterToGraph(graph, characterMeta.EphemeraId)
                        },
                    },
                })
                transactItems.push({
                    Put: {
                        EphemeraId: characterMeta.EphemeraId,
                        DataCategory: buildPositionAdjacencyDataCategory(diff.to),
                    },
                })
            }

            if (transactItems.length === 0) {
                return
            }

            await transactWrite(transactItems)
            persisted = true
        }, { retryErrors: ['TransactionCanceledException'] })

        if (!persisted) {
            return { ok: true, persisted: false, diff }
        }

        return {
            ok: true,
            persisted: true,
            diff,
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
            ok: false,
            errorCode: 'MEMBERSHIP_TRANSACT_FAILED',
            errorMessage: message,
        }
    }
}
