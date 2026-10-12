import { v4 as uuidv4 } from 'uuid'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { MutationKernelRehostPresenceBindingStep } from '../kernelStep'

/**
 * The mover's presence write for one rehost, for every mover of any host kind --- extracted from
 * `compilePositionKernelOp.ts` because it depends on nothing but `(hostId, froms, to)`, which is
 * already the exact shape `executeMembershipTransfer`'s own diff carries.
 *
 * **Single emitter, since 2026-09-09:** `compilePositionKernelOp` is the only caller, because
 * `executeMembershipTransfer` no longer builds its own steps --- it calls that compiler. Presence
 * writes for moves therefore hold through one compile path rather than two independent ones.
 *
 * **One re-point step, not remove-then-add.** A move re-points the
 * mover's existing binding, so its id is stable for the whole's life and a child pointer naming
 * it (an item a character holds names the character's binding) survives the move (PR-21(e)). The
 * compiler has no prior-state read, so the step names hosts only; `applyStepSequenceCore` picks
 * which binding to re-point, and which of the destination's bindings it now sits under, from the
 * graphs the transfer already put in the footprint. A departure to no host (destroy/scrub, or a
 * character going out of play) keeps one binding, hostless, rather than deleting it.
 *
 * `presenceUuid` is a bare, freshly-minted uuid, used only when the mover has no binding yet (its
 * first placement); it becomes the node's `PRESENCE#{presenceUuid}` key.
 */
export const presenceBindingStepsForMove = (
    hostId: EphemeraMembershipHostId,
    froms: readonly EphemeraMembershipHostId[],
    to: EphemeraMembershipHostId | null
): MutationKernelRehostPresenceBindingStep[] => (
    froms.length === 0 && to === null
        ? []
        : [{
            kind: 'rehostPresenceBinding',
            hostId,
            fromHostIds: froms,
            toHostId: to,
            presenceUuid: uuidv4(),
        }]
)
