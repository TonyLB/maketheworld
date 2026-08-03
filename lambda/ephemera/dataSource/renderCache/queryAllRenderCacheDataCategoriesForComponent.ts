/**
 * DataSource-owned Dynamo query for every render-cache `DataCategory` under a component ---
 * both `CACHE#...` rows and `Cache::...` catalog rows. Used to enumerate a full host teardown
 * (e.g. object removal) for `Delete Cache Records`.
 */
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import {
    queryCacheRowsForComponent,
    queryCatalogRowsForComponent,
    type EphemeraCacheComponentId,
} from '@tonylb/mtw-gateways/ts/ephemera/renderCache'

export type QueryAllRenderCacheDataCategoriesForComponentFn = (
    componentId: EphemeraCacheComponentId
) => Promise<string[]>

export async function queryAllRenderCacheDataCategoriesForComponent(
    componentId: EphemeraCacheComponentId
): Promise<string[]> {
    const [cacheRows, catalogRows] = await Promise.all([
        queryCacheRowsForComponent(ephemeraDB, componentId),
        queryCatalogRowsForComponent(ephemeraDB, componentId),
    ])
    return [
        ...cacheRows.map((row) => row.DataCategory),
        ...catalogRows.map((row) => row.DataCategory),
    ]
}
