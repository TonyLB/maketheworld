import type { AttemptTemplate } from '../../../deterministicTemplate/deterministicTemplate'
import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, PositionAttemptAction } from '../../../commandAttempt/action'
import type { NarrationUnit } from '../../../commandAttempt/narrationUnit'
import { CONTAINMENT_PHRASES, placingPattern, type ContainmentKind } from './matchContainmentTemplate'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import { currentHostRef, objectSpanRef } from './planStep'
import type { Referent } from './planStep'
import { optionAt, spanAt } from './templateCaptures'

/**
 * The spreading verbs, each with the third-person form its narration uses. A closed set, so a
 * closed map. `put`/`place` stay the containment template's, so the two never claim one command;
 * `lay` is left out, since "lay X on Y" ordinarily means a put.
 */
const SPREADING_VERB_FORMS: Readonly<Record<string, string>> = { spread: 'spreads', drape: 'drapes' }
/** The containment phrases, plus `over`/`across` read as `On` for a spread only: `put X over Y` stays unclaimed. */
const SPREAD_PHRASES: Readonly<Record<string, ContainmentKind>> = { ...CONTAINMENT_PHRASES, over: 'On', across: 'On' }

/**
 * A spread command (`spread X over Y`, `drape X on Y`): the object is laid partly onto (or into)
 * another and stays where it is. Two steps: extend the object in place (a second binding, connected
 * to the first), then move the new binding into the target with the containment transfer. The
 * extend's minted `presenceUuid` is how the move names the binding before it exists
 * (the moved referent's `view`).
 *
 * **The naive implementation of the spread intent.** A closed phrase list is a stand-in: the LLM
 * Plan fallback replaces it, producing the same two steps from open phrasing. Extend assumes the
 * object has extent, so for this route the closed verb list is what keeps extend to things that
 * drape and spread.
 *
 * Narration follows the containment template's pattern: the player's verb and the matched phrase,
 * one line to everyone who can see the actor or either object, before the move.
 */
export const spreadTemplate: AttemptTemplate<'spread'> = {
    name: 'spread',
    pattern: placingPattern(SPREADING_VERB_FORMS, SPREAD_PHRASES),
    build(captures, command) {
        const verbForm = SPREADING_VERB_FORMS[optionAt(captures, 0)]
        const phrase = optionAt(captures, 2)
        const subjectSpan = spanAt(captures, 1)
        const targetSpan = spanAt(captures, 3)
        const subject = objectSpanRef(subjectSpan.span, subjectSpan.stableRefKey)
        const target = objectSpanRef(targetSpan.span, targetSpan.stableRefKey)
        const extendActionId = mintActionId()
        const actionId = mintActionId()
        const presenceUuid = mintActionId()
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
            new PositionAttemptAction(extendActionId, [], {
                kind: 'change',
                primitive: 'extend',
                object: subject,
                presenceUuid,
            }),
            new PositionAttemptAction(actionId, [], {
                kind: 'change',
                primitive: 'transferMembership',
                object: { ...subject, view: [PresenceKey(presenceUuid)] } as Referent,
                from: currentHostRef(subject),
                to: target,
                containment: SPREAD_PHRASES[phrase],
            }),
        ], [narrationUnit])
    },
}
