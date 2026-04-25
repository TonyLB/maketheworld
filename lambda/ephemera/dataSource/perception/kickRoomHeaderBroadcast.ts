/**
 * Room header refresh: group room occupants by perspectiveKey, register broadcast threads, kick passive render.
 */
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { MessageGroupId } from '../../internalCache/orchestrateMessages'
import { resolveCanonAssetStackForRoom, resolveRoomAssetStackForRoom } from '../state/resolveAssetStackForRoom'
import {
    filterRoomCanonStackByCharacterAssets,
    groupCharacterRowsByPerspective,
    type CharacterPerspectiveRow,
} from '../renderOrchestration/fanOutStateChangedToPassiveRenders'
import { sendRenderRequested } from '../renderOrchestration/subscribedEvents'
import { sendPerceptionThreadRegistered } from './subscribedEvents'

export async function kickRoomHeaderBroadcastForRoom(options: {
    roomId: EphemeraRoomId;
    messageBus: MessageBus;
    messageGroupId?: MessageGroupId;
}): Promise<void> {
    const { roomId, messageBus, messageGroupId } = options
    const roomAssetStack = await resolveRoomAssetStackForRoom(roomId, {
        RoomAssets: internalCache.RoomAssets,
    })
    const roomCanonStack = await resolveCanonAssetStackForRoom(roomId, {
        RoomAssets: internalCache.RoomAssets,
        AssetMetaData: internalCache.AssetMetaData,
    })
    const characters = await internalCache.RoomCharacterList.get(roomId)
    const characterMetaRows = await Promise.all(
        characters.map(async (character) => {
            const characterId = character.EphemeraId as EphemeraCharacterId
            const { assets = [] } = (await internalCache.CharacterMeta.get(characterId)) || {}
            return { characterId, assets }
        })
    )
    const rows = characterMetaRows.reduce<CharacterPerspectiveRow[]>((previous, { characterId, assets }) => {
        const filteredAssetStack = filterRoomCanonStackByCharacterAssets(roomAssetStack, assets, roomCanonStack)
        if (filteredAssetStack.length === 0) {
            return previous
        }
        return [...previous, { characterId, filteredAssetStack }]
    }, [])

    const groups = groupCharacterRowsByPerspective(rows)
    for (const { assetStack, characterIds } of Object.values(groups)) {
        if (characterIds.length === 0) {
            continue
        }
        const perspectiveKey = computePerspectiveKey(assetStack)
        sendPerceptionThreadRegistered(messageBus, roomId, {
            threadKind: 'roomHeaderBroadcast',
            componentId: roomId,
            perspectiveKey,
            targets: characterIds,
            messageGroupId,
        })
        sendRenderRequested(messageBus, roomId, {
            componentId: roomId,
            perspective: { assetStack },
            targets: characterIds,
            messageGroupId,
        })
    }
}

/**
 * Perspective key for a character's filtered asset stack on a room, or null if the stack is empty.
 * Matches {@link kickPassiveRenderRequestedForCharacterInRoom} routing.
 */
export async function getCharacterRoomPerspectiveKey(
    roomId: EphemeraRoomId,
    assets: readonly string[]
): Promise<string | null> {
    const roomAssetStack = await resolveRoomAssetStackForRoom(roomId, {
        RoomAssets: internalCache.RoomAssets,
    })
    const roomCanonStack = await resolveCanonAssetStackForRoom(roomId, {
        RoomAssets: internalCache.RoomAssets,
        AssetMetaData: internalCache.AssetMetaData,
    })
    const filteredAssetStack = filterRoomCanonStackByCharacterAssets(roomAssetStack, assets, roomCanonStack)
    if (filteredAssetStack.length === 0) {
        return null
    }
    return computePerspectiveKey(filteredAssetStack)
}

/**
 * Passive render only: enqueue {@link sendRenderRequested} for one character's filtered perspective on a room.
 * Does not register perception threads or emit client Perception messages.
 */
export async function kickPassiveRenderRequestedForCharacterInRoom(options: {
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
    assets: readonly string[];
    messageBus: MessageBus;
    useDefaultMessageBusLane?: boolean;
}): Promise<boolean> {
    const { roomId, characterId, assets, messageBus, useDefaultMessageBusLane } = options
    const roomAssetStack = await resolveRoomAssetStackForRoom(roomId, {
        RoomAssets: internalCache.RoomAssets,
    })
    const roomCanonStack = await resolveCanonAssetStackForRoom(roomId, {
        RoomAssets: internalCache.RoomAssets,
        AssetMetaData: internalCache.AssetMetaData,
    })
    const filteredAssetStack = filterRoomCanonStackByCharacterAssets(roomAssetStack, assets, roomCanonStack)
    if (filteredAssetStack.length === 0) {
        return false
    }
    sendRenderRequested(messageBus, roomId, {
        componentId: roomId,
        perspective: { assetStack: filteredAssetStack },
        characterId,
    }, useDefaultMessageBusLane ? { useDefaultMessageBusLane: true } : undefined)
    return true
}
