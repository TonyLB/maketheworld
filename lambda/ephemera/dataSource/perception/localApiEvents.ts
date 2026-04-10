/**
 * Payload contracts for internal perception ingress events (api.ephemera).
 *
 * In-process only (dataSourceKey: 'api.ephemera'). See dataSource/perception/AGENT.md.
 */
import { isEphemeraCharacterId, type EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageGroupId } from '../../internalCache/orchestrateMessages'

export type CharacterPerceptionRequestedCommand = {
    characterId: EphemeraCharacterId;
    ephemeraId: EphemeraCharacterId;
    messageGroupId?: MessageGroupId;
}

export type PerceptionIngressCommand = CharacterPerceptionRequestedCommand

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
