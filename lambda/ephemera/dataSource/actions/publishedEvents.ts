import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { isCoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

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

/** One catalog line on the bus; aligns with EphemeraMetaRoomObject minus uuid. */
export type AcmeOrderPublishedOrder = {
    shortName: string;
    affinities: CoyoteAffinityPossibility[];
    affinitiesFailed?: boolean;
}

export type AcmeOrderPublishedPayload = {
    type: 'Acme Order';
    characterId: EphemeraCharacterId;
    orders: AcmeOrderPublishedOrder[];
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

export const isAcmeOrderPublishedOrder = (value: unknown): value is AcmeOrderPublishedOrder => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const o = value as Record<string, unknown>
    if (typeof o.shortName !== 'string' || o.shortName.trim().length === 0) {
        return false
    }
    if (!Array.isArray(o.affinities) || !o.affinities.every((x) => isCoyoteAffinityPossibility(x))) {
        return false
    }
    if ('affinitiesFailed' in o && typeof o.affinitiesFailed !== 'boolean') {
        return false
    }
    if (o.affinitiesFailed === true && o.affinities.length !== 0) {
        return false
    }
    return true
}

export const isAcmeOrderPublishedPayload = (
    value: unknown
): value is AcmeOrderPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Acme Order') {
        return false
    }
    if (typeof v.characterId !== 'string') {
        return false
    }
    if (!Array.isArray(v.orders) || !v.orders.every((entry) => isAcmeOrderPublishedOrder(entry))) {
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
