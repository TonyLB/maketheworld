import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { unique } from '@tonylb/mtw-utilities/ts/lists'
import { RoomKey } from '@tonylb/mtw-utilities/ts/types'
import internalCache from '../../../internalCache'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import type {
    ActiveCharacterRosterEntry,
    MembershipApplyArgs,
    MembershipApplyResult,
} from './types'
import { applyRoomStackToCharacterDraft, computeRoomStackUpdate } from './membershipRoomStack'

export type ApplyCharacterMembershipFlatDependencies = {
    getCharacterMeta?: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    getCharacterSessions?: (characterId: EphemeraCharacterId) => Promise<string[] | undefined>;
    getRoomAssets?: (roomId: EphemeraRoomId) => Promise<string[] | undefined>;
    getCanonAssets?: () => Promise<string[] | undefined>;
    transactWrite?: typeof ephemeraDB.transactWrite;
    readMembershipEndpoint?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId | null>;
}

const defaultReadMembershipEndpoint = async (characterId: EphemeraCharacterId): Promise<EphemeraRoomId | null> => {
    const containers = await internalCache.Positions.getMembershipContainers(characterId)
    return containers[0] ?? null
}

export const applyCharacterMembershipFlat = async (
    args: MembershipApplyArgs,
    deps?: ApplyCharacterMembershipFlatDependencies
): Promise<MembershipApplyResult> => {
    const getCharacterMeta = deps?.getCharacterMeta ?? ((characterId) => internalCache.CharacterMeta.get(characterId))
    const getCharacterSessions = deps?.getCharacterSessions ?? ((characterId) => internalCache.CharacterSessions.get(characterId))
    const getRoomAssets = deps?.getRoomAssets ?? ((roomId) => internalCache.RoomAssets.get(roomId))
    const getCanonAssets = deps?.getCanonAssets ?? (() => internalCache.Global.get('assets'))
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)
    const readMembershipEndpoint = deps?.readMembershipEndpoint ?? defaultReadMembershipEndpoint

    const from = await readMembershipEndpoint(args.characterId)
    const to = args.targetRoomId
    const changed = from !== to

    if (!changed) {
        return { ok: true, from, to, changed: false }
    }

    const characterMeta = await getCharacterMeta(args.characterId)
    const sessions = await getCharacterSessions(args.characterId)
    const roomRosterSnapshots: Partial<Record<EphemeraRoomId, ActiveCharacterRosterEntry[]>> = {}

    try {
        await exponentialBackoffWrapper(async () => {
            if (to === null) {
                const departureRoomId = from
                if (!departureRoomId) {
                    return
                }
                await transactWrite([
                    {
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
                    },
                    {
                        Update: {
                            Key: {
                                EphemeraId: departureRoomId,
                                DataCategory: 'Meta::Room',
                            },
                            updateKeys: ['activeCharacters'],
                            updateReducer: (draft) => {
                                draft.activeCharacters = (draft.activeCharacters ?? []).filter(
                                    ({ EphemeraId }) => EphemeraId !== characterMeta.EphemeraId
                                )
                            },
                            successCallback: (output) => {
                                roomRosterSnapshots[departureRoomId] = ((output as { activeCharacters?: ActiveCharacterRosterEntry[] }).activeCharacters ?? []) as ActiveCharacterRosterEntry[]
                            },
                        },
                    },
                ])
                return
            }

            const [roomAssets = [], canonAssets = []] = await Promise.all([
                getRoomAssets(to),
                getCanonAssets(),
            ])
            const { targetAsset, targetAssetListIndex } = computeRoomStackUpdate({
                targetRoomId: to,
                characterMeta,
                roomAssets,
                canonAssets,
            })
            const orderIndexByAsset = Object.assign(
                {},
                ...([...canonAssets, ...(characterMeta.assets || [])].map((asset, index) => ({ [asset]: index })))
            ) as Record<string, number>

            await transactWrite([
                {
                    Update: {
                        Key: {
                            EphemeraId: characterMeta.EphemeraId,
                            DataCategory: 'Meta::Character',
                        },
                        updateKeys: ['RoomId', 'RoomStack'],
                        updateReducer: (draft) => {
                            applyRoomStackToCharacterDraft(draft, {
                                targetRoomId: to,
                                targetAsset,
                                targetAssetListIndex,
                                orderIndexByAsset,
                            })
                        },
                    },
                },
                ...(from === to || from === null ? [] : [{
                    Update: {
                        Key: {
                            EphemeraId: from,
                            DataCategory: 'Meta::Room',
                        },
                        updateKeys: ['activeCharacters'],
                        updateReducer: (draft) => {
                            draft.activeCharacters = (draft.activeCharacters ?? []).filter(
                                ({ EphemeraId }) => EphemeraId !== characterMeta.EphemeraId
                            )
                        },
                            successCallback: (output) => {
                                roomRosterSnapshots[from] = ((output as { activeCharacters?: ActiveCharacterRosterEntry[] }).activeCharacters ?? []) as ActiveCharacterRosterEntry[]
                            },
                    },
                }]),
                {
                    Update: {
                        Key: {
                            EphemeraId: to,
                            DataCategory: 'Meta::Room',
                        },
                        updateKeys: ['activeCharacters'],
                        updateReducer: (draft) => {
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
                            roomRosterSnapshots[to] = ((output as { activeCharacters?: ActiveCharacterRosterEntry[] }).activeCharacters ?? []) as ActiveCharacterRosterEntry[]
                        },
                    },
                },
            ])
        }, { retryErrors: ['TransactionCanceledException'] })
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
            ok: false,
            errorCode: 'MEMBERSHIP_TRANSACT_FAILED',
            errorMessage: message,
        }
    }

    return {
        ok: true,
        from,
        to,
        changed: true,
        roomRosterSnapshots,
    }
}
