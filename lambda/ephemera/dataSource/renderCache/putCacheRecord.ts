//
// DataSource-owned Dynamo write: put CACHE# rows in ephemeraDB.
//
import { v4 as uuidv4 } from 'uuid'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import {
    EPHEMERA_CACHE_DATA_CATEGORY_PREFIX,
    type EphemeraCacheComponentId,
    type EphemeraCacheDynamoItem,
} from './baseClasses'

export type PutCacheRecordInput = {
    markState: EphemeraCacheDynamoItem['markState'];
    renderedContent: EphemeraCacheDynamoItem['renderedContent'];
    provenance: EphemeraCacheDynamoItem['provenance'];
    perspectiveId: EphemeraCacheDynamoItem['perspectiveId'];
    perspectiveMatcher: EphemeraCacheDynamoItem['perspectiveMatcher'];
    situationId?: EphemeraCacheDynamoItem['situationId'];
}

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
        ...(record.situationId !== undefined && { situationId: record.situationId })
    }
    await ephemeraDB.putItem(item)
    return dataCategory
}
