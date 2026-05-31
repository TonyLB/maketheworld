import type { QueryKeyProps } from '@tonylb/mtw-utilities/ts/dynamoDB/mixins/query'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    buildAffordanceDataCategory,
    EPHEMERA_AFFORDANCE_DATA_CATEGORY_PREFIX,
} from './keys'
import { isAffordanceCacheRow, type AffordanceCacheRow } from './types'

type EphemeraAffordanceCacheReadDBQueryExtendedProps = Partial<{
    KeyConditionExpression: string
    ExpressionAttributeValues: Record<string, unknown>
    allFields: boolean
    getAllFields: boolean
}>

type EphemeraAffordanceCacheReadDBQueryProps = QueryKeyProps<'EphemeraId', string> &
    EphemeraAffordanceCacheReadDBQueryExtendedProps

export type EphemeraAffordanceCacheReadDB = {
    query<Item extends Record<string, unknown>>(props: EphemeraAffordanceCacheReadDBQueryProps): Promise<Item[]>
    getItem<Item extends Record<string, unknown>>(props: {
        Key: { EphemeraId: string; DataCategory: string }
        getAllFields?: boolean
    }): Promise<Item | undefined>
}

export async function queryAffordanceRowsForRoom(
    db: EphemeraAffordanceCacheReadDB,
    roomId: EphemeraRoomId
): Promise<AffordanceCacheRow[]> {
    const raw = await db.query<AffordanceCacheRow>({
        Key: { EphemeraId: roomId },
        KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
        ExpressionAttributeValues: { ':dcPrefix': EPHEMERA_AFFORDANCE_DATA_CATEGORY_PREFIX },
        allFields: true,
    })
    return raw.filter(isAffordanceCacheRow)
}

export async function getAffordanceRowFromDynamo(
    db: EphemeraAffordanceCacheReadDB,
    roomId: EphemeraRoomId,
    perspectiveKey: string
): Promise<AffordanceCacheRow | undefined> {
    const item = await db.getItem<AffordanceCacheRow>({
        Key: {
            EphemeraId: roomId,
            DataCategory: buildAffordanceDataCategory(perspectiveKey),
        },
        getAllFields: true,
    })
    return item && isAffordanceCacheRow(item) ? item : undefined
}
