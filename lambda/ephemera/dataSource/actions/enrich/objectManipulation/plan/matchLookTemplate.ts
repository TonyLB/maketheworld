import { defineAttemptTemplate, fixedWord, words, type ObjectPhraseCapture } from '../../../deterministicTemplate/deterministicTemplate'
import { objectSpanRef } from './planStep'
import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, NarrateAttemptAction } from '../../../commandAttempt/action'
import { QUALIFIER_OBJECT_PHRASE_ELEMENT } from './qualifierPrepositions'

/**
 * A look at the `subject` object phrase. Narration has no desired result, so the referent rides on
 * the narration action itself; a qualifier on the phrase ("the cup on the table") is lowered after
 * the template into an assertion ahead of it (`lowerQualifiers`), which the dry run judges.
 */
const buildLook = ({ subject }: { subject: ObjectPhraseCapture }, command: string): CommandAttempt => (
    CommandAttempt.create('look', command, [new NarrateAttemptAction(mintActionId(), [], undefined, [objectSpanRef(subject.text, subject.stableRefKey)])])
)

/**
 * An object-directed look: a look verb and an object phrase. Only ever meaningful once classify has
 * already routed a command through Parse; the template does no family/route detection itself.
 */
export const lookTemplate = defineAttemptTemplate({
    name: 'look',
    pattern: [fixedWord('verb', { look: 'look', l: 'look', examine: 'examine', x: 'examine' }), QUALIFIER_OBJECT_PHRASE_ELEMENT],
    build: buildLook,
})

/** `look at` / `l at`: the model emits `at` as its own token, so it is a second pattern sharing the builder. */
export const lookAtTemplate = defineAttemptTemplate({
    name: 'look',
    pattern: [fixedWord('verb', { look: 'look', l: 'look' }), words('at'), QUALIFIER_OBJECT_PHRASE_ELEMENT],
    build: buildLook,
})
