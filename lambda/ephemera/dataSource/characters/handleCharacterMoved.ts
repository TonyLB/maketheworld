import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../internalCache'
import type { CharacterMetaItem } from '../../internalCache/characterMeta'
import type { CharacterMovedPublishedPayload } from '../positions/publishedEvents'
import { persistRoomStackNavigate } from './roomStack/persistRoomStackNavigate'

export type HandleCharacterMovedDependencies = {
    getCharacterMeta?: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    getRoomAssets?: (roomId: EphemeraRoomId) => Promise<string[] | undefined>;
    getCanonAssets?: () => Promise<string[] | undefined>;
    persist?: typeof persistRoomStackNavigate;
}

/**
 * Eviction-ladder maintenance on positions' `Character Moved`: a move into a room
 * merges the navigate ladder at the fact's `beatAnchorTime`. Out-of-play (`to: null`)
 * leaves the ladder alone. Tolerates failure (log, never throw): the ladder is
 * placement's fallback, not a precondition of the move that already committed.
 */
export const handleCharacterMoved = async (
    fact: CharacterMovedPublishedPayload,
    deps?: HandleCharacterMovedDependencies
): Promise<void> => {
    const { characterId, to, beatAnchorTime } = fact
    if (to === null) {
        return
    }
    const getCharacterMeta = deps?.getCharacterMeta
        ?? ((id: EphemeraCharacterId) => internalCache.CharacterMeta.get(id))
    const getRoomAssets = deps?.getRoomAssets
        ?? ((roomId: EphemeraRoomId) => internalCache.RoomAssets.get(roomId))
    const getCanonAssets = deps?.getCanonAssets
        ?? (() => internalCache.Global.get('assets'))
    const persist = deps?.persist ?? persistRoomStackNavigate

    try {
        const [characterMeta, roomAssets = [], canonAssets = []] = await Promise.all([
            getCharacterMeta(characterId),
            getRoomAssets(to),
            getCanonAssets(),
        ])
        await persist({
            characterId,
            targetRoomId: to,
            beatAnchorTime,
            characterAssets: characterMeta.assets || [],
            roomAssets,
            canonAssets,
        })
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[mtw.ephemera.characters] Character Moved ladder maintenance failed: ${message}`)
    }
}
