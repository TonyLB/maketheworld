import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalPrimitive, HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { ObjectRelationChangedPublishedPayload } from '../../publishedEvents'
import type { RelationalIngressOperation } from './types'

// LP4g: renamed from buildObjectRelationalFact --- subjectId/targetId widened to
// EphemeraLudicTerminalPrimitive, so `Object` in the old name was a restriction the
// code no longer has. The published payload's type name and wire `type` string
// ('Object Relation Changed') are left alone --- they're load-bearing for existing
// stream consumers/stored events, and renaming them is a separate, unforced change.
export const buildRelationalFact = (args: {
    subjectId: EphemeraLudicTerminalPrimitive
    targetId: EphemeraLudicTerminalPrimitive
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
