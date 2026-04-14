import { MessageBus, RoomUpdateMessage } from "../messageBus/baseClasses"
import { publishRoomAffordancePerceptionMessages } from "../dataSource/perception/publishRoomAffordancePerceptionMessages"

/** Bus `type: 'RoomUpdate'` is a roster-refresh hook only; wire `displayProtocol: 'RoomUpdate'` is retired (affordance PerceptionMessage only). */
export const roomUpdateMessage = async ({ payloads, messageBus }: { payloads: RoomUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads
        .filter(({ roomId }) => (roomId))
        .map(async ({ roomId }) => {
            await publishRoomAffordancePerceptionMessages({ roomId, messageBus })
        })
    )
}

export default roomUpdateMessage
