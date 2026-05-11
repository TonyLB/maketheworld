/**
 * Injectable ports for component aggregate assembly (compute-only gateway).
 *
 * Structurally identical to {@link ImportVerticalConsistencyAnalyzerDeps} from the
 * import-verticals reader so assets lambda `ComponentData` and `ComponentVerticals`
 * (and other caches implementing the same loader shapes) wire in without adapters.
 *
 * @see `ts/assets/components/verticals/consistency` (ImportVerticalConsistencyAnalyzerDeps).
 */
import type { ImportVerticalConsistencyAnalyzerDeps } from '../verticals/consistency'

export type AggregateGatewayDeps = ImportVerticalConsistencyAnalyzerDeps
