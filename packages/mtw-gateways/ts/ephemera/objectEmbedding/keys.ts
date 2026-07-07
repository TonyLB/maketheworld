import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { EMBEDDING_IMPROMPTU_DATA_CATEGORY } from '@tonylb/mtw-interfaces/ts/ephemeraEmbedding'

export { EMBEDDING_IMPROMPTU_DATA_CATEGORY }

/** v1: one impromptu embedding row per OBJECT#; cache key is the object id. */
export const objectEmbeddingCacheKey = (objectId: EphemeraObjectId): EphemeraObjectId => objectId
