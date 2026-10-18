import type { EphemeraFeatureId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraFeatureId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraLudicTerminalsEqual } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import internalCache from '../../../../internalCache'
import type { PopulateContainmentAtCacheDependencies } from './populateContainmentAtCache'
import { migrateBaseAtCache } from './migrateBaseAtCache'
import { populateContainmentAtCache } from './populateContainmentAtCache'

/**
 * The `Containment Population Drift Finding` consumer: reruns cache-time containment population
 * for one parent without the asset diff `Component Updated` needs (`cacheAsset` emits only for
 * components that changed, so an unchanged asset never reaches population again).
 *
 * The children are the Room/Feature sources of the `PartOf` edges into `parentId` --- what an
 * earlier population left on the parent's own graph --- so this heals what was populated, it does
 * not discover authored children that never were. All judging is `populateContainmentAtCache`'s
 * (via `containmentPopulationSteps`): a binding in the old shape is repaired in place, a room
 * parent gets its hostless remainder, and a clean parent commits nothing. First the parent's own graph
 * is migrated to `PRESENCE#Base` (`migrateBaseAtCache`), which is what the sweep's stored-data finding
 * (c) asks for.
 *
 * **Never call this from a read path.** It is a write-carrying repair, run only from the finding
 * consumer or a manual invocation, as `healLudicGraphStructure` is.
 */
export const healContainmentPopulation = async (
    parentId: EphemeraMembershipHostId,
    deps: PopulateContainmentAtCacheDependencies
): Promise<void> => {
    // First, so population reads a parent that already has its Base (monotoneCovers Slice 5). A parent the
    // migration declines (a member with no binding to list) is populated no further than it was.
    await migrateBaseAtCache(parentId, deps)
    const parentGraph = await internalCache.Positions.getLudicGraph(parentId)
    const childIds = [...new Set(
        parentGraph.relationalEdges.flatMap((edge) => (
            edge.kind === 'PartOf' &&
            ephemeraLudicTerminalsEqual(edge.to, parentId) &&
            typeof edge.from === 'string' &&
            (isEphemeraRoomId(edge.from) || isEphemeraFeatureId(edge.from))
                ? [edge.from as EphemeraRoomId | EphemeraFeatureId]
                : []
        ))
    )]
    await populateContainmentAtCache(parentId, childIds, deps)
}
