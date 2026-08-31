import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicTerminalPrimitive, relationKindAndLabelOf, relationKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import internalCache from '../../../../internalCache'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { boundaryEdgeOutcomes, computeCarryClosure } from '../../ludicGraph/expandValidate/interactionUnderTransfer'
import type { TransferMembershipStep } from '../../../actions/enrich/objectManipulation/parsePlanStep'
import { fromExecutorStep } from '../kernel/kernelStep'
import type { MutationKernelStep } from '../kernel/kernelStep'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { RelationalApplyResult, RelationalIngressArgs } from './types'

export type ApplyObjectRelationalChangeDependencies = {
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
    transactWrite?: typeof ephemeraDB.transactWrite
}

/**
 * Migrate slice (2026-07-23): collapses `applyObjectRelationalChange`'s old
 * `args.transferFromHostId !== undefined` branch (`applyObjectRelationalChangeWithTransfer`
 * vs. `planHostRelationalPatch` + `applyHostRelationalPatch`) into one
 * `commitStepSequence` call over whatever `MutationKernelStep[]` this route needs ---
 * a satisfied `sameHost` produces `[establishRelation]`/`[dissolveRelation]`;
 * a repaired one produces `[dissolveRelation*, transferMembership, establishRelation]`
 * (BD-28's boundary dissolves precede the transfer, per the executor's own
 * seeding order). `applyObjectRelationalChangeWithTransfer.ts`,
 * `planHostRelationalPatch.ts`, and `applyHostRelationalPatch.ts` all retire
 * from this call site.
 *
 * `transferFromHostId` (BD-16's repair signal) only ever carries a *host id*
 * across the wire, not a pre-computed step list --- so this re-derives the
 * repair transfer's carry-closure/boundary-sweep fresh at commit time, the
 * same cross-snapshot recheck pattern `executeObjectMove`
 * uses (a later, second look at live state than whatever Plan-stage's
 * `expandSameHost` saw). Calls the shared `computeCarryClosure`/
 * `boundaryEdgeOutcomes` primitives directly rather than through the full
 * executor worklist: this call site only ever seeds one fixed
 * `isolatedFromRelations`/`transferMembership` pair with no other pending
 * instruction, so the worklist's generality (multi-instruction scheduling,
 * `GroundingContext`-mediated Grounding) buys nothing here --- both are the
 * exact primitives `seedGroundedTransferMembership`'s command-expansion
 * would call internally.
 */
export const applyObjectRelationalChange = async (
    args: RelationalIngressArgs,
    deps: ApplyObjectRelationalChangeDependencies
): Promise<RelationalApplyResult> => {
    const relationalStep: MutationKernelStep = {
        kind: args.operation === 'establish' ? 'establishRelation' : 'dissolveRelation',
        subjectId: args.subjectId,
        targetId: args.targetId,
        ...relationKindAndLabelFrom(args),
    }

    let steps: MutationKernelStep[]

    if (args.transferFromHostId !== undefined) {
        const fromHostId = args.transferFromHostId
        const sourceGraph: EphemeraLudicGraph = await internalCache.Positions.getLudicGraph(fromHostId)

        const closure = computeCarryClosure(args.subjectId, sourceGraph)
        const outcomes = boundaryEdgeOutcomes(closure.objectIds, sourceGraph)

        const carryOutcome = outcomes.find((entry) => entry.outcome === 'carry')
        if (carryOutcome !== undefined) {
            return {
                ok: false,
                errorCode: 'RELATIONAL_TRANSFER_INCONSISTENT',
                errorMessage: 'Carry closure left a carry-classified edge on the boundary --- internal inconsistency',
            }
        }
        const deferOutcome = outcomes.find((entry) => entry.outcome === 'defer')
        if (deferOutcome !== undefined) {
            return {
                ok: false,
                errorCode: 'RELATIONAL_TRANSFER_DEFERRED',
                errorMessage: 'Boundary edge interaction under transfer requires LLM validation (BD-10) --- stale repair candidate',
            }
        }

        // LP7 widened HostRelationalEdge.from/to to EphemeraLudicTerminalId; no producer can build a
        // port-qualified boundary edge yet, so skip rather than assume (matches the ludicGraph
        // boundary/carry-closure narrows, ludicGraph/AGENT.md's BD-36 paragraph).
        const dissolveSteps: MutationKernelStep[] = outcomes
            .filter((entry) => entry.outcome === 'dissolve'
                && isEphemeraLudicTerminalPrimitive(entry.edge.from)
                && isEphemeraLudicTerminalPrimitive(entry.edge.to))
            .map((entry) => ({
                kind: 'dissolveRelation' as const,
                // Safe: filtered to primitive endpoints above.
                subjectId: entry.edge.from as EphemeraLudicTerminalPrimitive,
                targetId: entry.edge.to as EphemeraLudicTerminalPrimitive,
                ...relationKindAndLabelOf(entry.edge),
            }))

        const transferStep: TransferMembershipStep = {
            kind: 'transferMembership',
            objectIds: closure.objectIds,
            fromHostId,
            toHostId: args.hostId,
        }

        steps = [...dissolveSteps, fromExecutorStep(transferStep), relationalStep]
    }
    else {
        steps = [relationalStep]
    }

    // Pre-transaction current hosts: the relation's `targetId` is always already on the
    // destination (`expandSameHost`'s repaired contract --- the subject is the one that
    // moves); every other object this sequence can reference (the subject itself, and any
    // boundary object a dissolve step names) is still on the transfer's source host, or on
    // `hostId` outright when there is no repair transfer at all.
    const transferFromHostId = args.transferFromHostId
    const getCurrentHost = (id: EphemeraLudicTerminalPrimitive): EphemeraMembershipHostId | undefined =>
        transferFromHostId === undefined
            ? args.hostId
            : (id === args.targetId ? args.hostId : transferFromHostId)

    const result = await commitStepSequence(
        { steps },
        {
            messageBus: deps.messageBus,
            streamEvent: deps.streamEvent,
            getCurrentHost,
            ...(deps.transactWrite !== undefined ? { transactWrite: deps.transactWrite } : {}),
        }
    )

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] applyObjectRelationalChange failed: ${result.errorMessage}`)
        return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage }
    }

    return { ok: true, changed: true, beatAnchorTime: result.beatAnchorTime }
}
