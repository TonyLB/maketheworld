import type { ParseSkeleton } from '../parse/parseToken'
import type { CommandAttempt } from '../../../commandAttempt'
import { matchContainmentTemplate } from './matchContainmentTemplate'
import { matchLookTemplate } from './matchLookTemplate'
import { matchMembershipTemplate } from './matchMembershipTemplate'
import { matchRelationalTemplate } from './matchRelationalTemplate'

export type PlanSkeletonResult =
    /** Every template's ungrounded attempts, in template order (containment, relational, look, membership). Empty: no object route. */
    { type: 'attempts'; attempts: CommandAttempt[] }

/**
 * Plan (ISS8203 slice 1): the skeleton's ungrounded attempts. Every template answers the same
 * question, so the result is their union. Containment and relational are disjoint by their
 * prepositions, so only one of them claims a command; a leading `take` can still reach both
 * membership and the relational template (`take X off Y`). Template order makes the first attempt
 * the primary one. Plan never reads world state, and its attempts carry no `groundedId`s.
 */
export function planSkeleton(skeleton: ParseSkeleton, command: string): PlanSkeletonResult {
    const attempts = [
        matchContainmentTemplate(skeleton, command),
        matchRelationalTemplate(skeleton, command),
        matchLookTemplate(skeleton, command),
        matchMembershipTemplate(skeleton, command),
    ].flatMap(result => (result.type === 'matched' ? [result.attempt] : []))

    return { type: 'attempts', attempts }
}
