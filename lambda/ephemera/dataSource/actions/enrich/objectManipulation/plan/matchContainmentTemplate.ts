import type { AttemptTemplate, PatternElement } from '../../../deterministicTemplate/deterministicTemplate'
import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, PositionAttemptAction } from '../../../commandAttempt/action'
import type { NarrationUnit } from '../../../commandAttempt/narrationUnit'
import { currentHostRef, objectSpanRef } from './planStep'
import { qualifierObjectPhraseElement } from './qualifierPrepositions'
import { optionAt, spanAt } from './templateCaptures'

/**
 * The containment verbs (RD-1): placing into or onto, each with the third-person form its narration
 * uses. A closed set, so a closed map: anything else is open language for the fallback.
 */
const PLACING_VERB_FORMS: Readonly<Record<string, string>> = { put: 'puts', place: 'places' }

export type ContainmentKind = 'In' | 'On'

/** The containment phrases and the kind each names: `In` for containment, `On` for hosting (AB-54: `On` is a hosting kind, not a peer relation). */
export const CONTAINMENT_PHRASES: Readonly<Record<string, ContainmentKind>> = {
    in: 'In',
    inside: 'In',
    into: 'In',
    'on top of': 'On',
    onto: 'On',
    on: 'On',
}

/**
 * A placing command: verb, object, phrase, target. Each fixed word must be a whole token of the
 * skeleton, so a model's `hurriedly into` is no containment phrase. The object and the target are
 * object phrases, so each reading of a stacked command (`put cup on saucer on table`) is a fill:
 * which phrase is the destination, and which qualify a span.
 */
export const placingPattern = (verbForms: Readonly<Record<string, string>>, phrases: Readonly<Record<string, ContainmentKind>>): readonly PatternElement[] => [
    { type: 'templateText', options: Object.keys(verbForms) },
    qualifierObjectPhraseElement('subject'),
    { type: 'templateText', options: Object.keys(phrases) },
    qualifierObjectPhraseElement('target'),
]

/**
 * A containment command (`put X in Y`, `place X on Y`). The step is a whole-object transfer
 * carrying its containment kind, the same step every containment producer builds. Verbs outside
 * RD-1 (`take`, `tie`, ...) do not fit, so `take X in Y` plans as a membership take.
 *
 * The template created the action, so it authors its narration unit: the player's verb and
 * the matched phrase, one line to everyone who can see the actor or either object, before the move.
 */
export const containmentTemplate: AttemptTemplate<'containment'> = {
    name: 'containment',
    pattern: placingPattern(PLACING_VERB_FORMS, CONTAINMENT_PHRASES),
    build(captures, command) {
        const verbForm = PLACING_VERB_FORMS[optionAt(captures, 0)]
        const phrase = optionAt(captures, 2)
        const subjectSpan = spanAt(captures, 1)
        const targetSpan = spanAt(captures, 3)
        const subject = objectSpanRef(subjectSpan.span, subjectSpan.stableRefKey)
        const target = objectSpanRef(targetSpan.span, targetSpan.stableRefKey)
        const actionId = mintActionId()
        const narrationUnit: NarrationUnit = {
            covers: [actionId],
            variants: [{
                audience: { refs: ['actor', subjectSpan.stableRefKey, targetSpan.stableRefKey], phase: 'before' },
                parts: [
                    { slot: 'actor' },
                    { text: ` ${verbForm} ` },
                    { ref: subjectSpan.stableRefKey },
                    { text: ` ${phrase} ` },
                    { ref: targetSpan.stableRefKey },
                ],
            }],
        }
        return CommandAttempt.create(command, [
            new PositionAttemptAction(actionId, [], {
                kind: 'change',
                primitive: 'transferMembership',
                object: subject,
                from: currentHostRef(subject),
                to: target,
                containment: CONTAINMENT_PHRASES[phrase],
            }),
        ], [narrationUnit])
    },
}
