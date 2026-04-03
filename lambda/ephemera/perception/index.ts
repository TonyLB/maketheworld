import { PerceptionMessage as PerceptionRequestMessage, MessageBus, isPerceptionMapMessage, isPerceptionShowMessage, isPerceptionShowMoment, isPerceptionRoomMessage, isPerceptionAssetMessage, isPerceptionComponentMessage } from "../messageBus/baseClasses"
import { PerceptionMessage } from "@tonylb/mtw-interfaces/ts/messages"
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
    EphemeraMessageId,
    EphemeraRoomId,
    isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraKnowledgeId, isEphemeraRoomId
} from "@tonylb/mtw-interfaces/ts/baseClasses"
import { StandardComponentData } from "@tonylb/mtw-wml/ts/standardize/baseClasses"
import { AssetUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import { AssetKey } from "@tonylb/mtw-utilities/ts/types"
import StandardMoment from "@tonylb/mtw-wml/ts/standardize/components/moment"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import StandardMessage from "@tonylb/mtw-wml/ts/standardize/components/message"
import { isStandardMessageData } from "@tonylb/mtw-wml/ts/standardize/components/dataTypes"
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"

type EphemeraCharacterDescription = {
    [K in 'Name' | 'Pronouns' | 'fileURL' | 'Color']: EphemeraCharacter[K];
}

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
        if (isPerceptionShowMessage(payload)) {
            const { characterId, ephemeraId, onlyForAssets } = payload

            if (!characterId) {
                const internalCache = getCache()
                const messageMetaByAsset = await internalCache.ComponentAssetMeta.getAcrossAllAssets(ephemeraId) as Record<AssetUUID, StandardComponent>
                const roomsForMessage = (Object.values(messageMetaByAsset) as StandardComponentData[]).filter(isStandardMessageData).reduce<EphemeraRoomId[]>((previous, { rooms }) => ([ ...previous, ...(rooms ?? []) as `ROOM#${string}`[] ]), [])
                const roomCharacterLists = await Promise.all(roomsForMessage.map(async (roomId) => (internalCache.RoomCharacterList.get(roomId))))

                await Promise.all(
                    roomCharacterLists.map((characters) => (Promise.all(
                        characters.map(async ({ EphemeraId }) => {
                            if (onlyForAssets) {
                                const { assets } = await internalCache.CharacterMeta.get(EphemeraId)
                                if (!assets.find((asset) => (onlyForAssets.includes(asset)))) {
                                    return
                                }
                            }
                            messageBus.send({
                                type: 'Perception',
                                ephemeraId,
                                characterId: EphemeraId,
                                messageGroupId: payload.messageGroupId
                            })
                        })
                    )))
                )
            }
            else {
                const internalCache = getCache()
                const [characterMeta, globalAssets] = await Promise.all([
                    internalCache.CharacterMeta.get(characterId),
                    internalCache.Global.get('assets')
                ])
                const assetList = [ ...(globalAssets || []), ...characterMeta.assets ].map((key) => (AssetKey(key)))
                const messageMetaForCharacter = await internalCache.ComponentAssetMeta.getAcrossAssets(ephemeraId, assetList) as Record<AssetUUID, StandardComponent>
                const roomsForMessage = Object.values(messageMetaForCharacter).filter((component): component is StandardMessage => component instanceof StandardMessage).reduce<EphemeraRoomId[]>((previous, component) => ([ ...previous, ...(component.rooms.payload ?? []).map((reference) => (reference.universalKey)) as `ROOM#${string}`[] ]), [])
                if (roomsForMessage.includes(characterMeta.RoomId)) {
                    const messageForm = await internalCache.ComponentRender.get(characterId, ephemeraId)
                    if (messageForm.byUniversalId[characterMeta.RoomId]) {
                        const messageItem = messageForm._components.find((item) => (item instanceof StandardMessage)) as StandardMessage | undefined
                        if (messageItem) {
                            const rawMessage = messageItem.description?.toJSON()
                            const message: RenderTree = Array.isArray(rawMessage) ? rawMessage : []
                            if (message.length) {
                                messageBus.send({
                                    type: 'PublishMessage',
                                    targets: [characterId],
                                    displayProtocol: 'WorldMessage',
                                    message,
                                    messageGroupId: payload.messageGroupId
                                })
                            }
                        }
                    }
                }
            }
        }
        else if (isPerceptionShowMoment(payload)) {
            const { ephemeraId } = payload
            const internalCache = getCache()

            const [momentMetaByAsset, globalAssets = []] = await Promise.all([
                internalCache.ComponentAssetMeta.getAcrossAllAssets(ephemeraId),
                internalCache.Global.get('assets')
            ])
            const assetsByMessageId = Object.entries(momentMetaByAsset as Record<AssetUUID, StandardMoment>).reduce<Record<EphemeraMessageId, string[]>>((previous, [key, { messages }]) => (
                messages.payload.reduce<Record<EphemeraMessageId, string[]>>((accumulator, { key: messageId }) => (messageId
                    ? {
                        ...accumulator,
                        [messageId]: [
                            ...(accumulator[messageId] || []),
                            key
                        ]
                    }
                    : accumulator),
                previous)
            ), {})
            const allMessages = Object.keys(assetsByMessageId) as EphemeraMessageId[]
            allMessages.forEach((messageId) => {
                if (assetsByMessageId[messageId].find((asset) => (globalAssets.includes(asset)))) {
                    messageBus.send({
                        type: 'Perception',
                        ephemeraId: messageId,
                        messageGroupId: payload.messageGroupId ? internalCache.OrchestrateMessages.next(payload.messageGroupId) : undefined
                    })
                }
                else {
                    messageBus.send({
                        type: 'Perception',
                        ephemeraId: messageId,
                        onlyForAssets: assetsByMessageId[messageId],
                        messageGroupId: payload.messageGroupId ? internalCache.OrchestrateMessages.next(payload.messageGroupId) : undefined
                    })
                }
            })
        }
        else if (isPerceptionAssetMessage(payload)) {
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
                if (isEphemeraKnowledgeId(ephemeraId)) {
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
            if (isPerceptionMapMessage(payload) && isEphemeraCharacterId(characterId)) {
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
