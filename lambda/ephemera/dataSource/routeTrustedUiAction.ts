import type { ActionAPIMessage } from '@tonylb/mtw-interfaces/ts/ephemera'
import {
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageBus } from '../messageBus/baseClasses'
import { sendActionAssessed } from './apiEphemera'

/**
 * Trusted UI `action` ingress for look, move, and home.
 * Returns true when handled; false so app.ts can fall through to ExecuteAction (speech).
 */
export function routeTrustedUiAction(
    bus: Pick<MessageBus, 'publish'>,
    request: ActionAPIMessage,
): boolean {
    switch (request.actionType) {
        case 'look': {
            const characterId = request.payload.CharacterId
            const ephemeraId = request.payload.EphemeraId
            if (
                !isEphemeraRoomId(ephemeraId)
                && !isEphemeraFeatureId(ephemeraId)
                && !isEphemeraKnowledgeId(ephemeraId)
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
            return false
    }
}
