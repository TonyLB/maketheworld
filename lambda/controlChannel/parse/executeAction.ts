import messageBus from '../messageBus'
import internalCache from '../internalCache'
import { defaultColorFromCharacterId } from '@tonylb/mtw-utilities/dist/selfHealing/index'
import { ActionAPIMessage } from '@tonylb/mtw-interfaces/dist/ephemera'
import { LegalCharacterColor, PublishMessage } from '../messageBus/baseClasses'

const narrateOOCOrSpeech = async ({ CharacterId, Message, DisplayProtocol }: { CharacterId?: string; Message?: string; DisplayProtocol?: PublishMessage["displayProtocol"]; } = {}) => {
    if (CharacterId && Message && DisplayProtocol) {
        const { RoomId, Name, Color = defaultColorFromCharacterId(CharacterId) } = await internalCache.CharacterMeta.get(CharacterId) || {}
        if (RoomId) {
            messageBus.send({
                type: 'PublishMessage',
                targets: [`ROOM#${RoomId}`],
                displayProtocol: DisplayProtocol,
                message: [{ tag: 'String', value: Message }],
                characterId: CharacterId,
                name: Name || '',
                color: (Color || 'grey') as LegalCharacterColor
            })
            messageBus.send({
                type: 'ReturnValue',
                body: { messageType: 'ActionComplete' }
            })
        }
    }
}

export const executeAction = async (request: ActionAPIMessage) => {
    switch(request.actionType) {
        case 'look':
            messageBus.send({
                type: 'Perception',
                characterId: request.payload.CharacterId,
                ephemeraId: request.payload.EphemeraId
            })
            break
        case 'SayMessage':
        case 'NarrateMessage':
        case 'OOCMessage':
            await narrateOOCOrSpeech({ ...request.payload, DisplayProtocol: request.actionType })
            break
        case 'move':
            messageBus.send({
                type: 'MoveCharacter',
                characterId: request.payload.CharacterId,
                roomId: request.payload.RoomId,
                leaveMessage: ` left${request.payload.ExitName ? ` by ${request.payload.ExitName} exit` : ''}.`
            })
            break
        case 'home':
            const props = await internalCache.CharacterMeta.get(request.payload.CharacterId)
            const { HomeId = '' } = props || {}
            messageBus.send({
                type: 'MoveCharacter',
                characterId: request.payload.CharacterId,
                roomId: HomeId,
                leaveMessage: ' left to return home.'
            })
            break
        default:
            break        
    }
}