import { ephemeraLudicTerminalsEqual, isHostingRelationKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdge } from '../types'
import type { EphemeraLudicGraph } from '../../ludicGraph'

/**
 * The moved object's own containment edge into `fromGraph`'s root (if it was hosted there,
 * On/In/PartOf). It would otherwise hit `classifyInteractionUnderTransfer`'s hosting-kind throw ---
 * a correct invariant for every other shape reaching it, but not for the mover's own edge into the
 * host it is leaving. Extracted from `executeMembershipTransfer`'s former `honorDefer` block
 * (3d, 2026-09-08) so `buildObjectMoveOp` can strip it unconditionally rather than only when a
 * caller opted into a flag.
 */
export const findOwnRootContainmentEdge = (
    entityId: EphemeraObjectId,
    fromGraph: EphemeraLudicGraph
): HostRelationalEdge | undefined =>
    fromGraph.relationalEdges.find((edge) =>
        ephemeraLudicTerminalsEqual(edge.from, entityId)
        && ephemeraLudicTerminalsEqual(edge.to, fromGraph.rootId)
        && isHostingRelationKind(edge.kind))
