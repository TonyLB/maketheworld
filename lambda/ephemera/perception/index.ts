import { PerceptionMessage as PerceptionRequestMessage, MessageBus, isPerceptionMapMessage, isPerceptionRoomMessage, isPerceptionAssetMessage, isPerceptionComponentMessage } from "../messageBus/baseClasses"
import { internalCache } from "../internalCache"
import { getRoomCharacterList } from "../internalCache/hydrateRoomRoster"
import {
    EphemeraCharacterId,
    EphemeraRoomId,
    isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraKnowledgeId, isEphemeraRoomId
} from "@tonylb/mtw-interfaces/ts/baseClasses"
import { schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import { v4 as uuidv4 } from 'uuid'
import { sendCharacterPerceptionRequested } from "../dataSource/perception/subscribedEvents"
import { roomHeaderGeneratingPlaceholderWml } from "../dataSource/perception/roomHeaderPlaceholderWml"
import getCurrentTimestamp from "../internalUtils/dateUtil"
import { kickRoomHeaderBroadcastForRoom } from "../dataSource/perception/kickRoomHeaderBroadcast"
import {
    featureRenderChannelWmlForFeatureId,
    knowledgeRenderChannelWmlForKnowledgeId,
} from "../dataSource/perception/featureKnowledgeRenderWmlFromCacheRecord"
import { roomHeaderChannelWmlForRoomId, roomRenderChannelWmlForRoomId } from "../dataSource/perception/roomRenderWmlFromCacheRecord"

/**
 * When false, Perception requests for MAP# ids do not emit EphemeraUpdate MapUpdate.
 * Temporarily off pending perception DataSource migration; restore this path when Map display moves there.
 */
export const MAP_PERCEPTION_ENABLED = false

/**
 * When false, Perception requests whose ephemeraId is a Knowledge id do not emit the Knowledge PublishMessage.
 * Temporarily off pending perception DataSource migration; restore this path when Knowledge display moves there.
 */
export const KNOWLEDGE_PERCEPTION_ENABLED = false

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
                            messageGroupId: payload.messageGroupId,
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
                        messageGroupId: payload.messageGroupId
                    })
                }
            }
        }
        else if (isPerceptionComponentMessage(payload)) {
            const { characterId = 'ANONYMOUS', ephemeraId } = payload
            if (isEphemeraCharacterId(ephemeraId) && isEphemeraCharacterId(characterId)) {
                sendCharacterPerceptionRequested(messageBus, ephemeraId, {
                    characterId,
                    ephemeraId,
                    messageGroupId: payload.messageGroupId,
                })
            }
            else {
                const internalCache = getCache()
                if (isEphemeraFeatureId(ephemeraId) && isEphemeraCharacterId(characterId)) {
                    const cacheRecords = await internalCache.RenderCache.get(ephemeraId)
                    const wmlContent = featureRenderChannelWmlForFeatureId(ephemeraId, cacheRecords)
                    messageBus.publish({
                        type: 'PublishMessage',
                        targets: [characterId],
                        displayProtocol: 'PerceptionMessage',
                        wmlContent,
                        metaData: {
                            componentUUID: ephemeraId
                        },
                        messageGroupId: payload.messageGroupId
                    })
                }
                if (KNOWLEDGE_PERCEPTION_ENABLED && isEphemeraKnowledgeId(ephemeraId)) {
                    // Knowledge perception gated by KNOWLEDGE_PERCEPTION_ENABLED (see file-level JSDoc).
                    //
                    // Knowledge perception can be passed a CharacterID to view *as*, even if that character is not in play.
                    // When the response should be piped directly back to the calling session (rather than added to the
                    // message DB), the directResponse argument is passed True.
                    //
                    const targets = (isEphemeraCharacterId(characterId) && !payload.directResponse) ? [characterId] : [`SESSION#${await internalCache.Global.get('SessionId')}` as const]
                    const cacheRecords = await internalCache.RenderCache.get(ephemeraId)
                    const wmlContent = knowledgeRenderChannelWmlForKnowledgeId(ephemeraId, cacheRecords)
                    messageBus.publish({
                        type: 'PublishMessage',
                        targets,
                        displayProtocol: 'PerceptionMessage',
                        wmlContent,
                        metaData: {
                            componentUUID: ephemeraId
                        },
                        messageGroupId: payload.messageGroupId
                    })
                }
            }
        }
        else {
            const { characterId = 'ANONYMOUS' } = payload
            if (MAP_PERCEPTION_ENABLED && isPerceptionMapMessage(payload) && isEphemeraCharacterId(characterId)) {
                // Map perception gated by MAP_PERCEPTION_ENABLED (see file-level JSDoc).
                const internalCache = getCache()
                const mapDescribe = await internalCache.ComponentRender.get(characterId, payload.ephemeraId)
                if ((!payload.mustIncludeRoomId) || mapDescribe.byUniversalId[payload.mustIncludeRoomId]) {
                    messageBus.publish({
                        type: `EphemeraUpdate`,
                        updates: [{
                            type: 'MapUpdate',
                            active: true,
                            targets: [characterId],
                            connectionTargets: [characterId],
                            description: schemaToWML([mapDescribe.schema]),
                            MapId: payload.ephemeraId
                        }]
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
    messageGroupId?: string;
}

export const sendRoomGeneratingHeader = ({ roomId, characterIds, messageBus, messageGroupId }: SendRoomGeneratingHeaderArgs): void => {
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
        messageGroupId,
        messageId: `MESSAGE#${uuidv4()}`,
        createdTime: getCurrentTimestamp(),
    })
}

export default perceptionMessage
