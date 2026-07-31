import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import internalCache from '../../../../internalCache'
import { createExpansionEnvironment } from '../../../actions/enrich/objectManipulation/synthesize/expansionEnvironment'
import { runExecutor, seedGroundedTransferMembership } from '../../../actions/enrich/objectManipulation/synthesize/executor'
import { fromExecutorStep, isKernelMutationStep } from '../kernel/kernelStep'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { EphemeraPositionGraph } from '../../positionGraph'

export type ExecuteObjectMoveArgs = {
    objectIds: EphemeraObjectId[];
    fromHostId: EphemeraMembershipHostId;
    toHostId: EphemeraMembershipHostId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

/**
 * Single call site for every object membership move, regardless of transfer-set
 * size --- supersedes `executeObjectTakeHold.ts`/`executeObjectDrop.ts`, which
 * were byte-identical apart from their `(from, to)` pair (Phase 3.6, 2026-07-31;
 * they in turn superseded `applyObjectSetTakeHold.ts`/`applyObjectSetDrop.ts`/
 * `applyObjectSetTransfer.ts`).
 *
 * **Takes hosts, not an actor or a verb.** Take-hold is `room -> character`,
 * drop is `character -> room`, and a future `give` is `character -> character`
 * --- one operation with three intents, so the direction lives at the dispatch
 * branch that already knows which envelope arrived, and the verb (needed only
 * for narration and Plan-stage legality copy) is recoverable downstream from
 * which side of the move is the room. Nothing here needs the acting character:
 * moving an object between two membership hosts is the same world-effect
 * whoever caused it.
 *
 * Seeds and runs the general Synthesize executor fresh at execute time --- a
 * second, later snapshot than the Plan-stage dry run that originally selected
 * this candidate. That is a deliberate cross-snapshot recheck, not duplication,
 * the same pattern `commitStepSequence`'s own internal re-verification uses one
 * layer further in.
 *
 * `objectIds` (BD-13's carry-closed transfer set, resolved at Plan time) is
 * re-derived here, not trusted: only its first member seeds the executor ---
 * operand-expansion (`computeCarryClosure`) recomputes the real closure fresh
 * against current graph state, which is what actually produces BD-28's explicit
 * `DissolveRelationStep`s for any severed boundary relation.
 *
 * The seed is grounded rather than referent-shaped: `fromHostId`/`toHostId` are
 * already concrete, so there is nothing for Grounding to resolve and no
 * `GroundingContext` is supplied (see `runExecutor`). Operand-expansion is a
 * universal phase every grounded instruction passes through, so closure
 * re-derivation and the boundary sweep are unaffected by seeding at that tag.
 */
export const executeObjectMove = async (args: ExecuteObjectMoveArgs): Promise<void> => {
    const [primaryObjectId] = args.objectIds
    if (primaryObjectId === undefined) {
        return
    }

    const fromGraph = await internalCache.Positions.getPositionGraph(args.fromHostId)
    const toGraph = await internalCache.Positions.getPositionGraph(args.toHostId)
    const graphsByHost = new Map<string, EphemeraPositionGraph>([
        [args.fromHostId, fromGraph],
        [args.toHostId, toGraph],
    ])
    const env = createExpansionEnvironment(
        (hostId) => graphsByHost.get(hostId),
        () => args.fromHostId
    )

    const seed = seedGroundedTransferMembership({
        kind: 'transferMembership',
        objectIds: new Set([primaryObjectId]),
        fromHostId: args.fromHostId,
        toHostId: args.toHostId,
    })

    const outcome = runExecutor(seed, env)
    if (outcome.verdict !== 'legal') {
        return
    }

    // Commit result deliberately discarded, as both predecessors did: `ok: false`
    // yields no player feedback today. Surfacing it is a behavior change and a
    // product question, not part of this unification.
    await commitStepSequence(
        { steps: outcome.steps.map(fromExecutorStep).filter(isKernelMutationStep) },
        {
            messageBus: args.messageBus,
            streamEvent: args.streamEvent,
            getCurrentHost: () => args.fromHostId,
        }
    )
}
