import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { isBystanderMove } from './bystander'
import type { MutationKernelStep } from './kernelStep'
import type { StepSequenceFootprint } from './types'

/**
 * BD-27c's transaction-lock footprint: derives the full set of hosts a grounded step sequence
 * touches, computed once up front from a snapshot --- required, since `MultiKeyUpdate` does exactly
 * one batched fetch per `transactWrite` call and cannot be re-entered mid-reducer to lock a
 * newly-discovered host. A presence step contributes the mover's own host plus every host whose
 * membership it can change (decided at grounding time: a pointer's host, a move's `from` and `to`); `establishRelation`/
 * `dissolveRelation` carry no host field (BD-33), so both endpoints' *pre-transaction* current host
 * is derived via the injected resolver. The reducer that actually applies the sequence separately
 * re-verifies each relational step's shared host against the freshly-fetched, locked graphs --- this
 * function never is trusted as ground truth by itself, only as the lock-set declaration.
 *
 * A **bystander** (`isBystanderMove`) contributes only its own host: the Room it leaves or arrives at is
 * indexed by the characters row, so it is not fetched, locked or written.
 *
 * `capture` contributes nothing: a room's occupants are no longer in its graph, so the commit resolves
 * them before the transact (`initialOccupants`) and the capture is a positional walk step over that set.
 */
export const computeStepSequenceFootprint = (
    steps: readonly MutationKernelStep[],
    getCurrentHost: (id: EphemeraLudicTerminalPrimitive) => EphemeraMembershipHostId | undefined
): StepSequenceFootprint => {
    const hosts = new Set<EphemeraMembershipHostId>()
    // A bystander's room is indexed by the characters row, not the room's graph: it is neither fetched
    // nor locked, so a character-only commit never touches `Meta::Room`.
    const addHostOf = (moverId: EphemeraMembershipHostId, hostId: EphemeraMembershipHostId): void => {
        if (!isBystanderMove(moverId, hostId)) {
            hosts.add(hostId)
        }
    }
    for (const step of steps) {
        if (step.kind === 'capture') {
            // reads no graph: the commit resolves the host's occupants before the transact.
            continue
        }
        // a presence step names the mover's own graph and every host whose membership it can change: the
        // host a pointer names (the node is added there), a move's destination (also read, to confirm
        // the binding the mover will sit under) and the host a move leaves.
        if (step.kind === 'createComponent' || step.kind === 'destroyComponent') {
            hosts.add(step.hostId)
            continue
        }
        if (step.kind === 'addPresenceBinding' || step.kind === 'repairPresenceBinding') {
            hosts.add(step.hostId)
            step.fromHostPresences.forEach((parent) => addHostOf(step.hostId, parent.host))
            if (step.kind === 'repairPresenceBinding') {
                step.previousParents?.forEach((parent) => addHostOf(step.hostId, parent.host))
            }
            continue
        }
        if (step.kind === 'reparentPresenceBinding') {
            hosts.add(step.hostId)
            for (const parent of [...(step.lose ?? []), ...(step.gain ?? [])]) {
                addHostOf(step.hostId, parent.host)
            }
            for (const host of step.cascadeHosts ?? []) {
                hosts.add(host)
            }
            continue
        }
        if (step.kind === 'joinPresenceBindings') {
            // the joined bindings' parents and children are read and rewritten: the producer names the
            // children's hosts, and a parent host that is absent is a stale refusal at apply time.
            hosts.add(step.hostId)
            for (const host of step.cascadeHosts ?? []) {
                hosts.add(host)
            }
            continue
        }
        if (step.kind === 'splitPresenceBinding') {
            hosts.add(step.hostId)
            for (const piece of step.pieces) {
                piece.parents.forEach((parent) => addHostOf(step.hostId, parent.host))
                piece.cover.members.forEach((member) => hosts.add(member.host as EphemeraMembershipHostId))
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
