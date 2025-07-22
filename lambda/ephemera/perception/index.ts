import { PerceptionMessage, MessageBus, isPerceptionMapMessage, isPerceptionShowMessage, isPerceptionShowMoment, isPerceptionRoomMessage, isPerceptionAssetMessage, isPerceptionComponentMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { EphemeraCharacter } from "../cacheAsset/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import {
    EphemeraMessageId,
    EphemeraRoomId,
    isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraKnowledgeId, isEphemeraRoomId
} from "@tonylb/mtw-interfaces/ts/baseClasses"
import { ComponentMetaItem } from "../internalCache/componentMeta"
import { isStandardMessage, StandardComponentData } from "@tonylb/mtw-wml/ts/standardize/baseClasses"
import { isSchemaLink, isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { AssetUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import { AssetKey } from "@tonylb/mtw-utilities/ts/types"
import StandardMoment from "@tonylb/mtw-wml/ts/standardize/components/moment"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import StandardMessage from "@tonylb/mtw-wml/ts/standardize/components/message"

type EphemeraCharacterDescription = {
    [K in 'Name' | 'Pronouns' | 'fileURL' | 'Color']: EphemeraCharacter[K];
}

export const perceptionMessage = async ({ payloads, messageBus }: { payloads: PerceptionMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async (payload) => {
        if (isPerceptionShowMessage(payload)) {
            const { characterId, ephemeraId, onlyForAssets } = payload

            if (!characterId) {
                const messageMetaByAsset = await internalCache.ComponentMeta.getAcrossAllAssets(ephemeraId) as Record<AssetUUID, StandardComponent>
                const roomsForMessage = (Object.values(messageMetaByAsset) as StandardComponentData[]).filter(isStandardMessage).reduce<EphemeraRoomId[]>((previous, { rooms }) => ([ ...previous, ...rooms as `ROOM#${string}`[] ]), [])
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
                const [characterMeta, globalAssets] = await Promise.all([
                    internalCache.CharacterMeta.get(characterId),
                    internalCache.Global.get('assets')
                ])
                const messageMetaForCharacter = await internalCache.ComponentMeta.getAcrossAssets(ephemeraId, [ ...(globalAssets || []), ...characterMeta.assets ].map((key) => (AssetKey(key)))) as Record<AssetUUID, StandardComponent>
                const roomsForMessage = (Object.values(messageMetaForCharacter) as StandardComponentData[]).filter(isStandardMessage).reduce<EphemeraRoomId[]>((previous, { rooms }) => ([ ...previous, ...rooms.map((reference) => (new StandardReference(reference).universalKey)) as `ROOM#${string}`[] ]), [])
                if (roomsForMessage.includes(characterMeta.RoomId)) {
                    const messageForm = await internalCache.ComponentRender.get(characterId, ephemeraId)
                    if (messageForm.byUniversalId[characterMeta.RoomId]) {
                        const messageItem = messageForm._components.find((item) => (item instanceof StandardMessage))
                        if (messageItem) {
                            messageBus.send({
                                type: 'PublishMessage',
                                targets: [characterId],
                                displayProtocol: 'WorldMessage',
                                message: messageItem.description?.toJSON() ?? [],
                                messageGroupId: payload.messageGroupId
                            })
                        }
                    }
                }
            }
        }
        else if (isPerceptionShowMoment(payload)) {
            const { ephemeraId } = payload

            const [momentMetaByAsset, globalAssets = []] = await Promise.all([
                internalCache.ComponentMeta.getAcrossAllAssets(ephemeraId),
                internalCache.Global.get('assets')
            ])
            const assetsByMessageId = Object.entries(momentMetaByAsset as Record<AssetUUID, StandardMoment>).reduce<Record<EphemeraMessageId, string[]>>((previous, [key, { messages }]) => (
                messages.reduce<Record<EphemeraMessageId, string[]>>((accumulator, { key: messageId }) => (messageId
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
                const characterList = payload.characterId ? [payload.characterId] : (await internalCache.RoomCharacterList.get(payload.ephemeraId)).map(({ EphemeraId }) => (EphemeraId))
                await Promise.all(characterList.map(async (characterId) => {
                    const roomDescribe = await internalCache.ComponentRender.get(characterId, payload.ephemeraId, { header: payload.header })
                    messageBus.send({
                        type: 'PublishMessage',
                        targets: [characterId],
                        displayProtocol: payload.header ? 'RoomHeader' : 'RoomDescription',
                        description: schemaToWML([roomDescribe.schema]),
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
                messageBus.send({
                    type: 'PublishMessage',
                    targets: [characterId],
                    displayProtocol: 'CharacterDescription',
                    ...characterDescription,
                    CharacterId: ephemeraId,
                    messageGroupId: payload.messageGroupId
                })
            }
            else {
                if (isEphemeraFeatureId(ephemeraId) && isEphemeraCharacterId(characterId)) {
                    const featureDescribe = await internalCache.ComponentRender.get(characterId, ephemeraId)
                    messageBus.send({
                        type: 'PublishMessage',
                        targets: [characterId],
                        displayProtocol: 'FeatureDescription',
                        description: schemaToWML([featureDescribe.schema]),
                        FeatureId: ephemeraId,
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
                        displayProtocol: 'KnowledgeDescription',
                        description: schemaToWML([knowledgeDescribe.schema]),
                        KnowledgeId: ephemeraId,
                        messageGroupId: payload.messageGroupId
                    })
                }
            }
        }
        else {
            const { characterId = 'ANONYMOUS' } = payload
            if (isPerceptionMapMessage(payload) && isEphemeraCharacterId(characterId)) {
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

export default perceptionMessage
