import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { ObjectRelationChangedPublishedPayload } from '../../publishedEvents'
import type { RelationalIngressOperation } from './types'

export const buildObjectRelationalFact = (args: {
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    hostRoomId: EphemeraRoomId
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
    operation: RelationalIngressOperation
    beatAnchorTime: number
}): ObjectRelationChangedPublishedPayload => ({
    type: 'Object Relation Changed',
    subjectId: args.subjectId,
    targetId: args.targetId,
    hostRoomId: args.hostRoomId,
    relationKind: args.relationKind,
    ...(args.relationLabel !== undefined ? { relationLabel: args.relationLabel } : {}),
    operation: args.operation,
    beatAnchorTime: args.beatAnchorTime,
})
