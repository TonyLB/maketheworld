import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import internalCache from '../../../../internalCache'
import {
    actingCharacterRef,
    currentHostRef,
    objectSpanRef,
} from '../../../actions/enrich/objectManipulation/plan/ungroundedPrimitive'
import type { GroundingContext } from '../../../actions/enrich/objectManipulation/synthesize/groundReferent'
import { createExpansionEnvironment } from '../../../actions/enrich/objectManipulation/synthesize/expansionEnvironment'
import { runExecutor, seedTransferMembership } from '../../../actions/enrich/objectManipulation/synthesize/executor'
import { fromExecutorStep } from '../kernel/kernelStep'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { EphemeraPositionGraph } from '../../positionGraph'

export type ExecuteObjectTakeHoldArgs = {
    characterId: EphemeraCharacterId;
    objectIds: EphemeraObjectId[];
    roomId: EphemeraRoomId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

/**
 * Single call site for every take-hold command, regardless of transfer-set size
 * (Migrate slice, 2026-07-23) --- seeds and runs the general Synthesize
 * executor fresh at execute time (a second, later snapshot than the Plan-stage
 * dry run that originally selected this candidate --- a deliberate cross-snapshot
 * recheck, not duplication, per the same pattern `commitStepSequence`'s own
 * internal re-verification uses one layer further in), then commits the
 * resulting step sequence via the general kernel. Supersedes
 * `applyObjectSetTakeHold.ts`/`applyObjectSetTransfer.ts`, which are retired.
 *
 * `objectIds` (BD-13's carry-closed transfer set, resolved at Plan time) is
 * re-derived here, not trusted: only its first member seeds the executor ---
 * operand-expansion (`computeCarryClosure`) recomputes the real closure fresh
 * against current graph state, which is what actually produces BD-28's
 * explicit `DissolveRelationStep`s for any severed boundary relation.
 */
export const executeObjectTakeHold = async (args: ExecuteObjectTakeHoldArgs): Promise<void> => {
    const [primaryObjectId] = args.objectIds
    if (primaryObjectId === undefined) {
        return
    }

    const stableRefKey = 'executeObjectTakeHold/object'
    const groundingContext: GroundingContext = {
        actingCharacterId: args.characterId,
        resolvedSpans: new Map([[stableRefKey, { verdict: 'resolved', candidateIds: [primaryObjectId] }]]),
        getCurrentHost: (componentId) => (componentId === args.characterId ? args.roomId : undefined),
    }
    const seed = seedTransferMembership({
        kind: 'change',
        primitive: 'transferMembership',
        object: objectSpanRef('object', stableRefKey),
        from: currentHostRef(actingCharacterRef),
        to: actingCharacterRef,
    })

    const roomGraph = await internalCache.Positions.getPositionGraph(args.roomId)
    const characterGraph = await internalCache.Positions.getPositionGraph(args.characterId)
    const graphsByHost = new Map<string, EphemeraPositionGraph>([
        [args.roomId, roomGraph],
        [args.characterId, characterGraph],
    ])
    const env = createExpansionEnvironment(
        (hostId) => graphsByHost.get(hostId),
        () => args.roomId
    )

    const outcome = runExecutor(seed, env, groundingContext)
    if (outcome.verdict !== 'legal') {
        return
    }

    await commitStepSequence(
        { steps: outcome.steps.map(fromExecutorStep) },
        {
            messageBus: args.messageBus,
            streamEvent: args.streamEvent,
            getCurrentHost: () => args.roomId,
        }
    )
}
