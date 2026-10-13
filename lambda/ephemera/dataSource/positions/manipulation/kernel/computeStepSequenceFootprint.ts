import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { MutationKernelStep } from './kernelStep'
import type { StepSequenceFootprint } from './types'

/**
 * BD-27c's transaction-lock footprint: derives the full set of hosts a grounded step sequence
 * touches, computed once up front from a snapshot --- required, since `MultiKeyUpdate` does exactly
 * one batched fetch per `transactWrite` call and cannot be re-entered mid-reducer to lock a
 * newly-discovered host. A presence step contributes the mover's own host plus every host whose
 * membership it can change (decided at grounding time: a pointer's host, a move's `from` and `to`, a
 * release's `from`); `establishRelation`/
 * `dissolveRelation` carry no host field (BD-33), so both endpoints' *pre-transaction* current host
 * is derived via the injected resolver. The reducer that actually applies the sequence separately
 * re-verifies each relational step's shared host against the freshly-fetched, locked graphs --- this
 * function never is trusted as ground truth by itself, only as the lock-set declaration.
 *
 * `capture` contributes its `hostId` unconditionally --- the decisive reason capture had to
 * become a walk step rather than a side-table: `MultiKeyUpdate` cannot lock a newly-discovered host
 * mid-reducer, so a capture against a host no mutation step in the same sequence touches would
 * otherwise see `graphs.get(hostId)` come back `undefined` inside `applyStepSequenceCore`.
 */
export const computeStepSequenceFootprint = (
    steps: readonly MutationKernelStep[],
    getCurrentHost: (id: EphemeraLudicTerminalPrimitive) => EphemeraMembershipHostId | undefined
): StepSequenceFootprint => {
    const hosts = new Set<EphemeraMembershipHostId>()
    for (const step of steps) {
        if (step.kind === 'capture') {
            hosts.add(step.hostId)
            continue
        }
        // a presence step names the mover's own graph and every host whose membership it can change: the
        // host a pointer names (the node is added there), a move's destination (also read, to confirm
        // the binding the mover will sit under) and the host a move or release leaves.
        if (step.kind === 'createComponent' || step.kind === 'destroyComponent') {
            hosts.add(step.hostId)
            continue
        }
        if (step.kind === 'addPresenceBinding' || step.kind === 'repairPresenceBinding') {
            hosts.add(step.hostId)
            if (step.fromHostPresence) {
                hosts.add(step.fromHostPresence.host)
            }
            continue
        }
        if (step.kind === 'movePresenceBinding') {
            hosts.add(step.hostId)
            hosts.add(step.to.host)
            if (step.from) {
                hosts.add(step.from.host)
            }
            continue
        }
        if (step.kind === 'releasePresenceBinding') {
            hosts.add(step.hostId)
            hosts.add(step.from.host)
            continue
        }
        if (step.kind === 'splitPresenceBinding') {
            hosts.add(step.hostId)
            // every child whose binding is re-pointed: the entries of the new bindings. The original's own
            // entries stay put, so their children are not locked.
            for (const { presence, cover } of step.splitInto) {
                if (presence === step.presence) {
                    continue
                }
                for (const member of cover.members) {
                    if ('host' in member) {
                        hosts.add(member.host as EphemeraMembershipHostId)
                    }
                }
            }
            continue
        }
        if (step.kind === 'joinPresenceBindings') {
            hosts.add(step.hostId)
            // every child whose binding is re-pointed to the survivor: the absorbed cover's entries.
            for (const member of step.absorbedCover.members) {
                if ('host' in member) {
                    hosts.add(member.host as EphemeraMembershipHostId)
                }
            }
            continue
        }
        if (step.kind === 'addCrossingPort' || step.kind === 'removeCrossingPort') {
            hosts.add(step.hostId)
            continue
        }
        // a crossing leg's port-address endpoint (EphemeraLudicPortAddress) names no host
        // of its own to resolve or lock here --- whatever host stores that port record is locked
        // by the step that writes it (addCrossingPort/removeCrossingPort), not by this leg. Only
        // the primitive endpoint(s) need resolving. A leg with none (a two-sided crossing's middle
        // leg, port to port) locks the host it is stored on, its own `hostId`.
        const subjectIsPrimitive = isEphemeraLudicTerminalPrimitive(step.subjectId)
        const targetIsPrimitive = isEphemeraLudicTerminalPrimitive(step.targetId)
        const subjectHost = subjectIsPrimitive ? getCurrentHost(step.subjectId as EphemeraLudicTerminalPrimitive) : undefined
        const targetHost = targetIsPrimitive ? getCurrentHost(step.targetId as EphemeraLudicTerminalPrimitive) : undefined
        if (subjectIsPrimitive && subjectHost === undefined) {
            throw new Error(`computeStepSequenceFootprint: cannot resolve current host for ${step.subjectId}`)
        }
        if (targetIsPrimitive && targetHost === undefined) {
            throw new Error(`computeStepSequenceFootprint: cannot resolve current host for ${step.targetId}`)
        }
        if (subjectHost === undefined && targetHost === undefined) {
            hosts.add(step.hostId)
            continue
        }
        if (subjectHost !== undefined) {
            hosts.add(subjectHost)
        }
        if (targetHost !== undefined) {
            hosts.add(targetHost)
        }
    }
    return hosts
}

/**
 * The footprint hosts a `createComponent` step brings into being. They stay in the footprint (they
 * are written, and later steps read them), but there is no row to fetch: dry-run seeds nothing for
 * them and commit leaves them out of the `MultiKeyUpdate` keys, letting the step seed them.
 */
export const createdHostsOf = (steps: readonly MutationKernelStep[]): ReadonlySet<EphemeraMembershipHostId> =>
    new Set(steps.flatMap((step) => (step.kind === 'createComponent' ? [step.hostId] : [])))
