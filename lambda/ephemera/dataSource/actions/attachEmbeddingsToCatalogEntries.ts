import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import type { RoomInPlayObjectCatalogEntry } from './roomObjectCatalogForCharacter'

export function catalogObjectIdsUnion(
    room: readonly RoomInPlayObjectCatalogEntry[],
    held: readonly RoomInPlayObjectCatalogEntry[] = []
): EphemeraObjectId[] {
    return [...new Set([
        ...room.map(({ objectId }) => objectId),
        ...held.map(({ objectId }) => objectId),
    ])]
}

export function attachEmbeddingsToCatalogEntries(
    entries: readonly RoomInPlayObjectCatalogEntry[],
    embeddingMap: Record<EphemeraObjectId, SemanticEmbedding | undefined>
): RoomInPlayObjectCatalogEntry[] {
    return entries.map((entry) => ({
        ...entry,
        embedding: embeddingMap[entry.objectId],
    }))
}
