import { v4 as uuidv4 } from 'uuid'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { MutationKernelAddPresenceBindingStep, MutationKernelRemovePresenceBindingStep } from '../kernelStep'

/**
 * One presence binding per rehost, minted for every mover of any host kind --- extracted from
 * `compilePositionKernelOp.ts` because the block depends on nothing but `(hostId, froms, to)`,
 * which is already the exact shape `executeMembershipTransfer`'s own diff carries. Extraction was
 * what let a caller get a presence binding without routing through `compileMutationSteps`.
 *
 * **Single emitter, since 2026-09-09:** `compilePositionKernelOp` is now the only caller, because
 * `executeMembershipTransfer` no longer builds its own steps --- it calls that compiler. Universal
 * presence-binding population therefore holds through one compile path rather than two independent
 * ones, which is a stronger guarantee than the extraction originally bought: there is no second
 * site that could drift.
 *
 * A remove-then-add pair per rehost, rather than one replace-all step --- multiplicity lives in the
 * sequence, not the step, so a departure host with no existing binding just produces a no-op remove.
 *
 * `to` gates only the add, never the removes --- a departure to no host (destroy/scrub, or a
 * character going out of play) still has to clear every prior binding, or a stale binding is left
 * standing. This is the missing-clear fix, added 2026-09-04 to close a live defect, not new
 * behaviour of the move itself.
 *
 * **Renamed from `presencePortStepsForMove` (presenceNodes Slice 7a, PN-23).** The step no longer
 * carries a port record --- `applyStepSequenceCore.ts`'s handler mints the presence NODE directly
 * --- so `presenceUuid` here is a bare, freshly-minted uuid rather than a field nested inside an
 * `EphemeraPresencePort`. It still becomes the node's `PRESENCE#{presenceUuid}` key.
 */
export const presenceBindingStepsForMove = (
    hostId: EphemeraMembershipHostId,
    froms: readonly EphemeraMembershipHostId[],
    to: EphemeraMembershipHostId | null
): (MutationKernelAddPresenceBindingStep | MutationKernelRemovePresenceBindingStep)[] => [
    ...froms.map((fromHostId): MutationKernelRemovePresenceBindingStep => ({
        kind: 'removePresenceBinding',
        hostId,
        fromHostId,
    })),
    ...(to
        ? [{
            kind: 'addPresenceBinding' as const,
            hostId,
            fromHostId: to,
            presenceUuid: uuidv4(),
        }]
        : []),
]
