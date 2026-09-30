import type { EphemeraThingId } from '../enrich/objectManipulation/thing'
import type { CommandAttemptReferent } from './index'

/**
 * Named constructor for `CommandAttemptReferent` (slice 2), a sibling to
 * `plan/ungroundedPrimitive.ts`'s `objectSpanRef`/`actingCharacterRef` factories ---
 * referents aren't a class family (slice 1.6), so this stays a plain function rather
 * than a static class method. `refKey` is the stableRefKey link back to Plan's
 * ungrounded `Referent` (CA-1); `shortName` comes from Identify's resolved
 * `ObjectSpanCandidate.label`; `gloss` comes from the `ludicCache` node, present only
 * where authored or improvised (`EphemeraLudicCacheNode.gloss?: string`'s convention).
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
