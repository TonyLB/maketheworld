import type { AttemptTemplate } from '../../../deterministicTemplate/deterministicTemplate'
import { granulesOf, type Granules } from '../../../deterministicTemplate/granuleTokens'
import type { IntentTemplate } from '../../../deterministicTemplate/intentTemplates'
import { fixedWordsOf } from '../../../deterministicTemplate/patternTemplate'

/**
 * The deterministic templates a command is read against, and the one divider set they make: Plan's
 * templates, the intent rows, and the granules of every fixed word either reads. Production reads
 * `LIVE_TEMPLATE_SET` (`planSkeleton.ts`); a test supplies its own (`templateSetOf`) so that what it
 * pins does not move when the live set does.
 */
export type TemplateSet = {
    plan: readonly AttemptTemplate[]
    intents: readonly IntentTemplate[]
    granules: Granules
}

export const templateSetOf = (plan: readonly AttemptTemplate[], intents: readonly IntentTemplate[] = []): TemplateSet => ({
    plan,
    intents,
    granules: granulesOf([...plan, ...intents].flatMap(({ pattern }) => fixedWordsOf(pattern))),
})
