import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/** One graph-grounded membership-node add/remove on a fixed host (M4 v1). */
export type HostEffect =
    | { hostId: EphemeraRoomId; identityId: EphemeraCharacterId; op: 'add' | 'remove' }
    | { hostId: EphemeraRoomId; identityId: EphemeraObjectId; op: 'add' | 'remove' }
    | { hostId: EphemeraCharacterId; identityId: EphemeraObjectId; op: 'add' | 'remove' }

/** Membership host transfer semantics for bus facts and coordinator changed gates. */
export type MembershipTransferProjection = {
    froms: EphemeraMembershipHostId[]
    to: EphemeraMembershipHostId | null
    changed: boolean
}

/** Forward adapter output: kernel input + coordinator/fact fields from one planning pass. */
export type MembershipTransferPlan = {
    hostEffects: HostEffect[]
    projection: MembershipTransferProjection
}

export type HostRelationalEdge = {
    from: EphemeraObjectId
    to: EphemeraObjectId
    kind: HostRelationalEdgeKind
    relationLabel?: string
}

/**
 * One add/remove of an in-host relational edge on a fixed host graph (Room or
 * Character) --- `EphemeraPositionGraph.applyRelationalPatch`'s own input
 * shape (`positionGraph/index.ts`), still load-bearing after
 * `applyHostRelationalPatch.ts`/`planHostRelationalPatch.ts` retired (Migrate
 * slice, 2026-07-23): every relational-effect call site builds one of these
 * directly now instead of through that retired coordinator layer.
 */
export type HostRelationalPatch = {
    hostId: EphemeraMembershipHostId
    edge: HostRelationalEdge
    op: 'add' | 'remove'
}
