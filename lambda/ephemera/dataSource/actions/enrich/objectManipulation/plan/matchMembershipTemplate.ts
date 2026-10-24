import type { AttemptTemplate } from '../../../deterministicTemplate/deterministicTemplate'
import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, PositionAttemptAction } from '../../../commandAttempt/action'
import type { NarrationUnit } from '../../../commandAttempt/narrationUnit'
import {
    actingCharacterRef,
    currentHostRef,
    objectSpanRef,
    type TransferMembershipChange,
} from './planStep'
import { optionAt, spanAt } from './templateCaptures'

/** The membership verbs, each with the operation it plans and the narration it reads: `take` and `get` both read "picks up". */
const MEMBERSHIP_VERBS: Readonly<Record<string, { operationKind: 'takeHold' | 'drop'; narration: string }>> = {
    take: { operationKind: 'takeHold', narration: ' picks up ' },
    get: { operationKind: 'takeHold', narration: ' picks up ' },
    drop: { operationKind: 'drop', narration: ' drops ' },
}

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

/**
 * A membership command: `take`/`get` acquire, `drop` releases, the object is the span after the
 * verb, and whatever follows is not read here (`rest`). Runs after the containment and look
 * templates. A qualifier (`take X off Y`) arrives grouped onto the span (`groupSkeleton`) and is
 * lowered to an assertion after this template (`lowerQualifiers`); a tail left flat (a drop's) is
 * refused by the producer's BD-20 gate as an unread span.
 *
 * The template created the action, so it authors its narration unit: one line per verb class,
 * to everyone who can see the actor or the object, before the move.
 */
export const membershipTemplate: AttemptTemplate<'membership'> = {
    name: 'membership',
    pattern: [
        { type: 'templateText', options: Object.keys(MEMBERSHIP_VERBS) },
        { type: 'objectSpan', role: 'subject' },
        { type: 'rest' },
    ],
    build(captures, command) {
        const { operationKind, narration } = MEMBERSHIP_VERBS[optionAt(captures, 0)]
        const { span, stableRefKey } = spanAt(captures, 1)
        const actionId = mintActionId()
        const narrationUnit: NarrationUnit = {
            covers: [actionId],
            variants: [{
                audience: { refs: ['actor', stableRefKey], phase: 'before' },
                parts: [{ slot: 'actor' }, { text: narration }, { ref: stableRefKey }],
            }],
        }
        return CommandAttempt.create(command, [
            new PositionAttemptAction(actionId, [], planMembershipDesiredResult(operationKind, span, stableRefKey)),
        ], [narrationUnit])
    },
}
