/**
 * Payload contracts for internal perception ingress events (api.ephemera).
 *
 * In-process only (dataSourceKey: 'api.ephemera'). See dataSource/perception/AGENT.md.
 */
import {
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraRoomId,
    type EphemeraCharacterId,
    type EphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { isRenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { isNonEmptyPublishTargetArray, type PublishTarget } from '../../messageBus/baseClasses'
import type { MessageGroupId } from '../../internalCache/orchestrateMessages'
import type { EphemeraCacheComponentId } from '../renderCache/baseClasses'

export type CharacterPerceptionRequestedCommand = {
    characterId: EphemeraCharacterId;
    ephemeraId: EphemeraCharacterId;
    messageGroupId?: MessageGroupId;
}

export const isEphemeraCacheComponentId = (value: string): value is EphemeraCacheComponentId => (
    isEphemeraRoomId(value) || isEphemeraFeatureId(value) || isEphemeraKnowledgeId(value)
)

/** Room examine / correlated full-description fan-in (requires viewer characterId). */
export type PerceptionThreadRegisterRoomDescriptionCommand = {
    threadKind: 'roomDescription';
    componentId: EphemeraRoomId;
    perspectiveKey: string;
    characterId: EphemeraCharacterId;
    messageGroupId?: MessageGroupId;
    /** Caller-supplied id; if omitted, PerceptionThreads.register assigns a synthetic uuid. */
    registrationId?: string;
}

/** Multi-target room header fan-in (passive render + broadcast delivery per perspectiveKey). */
export type PerceptionThreadRegisterRoomHeaderBroadcastCommand = {
    threadKind: 'roomHeaderBroadcast';
    componentId: EphemeraRoomId;
    perspectiveKey: string;
    targets: PublishTarget[];
    messageGroupId?: MessageGroupId;
    registrationId?: string;
}

/** Session orientation render header fan-in (Character Registered; CHARACTER# targets). */
export type PerceptionThreadRegisterSessionOrientationRenderCommand = {
    threadKind: 'sessionOrientationRender';
    componentId: EphemeraRoomId;
    perspectiveKey: string;
    characterId: EphemeraCharacterId;
    targets: PublishTarget[];
    messageGroupId?: MessageGroupId;
    registrationId?: string;
}

/** Session orientation affordance header fan-in (Character Registered; CHARACTER# targets). */
export type PerceptionThreadRegisterSessionOrientationAffordancesCommand = {
    threadKind: 'sessionOrientationAffordances';
    componentId: EphemeraRoomId;
    perspectiveKey: string;
    characterId: EphemeraCharacterId;
    targets: PublishTarget[];
    messageGroupId?: MessageGroupId;
    registrationId?: string;
}

/** Wire payload for Leave / Arrive WorldMessage legs (same shape as PublishWorldMessage). */
export type CharacterMoveWorldMessageSpec = {
    targets: PublishTarget[];
    message: RenderTree;
}

/** Character move: correlated header fan-in on arrival room + perspectiveKey, with ordered WorldMessage legs.
 * Ordering ids must be the concrete values from OrchestrateMessages.before / root / after.
 * Optional messageId + createdTime anchor header revision to the position-move fact time (Model A).
 */
export type PerceptionThreadRegisterCharacterMoveCommand = {
    threadKind: 'characterMove';
    componentId: EphemeraRoomId;
    perspectiveKey: string;
    characterId: EphemeraCharacterId;
    departureRoomId: EphemeraRoomId;
    messageGroupId: MessageGroupId;
    leaveMessageGroupId: MessageGroupId;
    arriveMessageGroupId: MessageGroupId;
    leaveWorldMessage?: CharacterMoveWorldMessageSpec;
    arriveWorldMessage?: CharacterMoveWorldMessageSpec;
    headerTargets?: PublishTarget[];
    registrationId?: string;
    /** Pre-assigned header MessageId (Model A). */
    messageId?: string;
    /** Fictional anchor time for header revision (Model A / F1-4). */
    createdTime?: number;
}

/** Non-room component registration placeholder (stub thread body). */
export type PerceptionThreadRegisterStubCommand = {
    threadKind: 'stub';
    componentId: Exclude<EphemeraCacheComponentId, EphemeraRoomId>;
    perspectiveKey: string;
    messageGroupId?: MessageGroupId;
    registrationId?: string;
    characterId?: EphemeraCharacterId;
}

/** Discriminated command for `Perception Thread Registered` ingress and PerceptionThreads.register. */
export type PerceptionThreadRegisterCommand =
    | PerceptionThreadRegisterRoomDescriptionCommand
    | PerceptionThreadRegisterRoomHeaderBroadcastCommand
    | PerceptionThreadRegisterSessionOrientationRenderCommand
    | PerceptionThreadRegisterSessionOrientationAffordancesCommand
    | PerceptionThreadRegisterCharacterMoveCommand
    | PerceptionThreadRegisterStubCommand

export type PerceptionIngressCommand = CharacterPerceptionRequestedCommand | PerceptionThreadRegisterCommand

export const isCharacterMoveWorldMessageSpec = (value: unknown): value is CharacterMoveWorldMessageSpec => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const o = value as Record<string, unknown>
    if (!Array.isArray(o.targets) || o.targets.length === 0 || !o.targets.every((t) => typeof t === 'string')) {
        return false
    }
    return isRenderTree(o.message)
}

export const isCharacterPerceptionRequestedCommand = (value: unknown): value is CharacterPerceptionRequestedCommand => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return (
        typeof v.characterId === 'string' &&
        isEphemeraCharacterId(v.characterId) &&
        typeof v.ephemeraId === 'string' &&
        isEphemeraCharacterId(v.ephemeraId)
    )
}

const isStubComponentId = (id: string): id is Exclude<EphemeraCacheComponentId, EphemeraRoomId> => (
    isEphemeraCacheComponentId(id) && !isEphemeraRoomId(id)
)

export const isPerceptionThreadRegisterCommand = (value: unknown): value is PerceptionThreadRegisterCommand => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (
        v.threadKind !== 'roomDescription'
        && v.threadKind !== 'roomHeaderBroadcast'
        && v.threadKind !== 'sessionOrientationRender'
        && v.threadKind !== 'sessionOrientationAffordances'
        && v.threadKind !== 'characterMove'
        && v.threadKind !== 'stub'
    ) {
        return false
    }
    if (typeof v.componentId !== 'string' || !isEphemeraCacheComponentId(v.componentId)) {
        return false
    }
    if (typeof v.perspectiveKey !== 'string' || v.perspectiveKey.length === 0) {
        return false
    }
    if (v.threadKind !== 'characterMove' && v.messageGroupId !== undefined && typeof v.messageGroupId !== 'string') {
        return false
    }
    if (v.registrationId !== undefined && typeof v.registrationId !== 'string') {
        return false
    }
    if (v.characterId !== undefined && (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId))) {
        return false
    }
    if (v.threadKind === 'roomDescription') {
        return isEphemeraRoomId(v.componentId)
            && typeof v.characterId === 'string'
            && isEphemeraCharacterId(v.characterId)
    }
    if (v.threadKind === 'roomHeaderBroadcast') {
        return isEphemeraRoomId(v.componentId) && isNonEmptyPublishTargetArray(v.targets)
    }
    if (v.threadKind === 'sessionOrientationRender' || v.threadKind === 'sessionOrientationAffordances') {
        return (
            isEphemeraRoomId(v.componentId)
            && typeof v.characterId === 'string'
            && isEphemeraCharacterId(v.characterId)
            && isNonEmptyPublishTargetArray(v.targets)
        )
    }
    if (v.threadKind === 'characterMove') {
        if (!isEphemeraRoomId(v.componentId)) {
            return false
        }
        if (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId)) {
            return false
        }
        if (typeof v.departureRoomId !== 'string' || !isEphemeraRoomId(v.departureRoomId)) {
            return false
        }
        if (typeof v.messageGroupId !== 'string' || v.messageGroupId.length === 0) {
            return false
        }
        if (typeof v.leaveMessageGroupId !== 'string' || v.leaveMessageGroupId.length === 0) {
            return false
        }
        if (typeof v.arriveMessageGroupId !== 'string' || v.arriveMessageGroupId.length === 0) {
            return false
        }
        if (v.leaveWorldMessage !== undefined && !isCharacterMoveWorldMessageSpec(v.leaveWorldMessage)) {
            return false
        }
        if (v.arriveWorldMessage !== undefined && !isCharacterMoveWorldMessageSpec(v.arriveWorldMessage)) {
            return false
        }
        if (v.headerTargets !== undefined && !isNonEmptyPublishTargetArray(v.headerTargets)) {
            return false
        }
        if (v.messageId !== undefined && typeof v.messageId !== 'string') {
            return false
        }
        if (v.createdTime !== undefined && typeof v.createdTime !== 'number') {
            return false
        }
        return true
    }
    return isStubComponentId(v.componentId)
}
