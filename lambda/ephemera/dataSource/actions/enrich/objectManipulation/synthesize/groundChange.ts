import type { Change, GroundedReferent, Referent } from '../plan/planStep'
import { withGroundedId } from '../plan/planStep'
import { groundReferent, type GroundingContext } from './groundReferent'

/**
 * `ok: false` is hard-terminal today, same caveat as `GroundReferentResult`
 * (whose failures propagate straight through here) --- see BD-18
 * (`AGENT.backtrackChannel.planning.md`) for the unbuilt
 * Synthesize -> Identify backtrack direction this shape should stay
 * compatible with.
 */
export type GroundChangeResult =
    | { ok: true; change: Change<GroundedReferent> }
    | { ok: false; reason: string }

type GroundOneResult =
    | { ok: true; referent: GroundedReferent }
    | { ok: false; reason: string }

const groundOne = (referent: Referent, context: GroundingContext): GroundOneResult => {
    const result = groundReferent(referent, context)
    if (!result.ok) {
        return result
    }
    const [groundedId, ...rest] = result.candidates
    if (groundedId === undefined || rest.length > 0) {
        return {
            ok: false,
            reason: `${referent.referentType} referent grounded to ${result.candidates.length} candidates --- expected exactly one (AP-1: the product over identity candidates is formed by the producer, before Grounding)`,
        }
    }
    return { ok: true, referent: withGroundedId(referent, groundedId) }
}

/**
 * Grounds a single `Change` (Plan's output) to one answer: the same `Change`, every referent
 * kept and given its id (AP-1, `AGENT.commandAttemptPipeline.planning.md`). A referent with a
 * known `groundedId` passes through; a derived one (`actingCharacter`, `currentHost(X)`) is
 * looked up. The product over identity candidates is not formed here: the producer forms it
 * before Grounding (`enumerateIdentityAssignments`) and grounds phrase-named referents by
 * substitution (`groundStepBySubstitution`), one assignment per candidate. So a referent that
 * still grounds to several candidates fails rather than fanning out.
 *
 * Primitive-agnostic: a relational `Change` grounds the same way, though its referents already
 * carry ids by the time any live caller sees it. Typing each id for its slot (is this an object,
 * is that a membership host?) is lowering's job (`executor.ts`), not Grounding's. Whether a
 * self-reference is legal ("can't put an object on itself") is Validation's.
 *
 * Does not handle `Assertion` --- Plan's shipped compiler never emits one today
 * (`containedBy` unused), so this is a type-level exclusion, not a TODO.
 *
 * `transferMembership`'s object is one object, and that is complete: anything it hosts lives
 * in its own shard and travels with it. The relational edges the move must dissolve are not
 * Grounding's: Expansion adds them to the attempt as facilitating actions before the executor
 * runs (`commandAttempt/expandBoundaryChallenges.ts`).
 */
export const groundChange = (change: Change, context: GroundingContext): GroundChangeResult => {
    if (change.primitive === 'transferMembership') {
        const object = groundOne(change.object, context)
        if (!object.ok) {
            return object
        }
        const from = groundOne(change.from, context)
        if (!from.ok) {
            return from
        }
        const to = groundOne(change.to, context)
        if (!to.ok) {
            return to
        }
        return { ok: true, change: { ...change, object: object.referent, from: from.referent, to: to.referent } }
    }
    const subject = groundOne(change.subject, context)
    if (!subject.ok) {
        return subject
    }
    const target = groundOne(change.target, context)
    if (!target.ok) {
        return target
    }
    return { ok: true, change: { ...change, subject: subject.referent, target: target.referent } }
}
