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
    /** Internal relational edges (BD-13) carried along with the host effects, bundled into the same atomic write. */
    edgeCarries?: HostRelationalEdgeCarry[]
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

/**
 * One relational edge carried along to a fixed destination host (Room or
 * Character), used when a carried object set moves hosts and an existing edge
 * among the carried objects (e.g. `glass On tray`) must be re-materialized on the
 * destination host graph (BD-13). This is a *carry*, not an *add*: the edge already
 * existed --- it is not player-initiated establish/dissolve (that pathway is
 * Room-only, see HostRelationalPatch / BD-6) --- it is a mechanical consequence of
 * a membership move preserving a pre-existing fact, so there is no `op` field.
 * Deliberately kept separate from `HostRelationalPatch` even after that pathway
 * generalizes beyond Room-only hosts (BD-15/BD-16): the two answer different
 * questions (carry an existing fact across a move vs. create or destroy a fact
 * outright), not just "which hosts are legal."
 */
export type HostRelationalEdgeCarry = {
    hostId: EphemeraMembershipHostId
    edge: HostRelationalEdge
}
