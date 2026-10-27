import type { ParseSkeleton, ParseToken, ParseTokenDraft } from '../parse/parseToken'
import type { AttemptKind, CommandAttempt } from '../../../commandAttempt'
import type { AttemptTemplate } from '../../../deterministicTemplate/deterministicTemplate'
import type { SkeletonFill } from '../compileAttemptsFromSkeleton'
import { granulesOf, tokenize, type GranuleToken } from '../../../deterministicTemplate/granuleTokens'
import { fixedWordsOf, matchPattern, readFills, skeletonText } from '../../../deterministicTemplate/patternTemplate'
import { lowerQualifiers } from './lowerQualifiers'
import { containmentTemplate } from './matchContainmentTemplate'
import { lookAtTemplate, lookTemplate } from './matchLookTemplate'
import { membershipTemplate } from './matchMembershipTemplate'
import { exceedsQualifierCap } from './qualifierPrepositions'
import { spreadTemplate } from './matchSpreadTemplate'

/** The object templates, in order: the first attempt is the primary one. */
const PLAN_TEMPLATES: readonly AttemptTemplate[] = [containmentTemplate, spreadTemplate, lookTemplate, lookAtTemplate, membershipTemplate]

/** The granules of every object template's fixed words: how both routes cut a command into tokens. */
export const PLAN_GRANULES = granulesOf(PLAN_TEMPLATES.flatMap(({ pattern }) => fixedWordsOf(pattern)))

/** One fill of one template: its segmentation, and the attempt built from it with its reading's qualifiers lowered. */
export type PlanTemplateRead = { template: AttemptKind; segmentation: ParseSkeleton; segmentationKey: string; attempt: CommandAttempt }

/**
 * Every template's every fill over the tokens, in template order, keys stamped across them all
 * (so one span occurrence has one key in every fill). A command over the guard cap
 * (`exceedsQualifierCap`) has none.
 */
export function readPlanTemplates(tokens: readonly GranuleToken[], command: string): PlanTemplateRead[] {
    if (exceedsQualifierCap(tokens)) {
        return []
    }
    const matches = PLAN_TEMPLATES.flatMap((template) => matchPattern(template.pattern, tokens).map((fill) => ({ template, pattern: template.pattern, fill })))
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
export function planTokens(tokens: readonly GranuleToken[], command: string): SkeletonFill[] {
    const bySegmentation = readPlanTemplates(tokens, command).reduce<Map<string, SkeletonFill>>((fills, { segmentation, segmentationKey, attempt }) => (
        fills.set(segmentationKey, { skeleton: segmentation, attempts: [...(fills.get(segmentationKey)?.attempts ?? []), attempt] })
    ), new Map())
    return [...bySegmentation.values()]
}

export type PlanSkeletonResult =
    /** Every reading's attempts, by segmentation. Empty: no object route. */
    { type: 'attempts'; fills: SkeletonFill[] }

/**
 * The LLM route's entry into Plan: the words Parse's skeleton spells, spans and text alike,
 * cut into tokens as the command's own would be (`PLAN_GRANULES`), so Parse contributes its
 * words and never its segmentation.
 */
export function planSkeleton(skeleton: readonly (ParseTokenDraft | ParseToken)[], command: string): PlanSkeletonResult {
    return { type: 'attempts', fills: planTokens(tokenize(PLAN_GRANULES, skeletonText(skeleton)), command) }
}
