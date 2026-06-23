import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    getRoomObjectCatalogForCharacter,
    roomObjectLabelsFromCatalog,
    type RoomObjectCatalogDeps,
} from './roomObjectCatalogForCharacter'

export type RoomObjectLabelsDeps = RoomObjectCatalogDeps

/**
 * Thin wrapper: normalized shortNames for objects in the character's current room (classify prompt context).
 */
export async function getRoomObjectLabelsForCharacter(
    characterId: EphemeraCharacterId,
    deps: Partial<RoomObjectLabelsDeps> = {}
): Promise<string[]> {
    const catalog = await getRoomObjectCatalogForCharacter(characterId, deps)
    return roomObjectLabelsFromCatalog(catalog.entries)
}
