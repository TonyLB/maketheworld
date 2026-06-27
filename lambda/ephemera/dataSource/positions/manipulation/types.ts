import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

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
    postApplyGraphs: Partial<Record<EphemeraMembershipHostId, EphemeraPlayPositionGraph>>
}

export type ApplyHostEffectsResult =
    | ApplyHostEffectsSuccess
    | { ok: true; persisted: false; changed: false }
    | { ok: false; errorCode: string; errorMessage: string }
