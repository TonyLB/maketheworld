import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

export type RelationalIngressOperation = 'establish' | 'dissolve'

export type RelationalIngressArgs = {
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    hostId: EphemeraMembershipHostId
    operation: RelationalIngressOperation
} & RelationalKindAndLabel

export type RelationalApplyResult =
    | { ok: true; changed: boolean; beatAnchorTime?: number }
    | { ok: false; errorCode: string; errorMessage: string }
