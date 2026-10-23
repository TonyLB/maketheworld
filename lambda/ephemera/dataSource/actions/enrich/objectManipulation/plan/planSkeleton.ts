import type { ParseSkeleton } from '../parse/parseToken'
import type { CommandAttempt } from '../../../commandAttempt'
import { matchContainmentTemplate } from './matchContainmentTemplate'
import { matchLookTemplate } from './matchLookTemplate'
import { matchMembershipTemplate } from './matchMembershipTemplate'
import { matchSpreadTemplate } from './matchSpreadTemplate'

export type PlanSkeletonResult =
    /** Every template's ungrounded attempts, in template order (containment, spread, look, membership). Empty: no object route. */
    { type: 'attempts'; attempts: CommandAttempt[] }

/**
 * Plan (ISS8203 slice 1): the skeleton's ungrounded attempts. Every template answers the same
 * question, so the result is their union. Peer relations have no deterministic parse: they come
 * only from the LLM Plan fallback, which is not built yet, so a peer command plans nothing here.
 * Template order makes the first attempt the primary one. Plan never reads world state, and its
 * attempts carry no `groundedId`s.
 */
export function planSkeleton(skeleton: ParseSkeleton, command: string): PlanSkeletonResult {
    const attempts = matchPlanTemplates(skeleton, command)
        .flatMap(({ attempt }) => (attempt ? [attempt] : []))

    return { type: 'attempts', attempts }
}

export type PlanTemplateName = 'containment' | 'spread' | 'look' | 'membership'

/** One template's answer for a skeleton: its attempt, or none when it did not match. */
export type PlanTemplateMatch = { template: PlanTemplateName; attempt?: CommandAttempt }

/** Every template's answer, in template order, matched or not: what `planSkeleton` unions, labelled for the `/test parse` harness. */
export function matchPlanTemplates(skeleton: ParseSkeleton, command: string): PlanTemplateMatch[] {
    const results = [
        { template: 'containment', result: matchContainmentTemplate(skeleton, command) },
        { template: 'spread', result: matchSpreadTemplate(skeleton, command) },
        { template: 'look', result: matchLookTemplate(skeleton, command) },
        { template: 'membership', result: matchMembershipTemplate(skeleton, command) },
    ] as const
    return results.map(({ template, result }) => (
        result.type === 'matched' ? { template, attempt: result.attempt } : { template }
    ))
}
