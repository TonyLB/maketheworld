/**
 * Injectable ports for component aggregate assembly (compute-only gateway).
 *
 * {@link ComponentAggregateInternalCacheSlice} uses participation-scoped `ComponentData`
 * (`getAcrossAssets` only). {@link AggregateGatewayDeps} / {@link AggregateParticipationAssemblyDeps}
 * mirror analyzer field names for secondary uncached gateways.
 *
 * @see `ts/assets/components/verticals/consistency` (ImportVerticalConsistencyAnalyzerDeps).
 */
import type { ComponentDataParticipationLoader } from '../componentData/componentDataCache'
import type {
    ImportVerticalConsistencyAnalyzerDeps,
    ImportVerticalMetaImportProjectionLoader,
} from '../verticals/consistency'

export type { ComponentDataParticipationLoader }

/**
 * Analyzer-shaped deps ({@link ExhaustivePartitionLoader} + vertical projection).
 * Not used for steady-state merge assembly ({@link ComponentAggregateInternalCacheSlice}).
 */
export type AggregateGatewayDeps = ImportVerticalConsistencyAnalyzerDeps

/**
 * Uncached merge assembly deps: participation-scoped bodies + vertical projection.
 * Field names match {@link ImportVerticalConsistencyAnalyzerDeps} for secondary gateways.
 */
export type AggregateParticipationAssemblyDeps = {
    authoritativeComponentData: ComponentDataParticipationLoader
    metaImportProjection: ImportVerticalMetaImportProjectionLoader
}

/**
 * Narrow slice of the assets lambda `internalCache` used for component aggregate assembly:
 * `ComponentData` (pair / participation) and `ComponentVerticals`.
 */
export type ComponentAggregateInternalCacheSlice = {
    ComponentData: ComponentDataParticipationLoader
    ComponentVerticals: ImportVerticalMetaImportProjectionLoader
}
