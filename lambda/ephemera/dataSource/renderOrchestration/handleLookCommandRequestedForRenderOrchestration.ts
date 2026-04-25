import type { LookCommandRequestedPublishedPayload } from '../actions/publishedEvents'
import type { MessageBus } from '../../messageBus/baseClasses'
import { sendPerceptionThreadRegistered } from '../perception/subscribedEvents'
import { sendRenderRequested } from './subscribedEvents'
import internalCache from '../../internalCache'
import { resolveCanonAssetStackForRoom, resolveRoomAssetStackForRoom } from '../state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from './fanOutStateChangedToPassiveRenders'
import { computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { v4 as uuidv4 } from 'uuid'

export const prepareLookOrchestrationPerspective = async (
    characterId: EphemeraCharacterId,
    roomId: EphemeraRoomId,
): Promise<{ roomId: EphemeraRoomId; perspective: Perspective; perspectiveKey: string }> => {
    const roomAssetStack = await resolveRoomAssetStackForRoom(roomId, {
        RoomAssets: internalCache.RoomAssets,
    })
    const roomCanonStack = await resolveCanonAssetStackForRoom(roomId, {
        RoomAssets: internalCache.RoomAssets,
        AssetMetaData: internalCache.AssetMetaData,
    })
    const { assets: characterAssets = [] } = await internalCache.CharacterMeta.get(characterId) || {}
    const filteredAssetStack = filterRoomCanonStackByCharacterAssets(roomAssetStack, characterAssets, roomCanonStack)
    const perspective = { assetStack: filteredAssetStack }
    const perspectiveKey = computePerspectiveKey(perspective.assetStack)
    return { roomId, perspective, perspectiveKey }
}

/**
 * Event-driven look: register `roomDescription` on a run-scoped bus lane, flush so `PerceptionThreads` exists, then
 * `Render Requested` on the default lane (ongoing `flush` resolves it; no `renderOrchestration:*` lane for this path).
 */
export async function handleLookCommandRequestedForRenderOrchestration(
    messageBus: MessageBus,
    payload: LookCommandRequestedPublishedPayload,
): Promise<void> {
    const { roomId, characterId } = payload
    const { perspective, perspectiveKey } = await prepareLookOrchestrationPerspective(
        characterId,
        roomId,
    )
    const perceptionLane = `lookCommand:perceptionThread:${uuidv4()}`
    sendPerceptionThreadRegistered(
        messageBus,
        roomId,
        {
            threadKind: 'roomDescription',
            componentId: roomId,
            perspectiveKey,
            characterId,
        },
        perceptionLane
    )
    await messageBus.flush(perceptionLane)
    sendRenderRequested(
        messageBus,
        payload.roomId,
        {
            componentId: roomId,
            perspective,
            characterId,
        },
        { useDefaultMessageBusLane: true }
    )
}
