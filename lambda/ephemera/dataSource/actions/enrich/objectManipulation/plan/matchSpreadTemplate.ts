import type { ParseSkeleton, ParseToken, TextToken } from '../parse/parseToken'
import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, PositionAttemptAction } from '../../../commandAttempt/action'
import type { NarrationUnit } from '../../../commandAttempt/narrationUnit'
import { matchContainmentPhrase } from './matchContainmentTemplate'
import { currentHostRef, objectSpanRef } from './planStep'

/**
 * The spreading verbs, each with the third-person form its narration uses. A closed set, so a
 * closed map. `put`/`place` stay the containment template's, so the two never claim one command;
 * `lay` is left out, since "lay X on Y" ordinarily means a put.
 */
const SPREADING_VERB_FORMS: Readonly<Record<string, string>> = { spread: 'spreads', drape: 'drapes' }
/** Read as `On` for a spread only: `put X over Y` stays unclaimed. */
const SPREAD_ON_PHRASES = ['over', 'across'] as const

export type SpreadTemplateMatchResult =
    | { type: 'matched'; attempt: CommandAttempt }
    | { type: 'noMatch' }

function isTextToken(token: ParseToken): token is TextToken {
    return token.type === 'text'
}

/**
 * Matches a spread command (`spread X over Y`, `drape X on Y`) against the one closed shape
 * TEXT(verb) OBJECTSPAN TEXT(prep) OBJECTSPAN: the object is laid partly onto (or into) another
 * and stays where it is (PS-4). The step is the containment transfer with `keepFrom`, so the
 * object's one binding gains the target's as a parent and keeps its own.
 *
 * **The naive implementation of the spread intent.** A closed phrase list is a stand-in: the LLM
 * Plan fallback replaces it, producing the same `keepFrom` transfer from open phrasing.
 *
 * Narration follows the containment template's pattern: the player's verb and the matched phrase,
 * one line to everyone who can see the actor or either object, before the move.
 */
export function matchSpreadTemplate(skeleton: ParseSkeleton, command: string): SpreadTemplateMatchResult {
    if (skeleton.length !== 4) {
        return { type: 'noMatch' }
    }
    const [verbToken, subjectToken, prepToken, targetToken] = skeleton
    if (
        !isTextToken(verbToken)
        || subjectToken.type !== 'objectSpan'
        || !isTextToken(prepToken)
        || targetToken.type !== 'objectSpan'
    ) {
        return { type: 'noMatch' }
    }
    const verbForm = SPREADING_VERB_FORMS[verbToken.text.trim().toLowerCase()]
    if (verbForm === undefined) {
        return { type: 'noMatch' }
    }
    const matchedPhrase = matchContainmentPhrase(prepToken.text, SPREAD_ON_PHRASES)
    if (!matchedPhrase) {
        return { type: 'noMatch' }
    }
    const { containment, phrase } = matchedPhrase

    const subject = objectSpanRef(subjectToken.span, subjectToken.stableRefKey)
    const target = objectSpanRef(targetToken.span, targetToken.stableRefKey)
    const actionId = mintActionId()
    const narrationUnit: NarrationUnit = {
        covers: [actionId],
        variants: [{
            audience: { refs: ['actor', subjectToken.stableRefKey, targetToken.stableRefKey], phase: 'before' },
            parts: [
                { slot: 'actor' },
                { text: ` ${verbForm} ` },
                { ref: subjectToken.stableRefKey },
                { text: ` ${phrase} ` },
                { ref: targetToken.stableRefKey },
            ],
        }],
    }
    return {
        type: 'matched',
        attempt: CommandAttempt.create(command, [
            new PositionAttemptAction(actionId, [], {
                kind: 'change',
                primitive: 'transferMembership',
                object: subject,
                from: currentHostRef(subject),
                to: target,
                containment,
                keepFrom: true,
            }),
        ], [narrationUnit]),
    }
}
