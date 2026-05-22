import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

import type { AuthoritativeComponentData } from '../../componentData/dynamoStandardComponents'
import { componentRowsFromAuthoritativeComponentData } from '../../componentData/dynamoStandardComponents'
import type { ImportVerticalHop } from '../fetch'
import { metaImportDataCategory } from '../keys'
import { deriveRawImportVerticalHopsFromComponents, salvageImportVerticalHops } from './salvage'

/** Same shape as {@link AuthoritativeComponentData}; stable name for import-vertical analyzer deps. */
export type ImportVerticalAuthoritativeComponentData = AuthoritativeComponentData

/**
 * Import-vertical consistency orchestration (authoritative partition vs `Meta::Import::...` projection).
 * Other gateway trees can use the same `consistency/` directory pattern next to their domain helpers.
 */

/** Universal-key partition row shape shared with {@link componentRowsFromUniversalPartitionLines}. */
export type ImportVerticalUniversalPartitionRow = StandardComponentData & {
    AssetId: string
    DataCategory: string
}

/**
 * Maintenance/diagnostics partition enumerate per universal id (`exhaustiveScanCache` subpath).
 * Whitelist call sites only --- not pair-addressed `internalCache.ComponentData`.
 */
export interface ExhaustivePartitionLoader {
    get(ComponentIds: EphemeraId[]): Promise<ReadonlyArray<ImportVerticalAuthoritativeComponentData>>
}

/**
 * @deprecated Use {@link ExhaustivePartitionLoader}. Same contract; old name implied assets
 * `internalCache.ComponentData`, which is no longer the blessed analyzer loader.
 */
export type ImportVerticalAuthoritativeComponentDataLoader = ExhaustivePartitionLoader

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
    authoritativeComponentData: ExhaustivePartitionLoader
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

/**
 * Per-partition: both orphan and missing rows implies stale (wrong hops). Analyzer-internal helper;
 * not exported. The asset-level rollup lives with the diagnostics sweep that consumes it.
 */
function classifyImportVerticalSets(
    expectedCategories: ReadonlySet<string>,
    existingCategories: ReadonlySet<string>
): ImportVerticalConsistencyClassification {
    let missing = false
    for (const x of expectedCategories) {
        if (!existingCategories.has(x)) missing = true
    }
    let orphan = false
    for (const x of existingCategories) {
        if (!expectedCategories.has(x)) orphan = true
    }
    if (!missing && !orphan) return 'aligned'
    if (missing && orphan) return 'stale'
    if (missing) return 'missing'
    return 'orphan'
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
