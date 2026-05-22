import { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    ImportVerticalConsistencyAnalyzer,
    type ImportVerticalConsistencyAnalyzerDeps,
} from '@tonylb/mtw-gateways/ts/assets/components/verticals'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'
import { exhaustivePartitionLoader } from './exhaustivePartitionLoader'

/**
 * Reconciles all `Meta::Import::...` rows for one universal component partition from authoritative
 * cached component rows (same derivation as live projector + heal).
 *
 * Authoritative partition reads use module-local `exhaustivePartitionLoader` (`exhaustiveScanCache`
 * subpath). `Meta::Import` projection uses `internalCache.ComponentVerticals`.
 */
export async function syncImportVerticalPartition(universalKey: EphemeraId): Promise<void> {
    const deps: ImportVerticalConsistencyAnalyzerDeps = {
        authoritativeComponentData: exhaustivePartitionLoader,
        metaImportProjection: internalCache.ComponentVerticals,
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
