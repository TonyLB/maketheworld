import type { LookCommandRequestedPublishedPayload } from '../actions/publishedEvents'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import internalCache from '../../internalCache'
import { resolveCanonAssetStackForRoom, resolveRoomAssetStackForRoom } from '../state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from './fanOutStateChangedToPassiveRenders'
import { computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { orchestrateRenderRequest } from './orchestrationHandler'
import type { RenderOrchestrationPublishedPayload } from './publishedEvents'
import { prepareFeatureKnowledgeRenderForCharacter } from './prepareFeatureKnowledgeRenderForCharacter'

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
 * Event-driven look: register perception thread directly on `PerceptionThreads`, then run passive orchestration.
 * Dispatches by `componentId` kind (room vs feature/knowledge).
 */
export async function handleLookCommandRequestedForRenderOrchestration(
    payload: LookCommandRequestedPublishedPayload,
    streamEvent: StreamEventFunction<RenderOrchestrationPublishedPayload>,
): Promise<void> {
    const { componentId, characterId } = payload

    if (isEphemeraRoomId(componentId)) {
        const { perspective, perspectiveKey } = await prepareLookOrchestrationPerspective(
            characterId,
            componentId,
        )
        internalCache.PerceptionThreads.register({
            threadKind: 'roomDescription',
            componentId,
            perspectiveKey,
            characterId,
        })
        await orchestrateRenderRequest({
            payload: {
                type: 'RenderRequested',
                componentId,
                perspective,
                characterId,
            },
            streamEvent,
        })
        return
    }

    if (isEphemeraFeatureId(componentId) || isEphemeraKnowledgeId(componentId)) {
        const prepared = await prepareFeatureKnowledgeRenderForCharacter(
            characterId,
            componentId,
            undefined,
            { directResponse: payload.directResponse },
        )
        internalCache.PerceptionThreads.register(prepared.threadRegisterCommand)
        await orchestrateRenderRequest({
            payload: {
                type: 'RenderRequested',
                ...prepared.renderCommand,
            },
            streamEvent,
        })
    }
}
