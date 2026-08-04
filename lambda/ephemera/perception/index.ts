import { PerceptionMessage as PerceptionRequestMessage, MessageBus, isPerceptionRoomMessage, isPerceptionAssetMessage } from "../messageBus/baseClasses"
import { internalCache } from "../internalCache"
import { getRoomCharacterList } from "../internalCache/hydrateRoomRoster"
import {
    EphemeraCharacterId,
    EphemeraRoomId,
    isEphemeraRoomId,
} from "@tonylb/mtw-interfaces/ts/baseClasses"
import { v4 as uuidv4 } from 'uuid'
import { roomHeaderGeneratingPlaceholderWml } from "../dataSource/perception/roomHeaderPlaceholderWml"
import getCurrentTimestamp from "../internalUtils/dateUtil"
import { kickRoomHeaderBroadcastForRoom } from "../dataSource/perception/kickRoomHeaderBroadcast"
import { roomHeaderChannelWmlForRoomId, roomRenderChannelWmlForRoomId } from "../dataSource/perception/roomRenderWmlFromCacheRecord"

export const perceptionMessage = async ({ 
    payloads, 
    messageBus, 
    internalCacheOverride 
}: { 
    payloads: PerceptionRequestMessage[], 
    messageBus: MessageBus,
    internalCacheOverride?: any
}): Promise<void> => {
    const getCache = () => internalCacheOverride || internalCache
    
    await Promise.all(payloads.map(async (payload) => {
        //
        // Asset and Room are the only kinds this imperative handler serves. Component kinds
        // (Character / Feature / Knowledge) and Map were retired: every component look now
        // reaches delivery through `Action Assessed` `LookComponent` -> render orchestration ->
        // correlated fan-in, and `PerceptionMessage` no longer admits their payload shapes.
        //
        // WML Message (MESSAGE#) and Moment (MOMENT#) are not routed through Ephemera perception; see mtw-wml Message docs.
        if (isPerceptionAssetMessage(payload)) {
            const internalCache = getCache()
            const { rooms = [] } = (await internalCache.AssetRooms.get(payload.ephemeraId)) || {}
            await Promise.all(
                rooms
                    .filter(isEphemeraRoomId)
                    .map((roomId) =>
                        kickRoomHeaderBroadcastForRoom({
                            roomId,
                            messageBus,
                        })
                    )
            )
        }
        else if (isPerceptionRoomMessage(payload)) {
            if (isEphemeraRoomId(payload.ephemeraId)) {
                const internalCache = getCache()
                const characterList = payload.characterId ? [payload.characterId] : (await getRoomCharacterList(payload.ephemeraId)).map(({ EphemeraId }) => (EphemeraId))
                const cacheRecords = await internalCache.RenderCache.get(payload.ephemeraId)
                const wmlContent = payload.header
                    ? roomHeaderChannelWmlForRoomId(payload.ephemeraId, cacheRecords)
                    : roomRenderChannelWmlForRoomId(payload.ephemeraId, cacheRecords)
                for (const characterId of characterList) {
                    messageBus.publish({
                        type: 'PublishMessage',
                        targets: [characterId],
                        displayProtocol: 'PerceptionMessage',
                        wmlContent,
                        metaData: {
                            componentUUID: payload.ephemeraId,
                            displayMode: payload.header ? 'header' : 'full',
                            roomChannel: 'render',
                        },
                    })
                }
            }
        }
    }))

    messageBus.publish({
        type: 'ReturnValue',
        body: {
            messageType: "Success"
        }
    })
}

type SendRoomGeneratingHeaderArgs = {
    roomId: EphemeraRoomId;
    characterIds: EphemeraCharacterId[];
    messageBus: MessageBus;
}

export const sendRoomGeneratingHeader = ({ roomId, characterIds, messageBus }: SendRoomGeneratingHeaderArgs): void => {
    if (!characterIds.length) {
        return
    }
    const wmlContent = roomHeaderGeneratingPlaceholderWml(roomId)

    messageBus.publish({
        type: 'PublishMessage',
        targets: characterIds,
        displayProtocol: 'PerceptionMessage',
        wmlContent,
        metaData: {
            componentUUID: roomId,
            displayMode: 'header',
            status: 'generating',
            roomChannel: 'render',
        },
        messageId: `MESSAGE#${uuidv4()}`,
        createdTime: getCurrentTimestamp(),
    })
}

export default perceptionMessage
