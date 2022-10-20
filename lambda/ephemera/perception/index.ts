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
    }))

    messageBus.send({
        type: 'ReturnValue',
        body: {
            messageType: "Success"
        }
    })
}

export default perceptionMessage
