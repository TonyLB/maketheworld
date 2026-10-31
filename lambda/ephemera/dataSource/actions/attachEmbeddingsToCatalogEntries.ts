import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import type { RoomInPlayObjectCatalogEntry } from './actorObjectCatalog'

export function catalogObjectIds(entries: readonly RoomInPlayObjectCatalogEntry[]): EphemeraObjectId[] {
    return [...new Set(entries.map(({ objectId }) => objectId))]
}

export function attachEmbeddingsToCatalogEntries<Entry extends RoomInPlayObjectCatalogEntry>(
    entries: readonly Entry[],
    embeddingMap: Record<EphemeraObjectId, SemanticEmbedding | undefined>
): Entry[] {
    return entries.map((entry) => ({
        ...entry,
        embedding: embeddingMap[entry.objectId],
    }))
}
