import { isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { Change } from '../plan/ungroundedPrimitive'
import { actingCharacterRef, currentHostRef } from '../plan/ungroundedPrimitive'
import type { ParsePlanStep } from '../parsePlanStep'
import { groundReferent, type GroundingContext } from './groundReferent'

/**
 * `ok: false` is hard-terminal today, same caveat as `GroundReferentResult`
 * (whose failures propagate straight through here) --- see BD-18
 * (`AGENT.manipulationFrameAndRelational.planning.md`) for the unbuilt
 * Synthesize -> Identify backtrack direction this shape should stay
 * compatible with.
 */
export type GroundChangeResult =
    | { ok: true; step: ParsePlanStep }
    | { ok: false; reason: string }

/**
 * Grounds a single `Change` (Plan's output) into a `ParsePlanStep`. Does not
 * handle `Assertion` --- Plan's shipped compiler never emits one today
 * (`containedBy` unused, `sameHost` unbuilt), so this is a type-level
 * exclusion, not a TODO.
 *
 * `transferMembership` produces a **single-object, not-yet-carry-closed**
 * `objectIds` set --- growing it to a full carry-closed set is Expansion's
 * job (`computeCarryClosure`, `interactionUnderTransfer.ts`), deliberately not
 * invoked here. How Grounding and Expansion interleave is an open question
 * (`AGENT.concepts.md`, "Synthesize's three sub-roles") --- this function's
 * output is a valid but potentially incomplete candidate by design, not a
 * finished answer to that question.
 *
 * `establishRelation`/`dissolveRelation` derive their host as
 * `currentHost(actingCharacter)`, per BD-6's still-current default (BD-15/16's
 * `sameHost` generalization, which would let a held-item pair ground to a
 * Character host, isn't built yet). A derived host that isn't a Room fails
 * rather than silently narrowing, since that widening is explicitly
 * out-of-scope future work (BD-15 slice 3).
 */
export const groundChange = (change: Change, context: GroundingContext): GroundChangeResult => {
    switch (change.primitive) {
        case 'establishRelation':
        case 'dissolveRelation': {
            const subject = groundReferent(change.subject, context)
            if (!subject.ok) {
                return subject
            }
            if (!isEphemeraObjectId(subject.value)) {
                return { ok: false, reason: `Grounded subject ${subject.value} is not an object id` }
            }

            const target = groundReferent(change.target, context)
            if (!target.ok) {
                return target
            }
            if (!isEphemeraObjectId(target.value)) {
                return { ok: false, reason: `Grounded target ${target.value} is not an object id` }
            }

            const host = groundReferent(currentHostRef(actingCharacterRef), context)
            if (!host.ok) {
                return host
            }
            if (!isEphemeraRoomId(host.value)) {
                return { ok: false, reason: `Derived host ${host.value} is not a room --- character-hosted relations are BD-15 slice-3 scope, not yet built` }
            }

            return {
                ok: true,
                step: {
                    kind: change.primitive,
                    subjectId: subject.value,
                    targetId: target.value,
                    relationKind: change.relationKind,
                    ...(change.relationLabel !== undefined ? { relationLabel: change.relationLabel } : {}),
                    hostRoomId: host.value,
                },
            }
        }
        case 'transferMembership': {
            const object = groundReferent(change.object, context)
            if (!object.ok) {
                return object
            }
            if (!isEphemeraObjectId(object.value)) {
                return { ok: false, reason: `Grounded object ${object.value} is not an object id` }
            }

            const from = groundReferent(change.from, context)
            if (!from.ok) {
                return from
            }
            if (!isEphemeraMembershipHostId(from.value)) {
                return { ok: false, reason: `Grounded from-host ${from.value} is not a membership host id` }
            }

            const to = groundReferent(change.to, context)
            if (!to.ok) {
                return to
            }
            if (!isEphemeraMembershipHostId(to.value)) {
                return { ok: false, reason: `Grounded to-host ${to.value} is not a membership host id` }
            }

            return {
                ok: true,
                step: {
                    kind: 'transferMembership',
                    objectIds: new Set([object.value]),
                    fromHostId: from.value,
                    toHostId: to.value,
                },
            }
        }
    }
}
