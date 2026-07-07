import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    isEphemeraObjectEmbedding,
    type EphemeraObjectEmbedding,
} from '@tonylb/mtw-interfaces/ts/ephemeraEmbedding'
import {
    SemanticEmbedding,
    type SemanticEmbeddingDynamoRecord,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { EMBEDDING_IMPROMPTU_DATA_CATEGORY } from './keys'

export type EphemeraObjectEmbeddingReadDB = {
    getItems: (props: {
        Keys: { EphemeraId: EphemeraObjectId; DataCategory: typeof EMBEDDING_IMPROMPTU_DATA_CATEGORY }[]
        getAllFields: true
    }) => Promise<EphemeraObjectEmbedding[]>
}

const rowToSemanticEmbedding = (row: unknown): SemanticEmbedding | undefined => {
    if (!isEphemeraObjectEmbedding(row)) {
        return undefined
    }
    return SemanticEmbedding.fromDynamoRecord(row.embedding as SemanticEmbeddingDynamoRecord)
}

/**
 * Batch read EMBEDDING#IMPROMPTU rows for OBJECT# ids.
 * Missing or invalid rows map to undefined (not an error).
 */
export async function fetchObjectEmbeddingsImpromptu(
    db: EphemeraObjectEmbeddingReadDB,
    objectIds: readonly EphemeraObjectId[]
): Promise<Record<EphemeraObjectId, SemanticEmbedding | undefined>> {
    if (objectIds.length === 0) {
        return {}
    }

    const keys = objectIds.map((objectId) => ({
        EphemeraId: objectId,
        DataCategory: EMBEDDING_IMPROMPTU_DATA_CATEGORY,
    }))

    const returnValues = await db.getItems({
        Keys: keys,
        getAllFields: true,
    })

    const byObjectId = new Map<EphemeraObjectId, SemanticEmbedding>()
    for (const row of returnValues) {
        const embedding = rowToSemanticEmbedding(row)
        if (embedding && isEphemeraObjectEmbedding(row)) {
            byObjectId.set(row.EphemeraId, embedding)
        }
    }

    return objectIds.reduce<Record<EphemeraObjectId, SemanticEmbedding | undefined>>(
        (previous, objectId) => ({
            ...previous,
            [objectId]: byObjectId.get(objectId),
        }),
        {}
    )
}
