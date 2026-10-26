import type { CommandAttempt } from '../../../commandAttempt'
import type { AttemptTemplate } from '../../../deterministicTemplate/deterministicTemplate'
import { tokenize } from '../../../deterministicTemplate/granuleTokens'
import { matchPatternFills, skeletonText } from '../../../deterministicTemplate/patternTemplate'
import type { SkeletonFill } from '../compileAttemptsFromSkeleton'
import type { ParseSkeleton, ParseToken, ParseTokenDraft } from '../parse/parseToken'
import { PLAN_GRANULES, planSkeleton } from './planSkeleton'

export type TemplateMatchResult = { type: 'matched'; attempt: CommandAttempt } | { type: 'noMatch' }

const wordsOf = (text: string): string => text.trim().split(/\s+/).join(' ').toLowerCase()

/** Tests only: whether two flat skeletons cut the same words the same way (keys aside). */
export const sameSegmentation = (left: readonly (ParseTokenDraft | ParseToken)[], right: readonly (ParseTokenDraft | ParseToken)[]): boolean => (
    left.length === right.length && left.every((token, index) => {
        const other = right[index]
        return token.type === other.type && wordsOf(token.type === 'objectSpan' ? token.span : token.text) === wordsOf(other.type === 'objectSpan' ? other.span : other.text)
    })
)

/**
 * Tests only: one template as a matcher over a skeleton, answering the attempt it builds from the
 * fill that cuts the skeleton's words as the skeleton does, or `noMatch`, so template tests of a
 * Parse-shaped skeleton read that one reading.
 */
export const matchTemplate = (template: AttemptTemplate) => (skeleton: ParseSkeleton, command: string): TemplateMatchResult => {
    const fill = matchPatternFills(template.pattern, tokenize(PLAN_GRANULES, skeletonText(skeleton)))
        .find(({ segmentation }) => sameSegmentation(segmentation, skeleton))
    return fill === undefined ? { type: 'noMatch' } : { type: 'matched', attempt: template.build(fill.captures, command) }
}

/**
 * Tests only: Plan's fill for one segmentation of a command, as the producer receives it: the
 * attempts every template reads from the words cut as `skeleton` cuts them. Throws when no reading
 * makes that segmentation.
 */
export const planFillOf = (skeleton: readonly (ParseTokenDraft | ParseToken)[], command: string): SkeletonFill => {
    const fill = planSkeleton(skeleton, command).fills.find((each) => sameSegmentation(each.skeleton, skeleton))
    if (fill === undefined) {
        throw new Error(`planFillOf: no reading of "${command}" cuts it as the skeleton does`)
    }
    return fill
}
