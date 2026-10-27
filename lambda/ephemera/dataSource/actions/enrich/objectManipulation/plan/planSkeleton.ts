import type { ParseSkeleton } from '../parse/parseToken'
import type { AttemptKind, CommandAttempt } from '../../../commandAttempt'
import type { AttemptTemplate } from '../../../deterministicTemplate/deterministicTemplate'
import type { SkeletonFill } from '../compileAttemptsFromSkeleton'
import type { GranuleToken } from '../../../deterministicTemplate/granuleTokens'
import { matchPattern, readFills } from '../../../deterministicTemplate/patternTemplate'
import { INTENT_TEMPLATES } from '../../../deterministicTemplate/intentTemplates'
import { lowerQualifiers } from './lowerQualifiers'
import { templateSetOf, type TemplateSet } from './templateSet'
import { containmentTemplate } from './matchContainmentTemplate'
import { lookAtTemplate, lookTemplate } from './matchLookTemplate'
import { membershipTemplate } from './matchMembershipTemplate'
import { bareNavigationTemplate, navigationTemplate } from './matchNavigationTemplate'
import { exceedsQualifierCap } from './qualifierPrepositions'
import { spreadTemplate } from './matchSpreadTemplate'

/**
 * Plan's templates, in order: the first attempt is the primary one, so the navigation templates
 * come last, after every object template.
 */
export const PLAN_TEMPLATES: readonly AttemptTemplate[] = [
    containmentTemplate,
    spreadTemplate,
    lookTemplate,
    lookAtTemplate,
    membershipTemplate,
    navigationTemplate,
    bareNavigationTemplate,
]

/**
 * The granules of every deterministic template's fixed words, Plan's templates' and the intent
 * rows' (`deterministicTemplate/intentTemplates.ts`): the one divider set, how both routes cut a
 * command into tokens.
 */
export const LIVE_TEMPLATE_SET: TemplateSet = templateSetOf(PLAN_TEMPLATES, INTENT_TEMPLATES)

export const COMMAND_GRANULES = LIVE_TEMPLATE_SET.granules

/** One fill of one template: its segmentation, and the attempt built from it with its reading's qualifiers lowered. */
export type PlanTemplateRead = { template: AttemptKind; segmentation: ParseSkeleton; segmentationKey: string; attempt: CommandAttempt }

/**
 * Every template's every fill over the tokens (`templates`: the live set unless a test supplies its own), in template order, keys stamped across them all
 * (so one span occurrence has one key in every fill). A command over the guard cap
 * (`exceedsQualifierCap`) has none.
 */
export function readPlanTemplates(tokens: readonly GranuleToken[], command: string, templates: TemplateSet = LIVE_TEMPLATE_SET): PlanTemplateRead[] {
    if (exceedsQualifierCap(tokens)) {
        return []
    }
    const matches = templates.plan.flatMap((template) => matchPattern(template.pattern, tokens).map((fill) => ({ template, pattern: template.pattern, fill })))
    const fills = readFills(tokens, matches)
    return matches.map(({ template }, index) => ({
        template: template.name,
        segmentation: fills[index].segmentation,
        segmentationKey: fills[index].segmentationKey,
        attempt: lowerQualifiers(template.build(fills[index].captures, command), fills[index].reading),
    }))
}

/**
 * Plan (ISS8203 slice 1): the command's ungrounded attempts, by segmentation. Every template
 * answers the same question over the command's tokens, so the result is their union: every fill
 * of every template is a reading, and the readings that cut the command at the same token ranges
 * are one `SkeletonFill`, whose skeleton is that segmentation (`actions/AGENT.contract.md`
 * "Qualifier"). Template order makes the first attempt of a fill the primary one. A qualifier a
 * reading nests onto a span ("the cup on the table") comes out as a `containedBy` assertion action
 * ahead of the template's own. Peer relations have no deterministic parse. Plan never reads world
 * state, and its attempts carry no `groundedId`s.
 */
export function planTokens(tokens: readonly GranuleToken[], command: string, templates: TemplateSet = LIVE_TEMPLATE_SET): SkeletonFill[] {
    const bySegmentation = readPlanTemplates(tokens, command, templates).reduce<Map<string, SkeletonFill>>((fills, { segmentation, segmentationKey, attempt }) => (
        fills.set(segmentationKey, { skeleton: segmentation, attempts: [...(fills.get(segmentationKey)?.attempts ?? []), attempt] })
    ), new Map())
    return [...bySegmentation.values()]
}
