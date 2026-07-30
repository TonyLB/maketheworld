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
import { v4 as uuidv4 } from 'uuid'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import {
    ConnectionsCharactersConnectedEvent,
    ConnectionsCharactersDisconnectedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/connections/characters'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import { applyCharacterRoomMembership } from './membership/applyCharacterRoomMembership'
import { buildMembershipMoveOp } from './membership/buildMembershipMoveOp'
import { orchestrateCharacterDisconnect } from './membership/orchestrateCharacterDisconnect'
import { resolveConnectTargetRoom } from './membership/resolveConnectTargetRoom'
import { compilePositionKernelOp } from './manipulation/kernel/compile/compilePositionKernelOp'
import { isKernelMutationStep } from './manipulation/kernel/kernelStep'
import type { MembershipDiff } from './membership/types'
import { afterCharacterMembershipNavigateChanged } from './navigate/afterCharacterMembershipNavigateChanged'
import type { PositionsPublishedPayload } from './publishedEvents'

/**
 * Connect/disconnect narration (Phase 3, `AGENT.presentationKernel.planning.md`): both compile the
 * abstract `Move` op the same way `executeCharacterNavigate.ts` does for navigate --- a `compileMutationSteps`
 * callback built from `buildMembershipMoveOp` with `intentKind: 'connect'`/`'disconnect'`, `narrationHandledInline: true`
 * to suppress the async membership-presentation fan-in's fact leg for this commit. Connect's post-commit
 * narration reuses `orchestrateCharacterNavigate` (via `afterCharacterMembershipNavigateChanged`) since it
 * always has a destination room; disconnect has none, so it uses the dedicated `orchestrateCharacterDisconnect`.
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

    const compileMutationSteps = (diff: MembershipDiff) => compilePositionKernelOp(
        buildMembershipMoveOp({
            characterId: event.characterId,
            characterName: characterMeta.Name,
            froms: diff.froms,
            to: diff.to,
            bundleId,
            intentKind: 'connect',
            headerSlot: null,
        })
    ).steps.filter(isKernelMutationStep)

    const result = await applyCharacterRoomMembership(
        { characterId: event.characterId, targetRoomId, compileMutationSteps, narrationHandledInline: true },
        { messageBus, streamEvent }
    )

    await afterCharacterMembershipNavigateChanged({
        characterId: event.characterId,
        characterMeta,
        result,
        bundleId,
        intentKind: 'connect',
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
    const characterMeta = await internalCache.CharacterMeta.get(event.characterId)
    const bundleId = uuidv4()

    const compileMutationSteps = (diff: MembershipDiff) => compilePositionKernelOp(
        buildMembershipMoveOp({
            characterId: event.characterId,
            characterName: characterMeta.Name,
            froms: diff.froms,
            to: diff.to,
            bundleId,
            intentKind: 'disconnect',
            headerSlot: null,
        })
    ).steps.filter(isKernelMutationStep)

    const result = await applyCharacterRoomMembership(
        { characterId: event.characterId, targetRoomId: null, compileMutationSteps, narrationHandledInline: true },
        { messageBus, streamEvent }
    )

    if (result.ok && result.changed && result.froms.length > 0) {
        await orchestrateCharacterDisconnect({
            characterId: event.characterId,
            characterName: characterMeta.Name,
            froms: result.froms,
            bundleId,
            captures: result.captures,
            messageBus,
        })
    }
}
