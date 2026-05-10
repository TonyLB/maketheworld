import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

import { classifyImportVerticalSets } from './importVerticalClassification'
import { META_IMPORT_PREFIX, metaImportDataCategory } from './keys'
import { componentRowsFromUniversalPartitionLines } from './partitionComponentRows'
import { deriveRawImportVerticalHopsFromComponents, salvageImportVerticalHops } from './salvage'

/**
 * Import-vertical consistency orchestration (authoritative partition vs `Meta::Import::...` projection).
 * Other gateway trees can use the same `consistency.ts` filename next to their domain helpers.
 */

/** Universal-key partition row shape shared with {@link componentRowsFromUniversalPartitionLines}. */
export type ImportVerticalUniversalPartitionRow = StandardComponentData & {
    AssetId: string
    DataCategory: string
}

/**
 * Loads authoritative cached component lines for one universal component partition (same envelope as
 * `syncImportVerticalPartition` / diagnostics sweep).
 */
export interface ImportVerticalAuthoritativePartitionLoader {
    loadPartitionRows(universalKey: EphemeraId): Promise<ReadonlyArray<ImportVerticalUniversalPartitionRow>>
}

/**
 * Loads projected `Meta::Import::...` index rows for the same partition (repair/delete targets).
 * Callers may use the same storage snapshot as {@link ImportVerticalAuthoritativePartitionLoader} (e.g. one
 * shared `Query` promise) or separate reads; `check()` still defensively filters using the `Meta::Import::...`
 * prefix from **`keys`** (`META_IMPORT_PREFIX`).
 */
export interface ImportVerticalMetaImportProjectionLoader {
    loadMetaImportRows(universalKey: EphemeraId): Promise<ReadonlyArray<{ DataCategory: string }>>
}

export type ImportVerticalConsistencyAnalyzerDeps = {
    authoritativePartition: ImportVerticalAuthoritativePartitionLoader
    metaImportProjection: ImportVerticalMetaImportProjectionLoader
}

export type ImportVerticalConsistencyClassification = 'aligned' | 'missing' | 'orphan' | 'stale'

export type ImportVerticalConsistencyFindings = {
    universalKey: EphemeraId
    classification: ImportVerticalConsistencyClassification
    expectedCategories: readonly string[]
    existingCategories: readonly string[]
    /** `Meta::Import::...` categories present in authoritative derivation but missing from the index. */
    categoriesToAdd: readonly string[]
    /** Index rows to remove (minimal shape sufficient for `assetDB.deleteItem`). */
    metaRowsToDelete: ReadonlyArray<{ DataCategory: string }>
}

export class ImportVerticalConsistencyAnalyzer {
    private findings: ImportVerticalConsistencyFindings | undefined

    constructor(private readonly deps: ImportVerticalConsistencyAnalyzerDeps) {}

    /**
     * Loads via injected deps, runs derive/salvage/meta category pipeline, classifies, and stores findings.
     */
    async check(universalKey: EphemeraId): Promise<void> {
        const [partitionRows, metaRowsRaw] = await Promise.all([
            this.deps.authoritativePartition.loadPartitionRows(universalKey),
            this.deps.metaImportProjection.loadMetaImportRows(universalKey),
        ])
        const metaRows = metaRowsRaw.filter(
            (r) => typeof r.DataCategory === 'string' && r.DataCategory.startsWith(META_IMPORT_PREFIX)
        )

        const componentRows = componentRowsFromUniversalPartitionLines(partitionRows)
        const raw = deriveRawImportVerticalHopsFromComponents(componentRows)
        const salvaged = salvageImportVerticalHops(raw)

        const expectedCategories = new Set(
            salvaged.map((h) =>
                metaImportDataCategory({
                    parentAssetId: h.parentAssetId,
                    childAssetId: h.childAssetId,
                })
            )
        )

        const existingCategories = new Set(metaRows.map((r) => r.DataCategory))

        const classification = classifyImportVerticalSets(expectedCategories, existingCategories)

        const metaRowsToDelete = metaRows.filter((r) => !expectedCategories.has(r.DataCategory))
        const categoriesToAdd = [...expectedCategories].filter((dc) => !existingCategories.has(dc))

        this.findings = {
            universalKey,
            classification,
            expectedCategories: Object.freeze([...expectedCategories].sort()),
            existingCategories: Object.freeze([...existingCategories].sort()),
            categoriesToAdd: Object.freeze([...categoriesToAdd].sort()),
            metaRowsToDelete: Object.freeze(metaRowsToDelete.map((r) => ({ DataCategory: r.DataCategory }))),
        }
    }

    getFindings(): ImportVerticalConsistencyFindings {
        if (!this.findings) {
            throw new Error('ImportVerticalConsistencyAnalyzer.getFindings requires a successful check() first')
        }
        return this.findings
    }

    getClassification(): ImportVerticalConsistencyClassification {
        return this.getFindings().classification
    }
}
