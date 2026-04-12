/**
 * Room header refresh: group room occupants by perspectiveKey, register broadcast threads, kick passive render.
 */
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { MessageGroupId } from '../../internalCache/orchestrateMessages'
import { resolveCanonAssetStackForRoom } from '../state/resolveAssetStackForRoom'
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
        const filteredAssetStack = filterRoomCanonStackByCharacterAssets(roomCanonStack, assets)
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
