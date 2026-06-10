import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'

import internalCache from '../../../internalCache'
import type { StreamingEventMessage } from '../../../messageBus/baseClasses'
import type { PerceptionThreadRegisterCommand } from '../../perception/localApiEvents'
import { resolveCanonAssetStackForRoom, resolveRoomAssetStackForRoom } from '../../state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from '../../renderOrchestration/fanOutStateChangedToPassiveRenders'
import { sendPerceptionThreadRegistered } from '../../perception/subscribedEvents'
import { sendRenderRequested } from '../../renderOrchestration/subscribedEvents'
import type { RenderRequestedCommand } from '../../renderOrchestration/localApiEvents'

type MessageBusLike = { publish: (payload: StreamingEventMessage) => void }

export type PreparedFullRoomDescriptionRender = {
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
    threadRegisterCommand: PerceptionThreadRegisterCommand;
    renderCommand: RenderRequestedCommand;
}

/**
 * Resolve room perspective, room form WML, and commands for `roomDescription` thread + passive render.
 * Shared by {@link requestFullRoomDescriptionForCharacter} and event-driven look in render orchestration.
 */
export async function prepareFullRoomDescriptionRenderForCharacter(
    characterId: EphemeraCharacterId,
    roomId: EphemeraRoomId,
): Promise<PreparedFullRoomDescriptionRender> {
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
    const threadRegisterCommand: PerceptionThreadRegisterCommand = {
        threadKind: 'roomDescription',
        componentId: roomId,
        perspectiveKey,
        characterId,
    }
    const renderCommand: RenderRequestedCommand = {
        componentId: roomId,
        perspective,
        characterId,
    }
    return {
        roomId,
        characterId,
        threadRegisterCommand,
        renderCommand,
    }
}

/**
 * Register a `roomDescription` perception thread and request a render for the full (non-header) room view,
 * matching the legacy `executeAction` `look` path when `EphemeraId` is a room.
 */
export async function requestFullRoomDescriptionForCharacter(
    bus: MessageBusLike,
    characterId: EphemeraCharacterId,
    roomId: EphemeraRoomId,
): Promise<void> {
    const prepared = await prepareFullRoomDescriptionRenderForCharacter(characterId, roomId)
    sendPerceptionThreadRegistered(bus, prepared.roomId, prepared.threadRegisterCommand)
    sendRenderRequested(bus, prepared.roomId, prepared.renderCommand)
}
