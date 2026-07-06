import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraPositionGraph } from '../../positionGraph'
import type { HostRelationalPatch } from '../types'

export type RelationalIngressOperation = 'establish' | 'dissolve'

export type RelationalIngressArgs = {
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    roomId: EphemeraRoomId
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
    operation: RelationalIngressOperation
}

export type RelationalPatchPlan = {
    patch: HostRelationalPatch
    changed: boolean
}

export type PlanHostRelationalPatchDependencies = {
    getPositionGraph?: (hostId: EphemeraRoomId) => Promise<EphemeraPositionGraph>
}

export type RelationalApplyResult =
    | { ok: true; changed: boolean; beatAnchorTime?: number }
    | { ok: false; errorCode: string; errorMessage: string }
