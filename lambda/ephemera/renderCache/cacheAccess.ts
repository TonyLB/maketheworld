//
// Ephemera render cache access layer
//
// Put and delete CACHE# records in ephemeraDB. Each record is keyed by
// EphemeraId (componentId) and DataCategory (CACHE#uuid). For ExampleRemoved:
// read matching rows via `internalCache.RenderCache` (invocation memo), then
// deleteCacheRecord for each match.
//

import { v4 as uuidv4 } from 'uuid'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraCacheComponentId, EphemeraCacheDynamoItem } from './baseClasses'
import {
    EPHEMERA_CACHE_DATA_CATEGORY_PREFIX
} from './baseClasses'

export type PutCacheRecordInput = {
    markState: EphemeraCacheDynamoItem['markState'];
    renderedContent: EphemeraCacheDynamoItem['renderedContent'];
    provenance: EphemeraCacheDynamoItem['provenance'];
    perspectiveId: EphemeraCacheDynamoItem['perspectiveId'];
    perspectiveMatcher: EphemeraCacheDynamoItem['perspectiveMatcher'];
    situationId?: EphemeraCacheDynamoItem['situationId'];
    authoredExampleId?: EphemeraCacheDynamoItem['authoredExampleId'];
};

/**
 * Write a single cache record. If existingDataCategory is provided and starts
 * with CACHE#, that key is used (overwrite in place). Otherwise a new
 * CACHE#uuid is assigned. Returns the DataCategory used.
 */
export async function putCacheRecord(
    componentId: EphemeraCacheComponentId,
    record: PutCacheRecordInput,
    existingDataCategory?: string
): Promise<string> {
    const dataCategory =
        existingDataCategory?.startsWith(EPHEMERA_CACHE_DATA_CATEGORY_PREFIX) === true
            ? existingDataCategory
            : EPHEMERA_CACHE_DATA_CATEGORY_PREFIX + uuidv4()
    const item: EphemeraCacheDynamoItem = {
        EphemeraId: componentId,
        DataCategory: dataCategory,
        markState: record.markState,
        renderedContent: record.renderedContent,
        provenance: record.provenance,
        perspectiveId: record.perspectiveId,
        perspectiveMatcher: record.perspectiveMatcher,
        ...(record.situationId !== undefined && { situationId: record.situationId }),
        ...(record.authoredExampleId !== undefined && { authoredExampleId: record.authoredExampleId })
    }
    await ephemeraDB.putItem(item)
    return dataCategory
}

/**
 * Delete the cache record with the given key. Idempotent.
 */
export async function deleteCacheRecord(
    componentId: EphemeraCacheComponentId,
    dataCategory: string
): Promise<void> {
    await ephemeraDB.deleteItem({ EphemeraId: componentId, DataCategory: dataCategory })
}
