import type { AttemptTemplate, PatternElement } from '../../../deterministicTemplate/deterministicTemplate'
import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, PositionAttemptAction } from '../../../commandAttempt/action'
import type { NarrationUnit } from '../../../commandAttempt/narrationUnit'
import {
    actingCharacterRef,
    currentHostRef,
    objectSpanRef,
    type TransferMembershipChange,
} from './planStep'
import { QUALIFIER_OBJECT_PHRASE_ELEMENT } from './qualifierPrepositions'
import { optionAt, spanAt } from './templateCaptures'

/** The membership verbs, each with the operation it plans and the narration it reads: `take` and `get` both read "picks up". */
const MEMBERSHIP_VERBS: Readonly<Record<string, { operationKind: 'takeHold' | 'drop'; narration: string }>> = {
    take: { operationKind: 'takeHold', narration: ' picks up ' },
    get: { operationKind: 'takeHold', narration: ' picks up ' },
    drop: { operationKind: 'drop', narration: ' drops ' },
}

/** The membership verbs as a pattern element; the fast path claims the same list. */
export const MEMBERSHIP_VERB_ELEMENT: PatternElement = { type: 'templateText', options: Object.keys(MEMBERSHIP_VERBS) }

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
 * A membership command: `take`/`get` acquire, `drop` releases, the object is the object phrase
 * after the verb, and whatever follows is not read here (`rest`). Runs after the containment and
 * look templates. Each run of qualifiers the phrase reads (`take X off Y`, `take X on Y on Z`) is
 * its own fill, nested onto the span in that fill's reading and lowered to assertions after this
 * template (`lowerQualifiers`); a fill whose `rest` holds a span is dropped by the producer's BD-20
 * gate as leaving it unread.
 *
 * The template created the action, so it authors its narration unit: one line per verb class,
 * to everyone who can see the actor or the object, before the move.
 */
export const membershipTemplate: AttemptTemplate<'membership'> = {
    name: 'membership',
    pattern: [
        MEMBERSHIP_VERB_ELEMENT,
        QUALIFIER_OBJECT_PHRASE_ELEMENT,
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
