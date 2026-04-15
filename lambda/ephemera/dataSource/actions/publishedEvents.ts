import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

/**
 * Outbound stream payloads for mtw.ephemera.actions (bus-only DataSource).
 */
export type ActionsStubPublishedPayload = {
    type: 'ActionsStub';
}

export type CharacterNavigatePublishedPayload = {
    type: 'Character Navigate';
    characterId: EphemeraCharacterId;
    fromRoomId: EphemeraRoomId;
    toRoomId: EphemeraRoomId;
}

export type AwaitRoadRunnerPublishedPayload = {
    type: 'Await RoadRunner';
    characterId: EphemeraCharacterId;
    confidence: number;
}

export type AcmeOrderPublishedPayload = {
    type: 'Acme Order';
    characterId: EphemeraCharacterId;
    orders: string[];
    confidence: number;
}

export const isAwaitRoadRunnerPublishedPayload = (
    value: unknown
): value is AwaitRoadRunnerPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Await RoadRunner') {
        return false
    }
    if (typeof v.characterId !== 'string') {
        return false
    }
    if (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence)) {
        return false
    }
    return true
}

export type ActionsPublishedPayload =
    | ActionsStubPublishedPayload
    | CharacterNavigatePublishedPayload
    | AcmeOrderPublishedPayload
    | AwaitRoadRunnerPublishedPayload
