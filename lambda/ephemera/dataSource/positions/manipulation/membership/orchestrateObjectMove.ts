import { v4 as uuidv4 } from 'uuid'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'

import type { ActionsPublishedPayload } from '../../../actions/publishedEvents'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import { sendMessageBundleDeclared } from '../../../messageOrchestration/subscribedEvents'
import { presentStepSequence } from '../kernel/presentStepSequence'
import { resolveObjectMovePresentationLabels } from '../../../perception/resolveObjectMovePresentationLabels'
import { executeObjectMove } from './executeObjectMove'

/** An object move's compiled plan never includes a `describe` step --- same as navigate's, same noop. */
const noopActionsStreamEvent: StreamEventFunction<ActionsPublishedPayload> = async () => {}

export type OrchestrateObjectMoveArgs = {
    objectIds: EphemeraObjectId[];
    fromHostId: EphemeraMembershipHostId;
    toHostId: EphemeraMembershipHostId;
    /**
     * taken explicitly rather than derived by scanning `[fromHostId, toHostId]` for a
     * room --- a containment move's `toHostId` is the destination object (a tray), not a room,
     * so neither host is a room and the derived-`roomId` form silently no-ops for every such
     * move. `resolveObjectMovePresentationLabels` only needs *a* room for perspective/shortName
     * resolution, indifferent to whether it's one of this move's two hosts.
     */
    roomId: EphemeraRoomId;
    /**
     * Also taken explicitly, for the same reason `roomId` was --- a
     * containment move's `toHostId` can be an object (a tray), so a rehost between two objects
     * (`fromHostId` and `toHostId` both objects, e.g. moving a cup that is already sitting in a
     * room onto a table) has no character among its two hosts at all. Deriving `characterId` by
     * scanning `[fromHostId, toHostId]` silently no-op'd that case (caught before any live
     * caller could reach it, in `orchestrateObjectMove.test.ts`); the caller already knows who
     * issued the command, so it is threaded through rather than guessed.
     */
    characterId: EphemeraCharacterId;
    /** Hosting kinds only (AB-54); see `ExecuteObjectMoveArgs.containment`'s doc comment. */
    containment?: 'On' | 'In' | 'PartOf';
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

/**
 * The narrating entry point for a player-driven object move --- take, drop, and eventually give
 * give. Sibling of `orchestrateCharacterDisconnect`:
 * it declares the messageOrchestration bundle and presents the compiled narrate steps, leaving the
 * world change itself entirely to `executeObjectMove`, which stays callable bare for non-narrating
 * object-lifecycle moves (spawn/destroy/place/remove).
 *
 * **Takes hosts, not a verb.** Which of take/drop/give this is falls out inside
 * `compilePositionKernelOp` from which side of the move was the room (PB-M) --- this function never
 * needs to know, which is what let the retired `inferOperationFromFact` be deleted outright rather
 * than ported to a new home.
 *
 * Labels resolve *before* the commit because the compiled plan carries narration ingredients and the
 * plan is what commits. `resolveObjectMovePresentationLabels` is explicitly robust to the object
 * having left the room graph, so resolving early costs nothing in fidelity; a take's copy names the
 * object as the room's perspective saw it, which is what witnesses in that room would have called it.
 *
 * The bundle is declared **after** a successful commit, matching `orchestrateCharacterNavigate`'s
 * shape. That is a consistency preference, not a correctness requirement, and is recorded as such so
 * it is neither "corrected" later on a mistaken safety belief nor treated as load-bearing: the
 * messageOrchestration fan-in deliberately skips declared slots that never receive a report, so a
 * bundle declared ahead of a failed commit would settle harmlessly rather than hang.
 */
export const orchestrateObjectMove = async (args: OrchestrateObjectMoveArgs): Promise<void> => {
    const { characterId } = args
    const [primaryObjectId] = args.objectIds
    if (primaryObjectId === undefined) {
        return
    }

    const { characterName, objectShortName } = await resolveObjectMovePresentationLabels({
        characterId,
        objectId: primaryObjectId,
        roomId: args.roomId,
    })

    const bundleId = uuidv4()
    const result = await executeObjectMove({
        objectIds: args.objectIds,
        fromHostId: args.fromHostId,
        toHostId: args.toHostId,
        bundleId,
        narration: { characterName, objectShortName },
        ...(args.containment ? { containment: args.containment } : {}),
        messageBus: args.messageBus,
        streamEvent: args.streamEvent,
    })

    if (!result.ok) {
        return
    }

    if (result.plan.slots.length > 0) {
        sendMessageBundleDeclared(args.messageBus, bundleId, { bundleId, slots: [...result.plan.slots] })
    }

    await presentStepSequence(
        result.plan.steps,
        characterId,
        { streamEvent: noopActionsStreamEvent, messageBus: args.messageBus },
        result.captures
    )
}
