import type { HostingRelationKind, ClosedRelationKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isHostingRelationKind, isClosedRelationKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { ObjectRelationalEmissionPlan } from './objectManipulationPresentationFanIn'

/**
 * Relational (reposition-within-a-host) narration only. The take/drop builders that used to head this
 * file --- `buildTakeHoldWorldMessage`/`buildDropWorldMessage` and their `carriedSuffix` --- moved
 * into `presentStepSequence`'s `objectMove` copy case in Phase 4, verbatim, when object moves started
 * narrating from a positionally-captured audience instead of this fan-in.
 */

/**
 * Only `On` has established narration copy today --- `In`/`PartOf` are not yet producible on this
 * route (2026-08-22, Channel D CD2), so there is no real phrasing to invent for them.
 * `Partial`, not `Record<HostingRelationKind, ...>`: an exhaustive table would force placeholder
 * text for the other two rather than admitting nothing is known yet.
 */
const CONTAINMENT_NARRATION: Partial<Record<HostingRelationKind, { verb: string; preposition: string }>> = {
    On: { verb: 'puts', preposition: 'on' },
}

/** Both closed kinds have established narration copy, so this table is exhaustive --- mirroring
 * `interactionUnderTransfer.ts`'s `CLOSED_RELATION_BEHAVIOR`, a compile error forces an entry
 * here if `CLOSED_RELATION_KINDS` ever grows. */
const CLOSED_RELATION_NARRATION: Record<ClosedRelationKind, { verb: string; preposition: string }> = {
    Under: { verb: 'puts', preposition: 'under' },
    Against: { verb: 'leans', preposition: 'against' },
}

export const buildEstablishRelationWorldMessage = (plan: ObjectRelationalEmissionPlan): string => {
    const { characterName, subjectShortName, targetShortName } = plan
    if (isHostingRelationKind(plan.relationKind)) {
        const narration = CONTAINMENT_NARRATION[plan.relationKind]
        if (narration) {
            return `${characterName} ${narration.verb} ${subjectShortName} ${narration.preposition} ${targetShortName}`
        }
    } else if (isClosedRelationKind(plan.relationKind)) {
        const narration = CLOSED_RELATION_NARRATION[plan.relationKind]
        return `${characterName} ${narration.verb} ${subjectShortName} ${narration.preposition} ${targetShortName}`
    }
    // Only `Custom` carries a label, so the fallback verb is reached explicitly rather than via
    // `relationLabel ?? 'positions'` --- which used to imply the other kinds might supply one.
    const verb = plan.relationKind === 'Custom' ? plan.relationLabel : 'positions'
    return `${characterName} ${verb} ${subjectShortName} ${targetShortName}`
}

export const buildDissolveRelationWorldMessage = (plan: ObjectRelationalEmissionPlan): string => (
    `${plan.characterName} takes ${plan.subjectShortName} off ${plan.targetShortName}`
)

export const buildObjectRelationalWorldMessage = (plan: ObjectRelationalEmissionPlan): string => (
    plan.operation === 'dissolveRelation'
        ? buildDissolveRelationWorldMessage(plan)
        : buildEstablishRelationWorldMessage(plan)
)

/**
 * `targets` is the room alone. The trailing `plan.characterId` this used to carry was the last
 * surviving instance of the `[room, characterId]` idiom (Purpose finding 1): it was load-bearing at
 * exactly one of that idiom's four original sites --- a *departure* room, whose live roster no longer
 * contains the mover by publish time --- and a no-op at the other three. Establish/dissolve is one of
 * the no-op cases: the actor never leaves the room, so `ROOM#` expansion at flush already includes
 * them.
 */
export const publishObjectRelationalPresentation = (
    messageBus: MessageBus,
    plan: ObjectRelationalEmissionPlan
): void => {
    messageBus.publish({
        type: 'PublishMessage',
        targets: [plan.roomId],
        displayProtocol: 'WorldMessage',
        message: [buildObjectRelationalWorldMessage(plan)],
        createdTime: plan.beatAnchorTime,
    })
}
