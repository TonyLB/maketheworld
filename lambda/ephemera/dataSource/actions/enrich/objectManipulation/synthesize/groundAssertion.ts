import { isEphemeraObjectId, type EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { Assertion, Referent } from '../plan/ungroundedPrimitive'
import { groundReferent, type GroundingContext } from './groundReferent'
import type { GroundedAssertion } from './executorTypes'

/**
 * `ok: false` is hard-terminal today, same caveat as `GroundReferentResult`/
 * `GroundChangeResult` --- see BD-18 (`AGENT.backtrackChannel.planning.md`)
 * for the unbuilt Synthesize -> Identify backtrack direction this shape
 * should stay compatible with.
 */
export type GroundAssertionResult =
    | { ok: true; assertion: GroundedAssertion }
    | { ok: false; reason: string }

/**
 * Grounds an `Assertion` (Plan's output) into a `GroundedAssertion` --- the
 * executor's worklist operand, per BD-32's confirmed scope: **exactly one**
 * candidate per referent, not the joint candidate space `groundChange`
 * produces for `Change`. A referent grounding to more than one candidate here
 * is an error, documented as unreachable: the outer per-candidate selection
 * layer (BD-32) has already narrowed `GroundingContext.resolvedSpans` down to
 * one id per `stableRefKey` before the worklist ever runs.
 */
export const groundAssertion = (
    assertion: Assertion,
    context: GroundingContext
): GroundAssertionResult => {
    switch (assertion.predicate) {
        case 'containedBy':
        case 'sameHost': {
            const subjectId = groundSingleObjectId(assertion.subject, context)
            if (!subjectId.ok) {
                return subjectId
            }
            const objectId = groundSingleObjectId(assertion.object, context)
            if (!objectId.ok) {
                return objectId
            }
            return {
                ok: true,
                assertion: {
                    kind: 'assertion',
                    predicate: assertion.predicate,
                    subjectId: subjectId.id,
                    objectId: objectId.id,
                    negate: assertion.negate,
                    ...(assertion.predicate === 'sameHost' && assertion.relationKind !== undefined
                        ? { relationKind: assertion.relationKind }
                        : {}),
                },
            }
        }
        case 'isolatedFromRelations': {
            const objectId = groundSingleObjectId(assertion.object, context)
            if (!objectId.ok) {
                return objectId
            }
            return {
                ok: true,
                assertion: {
                    kind: 'assertion',
                    predicate: 'isolatedFromRelations',
                    objectIds: new Set([objectId.id]),
                },
            }
        }
    }
}

const groundSingleObjectId = (
    referent: Referent,
    context: GroundingContext
): { ok: true; id: EphemeraObjectId } | { ok: false; reason: string } => {
    const result = groundReferent(referent, context)
    if (!result.ok) {
        return { ok: false, reason: result.reason }
    }
    const objectCandidates = result.candidates.filter(isEphemeraObjectId)
    if (objectCandidates.length === 0) {
        return { ok: false, reason: 'No well-typed EphemeraObjectId candidate produced for this referent' }
    }
    if (objectCandidates.length > 1) {
        return {
            ok: false,
            reason: 'Referent grounded to more than one candidate --- unreachable once the outer per-candidate layer (BD-32) has already selected one',
        }
    }
    return { ok: true, id: objectCandidates[0]! }
}
