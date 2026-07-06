import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    EMBEDDING_IMPROMPTU_DATA_CATEGORY,
    type EphemeraObjectEmbedding,
} from '@tonylb/mtw-interfaces/ts/ephemeraEmbedding'
import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

export const embeddingRowFromArgs = (args: {
    objectId: EphemeraObjectId;
    embedding: SemanticEmbedding;
}): EphemeraObjectEmbedding => ({
    EphemeraId: args.objectId,
    DataCategory: EMBEDDING_IMPROMPTU_DATA_CATEGORY,
    embedding: args.embedding.toDynamoRecord(),
})

export const objectEmbeddingPutItem = (args: {
    objectId: EphemeraObjectId;
    embedding: SemanticEmbedding;
}) => ({
    Put: embeddingRowFromArgs(args),
})
