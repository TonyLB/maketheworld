import type { ParseSkeleton, ParseToken, TextToken } from '../parse/parseToken'
import type { ManipulationVerbClass } from '../../../baseClasses'
import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, PositionAttemptAction } from '../../../commandAttempt/action'
import type { NarrationUnit } from '../../../commandAttempt/narrationUnit'
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
 * Runs after the containment and look templates. A trailing tail (`take X off Y`, `take X out of Y`)
 * is ignored here: membership claims the leading verb, and the tail only narrows which X is meant.
 * The span is the first object span, or empty
 * when the command has none; the producer still reads every object span from the skeleton.
 *
 * The template created the action, so it authors its narration unit (AN-3): one line per verb class
 * (`take` and `get` both read "picks up"), to everyone who can see the actor or the object, before
 * the move.
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
    const actionId = mintActionId()
    const narrationUnit: NarrationUnit = {
        covers: [actionId],
        variants: [{
            audience: { refs: ['actor', refKey], phase: 'before' },
            parts: [{ slot: 'actor' }, { text: verbClass === 'acquire' ? ' picks up ' : ' drops ' }, { ref: refKey }],
        }],
    }
    return {
        type: 'matched',
        verbClass,
        attempt: CommandAttempt.create(command, [
            new PositionAttemptAction(actionId, [], planMembershipDesiredResult(operationKind, span, refKey)),
        ], [narrationUnit]),
    }
}
