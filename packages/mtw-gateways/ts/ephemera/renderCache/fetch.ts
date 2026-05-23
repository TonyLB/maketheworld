import type { QueryKeyProps } from '@tonylb/mtw-utilities/ts/dynamoDB/mixins/query'

import {
    buildCacheCatalogDataCategory,
    EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX,
    EPHEMERA_CACHE_DATA_CATEGORY_PREFIX,
} from './keys'
import {
    isEphemeraCacheCatalogRow,
    isEphemeraCacheDynamoItem,
    type EphemeraCacheCatalogRow,
    type EphemeraCacheComponentId,
    type EphemeraCacheDynamoItem,
} from './types'

type EphemeraRenderCacheReadDBQueryExtendedProps = Partial<{
    KeyConditionExpression: string
    ExpressionAttributeValues: Record<string, unknown>
    allFields: boolean
    getAllFields: boolean
}>

type EphemeraRenderCacheReadDBQueryProps = QueryKeyProps<'EphemeraId', string> &
    EphemeraRenderCacheReadDBQueryExtendedProps

export type EphemeraRenderCacheReadDB = {
    query<Item extends Record<string, unknown>>(props: EphemeraRenderCacheReadDBQueryProps): Promise<Item[]>
    getItem<Item extends Record<string, unknown>>(props: {
        Key: { EphemeraId: string; DataCategory: string }
        getAllFields?: boolean
    }): Promise<Item | undefined>
}

export async function queryCacheRowsForComponent(
    db: EphemeraRenderCacheReadDB,
    componentId: EphemeraCacheComponentId
): Promise<EphemeraCacheDynamoItem[]> {
    const raw = await db.query<EphemeraCacheDynamoItem>({
        Key: { EphemeraId: componentId },
        KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
        ExpressionAttributeValues: { ':dcPrefix': EPHEMERA_CACHE_DATA_CATEGORY_PREFIX },
        allFields: true,
    })
    return raw.filter(isEphemeraCacheDynamoItem)
}

export async function queryCatalogRowsForComponent(
    db: EphemeraRenderCacheReadDB,
    componentId: EphemeraCacheComponentId
): Promise<EphemeraCacheCatalogRow[]> {
    const raw = await db.query<EphemeraCacheCatalogRow>({
        Key: { EphemeraId: componentId },
        KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
        ExpressionAttributeValues: { ':dcPrefix': EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX },
        allFields: true,
    })
    return raw.filter(isEphemeraCacheCatalogRow)
}

export async function getCatalogRow(
    db: EphemeraRenderCacheReadDB,
    componentId: EphemeraCacheComponentId,
    perspectiveKey: string
): Promise<EphemeraCacheCatalogRow | undefined> {
    const item = await db.getItem<EphemeraCacheCatalogRow>({
        Key: {
            EphemeraId: componentId,
            DataCategory: buildCacheCatalogDataCategory(perspectiveKey),
        },
        getAllFields: true,
    })
    return item && isEphemeraCacheCatalogRow(item) ? item : undefined
}
