import type { Change, GroundedId, GroundedPresence, PlanStep, Referent } from './plan/planStep'

/** What one identity candidate says about a span key: its id, the names prose reads, and where it was seen. */
export type SpanName = { id: GroundedId; shortName: string; gloss?: string; presence?: GroundedPresence }

export const stampReferent = <R extends Referent>(referent: R, names: ReadonlyMap<string, SpanName>): R => {
    if (referent.referentType === 'objectSpan') {
        const name = referent.stableRefKey !== undefined ? names.get(referent.stableRefKey) : undefined
        if (!name) {
            return referent
        }
        return {
            ...referent,
            groundedId: name.id,
            shortName: name.shortName,
            ...(name.gloss !== undefined ? { gloss: name.gloss } : {}),
            ...(name.presence !== undefined ? { groundedPresence: name.presence } : {}),
        }
    }
    if (referent.referentType === 'currentHost') {
        return { ...referent, referentTarget: stampReferent(referent.referentTarget, names) }
    }
    return referent
}

/**
 * Stamps one candidate's span identities onto a step: every span referent with a key in
 * `names` gets its `groundedId`, `shortName`, `gloss` and `groundedPresence`, including the span nested inside a
 * `currentHost`. Derived referents (`actingCharacter`, `currentHost(actingCharacter)`) are
 * left alone --- they are resolved per snapshot, not per candidate. Pure: returns a new step.
 */
export const stampCandidateReferents = <S extends PlanStep>(step: S, names: ReadonlyMap<string, SpanName>): S => {
    if (step.kind === 'assertion') {
        return { ...step, subject: stampReferent(step.subject, names), object: stampReferent(step.object, names) }
    }
    const change = step as Change
    if (change.primitive === 'transferMembership') {
        return {
            ...change,
            object: stampReferent(change.object, names),
            from: stampReferent(change.from, names),
            to: stampReferent(change.to, names),
        } as S
    }
    return {
        ...change,
        subject: stampReferent(change.subject, names),
        target: stampReferent(change.target, names),
    } as S
}
