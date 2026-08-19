import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaCharacter, EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { RoomKey } from '@tonylb/mtw-utilities/ts/types'

import internalCache from '../../internalCache'
import { collectActiveCharactersInCoyoteRooms } from '../coyoteGame/utilities/collectActiveCharactersInCoyoteRooms'

export type PersistClearStoredLudicGraphsDependencies = {
    getGameRooms?: () => Promise<string[]>;
    getActiveCharactersInCoyoteRooms?: () => Promise<EphemeraCharacterId[]>;
    clearRoomLudicGraph?: (roomId: EphemeraRoomId) => Promise<void>;
    clearCharacterLudicGraph?: (characterId: EphemeraCharacterId) => Promise<void>;
}

const defaultClearRoomLudicGraph = async (roomId: EphemeraRoomId): Promise<void> => {
    await ephemeraDB.optimisticUpdate<EphemeraMetaRoom>({
        Key: { EphemeraId: roomId, DataCategory: 'Meta::Room' },
        updateKeys: ['ludicGraph'],
        updateReducer: (draft) => {
            delete draft.ludicGraph
        },
    })
}

const defaultClearCharacterLudicGraph = async (characterId: EphemeraCharacterId): Promise<void> => {
    await ephemeraDB.optimisticUpdate<EphemeraMetaCharacter>({
        Key: { EphemeraId: characterId, DataCategory: 'Meta::Character' },
        updateKeys: ['ludicGraph'],
        updateReducer: (draft) => {
            delete draft.ludicGraph
        },
    })
}

/**
 * Removes the `ludicGraph` attribute (REMOVE, not an empty-object overwrite) from every CoyoteGame
 * room and active-in-those-rooms character. Manual step for LPM's reset, run after the established
 * "wipe objects / disconnect all characters" sequence and before rootId/ports become required.
 */
export const persistClearStoredLudicGraphs = async (
    deps: PersistClearStoredLudicGraphsDependencies = {}
): Promise<
    | { ok: true; clearedRoomIds: EphemeraRoomId[]; clearedCharacterIds: EphemeraCharacterId[] }
    | { ok: false; errorMessage: string }
> => {
    const getGameRooms = deps.getGameRooms ?? (() => internalCache.CoyoteGame.get('gameRooms'))
    const getActiveCharactersInCoyoteRooms = deps.getActiveCharactersInCoyoteRooms ?? collectActiveCharactersInCoyoteRooms
    const clearRoomLudicGraph = deps.clearRoomLudicGraph ?? defaultClearRoomLudicGraph
    const clearCharacterLudicGraph = deps.clearCharacterLudicGraph ?? defaultClearCharacterLudicGraph

    try {
        const gameRooms = await getGameRooms()
        const roomIds = gameRooms.map((room) => RoomKey(room) as EphemeraRoomId)
        const characterIds = await getActiveCharactersInCoyoteRooms()

        for (const roomId of roomIds) {
            await clearRoomLudicGraph(roomId)
        }
        for (const characterId of characterIds) {
            await clearCharacterLudicGraph(characterId)
        }

        return { ok: true, clearedRoomIds: roomIds, clearedCharacterIds: characterIds }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, errorMessage: message }
    }
}
