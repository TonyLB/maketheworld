import { isEphemeraObjectId, type EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { Assertion, Referent, ReferentAssignment } from '../plan/planStep'
import { derivedReferentKey } from '../plan/planStep'
import type { GroundedAssertion } from './executorTypes'

/**
 * Grounds an `Assertion` (Plan's output) into a `GroundedAssertion`, the same substitution
 * `groundChange` applies to a `Change` (AP-1, AP-10): total over a complete
 * `ReferentAssignment`, throwing on a missing key rather than returning a result a caller
 * branches on. No shipped predicate emission reaches this today (`containedBy` unused) ---
 * kept in step with `groundChange`'s shape for when one does.
 */
export const groundAssertion = (
    assertion: Assertion,
    assignment: ReferentAssignment
): GroundedAssertion => {
    switch (assertion.predicate) {
        case 'containedBy':
            return {
                kind: 'assertion',
                predicate: 'containedBy',
                subjectId: groundSingleObjectId(assertion.subject, assignment),
                objectId: groundSingleObjectId(assertion.object, assignment),
                negate: assertion.negate,
            }
    }
}

const groundSingleObjectId = (
    referent: Referent,
    assignment: ReferentAssignment
): EphemeraObjectId => {
    if (referent.groundedId !== undefined) {
        if (!isEphemeraObjectId(referent.groundedId)) {
            throw new Error('groundAssertion: referent is not grounded to an EphemeraObjectId')
        }
        return referent.groundedId
    }
    if (referent.referentType === 'objectSpan') {
        if (referent.stableRefKey === undefined) {
            throw new Error(`groundAssertion: objectSpan referent for span "${referent.span}" has no stableRefKey to ground against`)
        }
        const groundedId = assignment.spans.get(referent.stableRefKey)
        if (groundedId === undefined || !isEphemeraObjectId(groundedId)) {
            throw new Error(`groundAssertion: no well-typed EphemeraObjectId span assignment for stableRefKey "${referent.stableRefKey}"`)
        }
        return groundedId
    }
    const key = derivedReferentKey(referent)
    const groundedId = assignment.derived.get(key)
    if (groundedId === undefined || !isEphemeraObjectId(groundedId)) {
        throw new Error(`groundAssertion: no well-typed EphemeraObjectId derived assignment for "${key}"`)
    }
    return groundedId
}
