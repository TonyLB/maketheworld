import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { ParentBinding } from '../../../ludicGraph/presenceParent'
import type { MutationKernelStep, PresenceBindingRef } from '../kernelStep'
import type { PositionKernelMoveOp, PositionKernelPresenceMove } from './positionKernelOp'

/**
 * The mover's presence writes for one op, for every mover of any host kind. Depends on nothing but
 * the op --- the producer named every binding (`resolvePresenceMoves`), so there is no prior-state
 * read and no guess. The only emitter of `movePresenceBinding` and `releasePresenceBinding`: `executeMembershipTransfer` and the rest reach it through
 * `compilePositionKernelOp`.
 *
 * **A move re-points, never remove-then-add**, so the binding's id is stable for the whole's life
 * and a child pointer naming it (an item a character holds names the character's binding) survives
 * (PR-21(e)). **Several moves** (a scrub of an object held by several hosts) converge to one binding
 * under the destination without a join step: a move into a parent where the mover already holds a
 * binding joins it (MC-3). Each move after the first carries its `cover`. **A departure to no host** (destroy,
 * disconnect, scrub to nowhere) is one `releasePresenceBinding` per binding that leaves: a whole
 * keeps one binding, hostless.
 */
export const presenceBindingStepsForMove = (
    hostId: EphemeraMembershipHostId,
    op: Pick<PositionKernelMoveOp, 'presenceMoves' | 'mintedRootUuid'>
): MutationKernelStep[] => {
    const moves = op.presenceMoves.filter((move): move is PositionKernelPresenceMove & { to: PresenceBindingRef } => move.to !== null)
    const releases = op.presenceMoves.filter((move): move is PositionKernelPresenceMove & { from: ParentBinding; to: null } => move.to === null)
    return [
        ...(op.mintedRootUuid ? [{ kind: 'addPresenceBinding' as const, hostId, presenceUuid: op.mintedRootUuid }] : []),
        // Several moves into one destination converge by themselves: the first re-points its binding, and
        // each later one finds the mover's binding already there and joins it. A later move carries its
        // planner-read `cover`, so the footprint can lock the children it re-points.
        ...moves.map(({ presence, from, to, cover }, index) => ({
            kind: 'movePresenceBinding' as const,
            hostId,
            presence,
            from,
            to,
            ...(index > 0 ? { cover: cover ?? { members: [] } } : {}),
        })),
        ...releases.map(({ presence, from }) => ({
            kind: 'releasePresenceBinding' as const,
            hostId,
            presence,
            from,
        })),
    ]
}
