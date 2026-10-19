import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { PopulateContainmentAtCacheDependencies } from './populateContainmentAtCache'
import { populateContainmentAtCache } from './populateContainmentAtCache'
import { authoredChildrenOf } from './authoredChildren'

/**
 * The `Fixed Containment Drift Finding` consumer: reruns cache-time containment population
 * for one parent without the asset diff `Component Updated` needs (`cacheAsset` emits only for
 * components that changed, so an unchanged asset never reaches population again).
 *
 * The children are the parent's authored list (`authoredChildrenOf`: the union of added nodes across
 * `Meta::<Tag>.cached`), not whatever an earlier population left on the graph, so a child that was
 * never populated, or lost its `PartOf` edge, is reached too. All judging is `populateContainmentAtCache`'s
 * (via `containmentPopulationSteps`): a binding in the old shape is repaired in place, a room
 * parent gets its hostless remainder, and a clean parent commits nothing.
 *
 * **Never call this from a read path.** It is a write-carrying repair, run only from the finding
 * consumer or a manual invocation, as `healLudicGraphStructure` is.
 */
export const healContainmentPopulation = async (
    parentId: EphemeraMembershipHostId,
    deps: PopulateContainmentAtCacheDependencies
): Promise<void> => {
    const childIds = await authoredChildrenOf(parentId)
    await populateContainmentAtCache(parentId, childIds, deps)
}
