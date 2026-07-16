import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { ObjectRelationChangedPublishedPayload } from '../../publishedEvents'
import type { RelationalIngressOperation } from './types'

export const buildObjectRelationalFact = (args: {
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    hostId: EphemeraMembershipHostId
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
    operation: RelationalIngressOperation
    beatAnchorTime: number
}): ObjectRelationChangedPublishedPayload => ({
    type: 'Object Relation Changed',
    subjectId: args.subjectId,
    targetId: args.targetId,
    hostId: args.hostId,
    relationKind: args.relationKind,
    ...(args.relationLabel !== undefined ? { relationLabel: args.relationLabel } : {}),
    operation: args.operation,
    beatAnchorTime: args.beatAnchorTime,
})
