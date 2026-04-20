//
// Coyote hypothesis combine layer: hydrated clustering output for Stage Two (DTO).
//

import type { EphemeraRoomId } from './baseClasses'
import type { CoyoteAffinityPossibility } from './coyotePlanAffinities'

/** Golden path: correlation key string (`stableKey`). Degraded only: correlate by display + room. */
export type ClusterMemberIdentifier =
    | string
    | { shortName: string; roomId: EphemeraRoomId }

export type ClusterMemberPair = {
    identifier: ClusterMemberIdentifier
    intendedRole?: CoyoteAffinityPossibility
}

export type CombineClustersReturn = {
    clusters: Array<{
        clusterName: string
        members: ClusterMemberPair[]
    }>
    outliers: ClusterMemberPair[]
}
