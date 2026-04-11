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

/** Registers a perception fan-in thread (component x perspective). Step 3 stub; delivery fields optional for later steps. */
export type PerceptionThreadRegisteredCommand = {
    componentId: EphemeraCacheComponentId;
    perspectiveKey: string;
    messageGroupId?: MessageGroupId;
    characterId?: EphemeraCharacterId;
}

export type PerceptionIngressCommand = CharacterPerceptionRequestedCommand | PerceptionThreadRegisteredCommand

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

export const isPerceptionThreadRegisteredCommand = (value: unknown): value is PerceptionThreadRegisteredCommand => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (typeof v.componentId !== 'string' || !isEphemeraCacheComponentId(v.componentId)) {
        return false
    }
    if (typeof v.perspectiveKey !== 'string' || v.perspectiveKey.length === 0) {
        return false
    }
    if (v.messageGroupId !== undefined && typeof v.messageGroupId !== 'string') {
        return false
    }
    if (v.characterId !== undefined && (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId))) {
        return false
    }
    return true
}
