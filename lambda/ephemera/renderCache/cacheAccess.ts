//
// Ephemera render cache access layer
//
// Query, put, and delete CACHE# records in ephemeraDB. Each record is keyed by
// EphemeraId (componentId) and DataCategory (CACHE#uuid). For ExampleRemoved:
// call queryCacheRecordsForComponent(componentId), filter by situationId or
// authoredExampleId (depending on event exampleId), then deleteCacheRecord for each match.
//

import { v4 as uuidv4 } from 'uuid'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraCacheComponentId, EphemeraCacheDynamoItem } from './baseClasses'
import {
    EPHEMERA_CACHE_DATA_CATEGORY_PREFIX,
    isEphemeraCacheDynamoItem
} from './baseClasses'

export type PutCacheRecordInput = {
    markState: EphemeraCacheDynamoItem['markState'];
    renderedContent: EphemeraCacheDynamoItem['renderedContent'];
    provenance: EphemeraCacheDynamoItem['provenance'];
    perspectiveId: EphemeraCacheDynamoItem['perspectiveId'];
    situationId?: EphemeraCacheDynamoItem['situationId'];
    authoredExampleId?: EphemeraCacheDynamoItem['authoredExampleId'];
};

/**
 * Query all cache records for a component (Room, Feature, or Knowledge).
 * Returns items including DataCategory for use with deleteCacheRecord.
 * Filtering by situationId or authoredExampleId is done by callers (e.g. ExampleRemoved).
 */
export async function queryCacheRecordsForComponent(
    componentId: EphemeraCacheComponentId
): Promise<EphemeraCacheDynamoItem[]> {
    const raw = await ephemeraDB.query<EphemeraCacheDynamoItem>({
        Key: { EphemeraId: componentId },
        KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
        ExpressionAttributeValues: { ':dcPrefix': EPHEMERA_CACHE_DATA_CATEGORY_PREFIX },
        allFields: true
    })
    return raw.filter(isEphemeraCacheDynamoItem)
}

/**
 * Write a single cache record. Assigns a new CACHE#uuid as DataCategory.
 * Returns the assigned dataCategory for use with deleteCacheRecord if needed.
 */
export async function putCacheRecord(
    componentId: EphemeraCacheComponentId,
    record: PutCacheRecordInput
): Promise<string> {
    const dataCategory = EPHEMERA_CACHE_DATA_CATEGORY_PREFIX + uuidv4()
    const item: EphemeraCacheDynamoItem = {
        EphemeraId: componentId,
        DataCategory: dataCategory,
        markState: record.markState,
        renderedContent: record.renderedContent,
        provenance: record.provenance,
        perspectiveId: record.perspectiveId,
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
