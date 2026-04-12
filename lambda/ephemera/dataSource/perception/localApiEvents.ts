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
    targets: EphemeraCharacterId[];
    messageGroupId?: MessageGroupId;
    registrationId?: string;
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
    | PerceptionThreadRegisterStubCommand

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

const isStubComponentId = (id: string): id is Exclude<EphemeraCacheComponentId, EphemeraRoomId> => (
    isEphemeraCacheComponentId(id) && !isEphemeraRoomId(id)
)

export const isPerceptionThreadRegisterCommand = (value: unknown): value is PerceptionThreadRegisterCommand => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.threadKind !== 'roomDescription' && v.threadKind !== 'roomHeaderBroadcast' && v.threadKind !== 'stub') {
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
        if (!isEphemeraRoomId(v.componentId) || !Array.isArray(v.targets) || v.targets.length === 0) {
            return false
        }
        return v.targets.every(
            (t) => typeof t === 'string' && isEphemeraCharacterId(t)
        )
    }
    return isStubComponentId(v.componentId)
}
