import type { AggregatePerspective } from '../aggregate/input'
import type { MergedComponentResult } from '../aggregate/result'

/**
 * Narrow port for batch assembly: same get contract as ComponentAggregateMergedCache.
 */
export type ComponentExamplesAggregatePort = {
    get(perspectives: readonly AggregatePerspective[]): Promise<readonly MergedComponentResult[]>
}
