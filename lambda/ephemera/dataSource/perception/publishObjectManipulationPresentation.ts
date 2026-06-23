import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { ObjectManipulationEmissionPlan } from './objectManipulationPresentationFanIn'

export const buildTakeHoldWorldMessage = (plan: ObjectManipulationEmissionPlan): string => (
    `${plan.characterName} picks up ${plan.objectShortName}`
)

export const publishObjectManipulationPresentation = (
    messageBus: MessageBus,
    plan: ObjectManipulationEmissionPlan
): void => {
    messageBus.publish({
        type: 'PublishMessage',
        targets: [plan.roomId, plan.characterId],
        displayProtocol: 'WorldMessage',
        message: [buildTakeHoldWorldMessage(plan)],
        createdTime: plan.beatAnchorTime,
        deliveryMode: 'deferred',
    })
}
