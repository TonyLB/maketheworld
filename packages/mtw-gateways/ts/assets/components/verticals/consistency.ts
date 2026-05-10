import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

import type { AuthoritativeComponentData } from '../assetMeta/dynamoStandardComponents'
import { componentRowsFromAuthoritativeComponentData } from '../assetMeta/dynamoStandardComponents'
import { classifyImportVerticalSets } from './importVerticalClassification'
import { META_IMPORT_PREFIX, metaImportDataCategory } from './keys'
import { deriveRawImportVerticalHopsFromComponents, salvageImportVerticalHops } from './salvage'

/** Same shape as {@link AuthoritativeComponentData}; stable name for import-vertical analyzer deps. */
export type ImportVerticalAuthoritativeComponentData = AuthoritativeComponentData

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
 * Loads authoritative parsed components per universal id (same contract as assets lambda
 * `internalCache.ComponentData.get`).
 */
export interface ImportVerticalAuthoritativeComponentDataLoader {
    get(ComponentIds: EphemeraId[]): Promise<ReadonlyArray<ImportVerticalAuthoritativeComponentData>>
}

/**
 * Loads projected `Meta::Import::...` index rows for the same partition (repair/delete targets).
 * Callers may use the same storage snapshot as {@link ImportVerticalAuthoritativeComponentDataLoader} (e.g. one
 * shared `Query` promise) or separate reads; `check()` still defensively filters using the `Meta::Import::...`
 * prefix from **`keys`** (`META_IMPORT_PREFIX`).
 */
export interface ImportVerticalMetaImportProjectionLoader {
    loadMetaImportRows(universalKey: EphemeraId): Promise<ReadonlyArray<{ DataCategory: string }>>
}

export type ImportVerticalConsistencyAnalyzerDeps = {
    authoritativeComponentData: ImportVerticalAuthoritativeComponentDataLoader
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
        const [cacheEntries, metaRowsRaw] = await Promise.all([
            this.deps.authoritativeComponentData.get([universalKey]),
            this.deps.metaImportProjection.loadMetaImportRows(universalKey),
        ])
        const metaRows = metaRowsRaw.filter(
            (r) => typeof r.DataCategory === 'string' && r.DataCategory.startsWith(META_IMPORT_PREFIX)
        )

        const authoritativeEntry =
            cacheEntries[0] ??
            ({
                ComponentId: universalKey,
                byAssets: [],
            } satisfies AuthoritativeComponentData)
        const componentRows = componentRowsFromAuthoritativeComponentData(authoritativeEntry)
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
