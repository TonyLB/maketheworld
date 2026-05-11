import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

import type { AuthoritativeComponentData } from '../assetMeta/dynamoStandardComponents'
import { componentRowsFromAuthoritativeComponentData } from '../assetMeta/dynamoStandardComponents'
import type { ImportVerticalHop } from './fetch'
import { classifyImportVerticalSets } from './importVerticalClassification'
import { metaImportDataCategory } from './keys'
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
 * One projected `Meta::Import::...` envelope keyed by universal id. Mirrors the assets lambda
 * `internalCache.ComponentVerticals` cache entry shape so the cache satisfies
 * {@link ImportVerticalMetaImportProjectionLoader} structurally without a wrapper.
 */
export type ImportVerticalMetaImportProjectionEntry = {
    universalKey: EphemeraId
    hops: readonly ImportVerticalHop[]
}

/**
 * Loads projected `Meta::Import::...` hops per universal id (same contract as assets lambda
 * `internalCache.ComponentVerticals.get`). Implementations parse rows into {@link ImportVerticalHop}
 * before returning, so `check()` can rely on the hops being well-formed Meta::Import entries.
 */
export interface ImportVerticalMetaImportProjectionLoader {
    get(universalKeys: EphemeraId[]): Promise<ReadonlyArray<ImportVerticalMetaImportProjectionEntry>>
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
        const [cacheEntries, metaEntries] = await Promise.all([
            this.deps.authoritativeComponentData.get([universalKey]),
            this.deps.metaImportProjection.get([universalKey]),
        ])

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

        const metaEntry = metaEntries.find((entry) => entry.universalKey === universalKey)
        const metaHops = metaEntry?.hops ?? []
        const existingCategories = new Set(metaHops.map((h) => h.dataCategory))

        const classification = classifyImportVerticalSets(expectedCategories, existingCategories)

        const metaRowsToDelete = metaHops.filter((h) => !expectedCategories.has(h.dataCategory))
        const categoriesToAdd = [...expectedCategories].filter((dc) => !existingCategories.has(dc))

        this.findings = {
            universalKey,
            classification,
            expectedCategories: Object.freeze([...expectedCategories].sort()),
            existingCategories: Object.freeze([...existingCategories].sort()),
            categoriesToAdd: Object.freeze([...categoriesToAdd].sort()),
            metaRowsToDelete: Object.freeze(metaRowsToDelete.map((h) => ({ DataCategory: h.dataCategory }))),
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
