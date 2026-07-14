import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraPositionGraph } from '../../../../positions/positionGraph'
import type { DissolveRelationStep, TransferMembershipStep } from '../parsePlanStep'
import { boundaryEdgeOutcomes, computeCarryClosure } from './interactionUnderTransfer'

/**
 * `error` is hard-terminal and `defer` today only ever escalates to an LLM
 * validator (BD-10) --- neither outcome can currently ask Identify to
 * reconsider its candidate given what Expansion found (e.g. "widen the
 * search to this other host"). That's a named-but-unbuilt future direction,
 * see BD-18 (`AGENT.manipulationFrameAndRelational.planning.md`); keep this
 * union open to a third outcome rather than overfitting call sites to just
 * these two during the Pipeline A -> B migration.
 */
export type ExpandTransferMembershipResult =
    | { verdict: 'complete'; dissolveSteps: DissolveRelationStep[]; transferStep: TransferMembershipStep }
    | { verdict: 'defer'; decidable: boolean; reason: string }
    | { verdict: 'error'; reason: string }

/**
 * Grows a single-object, not-yet-carry-closed `TransferMembershipStep`
 * (Grounding's output, slice 1) into a carry-closed one, plus any
 * `DissolveRelationStep`s needed for boundary edges that classify `dissolve`
 * (e.g. tray-table when tray moves, per BD-13's own worked example: "get
 * tray" -> dissolveRelation(tray-table) + transferMembership([tray, glass])).
 * The sandbox's `applyTransferMembershipStep` deliberately never grows a
 * transfer set itself and never dissolves boundary edges --- it only carries
 * *internal* edges to the destination --- so this is the piece that must run
 * before a candidate reaches Validation.
 *
 * `getGraph` is a plain injected callback (not a live DB call), matching this
 * codebase's `deps`-injection convention elsewhere.
 *
 * Does not decide how Grounding and Expansion interleave in general
 * (`AGENT.concepts.md`, "Synthesize's three sub-roles") --- this function
 * only operates on an already-grounded step, standalone and unwired.
 */
export const expandTransferMembership = (
    step: TransferMembershipStep,
    getGraph: (hostId: EphemeraMembershipHostId) => EphemeraPositionGraph | undefined
): ExpandTransferMembershipResult => {
    const [startId] = step.objectIds

    const sourceGraph = getGraph(step.fromHostId)
    if (!sourceGraph) {
        return { verdict: 'error', reason: `No graph found for host ${step.fromHostId}` }
    }

    const closureSet = computeCarryClosure(startId, sourceGraph)
    const boundaryOutcomes = boundaryEdgeOutcomes(closureSet, sourceGraph)

    const carryOutcome = boundaryOutcomes.find((entry) => entry.outcome === 'carry')
    if (carryOutcome !== undefined) {
        return {
            verdict: 'error',
            reason: 'Carry closure left a carry-classified edge on the boundary --- internal inconsistency',
        }
    }

    const deferOutcome = boundaryOutcomes.find((entry) => entry.outcome === 'defer')
    if (deferOutcome !== undefined) {
        return {
            verdict: 'defer',
            decidable: deferOutcome.edge.kind !== 'Custom',
            reason: 'Boundary edge interaction under transfer requires LLM validation (BD-10)',
        }
    }

    const dissolveOutcomes = boundaryOutcomes.filter((entry) => entry.outcome === 'dissolve')

    if (dissolveOutcomes.length > 0 && !isEphemeraRoomId(sourceGraph.hostId)) {
        return {
            verdict: 'error',
            reason: `Cannot dissolve a boundary edge on non-Room host ${sourceGraph.hostId} --- BD-15 slice 3 scope, not yet built`,
        }
    }

    // Safe: dissolveOutcomes is only non-empty once the guard above has confirmed sourceGraph.hostId is a Room.
    const hostRoomId = sourceGraph.hostId as EphemeraRoomId

    const dissolveSteps: DissolveRelationStep[] = dissolveOutcomes.map((entry) => ({
        kind: 'dissolveRelation',
        subjectId: entry.edge.from,
        targetId: entry.edge.to,
        relationKind: entry.edge.kind,
        ...(entry.edge.relationLabel !== undefined ? { relationLabel: entry.edge.relationLabel } : {}),
        hostRoomId,
    }))

    return {
        verdict: 'complete',
        dissolveSteps,
        transferStep: { ...step, objectIds: closureSet },
    }
}
