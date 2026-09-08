/**
 * Connect/disconnect handler for the `mtw.ephemera.positions` lane.
 *
 * Owns the ephemera-side projection of character presence transitions emitted
 * by `mtw.connections.characters`:
 *   - Character Connected   -> resolve eviction-ladder target room, membership
 *                              persistence API, post-persist orchestration.
 *   - Character Disconnected -> membership persistence API (orchestrateCharacterRoomMembership).
 *
 * At-least-once delivery: duplicate events are no-ops because the second
 * disconnect finds the character already out of play (`changed: false`) and the
 * second connect finds the character already in the target room.
 */
import { v4 as uuidv4 } from 'uuid'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    ConnectionsCharactersConnectedEvent,
    ConnectionsCharactersDisconnectedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/connections/characters'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { MessageOrchestrationSlotSpec } from '../messageOrchestration/localApiEvents'
import { getCharacterRoomPerspectiveKey } from '../perception/kickRoomHeaderBroadcast'
import { NAVIGATE_HEADER_SLOT_ID } from './navigate/navigateBundleSlotIds'
import { orchestrateCharacterRoomMembership } from './manipulation/membership/orchestrateCharacterRoomMembership'
import { orchestrateCharacterDisconnect } from './manipulation/membership/orchestrateCharacterDisconnect'
import { resolveConnectTargetRoom } from './manipulation/membership/resolveConnectTargetRoom'
import { afterCharacterMembershipNavigateChanged } from './navigate/afterCharacterMembershipNavigateChanged'
import type { PositionsPublishedPayload } from './publishedEvents'

/**
 * Connect/disconnect narration: both build+compile the abstract `Move` op the same way
 * `executeCharacterNavigate.ts` does for navigate --- via `orchestrateCharacterRoomMembership` ->
 * `planCharacterMoveTransfer`, with `intentKind: 'connect'`/`'disconnect'` (3e, MS-2). Connect's
 * post-commit narration reuses `orchestrateCharacterNavigate` (via
 * `afterCharacterMembershipNavigateChanged`) since it always has a destination room; disconnect has
 * none, so it uses the dedicated `orchestrateCharacterDisconnect`.
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

    const resolveHeaderSlot = async (to: EphemeraRoomId): Promise<MessageOrchestrationSlotSpec | null> => {
        const perspectiveKey = await getCharacterRoomPerspectiveKey(to, characterMeta.assets || [])
        return perspectiveKey ? {
            slotId: NAVIGATE_HEADER_SLOT_ID,
            expectedPublishType: 'PerceptionMessage',
            componentId: to,
            perspectiveKey,
            targets: [event.characterId],
            contentStream: 'render',
            format: 'header',
        } : null
    }

    const result = await orchestrateCharacterRoomMembership(
        { characterId: event.characterId, targetRoomId, bundleId, intentKind: 'connect', resolveHeaderSlot },
        { messageBus, streamEvent }
    )

    await afterCharacterMembershipNavigateChanged({
        characterId: event.characterId,
        characterMeta,
        result,
        bundleId,
        messageBus,
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

    const result = await orchestrateCharacterRoomMembership(
        { characterId: event.characterId, targetRoomId: null, bundleId, intentKind: 'disconnect' },
        { messageBus, streamEvent }
    )

    if (result.ok && result.changed) {
        await orchestrateCharacterDisconnect({
            characterId: event.characterId,
            bundleId,
            plan: result.plan,
            captures: result.captures,
            messageBus,
        })
    }
}
