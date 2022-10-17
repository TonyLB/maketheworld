import internalCache from "../internalCache"
import { MessageBus, RoomUpdateMessage } from "../messageBus/baseClasses"

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
                Characters: activeCharacters.map(({ EphemeraId, ConnectionIds, ...rest }) => ({ CharacterId: EphemeraId, ...rest }))
            })
        })
    )
}

export default roomUpdateMessage
