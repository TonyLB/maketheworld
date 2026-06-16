import { defaultColorFromCharacterId } from '../../lib/characterColor'
import internalCache from '../../internalCache'
import type { LegalCharacterColor } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { CharacterSpokePublishedPayload } from '../actions/publishedEvents'

export const handleCharacterSpoke = async (
    messageBus: Pick<MessageBus, 'publish'>,
    payload: CharacterSpokePublishedPayload,
): Promise<void> => {
    const { characterId, message, displayProtocol } = payload
    const { RoomId, Name, Color = defaultColorFromCharacterId(characterId) } = await internalCache.CharacterMeta.get(characterId) || {}
    if (!RoomId) {
        return
    }
    messageBus.publish({
        type: 'PublishMessage',
        targets: [RoomId],
        displayProtocol,
        message: [message],
        characterId,
        name: Name || '',
        color: (Color || 'grey') as LegalCharacterColor,
    })
}
