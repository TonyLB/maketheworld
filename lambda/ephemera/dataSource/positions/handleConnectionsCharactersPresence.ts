/**
 * Connect/disconnect handler for the `mtw.ephemera.positions` lane.
 *
 * Owns the ephemera-side projection of character presence transitions emitted
 * by `mtw.connections.characters`:
 *   - Character Connected   -> trigger CheckLocation(forceMove) so moveCharacter
 *                              runs the room.activeCharacters add and arrival
 *                              messaging through the existing flow.
 *   - Character Disconnected -> membership persistence API (applyCharacterRoomMembership).
 *
 * At-least-once delivery: duplicate events are no-ops because the second
 * disconnect finds the character already out of play (`changed: false`) and the
 * second connect CheckLocation/moveCharacter sees the character already in the target room.
 */
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import {
    ConnectionsCharactersConnectedEvent,
    ConnectionsCharactersDisconnectedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/connections/characters'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from './publishedEvents'
import { applyCharacterRoomMembership } from './membership/applyCharacterRoomMembership'

export const handleCharacterConnected = async (
    event: ConnectionsCharactersConnectedEvent,
    { messageBus }: { messageBus: MessageBus }
): Promise<void> => {
    messageBus.publish({
        type: 'CheckLocation',
        characterId: event.characterId,
        forceMove: true,
        arriveMessage: ' has connected.',
        suppressArrival: false
    })
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
