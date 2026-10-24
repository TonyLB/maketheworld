import type { ParseSkeleton } from '../parse/parseToken'
import type { CommandAttempt } from '../../../commandAttempt'
import { groupSkeleton } from './groupSkeleton'
import { matchAttemptTemplate } from '../../../deterministicTemplate/patternTemplate'
import { lowerQualifiers } from './lowerQualifiers'
import { containmentTemplate } from './matchContainmentTemplate'
import { lookTemplate } from './matchLookTemplate'
import { membershipTemplate } from './matchMembershipTemplate'
import { spreadTemplate } from './matchSpreadTemplate'

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

/** The object templates, in order: the first attempt is the primary one. */
const PLAN_TEMPLATES = [containmentTemplate, spreadTemplate, lookTemplate, membershipTemplate] as const

export type PlanTemplateName = typeof PLAN_TEMPLATES[number]['name']

/** One template's answer for a skeleton: its attempt, or none when it did not match. */
export type PlanTemplateMatch = { template: PlanTemplateName; attempt?: CommandAttempt }

/**
 * Every template's answer, in template order, matched or not: what `planSkeleton` unions, labelled
 * for the `/test parse` harness. The templates run on each reading of the flat skeleton
 * (`groupSkeleton`), and each matched attempt has its reading's qualifiers lowered into assertion
 * actions (`lowerQualifiers`); every reading's answers are pooled.
 */
export function matchPlanTemplates(skeleton: ParseSkeleton, command: string): PlanTemplateMatch[] {
    return groupSkeleton(skeleton).flatMap((reading) => PLAN_TEMPLATES.flatMap((template): PlanTemplateMatch[] => {
        const attempts = matchAttemptTemplate(template, reading, command)
        return attempts.length === 0
            ? [{ template: template.name }]
            : attempts.map((attempt) => ({ template: template.name, attempt: lowerQualifiers(attempt, reading) }))
    }))
}
