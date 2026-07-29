import { v4 as uuidv4 } from 'uuid'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'

import internalCache from '../../../internalCache'
import type { MessageBus } from '../../../messageBus/baseClasses'
import { resolveCanonAssetStackForRoom, resolveRoomAssetStackForRoom } from '../../state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from '../../renderOrchestration/fanOutStateChangedToPassiveRenders'
import { sendRenderRequested } from '../../renderOrchestration/subscribedEvents'
import type { RenderRequestedCommand } from '../../renderOrchestration/localApiEvents'
import { sendMessageBundleDeclared } from '../../messageOrchestration/subscribedEvents'
import { registerIngressSlot } from '../../messageOrchestration'

const ROOM_DESCRIPTION_SLOT_ID = 'roomDescription'

export type PreparedFullRoomDescriptionRender = {
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
    perspectiveKey: string;
    renderCommand: RenderRequestedCommand;
}

/**
 * Resolve room perspective, room form WML, and the render command for the full (non-header) room
 * view. Shared by {@link requestFullRoomDescriptionForCharacter} and event-driven look in render
 * orchestration.
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
    const renderCommand: RenderRequestedCommand = {
        componentId: roomId,
        perspective,
        characterId,
    }
    return {
        roomId,
        characterId,
        perspectiveKey,
        renderCommand,
    }
}

/**
 * Declare a one-slot messageOrchestration bundle, register its ingress slot, and request a render
 * for the full (non-header) room view --- matching the trusted UI `look` path when `EphemeraId` is
 * a room. Phase 7: registers against messageOrchestration's ingress registry (`format:'full'`,
 * the same `(componentId, perspectiveKey, 'render')` bucket `roomDescription`/`characterMove`/
 * `sessionOrientationRender` all share) instead of `PerceptionThreads`.
 */
export async function requestFullRoomDescriptionForCharacter(
    bus: MessageBus,
    characterId: EphemeraCharacterId,
    roomId: EphemeraRoomId,
): Promise<void> {
    const prepared = await prepareFullRoomDescriptionRenderForCharacter(characterId, roomId)
    const bundleId = uuidv4()
    sendMessageBundleDeclared(bus, bundleId, {
        bundleId,
        slots: [{ slotId: ROOM_DESCRIPTION_SLOT_ID, expectedPublishType: 'PerceptionMessage' }],
    })
    await registerIngressSlot(
        bus,
        bundleId,
        {
            slotId: ROOM_DESCRIPTION_SLOT_ID,
            expectedPublishType: 'PerceptionMessage',
            componentId: prepared.roomId,
            perspectiveKey: prepared.perspectiveKey,
            targets: [characterId],
            contentStream: 'render',
            format: 'full',
        },
        async () => {
            sendRenderRequested(bus, prepared.roomId, prepared.renderCommand)
        }
    )
}
