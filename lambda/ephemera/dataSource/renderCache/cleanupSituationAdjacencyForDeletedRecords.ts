/**
 * `Delete Cache Records` generalization: for every deleted `CACHE#` row carrying a `situationId`
 * and every deleted `Cache::` catalog row (perspectiveKey), remove the corresponding Situation
 * adjacency `Link::` row(s) --- mirrors the per-row cleanup `hydrateAuthoredCatalogDiff.ts` already
 * does for its own (component, perspective) case, generalized to an arbitrary `dataCategories` set.
 *
 * Restricted to the rows named in `dataCategories` (not the host's full row set), so a partial
 * delete doesn't strip adjacency for rows that remain live. Takes the Cartesian product of
 * situationIds x perspectiveKeys within that restricted set --- correct for full-host teardown
 * (today's only caller, object removal); a future partial-delete caller spanning multiple
 * perspectives in one call would need per-row perspectiveKey correlation, which the `CACHE#` row
 * schema doesn't carry (see `baseClasses.ts`'s `EphemeraCacheDynamoItem`).
 */
import type { EphemeraSituationId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { perspectiveKeyFromCatalogDataCategory } from '@tonylb/mtw-gateways/ts/ephemera/renderCache'

import internalCache from '../../internalCache'
import type { EphemeraCacheComponentId } from './baseClasses'
import { deleteAdjacencyForRemovedSlice } from './situationAdjacency'

export async function cleanupSituationAdjacencyForDeletedRecords(
    componentId: EphemeraCacheComponentId,
    dataCategories: string[]
): Promise<void> {
    const dataCategorySet = new Set(dataCategories)

    const [cacheRows, catalogRows] = await Promise.all([
        internalCache.RenderCache.getCacheRows(componentId),
        internalCache.RenderCache.getCatalogRows(componentId),
    ])

    const situationIds = [
        ...new Set(
            cacheRows
                .filter((row) => dataCategorySet.has(row.DataCategory) && row.situationId !== undefined)
                .map((row) => row.situationId as EphemeraSituationId)
        ),
    ]

    const perspectiveKeys = [
        ...new Set(
            catalogRows
                .filter((row) => dataCategorySet.has(row.DataCategory))
                .map((row) => perspectiveKeyFromCatalogDataCategory(row.DataCategory))
                .filter((key): key is string => key !== undefined)
        ),
    ]

    if (situationIds.length === 0 || perspectiveKeys.length === 0) {
        return
    }

    await Promise.all(
        situationIds.flatMap((situationId) =>
            perspectiveKeys.map((perspectiveKey) =>
                deleteAdjacencyForRemovedSlice({ situationId, hostEphemeraId: componentId, perspectiveKey })
            )
        )
    )
}
