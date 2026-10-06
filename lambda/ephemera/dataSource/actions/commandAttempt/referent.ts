import type { EphemeraThingId } from '../enrich/objectManipulation/thing'
import type { Referent } from '../enrich/objectManipulation/plan/planStep'
import type { CommandAttemptReferent } from './index'

/**
 * Named constructor for `CommandAttemptReferent` (slice 2), a sibling to
 * `plan/planStep.ts`'s `objectSpanRef`/`actingCharacterRef` factories ---
 * referents aren't a class family (slice 1.6), so this stays a plain function rather
 * than a static class method. `refKey` is the stableRefKey link back to Plan's
 * `Referent` (CA-1); `shortName` comes from Identify's resolved
 * `ObjectSpanCandidate.label`; `gloss` comes from the `ludicCache` node, present only
 * where authored or improvised (`EphemeraLudicCacheNode.gloss?: string`'s convention).
 * Used only to derive the prose's referents section from the actions' span referents
 * (`index.ts`'s `referentsFromActions`); nothing stores or reads this record as data.
 */
export const buildCommandAttemptReferent = (
    refKey: string,
    id: EphemeraThingId,
    shortName: string,
    gloss?: string
): CommandAttemptReferent => ({
    refKey,
    id,
    shortName,
    ...(gloss !== undefined ? { gloss } : {}),
})

/** Every object-span referent inside `referent`, including one nested under a `currentHost`. */
export const objectSpansIn = (referent: Referent): Extract<Referent, { referentType: 'objectSpan' }>[] => {
    if (referent.referentType === 'objectSpan') {
        return [referent]
    }
    if (referent.referentType === 'currentHost') {
        return objectSpansIn(referent.referentTarget)
    }
    return []
}
