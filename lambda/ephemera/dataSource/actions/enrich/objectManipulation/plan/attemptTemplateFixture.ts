import type { CommandAttempt } from '../../../commandAttempt'
import type { AttemptTemplate } from '../../../deterministicTemplate/deterministicTemplate'
import { matchAttemptTemplate } from '../../../deterministicTemplate/patternTemplate'
import type { ParseSkeleton } from '../parse/parseToken'

export type TemplateMatchResult = { type: 'matched'; attempt: CommandAttempt } | { type: 'noMatch' }

/**
 * Tests only: one template as a matcher over a skeleton, answering its first attempt or `noMatch`,
 * so template tests of single-reading skeletons read a single result.
 */
export const matchTemplate = (template: AttemptTemplate) => (skeleton: ParseSkeleton, command: string): TemplateMatchResult => {
    const [fill] = matchAttemptTemplate(template, skeleton, command)
    return fill === undefined ? { type: 'noMatch' } : { type: 'matched', attempt: fill.attempt }
}
