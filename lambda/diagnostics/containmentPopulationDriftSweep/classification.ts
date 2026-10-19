import { isEphemeraAreaId, isEphemeraFeatureId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraLudicTerminalsEqual } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { presenceGraphViewOf } from '../presenceCoverDriftSweep/classification'

type RawEdge = { kind?: unknown; from?: EphemeraLudicTerminalId; to?: EphemeraLudicTerminalId }

const edgesOf = (ludicGraph: unknown): RawEdge[] => {
    const edges = (ludicGraph as { edges?: unknown } | undefined)?.edges
    return Array.isArray(edges) ? edges as RawEdge[] : []
}

/** The children a fixed nesting can hold: Rooms in an Area, Features in a Room or Feature. Objects move, so they are never fixed. */
const isFixedChildOf = (parentId: string, childId: string): boolean => (
    isEphemeraAreaId(parentId) ? isEphemeraRoomId(childId) : isEphemeraFeatureId(childId)
)

/**
 * Whether a fixed nesting's parent has drifted from what its authored asset declares. The authored
 * child list is the setpoint (read from the asset rows by `authoredNestings.ts`); the stored
 * parent and child rows are what is judged. Read from raw rows, since this lambda cannot import
 * ephemera's graph class. A parent is drifted when any of these holds:
 *
 * - **Root:** a Room or Area has no binding lacking a parent pointer (the root of its presence
 *   tree, which it keeps whatever it contains; a row with no stored graph counts). A Feature's or
 *   Object's root becomes its placement, so it is not checked for one unless it hosts a fixed child.
 * - For each authored child that is a legal fixed nesting (`isFixedChildOf`):
 *   - the parent's node list lacks the child's node;
 *   - the parent's graph holds no `PartOf` edge from the child to the parent;
 *   - the child holds no binding pointing at the parent's root binding (a Room's binding into an
 *     Area must also be an empty-member carve-out).
 *
 * A stored nesting the asset no longer declares is not sensed: the contract defers removal for
 * Rooms and Features, so a finding would heal nothing. A parent holding several bindings names no
 * root for its children, so population refuses it; its children are not judged either. A row in a
 * shape the shared guard rejects is `LudicGraphStaleStructureSweep`'s.
 *
 * Every condition is one the consumer's population rerun repairs (once `healContainmentPopulation`
 * reads the authored list), so a finding is never one it would decline.
 */
export const isFixedContainmentDrifted = (
    parentId: string,
    parentGraph: unknown,
    authoredChildIds: readonly string[],
    childGraphOf: (childId: string) => unknown
): boolean => {
    const parent = presenceGraphViewOf(parentId, parentGraph)
    const isRootHolder = isEphemeraRoomId(parentId) || isEphemeraAreaId(parentId)
    const root = parent?.presenceNodes.find((node) => !node.fromHostPresence)
    if (isRootHolder && !root) {
        return true
    }
    const children = [...new Set(authoredChildIds)].filter((childId) => isFixedChildOf(parentId, childId))
    if (children.length === 0) {
        return false
    }
    const rootId = isRootHolder ? root?.universalKey : (parent?.presenceNodes.length === 1 ? parent.presenceNodes[0].universalKey : undefined)
    if (!parent || parent.presenceNodes.length === 0) {
        // A parent with children and no binding at all: population mints its root.
        return true
    }
    if (!rootId) {
        return false
    }
    const edges = edgesOf(parentGraph)
    return children.some((childId) => {
        if (!parent.nodeIds.includes(childId)) {
            return true
        }
        const hasEdge = edges.some((edge) => (
            edge.kind === 'PartOf' &&
            edge.from !== undefined && edge.to !== undefined &&
            ephemeraLudicTerminalsEqual(edge.from, childId) &&
            ephemeraLudicTerminalsEqual(edge.to, parentId)
        ))
        if (!hasEdge) {
            return true
        }
        const child = presenceGraphViewOf(childId, childGraphOf(childId))
        const binding = child?.presenceNodes.find((node) => node.fromHostPresence?.host === parentId)
        if (!binding || binding.fromHostPresence?.presence !== rootId) {
            return true
        }
        return isEphemeraAreaId(parentId) && binding.cover.members.length > 0
    })
}
