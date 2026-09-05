import { v4 as uuidv4 } from 'uuid'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { MutationKernelAddPresencePortStep, MutationKernelRemovePresencePortStep } from '../kernelStep'

/**
 * RD-3 (`AGENT.presenceRefactor.planning.md`): one presence port per rehost, shared by every mover
 * of any host kind --- extracted from `compilePositionKernelOp.ts` because the block depends on
 * nothing but `(hostId, froms, to)`, which is already the exact shape `executeMembershipTransfer`'s
 * own diff carries. Extraction is what dissolves RD-3 as a fork: neither caller needs to route
 * through `compileMutationSteps` just to get a presence port, since both reach this function
 * directly. RD-2 (2026-09-04): a remove-then-add pair per rehost, rather than one replace-all step
 * --- multiplicity lives in the sequence, not the step, so a departure host with no existing
 * binding just produces a no-op remove.
 *
 * `to` gates only the add, never the removes --- a departure to no host (destroy/scrub, or a
 * character going out of play under RD-1) still has to clear every prior binding, or a stale port
 * is left standing. This is the missing-clear fix the plan's step 2 records as a live defect, not
 * new behaviour.
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
