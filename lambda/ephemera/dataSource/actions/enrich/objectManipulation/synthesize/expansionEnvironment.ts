import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import type { ExpansionEnvironment } from './executorTypes'

/** Fresh per executor run --- the shared environment for one worklist's lifetime. */
export const createExpansionEnvironment = (
    getGraph: (hostId: EphemeraMembershipHostId) => EphemeraLudicGraph | undefined,
    getCurrentHost: (id: EphemeraObjectId) => EphemeraMembershipHostId | undefined,
    getMembershipContainers: (id: EphemeraPositionAdjacencyContainedId) => EphemeraMembershipHostId[] = () => []
): ExpansionEnvironment => ({
    getGraph,
    getCurrentHost,
    getMembershipContainers,
})
