import { isEphemeraAreaId, isEphemeraFeatureId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { parentPointersOf } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import { presenceGraphViewOf } from '../presenceCoverDriftSweep/classification'

/** The hosting kind a stored node carries, read from the raw row; a bare-id node carries none. */
const hostingKindOfNode = (ludicGraph: unknown, nodeId: string): unknown => {
    const nodes = (ludicGraph as { nodes?: unknown } | undefined)?.nodes
    const node = Array.isArray(nodes)
        ? nodes.find((entry) => typeof entry === 'object' && entry !== null && (entry as { universalKey?: unknown }).universalKey === nodeId)
        : undefined
    return (node as { hostingKind?: unknown } | undefined)?.hostingKind
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
 *   - the parent's node for the child does not carry the `PartOf` hosting kind;
 *   - the child holds no binding with the parent's root binding among its parents (a Room's binding into an
 *     Area must also be an empty-member carve-out).
 *
 * This sweep owns nestings that never move; Objects and Characters are outside it because their
 * placement is meant to change. De-authoring is out of scope: a stored nesting the asset no longer
 * declares is not sensed, since the contract defers removal for Rooms and Features and a finding
 * would heal nothing. The one overlap with `PresenceCoverDriftSweep` is a Room or Area with bindings
 * and no Base: that is `noBase` there (report-only) and the Root condition here (healed, because
 * population can mint the root). A parent holding several bindings names no
 * root for its children, so population refuses it; its children are not judged either. A row in a
 * shape the shared guard rejects is `LudicGraphStaleStructureSweep`'s.
 *
 * Every condition is one the consumer's population rerun repairs (`healContainmentPopulation`
 * reads the same authored list), so a finding is never one it would decline.
 */
export const isFixedContainmentDrifted = (
    parentId: string,
    parentGraph: unknown,
    authoredChildIds: readonly string[],
    childGraphOf: (childId: string) => unknown
): boolean => {
    const parent = presenceGraphViewOf(parentId, parentGraph)
    const isRootHolder = isEphemeraRoomId(parentId) || isEphemeraAreaId(parentId)
    const root = parent?.presenceNodes.find((node) => parentPointersOf(node).length === 0)
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
    return children.some((childId) => {
        if (!parent.nodeIds.includes(childId)) {
            return true
        }
        if (hostingKindOfNode(parentGraph, childId) !== 'PartOf') {
            return true
        }
        const child = presenceGraphViewOf(childId, childGraphOf(childId))
        // Some binding of the child names the parent's root (a child may hold several bindings, each under other parents too).
        const binding = child?.presenceNodes.find((node) => (
            parentPointersOf(node).some((pointer) => pointer.host === parentId && pointer.presence === rootId)
        ))
        if (!binding) {
            return true
        }
        return isEphemeraAreaId(parentId) && binding.cover.members.length > 0
    })
}
