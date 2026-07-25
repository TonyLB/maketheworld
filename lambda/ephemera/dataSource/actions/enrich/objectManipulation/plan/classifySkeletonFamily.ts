import type { ParseSkeleton } from '../parse/parseToken'
import type { ManipulationVerbClass } from '../../../baseClasses'
import { matchLookTemplate } from './matchLookTemplate'
import { matchRelationalTemplate } from './matchRelationalTemplate'

export type SkeletonFamilyMatch =
    | { type: 'membership'; verbClass: ManipulationVerbClass }
    | { type: 'relational' }
    | { type: 'relationalDefer' }
    | { type: 'look' }
    | { type: 'none' }

/**
 * CPG-3 (iteration 7, Sub-iteration 1): once classify stops deciding
 * ObjectMembershipIntent vs. ObjectRelateIntent, something must derive that split from
 * the Parse skeleton before dispatch. Relational is checked first --- this reproduces
 * classify's old tie-breaker ("ObjectRelateIntent beats ObjectMembershipIntent") and
 * resolves the real take/remove ambiguity ("take rope off crate" is relational dissolve;
 * "take rope" is membership acquire) via matchRelationalTemplate's stricter structural
 * 4-token requirement, which a bare acquire/release verb check can't distinguish alone.
 *
 * The membership check mirrors deterministicChecks.ts's acquire/release regex
 * (`take`/`get` -> acquire, `drop` -> release), but runs against the skeleton's leading
 * text token instead of raw command text --- Parse has already segmented the verb from
 * the object span by this point.
 */
export function classifySkeletonFamily(skeleton: ParseSkeleton): SkeletonFamilyMatch {
    const relational = matchRelationalTemplate(skeleton)
    if (relational.type === 'matched') {
        return { type: 'relational' }
    }
    if (relational.type === 'nestingDefer') {
        return { type: 'relationalDefer' }
    }

    const look = matchLookTemplate(skeleton)
    if (look.type === 'matched') {
        return { type: 'look' }
    }

    const [firstToken] = skeleton
    if (firstToken && firstToken.type === 'text') {
        const leadingVerb = firstToken.text.trim().toLowerCase()
        if (leadingVerb === 'take' || leadingVerb === 'get') {
            return { type: 'membership', verbClass: 'acquire' }
        }
        if (leadingVerb === 'drop') {
            return { type: 'membership', verbClass: 'release' }
        }
    }

    return { type: 'none' }
}
