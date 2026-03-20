//
// Ephemera render cache: types, constants, and access layer
//

export {
    queryCacheRecordsForComponent,
    putCacheRecord,
    deleteCacheRecord,
    type PutCacheRecordInput,
    type QueryCacheRecordsForComponentFn,
} from './cacheAccess'

export {
    findExactMatch,
    findExactMatchForComponent,
    type FindExactMatchInput,
    type FindExactMatchForComponentInput,
    normalizeMarkState,
    markStatesEqual,
} from './exampleComparison'

export type {
    EphemeraCacheComponentId,
    EphemeraCacheMarkValue,
    EphemeraCacheMarkState,
    EphemeraCacheRenderedContent,
    EphemeraCacheProvenance,
    EphemeraCacheRecord,
    EphemeraCacheDynamoItem,
    EphemeraPerspectiveId,
    EphemeraAuthoredExampleId
} from './baseClasses'

export {
    EPHEMERA_CACHE_DATA_CATEGORY_PREFIX,
    EPHEMERA_CACHE_PROVENANCE_AUTHORED,
    EPHEMERA_CACHE_PROVENANCE_GENERATED,
    isEphemeraCacheDynamoItem
} from './baseClasses'

export {
    generateRoomPreview,
    type GenerateRoomPreviewInput,
    type GenerateRoomPreviewResult,
    type GenerateRoomPreviewSuccess,
    type GenerateRoomPreviewFailure
} from './generateRoomPreview'
