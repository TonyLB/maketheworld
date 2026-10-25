import type { AttemptTemplate, PatternElement } from '../../../deterministicTemplate/deterministicTemplate'
import type { PatternCapture } from '../../../deterministicTemplate/patternTemplate'
import { objectSpanRef } from './planStep'
import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, NarrateAttemptAction } from '../../../commandAttempt/action'
import { QUALIFIER_OBJECT_PHRASE_ELEMENT } from './qualifierPrepositions'
import { spanAt } from './templateCaptures'

/**
 * A look at the object phrase in the pattern's last position. Narration has no desired result, so the
 * referent rides on the narration action itself; a qualifier on the phrase ("the cup on the table") is
 * lowered after the template into an assertion ahead of it (`lowerQualifiers`), which the dry run judges.
 */
const buildLook = (captures: PatternCapture[], command: string): CommandAttempt => {
    const { span, stableRefKey } = spanAt(captures, captures.length - 1)
    return CommandAttempt.create(command, [new NarrateAttemptAction(mintActionId(), [], undefined, [objectSpanRef(span, stableRefKey)])])
}

const LOOK_VERB_ELEMENT: PatternElement = { type: 'templateText', options: ['look', 'l', 'examine', 'x'] }

/**
 * An object-directed look: a look verb and an object phrase. Only ever meaningful once classify has
 * already routed a command through Parse; the template does no family/route detection itself.
 */
export const lookTemplate: AttemptTemplate<'look'> = {
    name: 'look',
    pattern: [LOOK_VERB_ELEMENT, QUALIFIER_OBJECT_PHRASE_ELEMENT],
    build: buildLook,
}

/** `look at` / `l at`: the model emits `at` as its own token, so it is a second pattern sharing the builder. */
export const lookAtTemplate: AttemptTemplate<'look'> = {
    name: 'look',
    pattern: [{ type: 'templateText', options: ['look', 'l'] }, { type: 'templateText', options: ['at'] }, QUALIFIER_OBJECT_PHRASE_ELEMENT],
    build: buildLook,
}
