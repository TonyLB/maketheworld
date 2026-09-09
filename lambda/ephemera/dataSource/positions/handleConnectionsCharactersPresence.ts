/**
 * Connect/disconnect handler for the `mtw.ephemera.positions` lane.
 *
 * Owns the ephemera-side projection of character presence transitions emitted
 * by `mtw.connections.characters`:
 *   - Character Connected   -> resolve eviction-ladder target room, then
 *                              `orchestrateCharacterMove`.
 *   - Character Disconnected -> `orchestrateCharacterMove` with a null target.
 *
 * At-least-once delivery: duplicate events are no-ops because the second
 * disconnect finds the character already out of play (`changed: false`) and the
 * second connect finds the character already in the target room.
 */
import { v4 as uuidv4 } from 'uuid'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import {
    ConnectionsCharactersConnectedEvent,
    ConnectionsCharactersDisconnectedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/connections/characters'
import type { MessageBus } from '../../messageBus/baseClasses'
import { orchestrateCharacterMove } from './navigate/orchestrateCharacterMove'
import { resolveConnectTargetRoom } from './manipulation/membership/resolveConnectTargetRoom'
import type { PositionsPublishedPayload } from './publishedEvents'

/**
 * Connect/disconnect narration: both go through `orchestrateCharacterMove` (3g) --- the same
 * convergence navigate/home/ghost-purge use --- with `intentKind: 'connect'`/`'disconnect'`. Connect
 * always has a destination room (runs the navigate tail); disconnect passes `targetRoomId: null`,
 * which skips the ladder write and header resolution entirely.
 *
 * Rules: `dataSource/positions/AGENT.contract.md` --- "Narration and presentation".
 */
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
    const bundleId = uuidv4()

    await orchestrateCharacterMove({
        characterId: event.characterId,
        targetRoomId,
        bundleId,
        intentKind: 'connect',
        characterMeta,
        messageBus,
        streamEvent,
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
    const bundleId = uuidv4()

    await orchestrateCharacterMove({
        characterId: event.characterId,
        targetRoomId: null,
        bundleId,
        intentKind: 'disconnect',
        messageBus,
        streamEvent,
    })
}
