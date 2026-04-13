import internalCache from "../internalCache"
import { MessageBus, RoomUpdateMessage } from "../messageBus/baseClasses"
import { publishRoomAffordancePerceptionMessages } from "../dataSource/perception/publishRoomAffordancePerceptionMessages"

export const roomUpdateMessage = async ({ payloads, messageBus }: { payloads: RoomUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads
        .filter(({ roomId }) => (roomId))
        .map(async ({ roomId }) => {
            const activeCharacters = await internalCache.RoomCharacterList.get(roomId)
            messageBus.send({
                type: 'PublishMessage',
                targets: [roomId],
                displayProtocol: 'RoomUpdate',
                RoomId: roomId,
                Characters: activeCharacters.map(({ EphemeraId, SessionIds, ...rest }) => ({ CharacterId: EphemeraId, ...rest }))
            })
            await publishRoomAffordancePerceptionMessages({ roomId, messageBus })
        })
    )
}

export default roomUpdateMessage
