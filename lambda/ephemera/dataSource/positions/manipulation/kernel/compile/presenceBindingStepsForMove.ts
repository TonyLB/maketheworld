import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { MutationKernelStep } from '../kernelStep'
import type { PositionKernelMoveOp } from './positionKernelOp'

/**
 * The mover's presence writes for one op, for every mover of any host kind. Depends on nothing but
 * the op --- the producer named every binding (`resolvePresenceMoves`), so there is no prior-state
 * read and no guess. The only emitter of `movePresenceBinding`, `releasePresenceBindings` and
 * `joinPresenceBindings`: `executeMembershipTransfer` and the rest reach it through
 * `compilePositionKernelOp`.
 *
 * **A move re-points, never remove-then-add**, so the binding's id is stable for the whole's life
 * and a child pointer naming it (an item a character holds names the character's binding) survives
 * (PR-21(e)). **Several moves** (a scrub of an object held by several hosts) are followed by one
 * join each for every binding beyond the first --- a stub until presenceMoves Slice 4, so for now
 * the bindings sit side by side under the destination. **A departure to no host** (destroy,
 * disconnect, scrub to nowhere) is `releasePresenceBindings`: a whole keeps one binding, hostless.
 */
export const presenceBindingStepsForMove = (
    hostId: EphemeraMembershipHostId,
    op: Pick<PositionKernelMoveOp, 'froms' | 'to' | 'presenceMoves' | 'mintedRootUuid'>
): MutationKernelStep[] => {
    if (op.to === null) {
        return op.froms.length === 0 ? [] : [{ kind: 'releasePresenceBindings', hostId }]
    }
    const [survivor, ...absorbed] = op.presenceMoves
    return [
        ...(op.mintedRootUuid ? [{ kind: 'addPresenceBinding' as const, hostId, presenceUuid: op.mintedRootUuid }] : []),
        ...op.presenceMoves.map(({ presence, from, to }) => ({
            kind: 'movePresenceBinding' as const,
            hostId,
            presence,
            from,
            to,
        })),
        ...absorbed.map((move) => ({
            kind: 'joinPresenceBindings' as const,
            hostId,
            survivor: survivor.presence,
            absorbed: move.presence,
        })),
    ]
}
