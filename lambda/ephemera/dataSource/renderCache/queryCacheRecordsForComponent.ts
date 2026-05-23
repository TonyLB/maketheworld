/**
 * DataSource-owned Dynamo query for all `CACHE#...` rows under a component.
 * Thin wrapper around mtw-gateways fetch (tests may mock this module).
 */
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import {
    queryCacheRowsForComponent,
    type EphemeraCacheComponentId,
    type EphemeraCacheDynamoItem,
} from '@tonylb/mtw-gateways/ts/ephemera/renderCache'

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
    return queryCacheRowsForComponent(ephemeraDB, componentId)
}
