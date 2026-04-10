import { PerceptionMessage as PerceptionRequestMessage, MessageBus, isPerceptionMapMessage, isPerceptionRoomMessage, isPerceptionAssetMessage, isPerceptionComponentMessage } from "../messageBus/baseClasses"
import { internalCache } from "../internalCache"
// Recreated type from deleted cacheAsset/baseClasses
type EphemeraCharacter = {
    Name?: string;
    Pronouns?: string;
    fileURL?: string;
    Color?: string;
    [key: string]: any;
}
import { ephemeraDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import {
    EphemeraCharacterId,
    EphemeraRoomId,
    isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraKnowledgeId, isEphemeraRoomId
} from "@tonylb/mtw-interfaces/ts/baseClasses"
import { schemaToWML } from "@tonylb/mtw-wml/ts/schema"

type EphemeraCharacterDescription = {
    [K in 'Name' | 'Pronouns' | 'fileURL' | 'Color']: EphemeraCharacter[K];
}

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
            rooms.forEach((roomId) => {
                messageBus.send({
                    type: 'Perception',
                    ephemeraId: roomId,
                    header: true,
                    messageGroupId: payload.messageGroupId
                })
            })
        }
        else if (isPerceptionRoomMessage(payload)) {
            if (isEphemeraRoomId(payload.ephemeraId)) {
                const internalCache = getCache()
                const characterList = payload.characterId ? [payload.characterId] : (await internalCache.RoomCharacterList.get(payload.ephemeraId)).map(({ EphemeraId }) => (EphemeraId))
                await Promise.all(characterList.map(async (characterId) => {
                    const roomDescribe = await internalCache.ComponentRender.get(characterId, payload.ephemeraId, { header: payload.header })
                    messageBus.send({
                        type: 'PublishMessage',
                        targets: [characterId],
                        displayProtocol: 'PerceptionMessage',
                        wmlContent: schemaToWML([roomDescribe.schema]),
                        metaData: {
                            componentUUID: payload.ephemeraId,
                            displayMode: payload.header ? 'header' : 'full'
                        },
                        messageGroupId: payload.messageGroupId
                    })
                }))
            }
        }
        else if (isPerceptionComponentMessage(payload)) {
            const { characterId = 'ANONYMOUS', ephemeraId } = payload
            if (isEphemeraCharacterId(ephemeraId) && isEphemeraCharacterId(characterId)) {
                const characterDescription = (await ephemeraDB.getItem<EphemeraCharacterDescription>({
                    Key: {
                        EphemeraId: ephemeraId,
                        DataCategory: 'Meta::Character'
                    },
                    ProjectionFields: ['Name', 'Pronouns', 'fileURL', 'Color']
                })) || {
                    Name: 'Unknown',
                    Pronouns: 'they/them',
                }
                
                // Generate WML content for the character (DB has Name; we emit DisplayName in WML)
                const { Name: displayName = 'Unknown', Pronouns = 'they/them' } = characterDescription
                const fileURL = ('fileURL' in characterDescription) ? characterDescription.fileURL : undefined
                const imageTag = fileURL ? `<Image key=(portrait) fileURL="${fileURL}" />` : ''
                const wmlContent = `<Asset uuid=(render)>
    <Character uuid=(${ephemeraId})>
        <DisplayName>${displayName}</DisplayName>
        <Pronouns>${Pronouns}</Pronouns>
        ${imageTag}
    </Character>
</Asset>`

                messageBus.send({
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
            else {
                const internalCache = getCache()
                if (isEphemeraFeatureId(ephemeraId) && isEphemeraCharacterId(characterId)) {
                    const featureDescribe = await internalCache.ComponentRender.get(characterId, ephemeraId)
                    messageBus.send({
                        type: 'PublishMessage',
                        targets: [characterId],
                        displayProtocol: 'PerceptionMessage',
                        wmlContent: schemaToWML([featureDescribe.schema]),
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
                    const knowledgeDescribe = await internalCache.ComponentRender.get(characterId, ephemeraId)
                    messageBus.send({
                        type: 'PublishMessage',
                        targets,
                        displayProtocol: 'PerceptionMessage',
                        wmlContent: schemaToWML([knowledgeDescribe.schema]),
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
                    messageBus.send({
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

    messageBus.send({
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
    const wmlContent = `<Asset uuid=(render)>
    <Room uuid=(${roomId})>
        <Example key=(generatingHeader) uuid=(EXAMPLE#generatingHeader)>
            <DisplayName>Generating...</DisplayName>
        </Example>
    </Room>
</Asset>`

    messageBus.send({
        type: 'PublishMessage',
        targets: characterIds,
        displayProtocol: 'PerceptionMessage',
        wmlContent,
        metaData: {
            componentUUID: roomId,
            displayMode: 'header',
            status: 'generating'
        },
        messageGroupId
    })
}

export default perceptionMessage
