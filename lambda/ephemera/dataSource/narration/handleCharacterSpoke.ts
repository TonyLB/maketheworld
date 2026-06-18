import { defaultColorFromCharacterId } from '../../lib/characterColor'
import internalCache from '../../internalCache'
import type { LegalCharacterColor } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { CharacterSpokePublishedPayload } from '../actions/publishedEvents'
import { resolveCharacterRoomId } from '../positions/membership/resolveCharacterRoomId'

export const handleCharacterSpoke = async (
    messageBus: Pick<MessageBus, 'publish'>,
    payload: CharacterSpokePublishedPayload,
): Promise<void> => {
    const { characterId, message, displayProtocol } = payload
    const [characterMeta, RoomId] = await Promise.all([
        internalCache.CharacterMeta.get(characterId),
        resolveCharacterRoomId(characterId),
    ])
    const { Name, Color = defaultColorFromCharacterId(characterId) } = characterMeta || {}
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
