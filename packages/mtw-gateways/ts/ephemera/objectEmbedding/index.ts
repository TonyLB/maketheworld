export { EMBEDDING_IMPROMPTU_DATA_CATEGORY, objectEmbeddingCacheKey } from './keys'

export type { EphemeraObjectEmbeddingReadDB } from './fetch'
export { fetchObjectEmbeddingsImpromptu } from './fetch'

export {
    ObjectEmbeddingCacheHandler,
    createObjectEmbeddingCacheHandler,
} from './factory'
