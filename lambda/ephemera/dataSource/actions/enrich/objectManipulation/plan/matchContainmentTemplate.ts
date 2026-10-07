import type { ParseSkeleton, ParseToken, TextToken } from '../parse/parseToken'
import { normalizeExitName } from '../../../roomExitTargetsForCharacter'
import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, PositionAttemptAction } from '../../../commandAttempt/action'
import { currentHostRef, objectSpanRef } from './planStep'

/** The containment verbs (RD-1): placing into or onto. Anything else is open language for the fallback. */
const PLACING_VERBS = new Set(['put', 'place'])
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
 * Which containment kind a preposition span names, or `undefined` for a peer (or unknown)
 * preposition. Shared with the relational template, which answers `noMatch` for these so the two
 * templates never both claim one command.
 */
export function matchContainmentPreposition(relationSpan: string): ContainmentKind | undefined {
    const normalizedSpan = normalizeExitName(relationSpan.trim())
    if (!normalizedSpan) {
        return undefined
    }
    if (ON_PHRASES.some((phrase) => matchesPhrase(normalizedSpan, phrase))) {
        return 'On'
    }
    if (CONTAINMENT_PHRASES.some((phrase) => matchesPhrase(normalizedSpan, phrase))) {
        return 'In'
    }
    return undefined
}

function isTextToken(token: ParseToken): token is TextToken {
    return token.type === 'text'
}

/**
 * Matches a containment command (`put X in Y`, `place X on Y`) against the one closed shape
 * TEXT(verb) OBJECTSPAN TEXT(prep) OBJECTSPAN. The step is a whole-object transfer carrying its
 * containment kind, the same step every containment producer builds. Verbs outside RD-1 (`take`,
 * `tie`, ...) answer `noMatch`, so `take X in Y` plans as a membership take.
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
    if (!PLACING_VERBS.has(verbToken.text.trim().toLowerCase())) {
        return { type: 'noMatch' }
    }
    const containment = matchContainmentPreposition(prepToken.text)
    if (!containment) {
        return { type: 'noMatch' }
    }

    const subject = objectSpanRef(subjectToken.span, subjectToken.stableRefKey)
    const target = objectSpanRef(targetToken.span, targetToken.stableRefKey)
    return {
        type: 'matched',
        attempt: CommandAttempt.create(command, [
            new PositionAttemptAction(mintActionId(), [], {
                kind: 'change',
                primitive: 'transferMembership',
                object: subject,
                from: currentHostRef(subject),
                to: target,
                containment,
            }),
        ]),
    }
}
