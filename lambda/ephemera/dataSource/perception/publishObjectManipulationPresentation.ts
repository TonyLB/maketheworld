import type { MessageBus } from '../../messageBus/baseClasses'
import type { ObjectRelationalEmissionPlan } from './objectManipulationPresentationFanIn'

/**
 * Relational (reposition-within-a-host) narration only. The take/drop builders that used to head this
 * file --- `buildTakeHoldWorldMessage`/`buildDropWorldMessage` and their `carriedSuffix` --- moved
 * into `presentStepSequence`'s `objectMove` copy case in Phase 4, verbatim, when object moves started
 * narrating from a positionally-captured audience instead of this fan-in.
 */
export const buildEstablishRelationWorldMessage = (plan: ObjectRelationalEmissionPlan): string => {
    const { characterName, subjectShortName, targetShortName, relationKind, relationLabel } = plan
    if (relationKind === 'On') {
        return `${characterName} puts ${subjectShortName} on ${targetShortName}`
    }
    if (relationKind === 'Under') {
        return `${characterName} puts ${subjectShortName} under ${targetShortName}`
    }
    if (relationKind === 'Against') {
        return `${characterName} leans ${subjectShortName} against ${targetShortName}`
    }
    return `${characterName} ${relationLabel ?? 'positions'} ${subjectShortName} ${targetShortName}`
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
