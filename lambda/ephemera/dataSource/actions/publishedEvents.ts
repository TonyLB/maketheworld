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

export type ActionsPublishedPayload =
    | ActionsStubPublishedPayload
    | CharacterNavigatePublishedPayload
    | AwaitRoadRunnerPublishedPayload
