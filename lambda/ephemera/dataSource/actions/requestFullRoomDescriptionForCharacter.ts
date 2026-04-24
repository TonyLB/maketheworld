import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

import internalCache from '../../internalCache'
import type { StreamingEventMessage } from '../../messageBus/baseClasses'
import { resolveCanonAssetStackForRoom } from '../state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from '../renderOrchestration/fanOutStateChangedToPassiveRenders'
import { sendPerceptionThreadRegistered } from '../perception/subscribedEvents'
import { sendRenderRequested } from '../renderOrchestration/subscribedEvents'

type MessageBusLike = { send: (payload: StreamingEventMessage) => void }

/**
 * Register a `roomDescription` perception thread and request a render for the full (non-header) room view,
 * matching the legacy `executeAction` `look` path when `EphemeraId` is a room.
 */
export async function requestFullRoomDescriptionForCharacter(
    bus: MessageBusLike,
    characterId: EphemeraCharacterId,
    roomId: EphemeraRoomId,
): Promise<void> {
    const roomCanonStack = await resolveCanonAssetStackForRoom(roomId, {
        RoomAssets: internalCache.RoomAssets,
        AssetMetaData: internalCache.AssetMetaData,
    })
    const { assets: characterAssets = [] } = await internalCache.CharacterMeta.get(characterId) || {}
    const filteredAssetStack = filterRoomCanonStackByCharacterAssets(roomCanonStack, characterAssets)
    const perspective = { assetStack: filteredAssetStack }
    const perspectiveKey = computePerspectiveKey(perspective.assetStack)
    sendPerceptionThreadRegistered(bus, roomId, {
        threadKind: 'roomDescription',
        componentId: roomId,
        perspectiveKey,
        characterId,
    })
    const roomForm = await internalCache.ComponentRender.get(characterId, roomId)
    const generationContextWml = schemaToWML([roomForm.schema])
    sendRenderRequested(bus, roomId, {
        componentId: roomId,
        perspective,
        characterId,
        generationContextWml,
    })
}
