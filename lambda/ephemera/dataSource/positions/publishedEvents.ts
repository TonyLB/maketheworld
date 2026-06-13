import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

/**
 * Outbound stream payloads for mtw.ephemera.positions (bus-only DataSource).
 */
export const EPHEMERA_POSITIONS_DATA_SOURCE_KEY = 'mtw.ephemera.positions' as const

export type CharacterMovedPublishedPayload = {
    type: 'Character Moved';
    characterId: EphemeraCharacterId;
    from: EphemeraRoomId | null;
    to: EphemeraRoomId | null;
    beatAnchorTime: number;
    legalExits?: string[];
    characterName?: string;
}

export type PositionsPublishedPayload = CharacterMovedPublishedPayload

const isMembershipEndpoint = (value: unknown): value is EphemeraRoomId | null => (
    value === null || (typeof value === 'string' && isEphemeraRoomId(value))
)

export const isCharacterMovedPublishedPayload = (
    value: unknown
): value is CharacterMovedPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Character Moved') {
        return false
    }
    if (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId)) {
        return false
    }
    if (!isMembershipEndpoint(v.from) || !isMembershipEndpoint(v.to)) {
        return false
    }
    if (typeof v.beatAnchorTime !== 'number' || !Number.isFinite(v.beatAnchorTime)) {
        return false
    }
    if (v.legalExits !== undefined) {
        if (!Array.isArray(v.legalExits) || !v.legalExits.every((entry) => typeof entry === 'string')) {
            return false
        }
    }
    if (v.characterName !== undefined && typeof v.characterName !== 'string') {
        return false
    }
    return true
}
