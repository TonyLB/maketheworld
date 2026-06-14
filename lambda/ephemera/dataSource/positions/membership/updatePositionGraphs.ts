import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { unique } from '@tonylb/mtw-utilities/ts/lists'
import internalCache from '../../../internalCache'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import { applyRoomStackToCharacterDraft, computeRoomStackUpdate } from './membershipRoomStack'
import {
    addCharacterToGraph,
    effectiveRoomPositionGraph,
    removeCharacterFromGraph,
} from './positionGraphMerge'
import type {
    ActiveCharacterRosterEntry,
    MembershipApplyArgs,
    MembershipDiff,
    UpdatePositionGraphsResult,
} from './types'

export type UpdatePositionGraphsDependencies = {
    getCharacterMeta?: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    getCharacterSessions?: (characterId: EphemeraCharacterId) => Promise<string[] | undefined>;
    getRoomAssets?: (roomId: EphemeraRoomId) => Promise<string[] | undefined>;
    getCanonAssets?: () => Promise<string[] | undefined>;
    getMetaRoom?: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
    getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
    transactWrite?: typeof ephemeraDB.transactWrite;
}

const defaultGetMembershipContainers = async (characterId: EphemeraCharacterId): Promise<EphemeraRoomId[]> =>
    internalCache.Positions.getMembershipContainers(characterId)

const defaultGetMetaRoom = async (roomId: EphemeraRoomId): Promise<EphemeraMetaRoom | undefined> =>
    internalCache.ComponentEphemeraMeta.get(roomId)

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

const snapshotRoster = (meta: Partial<EphemeraMetaRoom> | undefined): ActiveCharacterRosterEntry[] =>
    ((meta?.activeCharacters ?? []) as ActiveCharacterRosterEntry[])

export const updatePositionGraphs = async (
    args: MembershipApplyArgs,
    deps?: UpdatePositionGraphsDependencies
): Promise<UpdatePositionGraphsResult> => {
    const getCharacterMeta = deps?.getCharacterMeta ?? ((characterId) => internalCache.CharacterMeta.get(characterId))
    const getCharacterSessions = deps?.getCharacterSessions ?? ((characterId) => internalCache.CharacterSessions.get(characterId))
    const getRoomAssets = deps?.getRoomAssets ?? ((roomId) => internalCache.RoomAssets.get(roomId))
    const getCanonAssets = deps?.getCanonAssets ?? (() => internalCache.Global.get('assets'))
    const getMetaRoom = deps?.getMetaRoom ?? defaultGetMetaRoom
    const getMembershipContainers = deps?.getMembershipContainers ?? defaultGetMembershipContainers
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    const priorContainers = await getMembershipContainers(args.characterId)
    const diff = computeMembershipDiff(priorContainers, args.targetRoomId)

    if (!diff.changed) {
        return { ok: true, persisted: false, diff }
    }

    const characterMeta = await getCharacterMeta(args.characterId)
    const sessions = await getCharacterSessions(args.characterId)
    const roomRosterSnapshots: Partial<Record<EphemeraRoomId, ActiveCharacterRosterEntry[]>> = {}

    const touchedRoomIds = unique([
        ...diff.froms,
        ...(diff.to ? [diff.to] : []),
    ]) as EphemeraRoomId[]

    const roomMetaById = new Map<EphemeraRoomId, EphemeraMetaRoom>()
    await Promise.all(touchedRoomIds.map(async (roomId) => {
        const meta = await getMetaRoom(roomId)
        if (meta) {
            roomMetaById.set(roomId, meta)
        }
    }))

    let roomStackArgs: {
        targetAsset?: string;
        targetAssetListIndex?: number;
        orderIndexByAsset: Record<string, number>;
    } | undefined

    if (diff.to) {
        const [roomAssets = [], canonAssets = []] = await Promise.all([
            getRoomAssets(diff.to),
            getCanonAssets(),
        ])
        const { targetAsset, targetAssetListIndex } = computeRoomStackUpdate({
            targetRoomId: diff.to,
            characterMeta,
            roomAssets,
            canonAssets,
        })
        const orderIndexByAsset = Object.assign(
            {},
            ...([...canonAssets, ...(characterMeta.assets || [])].map((asset, index) => ({ [asset]: index })))
        ) as Record<string, number>
        roomStackArgs = { targetAsset, targetAssetListIndex, orderIndexByAsset }
    }

    try {
        let persisted = false
        await exponentialBackoffWrapper(async () => {
            const transactItems: Parameters<typeof transactWrite>[0] = []

            if (diff.to === null) {
                transactItems.push({
                    Update: {
                        Key: {
                            EphemeraId: characterMeta.EphemeraId,
                            DataCategory: 'Meta::Character',
                        },
                        updateKeys: ['RoomId'],
                        updateReducer: (draft) => {
                            delete draft.RoomId
                        },
                    },
                })
            }
            else {
                transactItems.push({
                    Update: {
                        Key: {
                            EphemeraId: characterMeta.EphemeraId,
                            DataCategory: 'Meta::Character',
                        },
                        updateKeys: ['RoomId', 'RoomStack'],
                        priorFetch: characterMeta as unknown as EphemeraMetaRoom,
                        updateReducer: (draft) => {
                            applyRoomStackToCharacterDraft(draft, {
                                targetRoomId: diff.to!,
                                ...roomStackArgs!,
                            })
                        },
                    },
                })
            }

            for (const departureRoomId of diff.froms) {
                const priorRoom = roomMetaById.get(departureRoomId)
                transactItems.push({
                    Update: {
                        Key: {
                            EphemeraId: departureRoomId,
                            DataCategory: 'Meta::Room',
                        },
                        updateKeys: ['positionGraph', 'activeCharacters'],
                        priorFetch: priorRoom,
                        updateReducer: (draft) => {
                            const graph = effectiveRoomPositionGraph(draft)
                            draft.positionGraph = removeCharacterFromGraph(graph, characterMeta.EphemeraId)
                            draft.activeCharacters = (draft.activeCharacters ?? []).filter(
                                ({ EphemeraId }) => EphemeraId !== characterMeta.EphemeraId
                            )
                        },
                        successCallback: (output) => {
                            roomRosterSnapshots[departureRoomId] = snapshotRoster(output as EphemeraMetaRoom)
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
                const priorRoom = roomMetaById.get(diff.to)
                transactItems.push({
                    Update: {
                        Key: {
                            EphemeraId: diff.to,
                            DataCategory: 'Meta::Room',
                        },
                        updateKeys: ['positionGraph', 'activeCharacters'],
                        priorFetch: priorRoom,
                        updateReducer: (draft) => {
                            const graph = effectiveRoomPositionGraph(draft)
                            draft.positionGraph = addCharacterToGraph(graph, characterMeta.EphemeraId)
                            const findMatch = (draft.activeCharacters ?? []).find(
                                ({ EphemeraId }) => EphemeraId === characterMeta.EphemeraId
                            )
                            draft.activeCharacters = [
                                ...(draft.activeCharacters ?? []).filter(
                                    ({ EphemeraId }) => EphemeraId !== characterMeta.EphemeraId
                                ),
                                {
                                    EphemeraId: characterMeta.EphemeraId,
                                    DisplayName: characterMeta.Name,
                                    fileURL: characterMeta.fileURL,
                                    Color: characterMeta.Color,
                                    SessionIds: unique(
                                        (findMatch as { SessionIds?: string[]; sessions?: string[] } | undefined)?.SessionIds
                                            ?? (findMatch as { sessions?: string[] } | undefined)?.sessions
                                            ?? [],
                                        sessions ?? []
                                    ),
                                },
                            ]
                        },
                        successCallback: (output) => {
                            roomRosterSnapshots[diff.to!] = snapshotRoster(output as EphemeraMetaRoom)
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
            roomRosterSnapshots,
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
