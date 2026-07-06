import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraPositionGraph } from '../positionGraph'

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

export type ApplyHostEffectsArgs = {
    hostEffects: HostEffect[]
}

export type ApplyHostEffectsSuccess = {
    ok: true
    persisted: true
    changed: boolean
    postApplyGraphs: EphemeraPositionGraph[]
}

export type ApplyHostEffectsResult =
    | ApplyHostEffectsSuccess
    | { ok: true; persisted: false; changed: false }
    | { ok: false; errorCode: string; errorMessage: string }

export type HostRelationalEdge = {
    from: EphemeraObjectId
    to: EphemeraObjectId
    kind: HostRelationalEdgeKind
    relationLabel?: string
}

/** One add/remove of an in-host relational edge on a fixed room host graph. */
export type HostRelationalPatch = {
    hostId: EphemeraRoomId
    edge: HostRelationalEdge
    op: 'add' | 'remove'
}

export type ApplyHostRelationalPatchArgs = {
    patches: HostRelationalPatch[]
}

export type ApplyHostRelationalPatchSuccess = {
    ok: true
    persisted: true
    changed: boolean
    postApplyGraphs: EphemeraPositionGraph[]
}

export type ApplyHostRelationalPatchResult =
    | ApplyHostRelationalPatchSuccess
    | { ok: true; persisted: false; changed: false }
    | { ok: false; errorCode: string; errorMessage: string }
