/**
 * External ingress: enqueue Affordances Requested per distinct occupant perspective on a room.
 *
 * Used from message-bus callbacks outside mtw.ephemera.affordanceOrchestration (e.g. RoomUpdate).
 * Inside the DataSource, call fanOutAffordanceRefreshForRoom instead (direct orchestrateAffordanceRequest).
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { AffordanceOrchestrationReason } from './localApiEvents'
import {
    resolveAffordanceRefreshGroupsForRoom,
    type ResolveAffordanceRefreshGroupsDependencies,
} from './fanOutAffordanceRefreshForRoom'
import { sendAffordancesRequested } from './subscribedEvents'

export type SendAffordanceRefreshRequestedForRoomOptions = {
    deps?: ResolveAffordanceRefreshGroupsDependencies;
}

export const sendAffordanceRefreshRequestedForRoom = async (
    {
        roomId,
        reason,
        messageBus,
        deps,
    }: {
        roomId: EphemeraRoomId;
        reason: AffordanceOrchestrationReason;
        messageBus: MessageBus;
    } & SendAffordanceRefreshRequestedForRoomOptions
): Promise<void> => {
    const groups = await resolveAffordanceRefreshGroupsForRoom(roomId, deps)
    for (const { assetStack } of groups) {
        sendAffordancesRequested(
            messageBus,
            roomId,
            {
                roomId,
                perspective: { assetStack },
                reason,
            },
        )
    }
}
