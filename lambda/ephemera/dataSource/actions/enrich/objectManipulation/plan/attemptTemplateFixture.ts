import type { CommandAttempt } from '../../../commandAttempt'
import type { AttemptTemplate } from '../../../deterministicTemplate/deterministicTemplate'
import { matchAttemptTemplate } from '../../../deterministicTemplate/patternTemplate'
import type { ParseSkeleton } from '../parse/parseToken'

export type TemplateMatchResult = { type: 'matched'; attempt: CommandAttempt } | { type: 'noMatch' }

/**
 * Tests only: one template as a matcher over a skeleton, answering its one attempt or `noMatch`
 * (the token engine gives at most one fill), so template tests read a single result.
 */
export const matchTemplate = (template: AttemptTemplate) => (skeleton: ParseSkeleton, command: string): TemplateMatchResult => {
    const [attempt] = matchAttemptTemplate(template, skeleton, command)
    return attempt === undefined ? { type: 'noMatch' } : { type: 'matched', attempt }
}
