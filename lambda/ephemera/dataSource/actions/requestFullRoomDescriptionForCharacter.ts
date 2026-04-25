import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

import internalCache from '../../internalCache'
import type { StreamingEventMessage } from '../../messageBus/baseClasses'
import type { PerceptionThreadRegisterCommand } from '../perception/localApiEvents'
import { resolveCanonAssetStackForRoom } from '../state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from '../renderOrchestration/fanOutStateChangedToPassiveRenders'
import { sendPerceptionThreadRegistered } from '../perception/subscribedEvents'
import { sendRenderRequested } from '../renderOrchestration/subscribedEvents'
import type { RenderRequestedCommand } from '../renderOrchestration/localApiEvents'

type MessageBusLike = { send: (payload: StreamingEventMessage, laneId?: string) => void }

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
    options?: { includeGenerationContextWml?: boolean },
): Promise<PreparedFullRoomDescriptionRender> {
    const roomCanonStack = await resolveCanonAssetStackForRoom(roomId, {
        RoomAssets: internalCache.RoomAssets,
        AssetMetaData: internalCache.AssetMetaData,
    })
    const { assets: characterAssets = [] } = await internalCache.CharacterMeta.get(characterId) || {}
    const filteredAssetStack = filterRoomCanonStackByCharacterAssets(roomCanonStack, characterAssets)
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
    if (options?.includeGenerationContextWml !== false) {
        const roomForm = await internalCache.ComponentRender.get(characterId, roomId)
        renderCommand.generationContextWml = schemaToWML([roomForm.schema])
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
