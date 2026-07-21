import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

export type RelationalIngressOperation = 'establish' | 'dissolve'

export type RelationalIngressArgs = {
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    hostId: EphemeraMembershipHostId
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
    operation: RelationalIngressOperation
    // BD-16 sameHost repair (2026-07-21): present when expandSameHost found the subject
    // on a different host than the relation's --- the compound apply must move it here
    // atomically with the relation, not as a separate command.
    transferFromHostId?: EphemeraMembershipHostId
}

export type RelationalApplyResult =
    | { ok: true; changed: boolean; beatAnchorTime?: number }
    | { ok: false; errorCode: string; errorMessage: string }
