import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export type EmptyMapSnapshot = {
    characterId: EphemeraCharacterId
    maps: []
}

/**
 * PR8 temporary `mtw.ephemera.maps` stub contract:
 * subscribe succeeds and returns an empty map snapshot payload.
 */
export const emptyMapSnapshotForCharacter = (characterId: EphemeraCharacterId): EmptyMapSnapshot => ({
    characterId,
    maps: []
})
