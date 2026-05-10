import { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    ImportVerticalConsistencyAnalyzer,
    type ImportVerticalConsistencyAnalyzerDeps,
    type ImportVerticalUniversalPartitionRow,
    META_IMPORT_PREFIX,
} from '@tonylb/mtw-gateways/ts/assets/components/verticals'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'

/**
 * Reconciles all `Meta::Import::...` rows for one universal component partition from authoritative
 * cached component rows (same derivation as live projector + heal).
 */
export async function syncImportVerticalPartition(universalKey: EphemeraId): Promise<void> {
    let rowsPromise: Promise<ReadonlyArray<ImportVerticalUniversalPartitionRow>> | undefined
    const ensureRows = () => {
        rowsPromise ??= (async () => {
            const rows =
                (await assetDB.query<ImportVerticalUniversalPartitionRow>({
                    Key: { AssetId: universalKey },
                    allFields: true,
                })) || []
            return rows
        })()
        return rowsPromise
    }

    const deps: ImportVerticalConsistencyAnalyzerDeps = {
        authoritativePartition: {
            loadPartitionRows: async (uk) => {
                if (uk !== universalKey) {
                    throw new Error('syncImportVerticalPartition: loadPartitionRows called for unexpected universalKey')
                }
                return ensureRows()
            },
        },
        metaImportProjection: {
            loadMetaImportRows: async (uk) => {
                if (uk !== universalKey) {
                    throw new Error('syncImportVerticalPartition: loadMetaImportRows called for unexpected universalKey')
                }
                const rows = await ensureRows()
                return rows
                    .filter(
                        (r) =>
                            typeof r.DataCategory === 'string' &&
                            r.DataCategory.startsWith(META_IMPORT_PREFIX)
                    )
                    .map((r) => ({ DataCategory: r.DataCategory }))
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
