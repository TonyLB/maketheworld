import messageBus from '../messageBus'
import internalCache from '../internalCache'
import { defaultColorFromCharacterId } from '../lib/characterColor'
import { ActionAPIMessage } from '@tonylb/mtw-interfaces/ts/ephemera'
import { EphemeraCharacterId, LegalCharacterColor, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { PublishMessage } from '../messageBus/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { resolveCanonAssetStackForRoom } from '../dataSource/state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from '../dataSource/renderOrchestration/fanOutStateChangedToPassiveRenders'
import { sendPerceptionThreadRegistered } from '../dataSource/perception/subscribedEvents'
import { sendRenderRequested } from '../dataSource/renderOrchestration/subscribedEvents'

const narrateOOCOrSpeech = async ({ CharacterId, Message, DisplayProtocol }: { CharacterId?: EphemeraCharacterId; Message?: string; DisplayProtocol?: PublishMessage["displayProtocol"]; } = {}) => {
    if (CharacterId && Message && DisplayProtocol) {
        const { RoomId, Name, Color = defaultColorFromCharacterId(CharacterId) } = await internalCache.CharacterMeta.get(CharacterId) || {}
        if (RoomId) {
            messageBus.send({
                type: 'PublishMessage',
                targets: [RoomId],
                displayProtocol: DisplayProtocol as any,
                message: [Message],
                characterId: CharacterId,
                name: Name || '',
                color: (Color || 'grey') as LegalCharacterColor
            })
            messageBus.send({
                type: 'ReturnValue',
                body: { messageType: 'Success' }
            })
        }
    }
}

export const executeAction = async (request: ActionAPIMessage) => {
    switch(request.actionType) {
        case 'look': {
            const characterId = request.payload.CharacterId
            const ephemeraId = request.payload.EphemeraId
            if (isEphemeraRoomId(ephemeraId)) {
                const roomCanonStack = await resolveCanonAssetStackForRoom(ephemeraId, {
                    RoomAssets: internalCache.RoomAssets,
                    AssetMetaData: internalCache.AssetMetaData,
                })
                const { assets: characterAssets = [] } = await internalCache.CharacterMeta.get(characterId) || {}
                const filteredAssetStack = filterRoomCanonStackByCharacterAssets(roomCanonStack, characterAssets)
                const perspective = { assetStack: filteredAssetStack }
                const perspectiveKey = computePerspectiveKey(perspective.assetStack)
                sendPerceptionThreadRegistered(messageBus, ephemeraId, {
                    componentId: ephemeraId,
                    perspectiveKey,
                    characterId,
                })
                const roomForm = await internalCache.ComponentRender.get(characterId, ephemeraId)
                const generationContextWml = schemaToWML([roomForm.schema])
                sendRenderRequested(messageBus, ephemeraId, {
                    componentId: ephemeraId,
                    perspective,
                    characterId,
                    generationContextWml,
                })
                break
            }
            messageBus.send({
                type: 'Perception',
                characterId,
                ephemeraId,
            })
            break
        }
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
            const { HomeId } = await internalCache.CharacterMeta.get(request.payload.CharacterId)
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

// Message bus handler for ExecuteAction messages
export const executeActionMessage = async ({ payloads }: { payloads: import('../messageBus/baseClasses').ExecuteActionMessage[], messageBus?: any }) => {
    await Promise.all(payloads.map(async (message) => {
        await executeAction(message.action)
    }))
}
