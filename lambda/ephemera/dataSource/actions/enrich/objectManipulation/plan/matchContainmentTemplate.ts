import type { ParseSkeleton, ParseToken, TextToken } from '../parse/parseToken'
import { normalizeExitName } from '../../../roomExitTargetsForCharacter'
import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, PositionAttemptAction } from '../../../commandAttempt/action'
import type { NarrationUnit } from '../../../commandAttempt/narrationUnit'
import { currentHostRef, objectSpanRef } from './planStep'

/**
 * The containment verbs (RD-1): placing into or onto, each with the third-person form its narration
 * uses. A closed set, so a closed map: anything else is open language for the fallback.
 */
const PLACING_VERB_FORMS: Readonly<Record<string, string>> = { put: 'puts', place: 'places' }
/** `In` for containment phrases, `On` for hosting phrases (AB-54: `On` is a hosting kind, not a peer relation). */
const CONTAINMENT_PHRASES = ['in', 'inside', 'into'] as const
const ON_PHRASES = ['on top of', 'onto', 'on'] as const

export type ContainmentKind = 'In' | 'On'

export type ContainmentTemplateMatchResult =
    | { type: 'matched'; attempt: CommandAttempt }
    | { type: 'noMatch' }

const matchesPhrase = (normalizedSpan: string, phrase: string): boolean => (
    normalizedSpan === phrase || new RegExp(`\\b${phrase}\\b`).test(normalizedSpan)
)

/**
 * Which containment kind a preposition span names, and the closed phrase that matched it, or
 * `undefined` for a peer (or unknown) preposition. Narration uses the matched phrase, never the raw
 * span, so a stray word in the text run ("hurriedly into") never reaches the line.
 */
function matchContainmentPhrase(relationSpan: string): { containment: ContainmentKind; phrase: string } | undefined {
    const normalizedSpan = normalizeExitName(relationSpan.trim())
    if (!normalizedSpan) {
        return undefined
    }
    const onPhrase = ON_PHRASES.find((phrase) => matchesPhrase(normalizedSpan, phrase))
    if (onPhrase) {
        return { containment: 'On', phrase: onPhrase }
    }
    const inPhrase = CONTAINMENT_PHRASES.find((phrase) => matchesPhrase(normalizedSpan, phrase))
    if (inPhrase) {
        return { containment: 'In', phrase: inPhrase }
    }
    return undefined
}

/**
 * Which containment kind a preposition span names, or `undefined` for a peer (or unknown)
 * preposition. Shared with the relational template, which answers `noMatch` for these so the two
 * templates never both claim one command.
 */
export function matchContainmentPreposition(relationSpan: string): ContainmentKind | undefined {
    return matchContainmentPhrase(relationSpan)?.containment
}

function isTextToken(token: ParseToken): token is TextToken {
    return token.type === 'text'
}

/**
 * Matches a containment command (`put X in Y`, `place X on Y`) against the one closed shape
 * TEXT(verb) OBJECTSPAN TEXT(prep) OBJECTSPAN. The step is a whole-object transfer carrying its
 * containment kind, the same step every containment producer builds. Verbs outside RD-1 (`take`,
 * `tie`, ...) answer `noMatch`, so `take X in Y` plans as a membership take.
 *
 * The template created the action, so it authors its narration unit: the player's verb and
 * the matched phrase, one line to everyone who can see the actor or either object, before the move.
 */
export function matchContainmentTemplate(skeleton: ParseSkeleton, command: string): ContainmentTemplateMatchResult {
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
    const verbForm = PLACING_VERB_FORMS[verbToken.text.trim().toLowerCase()]
    if (verbForm === undefined) {
        return { type: 'noMatch' }
    }
    const matchedPhrase = matchContainmentPhrase(prepToken.text)
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
            }),
        ], [narrationUnit]),
    }
}
