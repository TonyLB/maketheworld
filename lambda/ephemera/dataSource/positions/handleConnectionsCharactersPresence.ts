/**
 * Connect/disconnect handler for the `mtw.ephemera.positions` lane.
 *
 * Owns the ephemera-side projection of character presence transitions emitted
 * by `mtw.connections.characters`:
 *   - Character Connected   -> resolve eviction-ladder target room, membership
 *                              persistence API, post-persist orchestration.
 *   - Character Disconnected -> membership persistence API (applyCharacterRoomMembership).
 *
 * At-least-once delivery: duplicate events are no-ops because the second
 * disconnect finds the character already out of play (`changed: false`) and the
 * second connect finds the character already in the target room.
 */
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import {
    ConnectionsCharactersConnectedEvent,
    ConnectionsCharactersDisconnectedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/connections/characters'
import type { MessageBus } from '../../messageBus/baseClasses'
import { orchestrateCharacterNavigate } from '../../moveCharacter/orchestrateNavigate'
import type { PositionsPublishedPayload } from './publishedEvents'
import { applyCharacterRoomMembership } from './membership/applyCharacterRoomMembership'
import { resolveConnectTargetRoom } from './membership/resolveConnectTargetRoom'

export const handleCharacterConnected = async (
    event: ConnectionsCharactersConnectedEvent,
    {
        messageBus,
        streamEvent,
    }: {
        messageBus: MessageBus;
        streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    }
): Promise<void> => {
    const { targetRoomId, characterMeta } = await resolveConnectTargetRoom(event.characterId)
    const result = await applyCharacterRoomMembership(
        { characterId: event.characterId, targetRoomId },
        { messageBus, streamEvent }
    )

    if (result.ok && result.changed) {
        await orchestrateCharacterNavigate({
            payload: {
                type: 'MoveCharacter',
                characterId: event.characterId,
                roomId: targetRoomId,
                suppressDeparture: true,
                suppressArrival: true,
                suppressSelfMessage: true,
            },
            characterMeta,
            froms: result.froms,
            to: result.to,
            beatAnchorTime: result.beatAnchorTime,
            messageBus,
        })
    }
}

export const handleCharacterDisconnected = async (
    event: ConnectionsCharactersDisconnectedEvent,
    {
        messageBus,
        streamEvent,
    }: {
        messageBus: MessageBus;
        streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    }
): Promise<void> => {
    await applyCharacterRoomMembership(
        { characterId: event.characterId, targetRoomId: null },
        { messageBus, streamEvent }
    )
}
