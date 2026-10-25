import type { ParseSkeleton } from '../parse/parseToken'
import type { CommandAttempt } from '../../../commandAttempt'
import { matchAttemptTemplate } from '../../../deterministicTemplate/patternTemplate'
import { lowerQualifiers } from './lowerQualifiers'
import { containmentTemplate } from './matchContainmentTemplate'
import { lookAtTemplate, lookTemplate } from './matchLookTemplate'
import { membershipTemplate } from './matchMembershipTemplate'
import { spreadTemplate } from './matchSpreadTemplate'

export type PlanSkeletonResult =
    /** Every template's ungrounded attempts, in template order (containment, spread, look, membership). Empty: no object route. */
    { type: 'attempts'; attempts: CommandAttempt[] }

/**
 * Plan (ISS8203 slice 1): the skeleton's ungrounded attempts. Every template answers the same
 * question, so the result is their union. Peer relations have no deterministic parse: they come
 * only from the LLM Plan fallback, which is not built yet, so a peer command plans nothing here.
 * Template order makes the first attempt the primary one. A qualifier a reading nests onto a span
 * ("the cup on the table") comes out as a `containedBy` assertion action ahead of the template's
 * own (`matchPlanTemplates`). Plan never reads world state, and its attempts carry no `groundedId`s.
 */
export function planSkeleton(skeleton: ParseSkeleton, command: string): PlanSkeletonResult {
    const attempts = matchPlanTemplates(skeleton, command)
        .flatMap(({ attempt }) => (attempt ? [attempt] : []))

    return { type: 'attempts', attempts }
}

/** The object templates, in order: the first attempt is the primary one. */
const PLAN_TEMPLATES = [containmentTemplate, spreadTemplate, lookTemplate, lookAtTemplate, membershipTemplate] as const

export type PlanTemplateName = typeof PLAN_TEMPLATES[number]['name']

/** One template's answer for a skeleton: its attempt, or none when it did not match. */
export type PlanTemplateMatch = { template: PlanTemplateName; attempt?: CommandAttempt }

/**
 * Every template's answer, in template order, matched or not: what `planSkeleton` unions, labelled
 * for the `/test parse` harness. Each template is matched against the flat skeleton, and each fill
 * is a reading (its object phrases' spans nested as qualifiers); each fill's attempt has its own
 * reading's qualifiers lowered into assertion actions (`lowerQualifiers`), and every reading's
 * attempts are pooled.
 */
export function matchPlanTemplates(skeleton: ParseSkeleton, command: string): PlanTemplateMatch[] {
    return PLAN_TEMPLATES.flatMap((template): PlanTemplateMatch[] => {
        const fills = matchAttemptTemplate(template, skeleton, command)
        return fills.length === 0
            ? [{ template: template.name }]
            : fills.map(({ attempt, reading }) => ({ template: template.name, attempt: lowerQualifiers(attempt, reading) }))
    })
}
