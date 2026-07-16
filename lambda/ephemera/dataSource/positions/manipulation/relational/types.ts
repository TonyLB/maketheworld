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
}

export type RelationalApplyResult =
    | { ok: true; changed: boolean; beatAnchorTime?: number }
    | { ok: false; errorCode: string; errorMessage: string }
