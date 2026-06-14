import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageBus } from '../../messageBus/baseClasses'
import type {
    MembershipEmissionCopyKind,
    MembershipEmissionPlan,
    MembershipEmissionShape,
} from './membershipPresentationFanIn'

export const MEMBERSHIP_BEAT_EPSILON_MS = 1

const displayName = (plan: MembershipEmissionPlan): string => (
    plan.characterName || 'Someone'
)

export const buildMembershipLeaveSuffix = (
    copyKind: MembershipEmissionCopyKind,
    exitName?: string
): string => {
    if (copyKind === 'exitAware' && exitName) {
        return ` left by ${exitName} exit.`
    }
    if (copyKind === 'home') {
        return ' left to return home.'
    }
    if (copyKind === 'disconnect') {
        return ' has disconnected.'
    }
    return ' has left.'
}

export const buildMembershipArriveSuffix = (copyKind: MembershipEmissionCopyKind): string => {
    if (copyKind === 'connect') {
        return ' has connected.'
    }
    return ' has arrived.'
}

const publishLeaveWorldMessage = (
    messageBus: MessageBus,
    args: {
        characterId: EphemeraCharacterId;
        from: EphemeraRoomId;
        message: string;
        createdTime: number;
    }
): void => {
    messageBus.publish({
        type: 'PublishMessage',
        targets: [args.from, args.characterId],
        displayProtocol: 'WorldMessage',
        message: [args.message],
        createdTime: args.createdTime,
        deliveryMode: 'deferred',
    })
}

const publishArriveWorldMessage = (
    messageBus: MessageBus,
    args: {
        characterId: EphemeraCharacterId;
        to: EphemeraRoomId;
        message: string;
        createdTime: number;
    }
): void => {
    messageBus.publish({
        type: 'PublishMessage',
        targets: [args.to, args.characterId],
        displayProtocol: 'WorldMessage',
        message: [args.message],
        createdTime: args.createdTime,
        deliveryMode: 'deferred',
    })
}

const publishForShape = (
    messageBus: MessageBus,
    plan: MembershipEmissionPlan,
    shape: MembershipEmissionShape
): void => {
    const name = displayName(plan)
    const anchor = plan.beatAnchorTime

    if (shape === 'leaveAndArrive' && plan.from && plan.to) {
        publishLeaveWorldMessage(messageBus, {
            characterId: plan.characterId,
            from: plan.from,
            message: `${name}${buildMembershipLeaveSuffix(plan.copyKind, plan.exitName)}`,
            createdTime: anchor - MEMBERSHIP_BEAT_EPSILON_MS,
        })
        publishArriveWorldMessage(messageBus, {
            characterId: plan.characterId,
            to: plan.to,
            message: `${name}${buildMembershipArriveSuffix(plan.copyKind)}`,
            createdTime: anchor + MEMBERSHIP_BEAT_EPSILON_MS,
        })
        return
    }

    if (shape === 'leaveOnly' && plan.from) {
        publishLeaveWorldMessage(messageBus, {
            characterId: plan.characterId,
            from: plan.from,
            message: `${name}${buildMembershipLeaveSuffix(plan.copyKind, plan.exitName)}`,
            createdTime: anchor - MEMBERSHIP_BEAT_EPSILON_MS,
        })
        return
    }

    if (shape === 'arriveOnly' && plan.to) {
        publishArriveWorldMessage(messageBus, {
            characterId: plan.characterId,
            to: plan.to,
            message: `${name}${buildMembershipArriveSuffix(plan.copyKind)}`,
            createdTime: anchor + MEMBERSHIP_BEAT_EPSILON_MS,
        })
    }
}

export const publishMembershipPresentation = (
    messageBus: MessageBus,
    plan: MembershipEmissionPlan
): void => {
    if (plan.shape === 'none') {
        return
    }
    publishForShape(messageBus, plan, plan.shape)
}
