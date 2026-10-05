import type { ParseSkeleton, ParseToken, TextToken } from '../parse/parseToken'
import type { ManipulationVerbClass } from '../../../baseClasses'
import { CommandAttempt } from '../../../commandAttempt'
import { PositionAttemptAction } from '../../../commandAttempt/action'
import {
    actingCharacterRef,
    currentHostRef,
    objectSpanRef,
    type TransferMembershipChange,
} from './planStep'

export type MembershipTemplateMatchResult =
    | { type: 'matched'; attempt: CommandAttempt; verbClass: ManipulationVerbClass }
    | { type: 'noMatch' }

/**
 * Plan's half of a membership attempt: depends only on the operation and the object phrase. A take
 * moves the object from wherever it is (`currentHost` of the object itself: the room, or a table it
 * sits on) to the actor; a drop moves it from the actor to the room the actor is in.
 */
export const planMembershipDesiredResult = (
    operationKind: 'takeHold' | 'drop',
    span: string,
    refKey: string
): TransferMembershipChange => ({
    kind: 'change',
    primitive: 'transferMembership',
    object: objectSpanRef(span, refKey),
    from: operationKind === 'takeHold' ? currentHostRef(objectSpanRef(span, refKey)) : actingCharacterRef,
    to: operationKind === 'takeHold' ? actingCharacterRef : currentHostRef(actingCharacterRef),
})

function isTextToken(token: ParseToken): token is TextToken {
    return token.type === 'text'
}

/**
 * Matches a membership command by its leading verb: `take`/`get` acquire, `drop` releases.
 * Runs after the relational and look templates, which claim the same leading verbs at their
 * own token counts (`take X off Y` is relational). The span is the first object span, or empty
 * when the command has none; the producer still reads every object span from the skeleton.
 */
export function matchMembershipTemplate(skeleton: ParseSkeleton, command: string): MembershipTemplateMatchResult {
    const [firstToken] = skeleton
    if (!firstToken || !isTextToken(firstToken)) {
        return { type: 'noMatch' }
    }
    const leadingVerb = firstToken.text.trim().toLowerCase()
    const verbClass: ManipulationVerbClass | undefined =
        leadingVerb === 'take' || leadingVerb === 'get' ? 'acquire'
            : leadingVerb === 'drop' ? 'release'
                : undefined
    if (!verbClass) {
        return { type: 'noMatch' }
    }
    const spanToken = skeleton.find((token) => token.type === 'objectSpan')
    const span = spanToken?.type === 'objectSpan' ? spanToken.span : ''
    // The key Parse stamped on the span (its occurrence), so Identify and Grounding find it by key.
    const refKey = spanToken?.type === 'objectSpan' ? spanToken.stableRefKey : 'primaryObject'
    const operationKind = verbClass === 'acquire' ? 'takeHold' : 'drop'
    return {
        type: 'matched',
        verbClass,
        attempt: CommandAttempt.create(command, [
            new PositionAttemptAction([], planMembershipDesiredResult(operationKind, span, refKey)),
        ]),
    }
}
