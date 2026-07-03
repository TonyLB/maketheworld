import type { MessageBus } from '../../messageBus/baseClasses'
import type { ObjectManipulationEmissionPlan } from './objectManipulationPresentationFanIn'

export const buildTakeHoldWorldMessage = (plan: ObjectManipulationEmissionPlan): string => (
    `${plan.characterName} picks up ${plan.objectShortName}`
)

export const buildDropWorldMessage = (plan: ObjectManipulationEmissionPlan): string => (
    `${plan.characterName} drops ${plan.objectShortName}`
)

export const buildObjectManipulationWorldMessage = (plan: ObjectManipulationEmissionPlan): string => (
    plan.operation === 'drop'
        ? buildDropWorldMessage(plan)
        : buildTakeHoldWorldMessage(plan)
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
        deliveryMode: 'deferred',
    })
}
