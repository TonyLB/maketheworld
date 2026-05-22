/**
 * MAINTENANCE / DIAGNOSTICS ONLY --- partition enumerate on a universal component id.
 *
 * NEVER use on:
 * - Ephemera resolve / hydrate / render paths
 * - ComponentAggregate steady-state merge
 * - componentExamples mirroring or API hot paths
 *
 * Allowed call sites (whitelist):
 * - lambda/assets/dataSource/components/verticals/syncImportVerticalPartition.ts
 * - lambda/assets/dataSource/components/verticals/healComponentVertical.ts
 * - lambda/diagnostics/componentVerticalMisalignmentSweep
 * - packages/mtw-gateways/ts/assets/components/verticals/consistency (ImportVerticalConsistencyAnalyzer)
 *
 * Rationale: vertical index maintenance must see every (childAssetId, _from) on the universal partition.
 * Import via subpath only --- not re-exported from componentData/index.ts.
 */

import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

import { authoritativeComponentDataFromUniversalPartitionRows, type AuthoritativeComponentData } from './dynamoStandardComponents'

/**
 * Narrow `assetDB` slice for universal-key partition `Query` (maintenance paths only).
 */
export type ExhaustivePartitionAssetDB = {
    query: <T extends StandardComponentData & { AssetId: string; DataCategory: string }>(props: {
        Key: { AssetId: string }
        allFields: true
    }) => Promise<T[] | undefined>
}

/** @deprecated Prefer {@link ExhaustivePartitionAssetDB}. */
export type AuthoritativeComponentPartitionAssetDB = ExhaustivePartitionAssetDB

/**
 * Full-partition scan for one universal component id. Maintenance/diagnostics only.
 */
export async function exhaustiveComponentPartitionScan(
    assetDB: ExhaustivePartitionAssetDB,
    universalKey: EphemeraId
): Promise<AuthoritativeComponentData> {
    const ndjsonLines =
        (await assetDB.query<StandardComponentData & { AssetId: string; DataCategory: string }>({
            Key: { AssetId: universalKey },
            allFields: true,
        })) || []
    return authoritativeComponentDataFromUniversalPartitionRows(universalKey, ndjsonLines)
}
