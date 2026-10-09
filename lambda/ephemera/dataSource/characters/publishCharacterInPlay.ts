import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../internalCache'
import type { CharacterMetaItem } from '../../internalCache/characterMeta'
import messageBus from '../../messageBus'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { CharacterMovedPublishedPayload } from '../positions/publishedEvents'

export type PublishCharacterInPlayDependencies = {
    getCharacterMeta?: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    getSessionId?: () => Promise<string | undefined>;
    messageBus?: Pick<MessageBus, 'publish'>;
}

/**
 * Announces the mover as in play on positions' `Character Moved`, in whichever room it now occupies
 * (its home when `to` is null, as the move route always did). Tolerates failure (log, never throw):
 * the move already committed.
 */
export const publishCharacterInPlay = async (
    fact: CharacterMovedPublishedPayload,
    deps?: PublishCharacterInPlayDependencies
): Promise<void> => {
    const getCharacterMeta = deps?.getCharacterMeta
        ?? ((id: EphemeraCharacterId) => internalCache.CharacterMeta.get(id))
    const getSessionId = deps?.getSessionId ?? (() => internalCache.Global.get('SessionId'))
    const bus = deps?.messageBus ?? messageBus

    try {
        const [characterMeta, sessionId] = await Promise.all([
            getCharacterMeta(fact.characterId),
            getSessionId(),
        ])
        bus.publish({
            type: 'EphemeraUpdate',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: characterMeta.EphemeraId,
                Connected: true,
                RoomId: fact.to ?? characterMeta.HomeId,
                connectionTargets: ['GLOBAL', `SESSION#${sessionId}`],
            }],
        })
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[mtw.ephemera.characters] CharacterInPlay publish failed: ${message}`)
    }
}
