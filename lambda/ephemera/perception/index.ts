import { PerceptionMessage, MessageBus, isPerceptionMapMessage, PerceptionShowMessage, isPerceptionShowMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { EphemeraCharacter } from "../cacheAsset/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import {
    EphemeraRoomId,
    isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraRoomId
} from "@tonylb/mtw-interfaces/dist/baseClasses"
import { isTaggedLink, isTaggedText } from "@tonylb/mtw-interfaces/dist/messages"

type EphemeraCharacterDescription = {
    [K in 'Name' | 'Pronouns' | 'FirstImpression' | 'OneCoolThing' | 'Outfit' | 'fileURL' | 'Color']: EphemeraCharacter[K];
}

export const perceptionMessage = async ({ payloads, messageBus }: { payloads: PerceptionMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async (payload) => {
        if (isPerceptionShowMessage(payload)) {
            const { characterId, ephemeraId } = payload

            if (!characterId) {
                const messageMetaByAsset = await internalCache.ComponentMeta.getAcrossAllAssets(ephemeraId)
                const roomsForMessage = Object.values(messageMetaByAsset).reduce<EphemeraRoomId[]>((previous, { appearances }) => (
                    appearances.reduce<EphemeraRoomId[]>((accumulator, { rooms }) => ([ ...accumulator, ...rooms ]), previous)
                ), [])
                const roomCharacterLists = await Promise.all(roomsForMessage.map(async (roomId) => (internalCache.RoomCharacterList.get(roomId))))

                roomCharacterLists.forEach((characters) => {
                    characters.forEach(({ EphemeraId: characterId }) => {
                        messageBus.send({
                            type: 'Perception',
                            ephemeraId,
                            characterId
                        })
                    })
                })

            }
            else {
                const characterMeta = await internalCache.CharacterMeta.get(characterId)
                const messageMetaForCharacter = await internalCache.ComponentMeta.getAcrossAssets(ephemeraId, characterMeta.assets)
                const roomsForMessage = Object.values(messageMetaForCharacter).reduce<EphemeraRoomId[]>((previous, { appearances }) => (
                    appearances.reduce<EphemeraRoomId[]>((accumulator, { rooms }) => ([ ...accumulator, ...rooms ]), previous)
                ), [])
                if (roomsForMessage.includes(characterMeta.RoomId)) {
                    const { Description: messageRender } = await internalCache.ComponentRender.get(characterId, ephemeraId)
                    if (messageRender.find((item) => (isTaggedLink(item) || (isTaggedText(item) && item.value)))) {
                        messageBus.send({
                            type: 'PublishMessage',
                            targets: [characterId],
                            displayProtocol: 'WorldMessage',
                            message: messageRender
                        })
                    }
                }
            }
        }
        else {
            const { characterId, ephemeraId } = payload
            if (isEphemeraCharacterId(ephemeraId)) {
                const characterDescription = (await ephemeraDB.getItem<EphemeraCharacterDescription>({
                    EphemeraId: ephemeraId,
                    DataCategory: 'Meta::Character',
                    ProjectionFields: ['#name', 'Pronouns', 'FirstImpression', 'OneCoolThing', 'Outfit', 'fileURL', 'Color'],
                    ExpressionAttributeNames: {
                        '#name': 'Name'
                    }
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
                    CharacterId: ephemeraId
                })
            }
            else {
                if (isEphemeraRoomId(ephemeraId)) {
                    const roomDescribe = await internalCache.ComponentRender.get(characterId, ephemeraId)
                    messageBus.send({
                        type: 'PublishMessage',
                        targets: [characterId],
                        displayProtocol: 'RoomDescription',
                        ...roomDescribe,
                    })
                }
                if (isEphemeraFeatureId(ephemeraId)) {
                    const featureDescribe = await internalCache.ComponentRender.get(characterId, ephemeraId)
                    messageBus.send({
                        type: 'PublishMessage',
                        targets: [characterId],
                        displayProtocol: 'FeatureDescription',
                        ...featureDescribe,
                        FeatureId: ephemeraId
                    })
                }
                if (isPerceptionMapMessage(payload)) {
                    const mapDescribe = await internalCache.ComponentRender.get(characterId, payload.ephemeraId)
                    if ((!payload.mustIncludeRoomId) || mapDescribe.rooms.find(({ roomId }) => (payload.mustIncludeRoomId === roomId))) {
                        messageBus.send({
                            type: `EphemeraUpdate`,
                            updates: [{
                                type: 'MapUpdate',
                                active: true,
                                targets: [characterId],
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
