/**
 * Payload contracts for internal perception ingress events (api.ephemera).
 *
 * In-process only (dataSourceKey: 'api.ephemera'). See dataSource/perception/AGENT.md.
 */
import {
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraObjectId,
    isEphemeraRoomId,
    type EphemeraCharacterId,
    type EphemeraFeatureId,
    type EphemeraKnowledgeId,
    type EphemeraObjectId,
    type EphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isNonEmptyPublishTargetArray, type PublishTarget } from '../../messageBus/baseClasses'
import type { MessageGroupId } from '../../internalCache/orchestrateMessages'
import type { EphemeraCacheComponentId } from '../renderCache/baseClasses'

export type CharacterPerceptionRequestedCommand = {
    characterId: EphemeraCharacterId;
    ephemeraId: EphemeraCharacterId;
    messageGroupId?: MessageGroupId;
}

export const isEphemeraCacheComponentId = (value: string): value is EphemeraCacheComponentId => (
    isEphemeraRoomId(value) || isEphemeraFeatureId(value) || isEphemeraKnowledgeId(value) || isEphemeraObjectId(value)
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

/** Character move: targeting-only registration for mover arrival-room header render fan-in.
 * Optional messageId + createdTime anchor header revision to the position-move fact time (Model A).
 */
export type PerceptionThreadRegisterCharacterMoveCommand = {
    threadKind: 'characterMove';
    componentId: EphemeraRoomId;
    perspectiveKey: string;
    characterId: EphemeraCharacterId;
    targets: PublishTarget[];
    messageGroupId?: MessageGroupId;
    registrationId?: string;
    /** Pre-assigned header MessageId (Model A). */
    messageId?: string;
    /** Fictional anchor time for header revision (Model A / F1-4). */
    createdTime?: number;
}

/** Feature link / look correlated description fan-in (requires viewer characterId). */
export type PerceptionThreadRegisterFeatureDescriptionCommand = {
    threadKind: 'featureDescription';
    componentId: EphemeraFeatureId;
    perspectiveKey: string;
    characterId: EphemeraCharacterId;
    messageGroupId?: MessageGroupId;
    registrationId?: string;
}

/** Knowledge link / look correlated description fan-in (requires viewer characterId). */
export type PerceptionThreadRegisterKnowledgeDescriptionCommand = {
    threadKind: 'knowledgeDescription';
    componentId: EphemeraKnowledgeId;
    perspectiveKey: string;
    characterId: EphemeraCharacterId;
    messageGroupId?: MessageGroupId;
    /** When true, fan-in delivers to SESSION#... instead of characterId (guest / direct-response UI). */
    directResponse?: boolean;
    registrationId?: string;
}

/** Object link / look correlated description fan-in (requires viewer characterId). Stub: shortName only. */
export type PerceptionThreadRegisterObjectDescriptionCommand = {
    threadKind: 'objectDescription';
    componentId: EphemeraObjectId;
    perspectiveKey: string;
    characterId: EphemeraCharacterId;
    messageGroupId?: MessageGroupId;
    registrationId?: string;
}

/** Discriminated command for `Perception Thread Registered` ingress and PerceptionThreads.register. */
export type PerceptionThreadRegisterCommand =
    | PerceptionThreadRegisterRoomDescriptionCommand
    | PerceptionThreadRegisterRoomHeaderBroadcastCommand
    | PerceptionThreadRegisterSessionOrientationRenderCommand
    | PerceptionThreadRegisterSessionOrientationAffordancesCommand
    | PerceptionThreadRegisterCharacterMoveCommand
    | PerceptionThreadRegisterFeatureDescriptionCommand
    | PerceptionThreadRegisterKnowledgeDescriptionCommand
    | PerceptionThreadRegisterObjectDescriptionCommand

export type PerceptionIngressCommand = CharacterPerceptionRequestedCommand | PerceptionThreadRegisterCommand

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
        && v.threadKind !== 'featureDescription'
        && v.threadKind !== 'knowledgeDescription'
        && v.threadKind !== 'objectDescription'
    ) {
        return false
    }
    if (typeof v.componentId !== 'string' || !isEphemeraCacheComponentId(v.componentId)) {
        return false
    }
    if (typeof v.perspectiveKey !== 'string' || v.perspectiveKey.length === 0) {
        return false
    }
    if (v.messageGroupId !== undefined && typeof v.messageGroupId !== 'string') {
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
        return (
            isEphemeraRoomId(v.componentId)
            && typeof v.characterId === 'string'
            && isEphemeraCharacterId(v.characterId)
            && isNonEmptyPublishTargetArray(v.targets)
            && (v.messageId === undefined || typeof v.messageId === 'string')
            && (v.createdTime === undefined || typeof v.createdTime === 'number')
        )
    }
    if (v.threadKind === 'featureDescription') {
        return (
            isEphemeraFeatureId(v.componentId)
            && typeof v.characterId === 'string'
            && isEphemeraCharacterId(v.characterId)
        )
    }
    if (v.threadKind === 'knowledgeDescription') {
        return (
            isEphemeraKnowledgeId(v.componentId)
            && typeof v.characterId === 'string'
            && isEphemeraCharacterId(v.characterId)
            && (v.directResponse === undefined || typeof v.directResponse === 'boolean')
        )
    }
    if (v.threadKind === 'objectDescription') {
        return (
            isEphemeraObjectId(v.componentId)
            && typeof v.characterId === 'string'
            && isEphemeraCharacterId(v.characterId)
        )
    }
    return false
}
