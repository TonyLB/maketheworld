import { v4 as uuidv4 } from 'uuid'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'

import type { ActionsPublishedPayload } from '../../../actions/publishedEvents'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import { commitAndPresentStepSequence } from '../kernel/commitAndPresentStepSequence'
import { resolveObjectMovePresentationLabels } from '../../../perception/resolveObjectMovePresentationLabels'
import { planObjectMoveTransfer } from './planObjectMoveTransfer'

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
 * give. `planObjectMoveTransfer` builds and dry-runs the plan (3d, 2026-09-08's replacement for
 * `executeMembershipTransfer`'s retired `honorDefer` mode); this function hands the compiled plan to
 * the shared `commitAndPresentStepSequence` composer (3e, MS-2; renamed from `executeStepSequence` in
 * 3g), which commits it, declares the
 * messageOrchestration bundle (from `plan.slots`, only on a successful commit), and presents the
 * compiled narrate steps --- no manual commit/declare/present sequence of its own anymore. Every
 * non-narrating object-lifecycle move (spawn/destroy/place/remove) still calls
 * `executeMembershipTransfer` directly; this is the one route with a legality question to ask, so it
 * is the one route that plans separately from that shared administrative function.
 *
 * **Takes hosts, not a verb.** Which of take/drop/give this is falls out inside
 * `compilePositionKernelOp` from which side of the move was the room --- this function never
 * needs to know, which is what let the retired `inferOperationFromFact` be deleted outright rather
 * than ported to a new home.
 *
 * Labels resolve *before* the commit because the compiled plan carries narration ingredients and the
 * plan is what commits. `resolveObjectMovePresentationLabels` is explicitly robust to the object
 * having left the room graph, so resolving early costs nothing in fidelity; a take's copy names the
 * object as the room's perspective saw it, which is what witnesses in that room would have called it.
 *
 * The bundle is declared **after** a successful commit (`commitAndPresentStepSequence`'s own sequencing),
 * matching `presentCharacterMove`'s shape. That is a consistency preference, not a
 * correctness requirement, and is recorded as such so it is neither "corrected" later on a mistaken
 * safety belief nor treated as load-bearing: the messageOrchestration fan-in deliberately skips
 * declared slots that never receive a report, so a bundle declared ahead of a failed commit would
 * settle harmlessly rather than hang.
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
    const planResult = await planObjectMoveTransfer({
        entityId: primaryObjectId,
        fromHostId: args.fromHostId,
        toHostId: args.toHostId,
        bundleId,
        narration: { characterName, objectShortName },
        ...(args.containment ? { containment: args.containment } : {}),
    })

    if (!planResult.ok) {
        console.error(`[mtw.ephemera.positions] orchestrateObjectMove refused: ${planResult.errorCode}`)
        return
    }

    const { plan } = planResult
    await commitAndPresentStepSequence(
        plan,
        bundleId,
        characterId,
        {
            commit: {
                messageBus: args.messageBus,
                streamEvent: args.streamEvent,
                getCurrentHost: () => planResult.fromHostId,
            },
            perceive: { streamEvent: noopActionsStreamEvent, messageBus: args.messageBus },
        }
    )
}
