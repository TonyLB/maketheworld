import type { ParseSkeleton } from '../parse/parseToken'
import type { CommandAttempt } from '../../../commandAttempt'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'
import { matchLookTemplate } from './matchLookTemplate'
import { matchMembershipTemplate } from './matchMembershipTemplate'
import { matchRelationalTemplate } from './matchRelationalTemplate'

export type PlanSkeletonResult =
    /** Every template's ungrounded attempts, in template order (relational, look, membership). Empty: no object route. */
    | { type: 'attempts'; attempts: CommandAttempt[] }
    | { type: 'declined'; errorMessage: string }

/**
 * Plan (ISS8203 slice 1): the skeleton's ungrounded attempts. Every template answers the same
 * question, so the result is their union. The templates are disjoint today except for a leading
 * `take`, which both the relational template (`take X off Y`) and membership claim; template
 * order makes the first attempt the primary one, the same precedence the old family classifier
 * had. Plan never reads world state, and its attempts carry no `groundedId`s.
 */
export function planSkeleton(skeleton: ParseSkeleton, command: string): PlanSkeletonResult {
    const relational = matchRelationalTemplate(skeleton, command)
    if (relational.type === 'declined') {
        return { type: 'declined', errorMessage: objectManipulationErrorMessages.nestingRelational }
    }

    const attempts = [relational, matchLookTemplate(skeleton, command), matchMembershipTemplate(skeleton, command)]
        .flatMap(result => (result.type === 'matched' ? [result.attempt] : []))

    return { type: 'attempts', attempts }
}
