import internalCache from '../internalCache'
import { defaultColorFromCharacterId } from '../lib/characterColor'
import { ActionAPIMessage } from '@tonylb/mtw-interfaces/ts/ephemera'
import { EphemeraCharacterId, LegalCharacterColor, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { MessageBus, PublishMessage } from '../messageBus/baseClasses'
import { requestFullRoomDescriptionForCharacter } from '../dataSource/actions/actionHandlers/requestFullRoomDescriptionForCharacter'
import { sendActionAssessed } from '../dataSource/apiEphemera'

const narrateOOCOrSpeech = async (
    messageBus: Pick<MessageBus, 'publish'>,
    { CharacterId, Message, DisplayProtocol }: { CharacterId?: EphemeraCharacterId; Message?: string; DisplayProtocol?: PublishMessage["displayProtocol"]; } = {}
) => {
    if (CharacterId && Message && DisplayProtocol) {
        const { RoomId, Name, Color = defaultColorFromCharacterId(CharacterId) } = await internalCache.CharacterMeta.get(CharacterId) || {}
        if (RoomId) {
            messageBus.publish({
                type: 'PublishMessage',
                targets: [RoomId],
                displayProtocol: DisplayProtocol as any,
                message: [Message],
                characterId: CharacterId,
                name: Name || '',
                color: (Color || 'grey') as LegalCharacterColor
            })
            messageBus.publish({
                type: 'ReturnValue',
                body: { messageType: 'Success' }
            })
        }
    }
}

export const executeAction = async (messageBus: Pick<MessageBus, 'publish'>, request: ActionAPIMessage) => {
    switch(request.actionType) {
        case 'look': {
            const characterId = request.payload.CharacterId
            const ephemeraId = request.payload.EphemeraId
            if (isEphemeraRoomId(ephemeraId)) {
                await requestFullRoomDescriptionForCharacter(messageBus, characterId, ephemeraId)
                break
            }
            messageBus.publish({
                type: 'Perception',
                characterId,
                ephemeraId,
            })
            break
        }
        case 'SayMessage':
        case 'NarrateMessage':
        case 'OOCMessage':
            await narrateOOCOrSpeech(messageBus, { ...request.payload, DisplayProtocol: request.actionType })
            break
        case 'move':
            if (!isEphemeraRoomId(request.payload.RoomId)) {
                break
            }
            sendActionAssessed(messageBus, request.payload.CharacterId, {
                characterId: request.payload.CharacterId,
                assessed: {
                    type: 'Navigation',
                    targetId: request.payload.RoomId,
                    ...(request.payload.ExitName !== undefined ? { exitName: request.payload.ExitName } : {}),
                    confidence: 1,
                },
                source: 'uiExit',
            })
            break
        case 'home':
            sendActionAssessed(messageBus, request.payload.CharacterId, {
                characterId: request.payload.CharacterId,
                assessed: {
                    type: 'Home',
                    confidence: 1,
                },
                source: 'uiHome',
            })
            break
        default:
            break        
    }
}

// Message bus handler for ExecuteAction messages
export const executeActionMessage = async ({ payloads, messageBus }: { payloads: import('../messageBus/baseClasses').ExecuteActionMessage[], messageBus: Pick<MessageBus, 'publish'> }) => {
    await Promise.all(payloads.map(async (message) => {
        await executeAction(messageBus, message.action)
    }))
}
