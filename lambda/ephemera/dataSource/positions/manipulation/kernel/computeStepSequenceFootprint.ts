import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { MutationKernelStep } from './kernelStep'
import type { StepSequenceFootprint } from './types'

/**
 * BD-27c's transaction-lock footprint: derives the full set of hosts a grounded step sequence
 * touches, computed once up front from a snapshot --- required, since `MultiKeyUpdate` does exactly
 * one batched fetch per `transactWrite` call and cannot be re-entered mid-reducer to lock a
 * newly-discovered host. `transferMembership` contributes every host in `fromHostIds` plus `toHostId`
 * (if non-null) directly (already fully decided at grounding time, unaffected by BD-36's entity-kind
 * widening or the object-lifecycle Migrate row's plural-`froms`/nullable-`to` widening);
 * `establishRelation`/
 * `dissolveRelation` carry no host field (BD-33), so both endpoints' *pre-transaction* current host
 * is derived via the injected resolver. The reducer that actually applies the sequence separately
 * re-verifies each relational step's shared host against the freshly-fetched, locked graphs --- this
 * function never is trusted as ground truth by itself, only as the lock-set declaration.
 */
export const computeStepSequenceFootprint = (
    steps: readonly MutationKernelStep[],
    getCurrentHost: (id: EphemeraObjectId) => EphemeraMembershipHostId | undefined
): StepSequenceFootprint => {
    const hosts = new Set<EphemeraMembershipHostId>()
    for (const step of steps) {
        if (step.kind === 'transferMembership') {
            for (const fromHostId of step.fromHostIds) {
                hosts.add(fromHostId)
            }
            if (step.toHostId !== null) {
                hosts.add(step.toHostId)
            }
            continue
        }
        const subjectHost = getCurrentHost(step.subjectId)
        const targetHost = getCurrentHost(step.targetId)
        if (subjectHost === undefined || targetHost === undefined) {
            throw new Error(
                `computeStepSequenceFootprint: cannot resolve current host for ${step.subjectId} or ${step.targetId}`
            )
        }
        hosts.add(subjectHost)
        hosts.add(targetHost)
    }
    return hosts
}
