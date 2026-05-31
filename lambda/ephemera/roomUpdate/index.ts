import { MessageBus, RoomUpdateMessage } from "../messageBus/baseClasses"
import { sendAffordanceRefreshRequestedForRoom } from "../dataSource/affordanceOrchestration/sendAffordanceRefreshRequestedForRoom"

/** Bus `type: 'RoomUpdate'` is a roster-refresh hook; enqueues Affordances Requested (reason: roster). */
export const roomUpdateMessage = async ({ payloads, messageBus }: { payloads: RoomUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads
        .filter(({ roomId }) => (roomId))
        .map(async ({ roomId }) => {
            await sendAffordanceRefreshRequestedForRoom({
                roomId,
                reason: 'roster',
                messageBus,
                useDefaultMessageBusLane: true,
            })
        })
    )
}

export default roomUpdateMessage
