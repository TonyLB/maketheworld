import type { AttemptTemplate } from '../../../deterministicTemplate/deterministicTemplate'
import { objectSpanRef } from './planStep'
import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, NarrateAttemptAction } from '../../../commandAttempt/action'
import { spanAt } from './templateCaptures'

/**
 * An object-directed look: a look verb and one span. No preposition/relation phrase (unlike the
 * containment template) --- a describe referent is singular with no relation to another referent.
 * Only ever meaningful once classify has already routed a command through Parse; the template does
 * no family/route detection itself.
 */
export const lookTemplate: AttemptTemplate<'look'> = {
    name: 'look',
    pattern: [
        { type: 'templateText', options: ['look', 'l', 'examine', 'x'] },
        { type: 'objectSpan', role: 'subject' },
    ],
    build(captures, command) {
        // Narration has no desired result, so the referent rides on the narration action itself.
        const { span, stableRefKey } = spanAt(captures, 1)
        return CommandAttempt.create(command, [new NarrateAttemptAction(mintActionId(), [], undefined, [objectSpanRef(span, stableRefKey)])])
    },
}
