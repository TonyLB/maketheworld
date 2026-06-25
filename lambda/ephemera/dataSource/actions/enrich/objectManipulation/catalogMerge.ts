import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'

export type ObjectManipulationCatalogScope = 'room' | 'held'

export type ObjectManipulationCatalogEntry = RoomInPlayObjectCatalogEntry & {
    catalogScope: ObjectManipulationCatalogScope
}

export function mergeObjectManipulationCatalogs(
    room: readonly RoomInPlayObjectCatalogEntry[],
    held: readonly RoomInPlayObjectCatalogEntry[] = []
): ObjectManipulationCatalogEntry[] {
    const byObjectId = new Map<string, ObjectManipulationCatalogEntry>()
    for (const entry of room) {
        byObjectId.set(entry.objectId, { ...entry, catalogScope: 'room' })
    }
    for (const entry of held) {
        if (!byObjectId.has(entry.objectId)) {
            byObjectId.set(entry.objectId, { ...entry, catalogScope: 'held' })
        }
    }
    const roomIds = new Set(room.map(({ objectId }) => objectId))
    const roomOrdered = room.map(({ objectId }) => byObjectId.get(objectId)!)
    const heldOnly = held
        .filter(({ objectId }) => !roomIds.has(objectId))
        .map(({ objectId }) => byObjectId.get(objectId)!)
    return [...roomOrdered, ...heldOnly]
}
