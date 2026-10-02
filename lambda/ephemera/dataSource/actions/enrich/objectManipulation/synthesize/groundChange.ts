import type { Change, GroundedReferent, Referent, ReferentAssignment } from '../plan/planStep'
import { derivedReferentKey, withGroundedId } from '../plan/planStep'

/**
 * Grounds one `Referent` against a `ReferentAssignment`: already-grounded passes through,
 * an `objectSpan` looks up its `stableRefKey` in `assignment.spans`, and `actingCharacter`/
 * `currentHost` look up their structural key in `assignment.derived`. A missing key is a
 * construction bug (AP-1's product-over-identity-candidates is formed by the producer,
 * before Grounding; AP-10's two namespaces are each supposed to be complete by the time
 * `groundChange` runs) and throws, rather than returning a result a caller branches on.
 */
const groundOneReferent = (referent: Referent, assignment: ReferentAssignment): GroundedReferent => {
    if (referent.groundedId !== undefined) {
        return referent as GroundedReferent
    }
    if (referent.referentType === 'objectSpan') {
        if (referent.stableRefKey === undefined) {
            throw new Error(`groundChange: objectSpan referent for span "${referent.span}" has no stableRefKey to ground against`)
        }
        const groundedId = assignment.spans.get(referent.stableRefKey)
        if (groundedId === undefined) {
            throw new Error(`groundChange: no span assignment for stableRefKey "${referent.stableRefKey}"`)
        }
        return withGroundedId(referent, groundedId)
    }
    const key = derivedReferentKey(referent)
    const groundedId = assignment.derived.get(key)
    if (groundedId === undefined) {
        throw new Error(`groundChange: no derived assignment for "${key}"`)
    }
    return withGroundedId(referent, groundedId)
}

/**
 * Grounds a single `Change` (Plan's output) to one answer: the same `Change`, every referent
 * kept and given its id (AP-1, AP-10, `AGENT.commandAttemptPipeline.planning.md`). Pure
 * substitution against a complete `ReferentAssignment` --- it does not walk live KR state
 * itself; whoever builds the assignment (the producer, for the span half; whoever holds a
 * snapshot, for the derived half) does that. Total and throwing: a referent whose key is
 * missing from the assignment is a construction bug, not a runtime outcome.
 *
 * Primitive-agnostic: a relational `Change` grounds the same way. Typing each id for its slot
 * (is this an object, is that a membership host?) is lowering's job (`executor.ts`), not
 * Grounding's. Whether a self-reference is legal ("can't put an object on itself") is the
 * producer's/Validation's.
 *
 * Does not handle `Assertion` --- see `groundAssertion.ts`.
 */
export const groundChange = (change: Change, assignment: ReferentAssignment): Change<GroundedReferent> => {
    if (change.primitive === 'transferMembership') {
        return {
            ...change,
            object: groundOneReferent(change.object, assignment),
            from: groundOneReferent(change.from, assignment),
            to: groundOneReferent(change.to, assignment),
        }
    }
    return {
        ...change,
        subject: groundOneReferent(change.subject, assignment),
        target: groundOneReferent(change.target, assignment),
    }
}
