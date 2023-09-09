import { PerceptionMessage, MessageBus, isPerceptionMapMessage, isPerceptionShowMessage, isPerceptionShowMoment, isPerceptionRoomMessage, isPerceptionAssetMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { EphemeraCharacter } from "../cacheAsset/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import {
    EphemeraMessageId,
    EphemeraRoomId,
    isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraKnowledgeId, isEphemeraRoomId
} from "@tonylb/mtw-interfaces/ts/baseClasses"
import { isTaggedLink, isTaggedText } from "@tonylb/mtw-interfaces/ts/messages"

type EphemeraCharacterDescription = {
    [K in 'Name' | 'Pronouns' | 'FirstImpression' | 'OneCoolThing' | 'Outfit' | 'fileURL' | 'Color']: EphemeraCharacter[K];
}

export const perceptionMessage = async ({ payloads, messageBus }: { payloads: PerceptionMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async (payload) => {
        if (isPerceptionShowMessage(payload)) {
            const { characterId, ephemeraId, onlyForAssets } = payload

            if (!characterId) {
                const messageMetaByAsset = await internalCache.ComponentMeta.getAcrossAllAssets(ephemeraId)
                const roomsForMessage = Object.values(messageMetaByAsset).reduce<EphemeraRoomId[]>((previous, { appearances }) => (
                    appearances.reduce<EphemeraRoomId[]>((accumulator, { rooms }) => ([ ...accumulator, ...rooms ]), previous)
                ), [])
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
                const messageMetaForCharacter = await internalCache.ComponentMeta.getAcrossAssets(ephemeraId, [ ...(globalAssets || []), ...characterMeta.assets ])
                const roomsForMessage = Object.values(messageMetaForCharacter).reduce<EphemeraRoomId[]>((previous, { appearances }) => (
                    appearances.reduce<EphemeraRoomId[]>((accumulator, { rooms }) => ([ ...accumulator, ...rooms ]), previous)
                ), [])
                if (roomsForMessage.includes(characterMeta.RoomId)) {
                    const { Description: messageRender, rooms: roomsRendered } = await internalCache.ComponentRender.get(characterId, ephemeraId)
                    if (messageRender.find((item) => (isTaggedLink(item) || (isTaggedText(item) && item.value))) && roomsRendered.includes(characterMeta.RoomId)) {
                        messageBus.send({
                            type: 'PublishMessage',
                            targets: [characterId],
                            displayProtocol: 'WorldMessage',
                            message: messageRender,
                            messageGroupId: payload.messageGroupId
                        })
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
            const assetsByMessageId = Object.entries(momentMetaByAsset).reduce<Record<EphemeraMessageId, string[]>>((previous, [key, { appearances }]) => (
                appearances.reduce<Record<EphemeraMessageId, string[]>>((accumulator, { messages }) => (
                    messages.reduce<Record<EphemeraMessageId, string[]>>((innerAccumulator, messageId) => ({
                        ...innerAccumulator,
                        [messageId]: [
                            ...(innerAccumulator[messageId] || []),
                            key
                        ]
                    }), accumulator)
                ), previous)
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
                    const roomDescribe = await internalCache.ComponentRender.get(characterId, payload.ephemeraId)
                    messageBus.send({
                        type: 'PublishMessage',
                        targets: [characterId],
                        displayProtocol: payload.header ? 'RoomHeader' : 'RoomDescription',
                        ...roomDescribe,
                        messageGroupId: payload.messageGroupId
                    })
                }))
            }
        }
        else {
            const { characterId = 'ANONYMOUS', ephemeraId } = payload
            if (isEphemeraCharacterId(ephemeraId) && isEphemeraCharacterId(characterId)) {
                const characterDescription = (await ephemeraDB.getItem<EphemeraCharacterDescription>({
                    Key: {
                        EphemeraId: ephemeraId,
                        DataCategory: 'Meta::Character'
                    },
                    ProjectionFields: ['Name', 'Pronouns', 'FirstImpression', 'OneCoolThing', 'Outfit', 'fileURL', 'Color']
                })) || {
                    Name: 'Unknown',
                    Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' },
                    FirstImpression: ''
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
                        ...featureDescribe,
                        FeatureId: ephemeraId,
                        messageGroupId: payload.messageGroupId
                    })
                }
                if (isEphemeraKnowledgeId(ephemeraId)) {
                    const targets = isEphemeraCharacterId(characterId) ? [characterId] : []
                    const knowledgeDescribe = await internalCache.ComponentRender.get(characterId, ephemeraId)
                    messageBus.send({
                        type: 'PublishMessage',
                        targets,
                        displayProtocol: 'KnowledgeDescription',
                        ...knowledgeDescribe,
                        KnowledgeId: ephemeraId,
                        messageGroupId: payload.messageGroupId
                    })
                }
                if (isPerceptionMapMessage(payload) && isEphemeraCharacterId(characterId)) {
                    const [mapDescribe, characterConnections] = await Promise.all([
                        internalCache.ComponentRender.get(characterId, payload.ephemeraId),
                        internalCache.CharacterConnections.get(characterId)
                    ])
                    if ((!payload.mustIncludeRoomId) || mapDescribe.rooms.find(({ roomId }) => (payload.mustIncludeRoomId === roomId))) {
                        messageBus.send({
                            type: `EphemeraUpdate`,
                            updates: [{
                                type: 'MapUpdate',
                                active: true,
                                targets: [characterId],
                                connectionTargets: (characterConnections || []).map((connectionId) => (`CHARACTER#${connectionId}` as const)),
                                ...mapDescribe,
                                MapId: payload.ephemeraId
                            }]
                        })
                    }
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
