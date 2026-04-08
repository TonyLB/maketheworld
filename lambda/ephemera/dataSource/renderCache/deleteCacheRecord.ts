//
// DataSource-owned Dynamo delete: remove a CACHE# row from ephemeraDB.
//
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraCacheComponentId } from './baseClasses'

/**
 * Delete the cache record with the given key. Idempotent.
 */
export async function deleteCacheRecord(
    componentId: EphemeraCacheComponentId,
    dataCategory: string
): Promise<void> {
    await ephemeraDB.deleteItem({ EphemeraId: componentId, DataCategory: dataCategory })
}
