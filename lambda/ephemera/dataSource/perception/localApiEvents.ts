/**
 * Payload contracts for internal perception ingress events (api.ephemera).
 *
 * In-process only (dataSourceKey: 'api.ephemera'). See dataSource/perception/AGENT.md.
 *
 * Phase 7: PerceptionThreadRegisterCommand retreated to its final, permanent role ---
 * `roomHeaderBroadcast` and `sessionOrientationAffordances` only. The five directed-consequence
 * kinds (roomDescription/featureDescription/knowledgeDescription/objectDescription/
 * sessionOrientationRender) register against messageOrchestration's ingress registry instead
 * (dataSource/messageOrchestration/localApiEvents.ts's MessageOrchestrationSlotSpec).
 */
import {
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraObjectId,
    isEphemeraRoomId,
    type EphemeraCharacterId,
    type EphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isNonEmptyPublishTargetArray, type PublishTarget } from '../../messageBus/baseClasses'
import type { EphemeraCacheComponentId } from '../renderCache/baseClasses'

export type CharacterPerceptionRequestedCommand = {
    characterId: EphemeraCharacterId;
    ephemeraId: EphemeraCharacterId;
}

export const isEphemeraCacheComponentId = (value: string): value is EphemeraCacheComponentId => (
    isEphemeraRoomId(value) || isEphemeraFeatureId(value) || isEphemeraKnowledgeId(value) || isEphemeraObjectId(value)
)

/** Multi-target room header fan-in (passive render + broadcast delivery per perspectiveKey). */
export type PerceptionThreadRegisterRoomHeaderBroadcastCommand = {
    threadKind: 'roomHeaderBroadcast';
    componentId: EphemeraRoomId;
    perspectiveKey: string;
    targets: PublishTarget[];
    registrationId?: string;
}

/** Session orientation affordance header fan-in (Character Registered; CHARACTER# targets). */
export type PerceptionThreadRegisterSessionOrientationAffordancesCommand = {
    threadKind: 'sessionOrientationAffordances';
    componentId: EphemeraRoomId;
    perspectiveKey: string;
    characterId: EphemeraCharacterId;
    targets: PublishTarget[];
    registrationId?: string;
}

/** Discriminated command for `Perception Thread Registered` ingress and PerceptionThreads.register. */
export type PerceptionThreadRegisterCommand =
    | PerceptionThreadRegisterRoomHeaderBroadcastCommand
    | PerceptionThreadRegisterSessionOrientationAffordancesCommand

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
        v.threadKind !== 'roomHeaderBroadcast'
        && v.threadKind !== 'sessionOrientationAffordances'
    ) {
        return false
    }
    if (typeof v.componentId !== 'string' || !isEphemeraCacheComponentId(v.componentId)) {
        return false
    }
    if (typeof v.perspectiveKey !== 'string' || v.perspectiveKey.length === 0) {
        return false
    }
    if (v.registrationId !== undefined && typeof v.registrationId !== 'string') {
        return false
    }
    if (v.characterId !== undefined && (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId))) {
        return false
    }
    if (v.threadKind === 'roomHeaderBroadcast') {
        return isEphemeraRoomId(v.componentId) && isNonEmptyPublishTargetArray(v.targets)
    }
    return (
        isEphemeraRoomId(v.componentId)
        && typeof v.characterId === 'string'
        && isEphemeraCharacterId(v.characterId)
        && isNonEmptyPublishTargetArray(v.targets)
    )
}
