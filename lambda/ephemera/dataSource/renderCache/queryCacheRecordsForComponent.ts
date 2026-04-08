/**
 * DataSource-owned Dynamo query for all `CACHE#...` rows under a component.
 *
 * This is intentionally in the DataSource "data-domain" so runtime layers (e.g.
 * `internalCache`) can couple only via an injected boundary function.
 */
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraCacheComponentId, EphemeraCacheDynamoItem } from './baseClasses'
import { EPHEMERA_CACHE_DATA_CATEGORY_PREFIX, isEphemeraCacheDynamoItem } from './baseClasses'

export type QueryCacheRecordsForComponentFn = (
    componentId: EphemeraCacheComponentId
) => Promise<EphemeraCacheDynamoItem[]>

/**
 * Query all cache records for a component (Room, Feature, or Knowledge).
 * Returns items including DataCategory for use with [`deleteCacheRecord`](./deleteCacheRecord.ts).
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

