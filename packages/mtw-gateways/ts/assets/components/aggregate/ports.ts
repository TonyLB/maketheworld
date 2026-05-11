/**
 * Injectable ports for component aggregate assembly (compute-only gateway).
 *
 * Structurally identical to {@link ImportVerticalConsistencyAnalyzerDeps} from the
 * import-verticals reader. Field names match that type (`authoritativeComponentData`,
 * `metaImportProjection`). Prefer {@link ComponentAggregateInternalCacheSlice} for
 * lambda composition so property names match assets `internalCache` handlers.
 *
 * @see `ts/assets/components/verticals/consistency` (ImportVerticalConsistencyAnalyzerDeps).
 */
import type {
    ImportVerticalAuthoritativeComponentDataLoader,
    ImportVerticalConsistencyAnalyzerDeps,
    ImportVerticalMetaImportProjectionLoader,
} from '../verticals/consistency'

export type AggregateGatewayDeps = ImportVerticalConsistencyAnalyzerDeps

/**
 * Narrow slice of the assets lambda `internalCache` used for component aggregate assembly:
 * `ComponentData` and `ComponentVerticals` (see `lambda/assets/internalCache/index.ts`; tier-1 factories from **`mtw-gateways`**).
 * Other lambdas may supply the same loader contracts under different concrete classes;
 * the default wiring path uses these handler names.
 */
export type ComponentAggregateInternalCacheSlice = {
    ComponentData: ImportVerticalAuthoritativeComponentDataLoader
    ComponentVerticals: ImportVerticalMetaImportProjectionLoader
}
