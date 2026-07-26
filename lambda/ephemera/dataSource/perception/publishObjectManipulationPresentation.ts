import type { MessageBus } from '../../messageBus/baseClasses'
import type {
    ObjectManipulationEmissionPlan,
    ObjectRelationalEmissionPlan,
} from './objectManipulationPresentationFanIn'

/** Appended when the transfer set (BD-13 carry) has more than one member --- same suffix, both directions. */
const carriedSuffix = (plan: ObjectManipulationEmissionPlan): string => (
    plan.carriedObjectCount > 1 ? ' and everything on it' : ''
)

export const buildTakeHoldWorldMessage = (plan: ObjectManipulationEmissionPlan): string => (
    `${plan.characterName} picks up ${plan.objectShortName}${carriedSuffix(plan)}`
)

export const buildDropWorldMessage = (plan: ObjectManipulationEmissionPlan): string => (
    `${plan.characterName} drops ${plan.objectShortName}${carriedSuffix(plan)}`
)

export const buildObjectManipulationWorldMessage = (plan: ObjectManipulationEmissionPlan): string => (
    plan.operation === 'drop'
        ? buildDropWorldMessage(plan)
        : buildTakeHoldWorldMessage(plan)
)

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

export const publishObjectManipulationPresentation = (
    messageBus: MessageBus,
    plan: ObjectManipulationEmissionPlan
): void => {
    messageBus.publish({
        type: 'PublishMessage',
        targets: [plan.roomId, plan.characterId],
        displayProtocol: 'WorldMessage',
        message: [buildObjectManipulationWorldMessage(plan)],
        createdTime: plan.beatAnchorTime,
    })
}

export const publishObjectRelationalPresentation = (
    messageBus: MessageBus,
    plan: ObjectRelationalEmissionPlan
): void => {
    messageBus.publish({
        type: 'PublishMessage',
        targets: [plan.roomId, plan.characterId],
        displayProtocol: 'WorldMessage',
        message: [buildObjectRelationalWorldMessage(plan)],
        createdTime: plan.beatAnchorTime,
    })
}
