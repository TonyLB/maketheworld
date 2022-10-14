import { PerceptionMessage, MessageBus, isPerceptionMapMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { EphemeraCharacter } from "../cacheAsset/baseClasses"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import {
    isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraRoomId
} from "@tonylb/mtw-interfaces/dist/baseClasses"

type EphemeraCharacterDescription = {
    [K in 'Name' | 'Pronouns' | 'FirstImpression' | 'OneCoolThing' | 'Outfit' | 'fileURL' | 'Color']: EphemeraCharacter[K];
}

export const perceptionMessage = async ({ payloads, messageBus }: { payloads: PerceptionMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async (payload) => {
        const { characterId, ephemeraId } = payload
        if (isEphemeraCharacterId(ephemeraId)) {
            const CharacterId = splitType(ephemeraId)[1]
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
                targets: [{ characterId }],
                displayProtocol: 'CharacterDescription',
                CharacterId,
                ...characterDescription
            })
        }
        else {
            console.log(`Perception Payload: ${JSON.stringify(payload, null, 4)}`)
            if (isEphemeraRoomId(ephemeraId)) {
                const roomDescribe = await internalCache.ComponentRender.get(characterId, ephemeraId)
                const RoomId = splitType(ephemeraId)[1]
                messageBus.send({
                    type: 'PublishMessage',
                    targets: [{ characterId }],
                    displayProtocol: 'RoomDescription',
                    ...roomDescribe,
                    RoomId
                })
            }
            if (isEphemeraFeatureId(ephemeraId)) {
                const featureDescribe = await internalCache.ComponentRender.get(characterId, ephemeraId)
                const FeatureId = splitType(ephemeraId)[1]
                messageBus.send({
                    type: 'PublishMessage',
                    targets: [{ characterId }],
                    displayProtocol: 'FeatureDescription',
                    ...featureDescribe,
                    FeatureId
                })
            }
            if (isPerceptionMapMessage(payload)) {
                const mapDescribe = await internalCache.ComponentRender.get(characterId, payload.ephemeraId)
                console.log(`MapDescribe: ${JSON.stringify(mapDescribe, null, 4)}`)
                const MapId = splitType(ephemeraId)[1]
                if ((!payload.mustIncludeRoomId) || mapDescribe.rooms.find(({ roomId }) => (payload.mustIncludeRoomId === `ROOM#${roomId}`))) {
                    messageBus.send({
                        type: `EphemeraUpdate`,
                        global: false,
                        updates: [{
                            type: 'MapUpdate',
                            active: true,
                            targets: [{ characterId }],
                            ...mapDescribe,
                            MapId
                        }]
                    })
                }
            }
        }
    }))

    messageBus.send({
        type: 'ReturnValue',
        body: {
            messageType: "ActionComplete"
        }
    })
}

export default perceptionMessage
