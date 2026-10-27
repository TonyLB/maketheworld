import { defineAttemptTemplate, fixedWord } from '../../../deterministicTemplate/deterministicTemplate'
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

/** The membership verbs, each with the operation it plans and the narration it reads: `take` and `get` both read "picks up". */
const MEMBERSHIP_VERB_ELEMENT = fixedWord('verb', {
    take: { operationKind: 'takeHold', narration: ' picks up ' },
    get: { operationKind: 'takeHold', narration: ' picks up ' },
    drop: { operationKind: 'drop', narration: ' drops ' },
} as const)

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
 * A membership command: `take`/`get` acquire, `drop` releases, and the object is the object phrase
 * after the verb, which reads the rest of the command. Runs after the containment and look
 * templates. Each run of qualifiers the phrase reads (`take X off Y`, `take X on Y on Z`) is its own
 * fill, nested onto the span in that fill's reading and lowered to assertions after this template
 * (`lowerQualifiers`); words outside the qualifier set stay in a span (`get cup under table`).
 * The fast path claims every command this pattern fits (`discriminateIntent/deterministicChecks.ts`).
 *
 * The template created the action, so it authors its narration unit: one line per verb class,
 * to everyone who can see the actor or the object, before the move.
 */
export const membershipTemplate = defineAttemptTemplate({
    name: 'membership',
    pattern: [MEMBERSHIP_VERB_ELEMENT, QUALIFIER_OBJECT_PHRASE_ELEMENT],
    build({ verb, subject }, command) {
        const { operationKind, narration } = verb.value
        const { text: span, stableRefKey } = subject
        const actionId = mintActionId()
        const narrationUnit: NarrationUnit = {
            covers: [actionId],
            variants: [{
                audience: { refs: ['actor', stableRefKey], phase: 'before' },
                parts: [{ slot: 'actor' }, { text: narration }, { ref: stableRefKey }],
            }],
        }
        return CommandAttempt.create('membership', command, [
            new PositionAttemptAction(actionId, [], planMembershipDesiredResult(operationKind, span, stableRefKey)),
        ], [narrationUnit])
    },
})
