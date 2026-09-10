import { v4 as uuidv4 } from 'uuid'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { MutationKernelAddPresencePortStep, MutationKernelRemovePresencePortStep } from '../kernelStep'

/**
 * One presence port per rehost, minted for every mover of any host kind --- extracted from
 * `compilePositionKernelOp.ts` because the block depends on nothing but `(hostId, froms, to)`,
 * which is already the exact shape `executeMembershipTransfer`'s own diff carries. Extraction was
 * what let a caller get a presence port without routing through `compileMutationSteps`.
 *
 * **Single emitter, since 2026-09-09:** `compilePositionKernelOp` is now the only caller, because
 * `executeMembershipTransfer` no longer builds its own steps --- it calls that compiler. Universal
 * port population therefore holds through one compile path rather than two independent ones, which
 * is a stronger guarantee than the extraction originally bought: there is no second site that could
 * drift.
 *
 * A remove-then-add pair per rehost, rather than one replace-all step --- multiplicity lives in the
 * sequence, not the step, so a departure host with no existing binding just produces a no-op remove.
 *
 * `to` gates only the add, never the removes --- a departure to no host (destroy/scrub, or a
 * character going out of play) still has to clear every prior binding, or a stale port is left
 * standing. This is the missing-clear fix, added 2026-09-04 to close a live defect, not new
 * behaviour of the move itself.
 */
export const presencePortStepsForMove = (
    hostId: EphemeraMembershipHostId,
    froms: readonly EphemeraMembershipHostId[],
    to: EphemeraMembershipHostId | null
): (MutationKernelAddPresencePortStep | MutationKernelRemovePresencePortStep)[] => [
    ...froms.map((fromHostId): MutationKernelRemovePresencePortStep => ({
        kind: 'removePresencePort',
        hostId,
        fromHostId,
    })),
    ...(to
        ? [{
            kind: 'addPresencePort' as const,
            hostId,
            port: { portId: uuidv4(), fromHostId: to, kind: 'Present' as const },
        }]
        : []),
]
