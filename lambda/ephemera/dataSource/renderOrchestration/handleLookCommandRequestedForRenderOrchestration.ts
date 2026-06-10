import type { LookCommandRequestedPublishedPayload } from '../actions/publishedEvents'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import internalCache from '../../internalCache'
import { resolveCanonAssetStackForRoom, resolveRoomAssetStackForRoom } from '../state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from './fanOutStateChangedToPassiveRenders'
import { computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { orchestrateRenderRequest } from './orchestrationHandler'
import type { RenderOrchestrationPublishedPayload } from './publishedEvents'

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
 * Event-driven look: register `roomDescription` directly on `PerceptionThreads`, then run passive orchestration.
 */
export async function handleLookCommandRequestedForRenderOrchestration(
    payload: LookCommandRequestedPublishedPayload,
    streamEvent: StreamEventFunction<RenderOrchestrationPublishedPayload>,
): Promise<void> {
    const { roomId, characterId } = payload
    const { perspective, perspectiveKey } = await prepareLookOrchestrationPerspective(
        characterId,
        roomId,
    )
    internalCache.PerceptionThreads.register({
        threadKind: 'roomDescription',
        componentId: roomId,
        perspectiveKey,
        characterId,
    })
    await orchestrateRenderRequest({
        payload: {
            type: 'RenderRequested',
            componentId: roomId,
            perspective,
            characterId,
        },
        streamEvent,
    })
}
