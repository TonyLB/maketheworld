import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageBus, PublishMessage } from '../../messageBus/baseClasses'
import type {
    MembershipEmissionCopyKind,
    MembershipEmissionPlan,
    MembershipEmissionShape,
} from './membershipPresentationFanIn'
import { sendMessageSlotReported } from '../messageOrchestration/subscribedEvents'
import { navigateLeaveSlotId, NAVIGATE_ARRIVE_SLOT_ID } from '../positions/navigate/navigateBundleSlotIds'

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

const leaveCopyKindForFrom = (
    plan: MembershipEmissionPlan,
    fromRoom: EphemeraRoomId
): MembershipEmissionCopyKind => {
    const matchesIntentFrom = plan.intentFromRoomId === undefined || plan.intentFromRoomId === fromRoom
    if (plan.copyKind === 'exitAware' && matchesIntentFrom && plan.exitName) {
        return 'exitAware'
    }
    if (plan.froms.length === 1) {
        if (plan.copyKind === 'home' || plan.copyKind === 'disconnect') {
            return plan.copyKind
        }
        if (plan.copyKind === 'genericNavigate' && matchesIntentFrom) {
            return 'genericNavigate'
        }
    } else if (plan.intentFromRoomId === fromRoom) {
        if (plan.copyKind === 'home') {
            return 'home'
        }
        if (plan.copyKind === 'genericNavigate') {
            return 'genericNavigate'
        }
    }
    return 'genericFactOnly'
}

/** Reports a resolved slot into the plan's bundle when bundleId is present, else publishes directly (fact-only-at-settle / non-navigate intents keep today's behavior). */
const deliverMembershipMessage = (
    messageBus: MessageBus,
    bundleId: string | undefined,
    slotId: string,
    message: PublishMessage
): void => {
    if (bundleId) {
        sendMessageSlotReported(messageBus, bundleId, { bundleId, slotId, message })
        return
    }
    messageBus.publish(message)
}

const publishLeaveWorldMessage = (
    messageBus: MessageBus,
    args: {
        characterId: EphemeraCharacterId;
        from: EphemeraRoomId;
        message: string;
        createdTime: number;
        bundleId?: string;
    }
): void => {
    deliverMembershipMessage(messageBus, args.bundleId, navigateLeaveSlotId(args.from), {
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
        bundleId?: string;
    }
): void => {
    deliverMembershipMessage(messageBus, args.bundleId, NAVIGATE_ARRIVE_SLOT_ID, {
        type: 'PublishMessage',
        targets: [args.to, args.characterId],
        displayProtocol: 'WorldMessage',
        message: [args.message],
        createdTime: args.createdTime,
        deliveryMode: 'deferred',
    })
}

const publishLeaves = (messageBus: MessageBus, plan: MembershipEmissionPlan): void => {
    const name = displayName(plan)
    const createdTime = plan.beatAnchorTime - MEMBERSHIP_BEAT_EPSILON_MS
    for (const fromRoom of plan.froms) {
        const leaveCopyKind = leaveCopyKindForFrom(plan, fromRoom)
        publishLeaveWorldMessage(messageBus, {
            characterId: plan.characterId,
            from: fromRoom,
            message: `${name}${buildMembershipLeaveSuffix(leaveCopyKind, plan.exitName)}`,
            createdTime,
            bundleId: plan.bundleId,
        })
    }
}

const publishForShape = (
    messageBus: MessageBus,
    plan: MembershipEmissionPlan,
    shape: MembershipEmissionShape
): void => {
    const name = displayName(plan)
    const anchor = plan.beatAnchorTime

    if (shape === 'leaveAndArrive' && plan.froms.length > 0 && plan.to) {
        publishLeaves(messageBus, plan)
        publishArriveWorldMessage(messageBus, {
            characterId: plan.characterId,
            to: plan.to,
            message: `${name}${buildMembershipArriveSuffix(plan.copyKind)}`,
            createdTime: anchor + MEMBERSHIP_BEAT_EPSILON_MS,
            bundleId: plan.bundleId,
        })
        return
    }

    if (shape === 'leaveOnly' && plan.froms.length > 0) {
        publishLeaves(messageBus, plan)
        return
    }

    if (shape === 'arriveOnly' && plan.to) {
        publishArriveWorldMessage(messageBus, {
            characterId: plan.characterId,
            to: plan.to,
            message: `${name}${buildMembershipArriveSuffix(plan.copyKind)}`,
            createdTime: anchor + MEMBERSHIP_BEAT_EPSILON_MS,
            bundleId: plan.bundleId,
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
