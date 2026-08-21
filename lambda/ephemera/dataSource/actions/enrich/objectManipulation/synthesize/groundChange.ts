import { isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { Change } from '../plan/ungroundedPrimitive'
import { actingCharacterRef, currentHostRef } from '../plan/ungroundedPrimitive'
import type { ParsePlanStep } from '../parsePlanStep'
import { groundReferent, type GroundingContext } from './groundReferent'

/**
 * `ok: false` is hard-terminal today, same caveat as `GroundReferentResult`
 * (whose failures propagate straight through here) --- see BD-18
 * (`AGENT.backtrackChannel.planning.md`) for the unbuilt
 * Synthesize -> Identify backtrack direction this shape should stay
 * compatible with.
 */
export type GroundChangeResult =
    | { ok: true; candidates: readonly ParsePlanStep[] }
    | { ok: false; reason: string }

/**
 * Grounds a single `Change` (Plan's output) into the *joint candidate space* of
 * `ParsePlanStep`s it could produce (BD-23, 2026-07-19) --- not a single answer.
 * Each referent field may ground to multiple candidates; this takes the
 * Cartesian product across all of a Change's referent fields, constructing one
 * step per combination. Per-combination type checks (is this candidate actually
 * an object id / room id / membership host id?) filter out ill-typed
 * combinations individually --- one bad combination doesn't invalidate others.
 * **Same-object combinations (subject and target grounding to the identical id)
 * are deliberately never filtered here** --- a self-reference isn't inherently
 * invalid at this layer; whether it's actually legal (e.g. "can't put an object
 * on itself") is Validation's job, a later, separate step. Fails only when the
 * resulting candidate list is empty.
 *
 * Does not handle `Assertion` --- Plan's shipped compiler never emits one today
 * (`containedBy` unused, `sameHost` unbuilt), so this is a type-level
 * exclusion, not a TODO.
 *
 * `transferMembership` produces **single-object, not-yet-carry-closed**
 * `objectIds` sets per candidate --- growing one to a full carry-closed set is
 * Expansion's job (`computeCarryClosure`, `interactionUnderTransfer.ts`),
 * deliberately not invoked here. How Grounding and Expansion interleave is an
 * open question (`AGENT.concepts.md`, "Synthesize's three sub-roles") --- this
 * function's output is a valid but potentially incomplete candidate set by
 * design, not a finished answer to that question.
 *
 * `establishRelation`/`dissolveRelation` derive their host as
 * `currentHost(actingCharacter)`, per BD-6's still-current default (BD-15/16's
 * `sameHost` generalization, which would let a held-item pair ground to a
 * Character host, isn't built yet). A derived host candidate that isn't a Room
 * is filtered out per-combination rather than failing the whole call, since
 * that widening is explicitly out-of-scope future work (BD-15 slice 3).
 */
export const groundChange = (change: Change, context: GroundingContext): GroundChangeResult => {
    switch (change.primitive) {
        case 'establishRelation':
        case 'dissolveRelation': {
            const subject = groundReferent(change.subject, context)
            if (!subject.ok) {
                return subject
            }
            const target = groundReferent(change.target, context)
            if (!target.ok) {
                return target
            }
            const host = groundReferent(currentHostRef(actingCharacterRef), context)
            if (!host.ok) {
                return host
            }

            // LP4c-i: HostRelationalEdgeKind widened (ephemeraMeta.ts) to admit containment
            // ('In'/'PartOf'), but ParsePlanStep's relationKind stays the narrow four-kind set
            // (LD-13, parsePlanStep.ts). Unreachable today: isContainmentSpan routes containment
            // language to nestingDefer before a Change carrying one reaches here.
            if (change.relationKind === 'In' || change.relationKind === 'PartOf') {
                return { ok: false, reason: 'Containment relation kinds are not yet groundable as establishRelation/dissolveRelation steps' }
            }

            const candidates: ParsePlanStep[] = []
            for (const subjectCandidate of subject.candidates) {
                if (!isEphemeraObjectId(subjectCandidate)) continue
                for (const targetCandidate of target.candidates) {
                    if (!isEphemeraObjectId(targetCandidate)) continue
                    for (const hostCandidate of host.candidates) {
                        if (!isEphemeraRoomId(hostCandidate)) continue
                        candidates.push({
                            kind: change.primitive,
                            subjectId: subjectCandidate,
                            targetId: targetCandidate,
                            relationKind: change.relationKind,
                            ...(change.relationLabel !== undefined ? { relationLabel: change.relationLabel } : {}),
                            hostRoomId: hostCandidate,
                        })
                    }
                }
            }
            if (candidates.length === 0) {
                return { ok: false, reason: 'No valid combination of grounded candidates produced a well-typed establishRelation/dissolveRelation step' }
            }
            return { ok: true, candidates }
        }
        case 'transferMembership': {
            const object = groundReferent(change.object, context)
            if (!object.ok) {
                return object
            }
            const from = groundReferent(change.from, context)
            if (!from.ok) {
                return from
            }
            const to = groundReferent(change.to, context)
            if (!to.ok) {
                return to
            }

            const candidates: ParsePlanStep[] = []
            for (const objectCandidate of object.candidates) {
                if (!isEphemeraObjectId(objectCandidate)) continue
                for (const fromCandidate of from.candidates) {
                    if (!isEphemeraMembershipHostId(fromCandidate)) continue
                    for (const toCandidate of to.candidates) {
                        if (!isEphemeraMembershipHostId(toCandidate)) continue
                        candidates.push({
                            kind: 'transferMembership',
                            objectIds: new Set([objectCandidate]),
                            fromHostId: fromCandidate,
                            toHostId: toCandidate,
                        })
                    }
                }
            }
            if (candidates.length === 0) {
                return { ok: false, reason: 'No valid combination of grounded candidates produced a well-typed transferMembership step' }
            }
            return { ok: true, candidates }
        }
    }
}
