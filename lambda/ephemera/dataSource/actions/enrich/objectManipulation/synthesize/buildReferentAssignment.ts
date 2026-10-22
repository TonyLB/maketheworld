import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { DerivedReferentKey, GroundedId, PlanStep, Referent, ReferentAssignment } from '../plan/planStep'
import { derivedReferentKey, stepReferents } from '../plan/planStep'

/**
 * One snapshot of the world, as derived referents need it: who the actor is, and where a
 * thing currently is. Whoever holds the snapshot supplies it --- actions' dry run from its
 * frame, positions from live cache after the hand-off. `undefined` means "not
 * knowable from this snapshot" (no actor, not in exactly one host).
 */
export type DerivedReferentResolver = {
    actingCharacter: GroundedId | undefined
    currentHost: (id: GroundedId) => GroundedId | undefined
    /**
     * The hosts a view of a thing sits under (`undefined` when the view no longer holds). Read only for
     * a transfer's `from`, when the thing is in several hosts: the view says which part is meant, so the
     * first of its hosts is where the move starts. Whether the move may go ahead is the transfer
     * preconditions' call.
     */
    viewHosts?: (id: GroundedId, view: readonly EphemeraPresenceNodeId[]) => readonly GroundedId[] | undefined
}

/**
 * Builds the `ReferentAssignment` `groundChange`/`groundAssertion` consume for one step: the
 * span half as given (decided once, at identity selection), plus a derived entry for every
 * ungrounded derived referent the step holds, resolved against `resolver` (the derived
 * half, rebuilt per snapshot). Walks the step's referents generically, so a new derived
 * shape (`currentHost(span:<key>)`, containment's) needs no new entry here.
 *
 * A transfer's `currentHost` falls back to the first host of the target's `view` when the thing is in
 * several hosts, so the preconditions, not grounding, judge the move. Every other step needs the one host
 * `currentHost` names.
 *
 * Returns `undefined` when the snapshot cannot resolve a derived referent --- a
 * world-dependent failure, where the caller drops the step. A `currentHost` over a span
 * missing from `spans` is a construction bug and throws, as `groundChange` does.
 */
export const buildReferentAssignment = (
    step: PlanStep,
    spans: ReadonlyMap<string, GroundedId>,
    resolver: DerivedReferentResolver
): ReferentAssignment | undefined => {
    const derived = new Map<DerivedReferentKey, GroundedId>()
    const viewed = step.kind === 'change' && step.primitive === 'transferMembership' && resolver.viewHosts !== undefined
    const hostOf = (id: GroundedId, view: readonly EphemeraPresenceNodeId[] | undefined): GroundedId | undefined => (
        resolver.currentHost(id) ?? (viewed && view !== undefined ? resolver.viewHosts?.(id, view)?.[0] : undefined)
    )

    const resolve = (referent: Referent): GroundedId | undefined => {
        if (referent.groundedId !== undefined) {
            return referent.groundedId
        }
        switch (referent.referentType) {
            case 'objectSpan': {
                const id = referent.stableRefKey !== undefined ? spans.get(referent.stableRefKey) : undefined
                if (id === undefined) {
                    throw new Error(`buildReferentAssignment: no span assignment for "${referent.span}"`)
                }
                return id
            }
            case 'actingCharacter':
                return resolver.actingCharacter
            case 'currentHost': {
                const targetId = resolve(referent.referentTarget)
                const target = referent.referentTarget
                return targetId === undefined ? undefined : hostOf(targetId, target.referentType === 'objectSpan' ? target.view : undefined)
            }
            case 'graphNode':
                return referent.groundedId
        }
    }

    for (const referent of stepReferents(step)) {
        if (referent.groundedId !== undefined || referent.referentType === 'objectSpan') {
            continue
        }
        const id = resolve(referent)
        if (id === undefined) {
            return undefined
        }
        derived.set(derivedReferentKey(referent), id)
    }

    return { spans, derived }
}
