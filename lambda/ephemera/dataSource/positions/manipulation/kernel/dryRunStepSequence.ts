import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import internalCache from '../../../../internalCache'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { applyStepSequenceCore } from './applyStepSequenceCore'
import { computeStepSequenceFootprint } from './computeStepSequenceFootprint'
import type { MutationKernelStep } from './kernelStep'
import type { MutationKernelApplyOutcome } from './types'

const defaultGetGraph = (hostId: EphemeraMembershipHostId): Promise<EphemeraLudicGraph> =>
    internalCache.Positions.getLudicGraph(hostId)

/**
 * 3c: the kernel's own legality check (`applyStepSequenceCore`), reachable pre-commit. No new
 * logic --- `computeStepSequenceFootprint` and `applyStepSequenceCore` are both already pure, this
 * function only composes them behind one seam instead of leaving every caller that wants a
 * pre-commit read to re-derive the footprint-then-fetch-then-evaluate sequence by hand
 * (`executeMembershipTransfer`'s `honorDefer` block and the enrich tier's `sandboxMembershipDryRun`
 * both currently do). `plan*`-tier under Phase 3's tier rule: reads and evaluates, never writes.
 *
 * **Advisory, not authoritative.** `commitStepSequence` re-runs `applyStepSequenceCore` against
 * freshly-fetched, *locked* graphs, and is the only check that can actually gate a write. Calling
 * this function and then committing is not duplicated work: the *plan* (the step array) flows
 * through as a value between the two calls, but the *verdict* does not, because the world can
 * change in between. That cross-snapshot recheck is a safety property, not redundancy.
 *
 * **The footprint is fixed by the input `steps`.** `computeStepSequenceFootprint` is deterministic
 * given `steps`, so a `repairable` verdict whose repair would touch a host outside today's
 * footprint cannot be re-evaluated by calling this function again with the same steps --- the
 * caller must build new, wider steps first. `fetchRelationalReachability`
 * (`relational/findRelationalChainsForRemoval.ts`) is the existing precedent for that widening
 * fetch discipline; this function does not perform it, and evaluates exactly the footprint its
 * input implies.
 */
export const dryRunStepSequence = async (
    steps: readonly MutationKernelStep[],
    deps: {
        getCurrentHost: (id: EphemeraLudicTerminalPrimitive) => EphemeraMembershipHostId | undefined
        getGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    }
): Promise<MutationKernelApplyOutcome> => {
    const getGraph = deps.getGraph ?? defaultGetGraph
    const footprint = computeStepSequenceFootprint(steps, deps.getCurrentHost)

    const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>()
    await Promise.all([...footprint].map(async (hostId) => {
        graphs.set(hostId, await getGraph(hostId))
    }))

    return applyStepSequenceCore(steps, graphs)
}
