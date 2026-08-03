import type { ActionAPIMessage } from '@tonylb/mtw-interfaces/ts/ephemera'
import {
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageBus } from '../messageBus/baseClasses'
import { sendActionAssessed } from './apiEphemera'

type SpeechActionType = 'SayMessage' | 'NarrateMessage' | 'OOCMessage'

const isSpeechActionType = (actionType: string): actionType is SpeechActionType => (
    actionType === 'SayMessage' || actionType === 'NarrateMessage' || actionType === 'OOCMessage'
)

const routeSpeechAction = (
    bus: Pick<MessageBus, 'publish'>,
    request: ActionAPIMessage & { actionType: SpeechActionType },
    requestId?: string,
): boolean => {
    const message = request.payload.Message
    if (typeof message !== 'string' || message.trim().length === 0) {
        return true
    }
    sendActionAssessed(bus, request.payload.CharacterId, {
        characterId: request.payload.CharacterId,
        assessed: {
            type: 'CharacterSpoke',
            message,
            displayProtocol: request.actionType,
            confidence: 1,
        },
        source: 'uiSpeech',
        ...(requestId ? { requestId } : {}),
    })
    return true
}

/**
 * Trusted UI `action` ingress for look, move, home, and speech.
 */
export function routeTrustedUiAction(
    bus: Pick<MessageBus, 'publish'>,
    request: ActionAPIMessage,
    requestId?: string,
): boolean {
    switch (request.actionType) {
        case 'look': {
            const characterId = request.payload.CharacterId
            const ephemeraId = request.payload.EphemeraId
            if (
                !isEphemeraRoomId(ephemeraId)
                && !isEphemeraFeatureId(ephemeraId)
                && !isEphemeraKnowledgeId(ephemeraId)
                && !isEphemeraCharacterId(ephemeraId)
            ) {
                return true
            }
            sendActionAssessed(bus, characterId, {
                characterId,
                assessed: {
                    type: 'LookComponent',
                    componentId: ephemeraId,
                    confidence: 1,
                },
                source: 'uiLook',
            })
            return true
        }
        case 'move': {
            if (!isEphemeraRoomId(request.payload.RoomId)) {
                return true
            }
            sendActionAssessed(bus, request.payload.CharacterId, {
                characterId: request.payload.CharacterId,
                assessed: {
                    type: 'Navigation',
                    targetId: request.payload.RoomId,
                    ...(request.payload.ExitName !== undefined ? { exitName: request.payload.ExitName } : {}),
                    confidence: 1,
                },
                source: 'uiExit',
            })
            return true
        }
        case 'home':
            sendActionAssessed(bus, request.payload.CharacterId, {
                characterId: request.payload.CharacterId,
                assessed: {
                    type: 'Home',
                    confidence: 1,
                },
                source: 'uiHome',
            })
            return true
        default:
            if (isSpeechActionType(request.actionType)) {
                return routeSpeechAction(bus, request as ActionAPIMessage & { actionType: SpeechActionType }, requestId)
            }
            return true
    }
}
