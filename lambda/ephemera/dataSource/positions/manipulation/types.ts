import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/** Membership host transfer semantics for bus facts and coordinator changed gates. */
export type MembershipTransferProjection = {
    froms: EphemeraMembershipHostId[]
    to: EphemeraMembershipHostId | null
    changed: boolean
}

/** Forward adapter output: the coordinator/fact projection from one planning pass. */
export type MembershipTransferPlan = {
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
 * Character) --- `EphemeraLudicGraph.applyRelationalPatch`'s own input
 * shape (`ludicGraph/index.ts`), still load-bearing after
 * `applyHostRelationalPatch.ts`/`planHostRelationalPatch.ts` retired (Migrate
 * slice, 2026-07-23): every relational-effect call site builds one of these
 * directly now instead of through that retired coordinator layer.
 */
export type HostRelationalPatch = {
    hostId: EphemeraMembershipHostId
    edge: HostRelationalEdge
    op: 'add' | 'remove'
}
