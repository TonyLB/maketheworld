import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import internalCache from '../../../../internalCache'
import { createExpansionEnvironment } from '../../../actions/enrich/objectManipulation/synthesize/expansionEnvironment'
import { runExecutor, seedGroundedTransferMembership } from '../../../actions/enrich/objectManipulation/synthesize/executor'
import type { ExecutorDissolveRelationStep } from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import { isKernelMutationStep } from '../kernel/kernelStep'
import { commitStepSequence } from '../kernel/commitStepSequence'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import type { CompiledPositionKernelPlan } from '../kernel/compile/compilePositionKernelOp'
import { buildObjectMoveOp } from '../../membership/buildObjectMoveOp'
import type { MutationKernelCaptures } from '../kernel/types'
import type { HostRelationalEdge } from '../types'
import type { EphemeraLudicGraph } from '../../ludicGraph'

export type ExecuteObjectMoveArgs = {
    objectIds: EphemeraObjectId[];
    fromHostId: EphemeraMembershipHostId;
    toHostId: EphemeraMembershipHostId;
    /** Correlates this move's narration slots; the same id must reach `orchestrateObjectMove`. */
    bundleId: string;
    /**
     * Copy ingredients for the narrate steps (PB-2). Omit to move an object without narrating
     * (object-lifecycle moves), in which case no capture steps are compiled either --- captures exist
     * only to serve narration, so a silent move should not be locking hosts to snapshot rosters
     * nobody reads.
     */
    narration?: { characterName: string; objectShortName: string };
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

/**
 * Everything `orchestrateObjectMove` needs to publish, and nothing more.
 *
 * The plan travels rather than being recompiled, because unlike the character routes there is
 * nothing to recompile *for*. Navigate compiles twice only because its header slot needs an async
 * perspective-key lookup that cannot happen inside the mutation path; an object move has no header,
 * so a second compile would be two chances to disagree in exchange for nothing. (This is why
 * `buildObjectMoveOp` is called once here with narration already in hand, rather than once bare and
 * once narrating.)
 *
 * The `ok: true` shape is the structural guard against narrating a commit that did not happen:
 * `captures` exists on this branch alone, and `presentStepSequence` hard-throws on a `captureId` it
 * cannot resolve, so there is no path from a failed commit to a published line. The tempting way past
 * the resulting type error --- defaulting `captures` to an empty map --- would narrate a take that
 * never persisted. Don't.
 */
export type ExecuteObjectMoveResult =
    | { ok: false }
    | {
        ok: true
        plan: CompiledPositionKernelPlan
        captures: MutationKernelCaptures
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
 *
 * **The executor's steps are data for the op, not committed output** (Phase 4,
 * PB-9(i-b)). What actually commits is `compilePositionKernelOp`'s plan, built
 * from the re-derived closure and Expansion's dissolve-classified boundary
 * edges. That keeps exactly one source of dissolves --- emitting both the
 * executor's steps and the compiler's would double them --- and it is what puts
 * the capture steps narration needs into the same transaction as the transfer.
 * Expansion still owns classification, including its `error`/`defer` verdicts,
 * which the compiler has no channel for; the compiler only sequences.
 */
export const executeObjectMove = async (args: ExecuteObjectMoveArgs): Promise<ExecuteObjectMoveResult> => {
    const [primaryObjectId] = args.objectIds
    if (primaryObjectId === undefined) {
        return { ok: false }
    }

    const fromGraph = await internalCache.Positions.getPositionGraph(args.fromHostId)
    const toGraph = await internalCache.Positions.getPositionGraph(args.toHostId)
    const graphsByHost = new Map<string, EphemeraLudicGraph>([
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
        return { ok: false }
    }

    // `runExecutor` mutates `env` in place, and this function owns it, so the
    // closure Operand-expansion settled is readable here rather than needing a
    // channel on `ExecutorOutcome`. There is exactly one group: the seed pairs
    // `isolatedFromRelations` and `transferMembership` on the same `startId`, and
    // `lookupOrComputeClosure`'s member index makes the pair share one computation.
    const groupId = env.groupIdByObject.get(primaryObjectId)
    const fragment = groupId === undefined ? undefined : env.settledGroups.get(groupId)
    if (fragment === undefined) {
        return { ok: false }
    }

    const dissolvedEdges: HostRelationalEdge[] = outcome.steps
        .filter((step): step is ExecutorDissolveRelationStep => step.kind === 'dissolveRelation')
        .map((step) => ({
            from: step.subjectId,
            to: step.targetId,
            kind: step.relationKind,
            ...(step.relationLabel !== undefined ? { relationLabel: step.relationLabel } : {}),
        }))

    const plan = compilePositionKernelOp(buildObjectMoveOp({
        fragment,
        dissolvedEdges,
        fromHostId: args.fromHostId,
        toHostId: args.toHostId,
        bundleId: args.bundleId,
        ...(args.narration ? { narration: args.narration } : {}),
    }))

    const result = await commitStepSequence(
        { steps: plan.steps.filter(isKernelMutationStep) },
        {
            messageBus: args.messageBus,
            streamEvent: args.streamEvent,
            getCurrentHost: () => args.fromHostId,
        }
    )

    // A failed commit still yields no player feedback --- that stays the deferred
    // product question both predecessors recorded. What changed in Phase 4 is that
    // the caller now has to know, because narration runs after this point and must
    // never contradict a world that did not change.
    if (!result.ok) {
        return { ok: false }
    }

    return { ok: true, plan, captures: result.captures }
}
