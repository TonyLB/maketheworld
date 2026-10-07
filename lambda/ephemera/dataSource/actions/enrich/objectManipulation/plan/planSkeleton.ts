import type { ParseSkeleton } from '../parse/parseToken'
import type { CommandAttempt } from '../../../commandAttempt'
import { matchContainmentTemplate } from './matchContainmentTemplate'
import { matchLookTemplate } from './matchLookTemplate'
import { matchMembershipTemplate } from './matchMembershipTemplate'

export type PlanSkeletonResult =
    /** Every template's ungrounded attempts, in template order (containment, look, membership). Empty: no object route. */
    { type: 'attempts'; attempts: CommandAttempt[] }

/**
 * Plan (ISS8203 slice 1): the skeleton's ungrounded attempts. Every template answers the same
 * question, so the result is their union. Peer relations have no deterministic parse: they come
 * only from the LLM Plan fallback, which is not built yet, so a peer command plans nothing here.
 * Template order makes the first attempt the primary one. Plan never reads world state, and its
 * attempts carry no `groundedId`s.
 */
export function planSkeleton(skeleton: ParseSkeleton, command: string): PlanSkeletonResult {
    const attempts = [
        matchContainmentTemplate(skeleton, command),
        matchLookTemplate(skeleton, command),
        matchMembershipTemplate(skeleton, command),
    ].flatMap(result => (result.type === 'matched' ? [result.attempt] : []))

    return { type: 'attempts', attempts }
}
