import type { ParseSkeleton } from '../parse/parseToken'
import type { CommandAttempt } from '../../../commandAttempt'
import { groupSkeleton } from './groupSkeleton'
import { lowerQualifiers } from './lowerQualifiers'
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
 * Template order makes the first attempt the primary one. A qualifier the skeleton groups onto a span
 * ("the cup on the table") comes out as a `containedBy` assertion action ahead of the template's
 * own (`matchPlanTemplates`). Plan never reads world state, and its attempts carry no `groundedId`s.
 */
export function planSkeleton(skeleton: ParseSkeleton, command: string): PlanSkeletonResult {
    const attempts = matchPlanTemplates(skeleton, command)
        .flatMap(({ attempt }) => (attempt ? [attempt] : []))

    return { type: 'attempts', attempts }
}

export type PlanTemplateName = 'containment' | 'spread' | 'look' | 'membership'

/** One template's answer for a skeleton: its attempt, or none when it did not match. */
export type PlanTemplateMatch = { template: PlanTemplateName; attempt?: CommandAttempt }

/**
 * Every template's answer, in template order, matched or not: what `planSkeleton` unions, labelled
 * for the `/test parse` harness. The templates run on each reading of the flat skeleton
 * (`groupSkeleton`), and each matched attempt has its reading's qualifiers lowered into assertion
 * actions (`lowerQualifiers`); every reading's answers are pooled.
 */
export function matchPlanTemplates(skeleton: ParseSkeleton, command: string): PlanTemplateMatch[] {
    return groupSkeleton(skeleton).flatMap((reading) => {
        const results = [
            { template: 'containment', result: matchContainmentTemplate(reading, command) },
            { template: 'spread', result: matchSpreadTemplate(reading, command) },
            { template: 'look', result: matchLookTemplate(reading, command) },
            { template: 'membership', result: matchMembershipTemplate(reading, command) },
        ] as const
        return results.map(({ template, result }): PlanTemplateMatch => (
            result.type === 'matched' ? { template, attempt: lowerQualifiers(result.attempt, reading) } : { template }
        ))
    })
}
