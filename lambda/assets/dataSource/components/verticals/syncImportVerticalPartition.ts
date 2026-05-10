import { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    ImportVerticalConsistencyAnalyzer,
    queryImportVerticalMeta,
    type ImportVerticalConsistencyAnalyzerDeps,
} from '@tonylb/mtw-gateways/ts/assets/components/verticals'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'

/**
 * Reconciles all `Meta::Import::...` rows for one universal component partition from authoritative
 * cached component rows (same derivation as live projector + heal).
 *
 * Cold path: `internalCache.ComponentData.get` (partition query) plus a narrow `Meta::Import` query;
 * see `lambda/assets/internalCache/AGENT.md` for future shared partition memoization.
 */
export async function syncImportVerticalPartition(universalKey: EphemeraId): Promise<void> {
    const deps: ImportVerticalConsistencyAnalyzerDeps = {
        authoritativeComponentData: internalCache.ComponentData,
        metaImportProjection: {
            loadMetaImportRows: async (uk) => {
                const hops = await queryImportVerticalMeta(assetDB, uk)
                return hops.map((h) => ({ DataCategory: h.dataCategory }))
            },
        },
    }

    const analyzer = new ImportVerticalConsistencyAnalyzer(deps)
    await analyzer.check(universalKey)
    const { categoriesToAdd, metaRowsToDelete } = analyzer.getFindings()

    await Promise.all(
        metaRowsToDelete.map((r) =>
            assetDB.deleteItem({
                AssetId: universalKey,
                DataCategory: r.DataCategory,
            })
        )
    )

    await Promise.all(
        categoriesToAdd.map((DataCategory) =>
            assetDB.putItem({
                AssetId: universalKey,
                DataCategory,
            })
        )
    )

    internalCache.ComponentVerticals.invalidate(universalKey)
}
