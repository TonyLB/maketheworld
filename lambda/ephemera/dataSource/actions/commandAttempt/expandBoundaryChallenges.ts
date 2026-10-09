import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraLudicTerminalsEqual, isHostingRelationKind, relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicGraph } from '../../positions/ludicGraph'
import { boundaryEdgeOutcomes } from '../../positions/ludicGraph/expandValidate/interactionUnderTransfer'
import type { HostRelationalEdge } from '../../positions/ludicGraph/baseClasses'
import { presencesHolding } from '../../positions/ludicGraph/presenceSubGraph'
import type { DissolveRelationChange, GroundedReferent } from '../enrich/objectManipulation/plan/planStep'
import { derivedReferentKey, graphNodeRef } from '../enrich/objectManipulation/plan/planStep'
import { isEphemeraThingId } from '../enrich/objectManipulation/thing'
import type { ExpansionEnvironment } from '../enrich/objectManipulation/synthesize/executorTypes'
import { findRelationalChainFromLeg } from '../enrich/objectManipulation/synthesize/findRelationalChain'
import type { AttemptAction } from './action'
import { mintActionId, PositionAttemptAction } from './action'
import type { Challenge } from './challenge'
import { CustomEdgeChallenge, ExitEdgeChallenge } from './challenge'
import { objectTouchesExitEdgeOnGraph } from '../enrich/objectManipulation/membershipObservation'
import type { NarrationUnit } from './narrationUnit'

/**
 * A challenge's `id` is its key: structural, so a fresh run of the same (attempt, identity) pair
 * mints the same ids in any module instance, which is what lets a stored answer find its challenge.
 * Each id is scoped by the primary action's id (Plan-minted, so stable across reruns of a frozen root).
 */
const terminalKey = (terminal: unknown): string => typeof terminal === 'string' ? terminal : JSON.stringify(terminal)

const exitEdgeChallengeId = (primaryActionId: string): string => `exitEdge:${primaryActionId}`

const customEdgeChallengeId = (
    primaryActionId: string,
    edge: Extract<HostRelationalEdge, { kind: 'Custom' }>
): string => `customEdge:${primaryActionId}:${edge.edgeId ?? [terminalKey(edge.from), terminalKey(edge.to), edge.kind, edge.relationLabel].join('|')}`

const describeCustomEdgeChallenge = (edge: Extract<HostRelationalEdge, { kind: 'Custom' }>): string =>
    `Boundary relation to dissolve: ${edge.relationLabel}.`

const describeExitEdgeChallenge = (): string =>
    'Exit contact: the moved object touches an exit, which has no graph rule for moving it.'

/** What Expansion adds to an attempt: its actions in execution order, and the narration units it authors over the ones it created. */
export type ExpandedAttemptActions = {
    actions: AttemptAction[]
    narrationUnits: NarrationUnit[]
}

/**
 * Expansion's own narration for a facilitating dissolve: Expansion created the action, so it
 * authors the line. Worded from which end is moving, never from
 * the edge's direction, so a lashing reads the same whichever way it was stored. One audience over
 * both ends, before the dissolve: everyone who could see either end sees the line once,
 * even in a room both ends share.
 */
const dissolveNarrationUnit = (
    actionId: string,
    movedRef: string,
    otherRef: string
): NarrationUnit => ({
    covers: [actionId],
    variants: [{
        audience: { refs: [movedRef, otherRef], phase: 'before' },
        parts: [{ slot: 'actor' }, { text: ' frees ' }, { ref: movedRef }, { text: ' from ' }, { ref: otherRef }],
    }],
})

/**
 * Expansion: the facilitating actions a whole-object transfer needs. Its precondition is
 * that the moved object is connected to nothing that stays behind, so each boundary edge the
 * relation-under-transfer table classifies adds one prior action whose desired result is
 * "this relation no longer holds". A `dissolve` cell gives an action with no challenge. A
 * `defer` cell gives one carrying a graph challenge (`CustomEdgeChallenge`) for Adjudicate to judge. The action
 * states the result, not the method: untying and cutting a lashing leave the same graph.
 *
 * The actions are returned in execution order, facilitating dissolves first and the primary
 * action last (BD-28), so a consumer can lower them in sequence without knowing which is which.
 * Each dissolve comes with the narration unit Expansion authors for it, naming its ends by
 * `derivedReferentKey` (they have no `stableRefKey`). Delivery follows action order, so a dissolve's
 * line is delivered before the primary action's.
 *
 * This is the one classification of boundary edges, on both sides: the dry run lowers these
 * actions rather than classifying again, and the commit side (`commitAttempt`) commits them as
 * the only source of facilitating dissolves. Its later re-check only refuses a move whose live
 * boundary edges these actions do not cover.
 *
 * Each dissolve's referents are grounded (`graphNode`s): Expansion finds the relation's far end
 * in the graph, and no phrase named it. A boundary edge's far end may be a crossing port (the
 * relation reaches another shard), so the two ends are the relation's true endpoints, walked
 * through any ports by `findRelationalChainFromLeg`. `subject`/`target` follow the relation's
 * own direction, whichever end is the moved object. Expansion grounds them, so it also learns
 * where each is seen: every bucket holding that end (`presencesHolding`) **in the shard whose
 * graph holds that end's own leg**, each end on its own. For an edge inside `graph` that is
 * `graph` for both, and an `Enumerated` split can still put the two ends in different buckets (a
 * wire in one room's half of a breadboard, connected to a spot in the other's); for a crossing,
 * the far end's shard can lead to a different room entirely. The Change carries no `host`: the
 * executor's `dissolveRelation` command-expansion rediscovers this exact relation by chain
 * discovery (`findRelationalChain`), the same mechanism the ingress relational route uses.
 *
 * A relation whose chain cannot be walked (a shard `getGraph` does not have) or whose far end is
 * not a thing (a presence binding, PR-15) gets no dissolve: the move's commit-time recheck then
 * refuses it as uncovered, rather than Expansion guessing an end it cannot name.
 */
export const attemptActionsFromBoundaryOutcomes = (
    primaryAction: AttemptAction,
    objectId: EphemeraObjectId,
    graph: EphemeraLudicGraph,
    getGraph: ExpansionEnvironment['getGraph']
): ExpandedAttemptActions => {
    // A mover's own containment edge into the host it is leaving (the cup `On` the table, read
    // from the table's shard) is removed by the move itself, as `buildObjectMoveOp` does at
    // commit, so it is not a boundary edge and never reaches the hosting-kind classifier.
    const outcomes = boundaryEdgeOutcomes(objectId, graph, (edge) =>
        isHostingRelationKind(edge.kind)
        && ephemeraLudicTerminalsEqual(edge.to, graph.rootId)
        && ephemeraLudicTerminalsEqual(edge.from, objectId))
    const boundary = outcomes.flatMap((entry): { action: AttemptAction; narrationUnit: NarrationUnit }[] => {
        const chain = findRelationalChainFromLeg({ hostId: graph.hostId, edge: entry.edge }, { getGraph })
        if (chain.verdict !== 'found') {
            return []
        }
        const [subjectId, targetId] = chain.endpoints
        if (!isEphemeraThingId(subjectId) || !isEphemeraThingId(targetId)) {
            return []
        }
        // Each end is seen from the shard holding its own leg: the chain's edge step touching it.
        const presenceOf = (endId: typeof subjectId) => {
            const leg = chain.steps.find((step) => step.type === 'edge'
                && (ephemeraLudicTerminalsEqual(step.edge.from, endId) || ephemeraLudicTerminalsEqual(step.edge.to, endId)))
            const legGraph = leg === undefined ? undefined : leg.hostId === graph.hostId ? graph : getGraph(leg.hostId)
            return legGraph === undefined ? undefined : presencesHolding(legGraph, endId)
        }
        const subject = graphNodeRef(subjectId, presenceOf(subjectId))
        const target = graphNodeRef(targetId, presenceOf(targetId))
        const desiredResult: DissolveRelationChange<GroundedReferent> = {
            kind: 'change',
            primitive: 'dissolveRelation',
            subject,
            target,
            ...relationKindAndLabelOf(entry.edge),
        }

        let challenges: Challenge[] = []
        if (entry.outcome === 'defer') {
            // The classifier defers only `Custom` (the one peer kind); anything else is an invariant break.
            if (entry.edge.kind !== 'Custom') {
                throw new Error(`attemptActionsFromBoundaryOutcomes: a '${entry.edge.kind}' boundary edge deferred, but only 'Custom' defers`)
            }
            challenges = [new CustomEdgeChallenge(customEdgeChallengeId(primaryAction.id, entry.edge), entry.edge, describeCustomEdgeChallenge(entry.edge))]
        }

        const action = new PositionAttemptAction(
            mintActionId(),
            challenges,
            desiredResult,
            entry.edge.kind === 'Custom' ? `Dissolve: ${entry.edge.relationLabel}` : `Dissolve: ${entry.edge.kind}`
        )
        // A boundary edge has the moved object at exactly one end.
        const subjectMoves = ephemeraLudicTerminalsEqual(subjectId, objectId)
        const [moved, other] = subjectMoves ? [subject, target] : [target, subject]
        return [{ action, narrationUnit: dissolveNarrationUnit(action.id, derivedReferentKey(moved), derivedReferentKey(other)) }]
    })

    return {
        actions: [...boundary.map(({ action }) => action), primaryAction],
        narrationUnits: boundary.map(({ narrationUnit }) => narrationUnit),
    }
}

/**
 * Expansion for any `transferMembership` (ISS8203 slice 3), whichever template produced it. A
 * transfer whose moved object touches an exit gets an {@link ExitEdgeChallenge} on the primary
 * action, which stays pending (the take or drop abstains); then the boundary dissolves are added
 * as {@link attemptActionsFromBoundaryOutcomes} does. `graph` is the object's source host;
 * `getGraph` reaches the shards a crossing relation continues into.
 */
export const attemptActionsFromTransfer = (
    primaryAction: AttemptAction,
    objectId: EphemeraObjectId,
    graph: EphemeraLudicGraph,
    getGraph: ExpansionEnvironment['getGraph']
): ExpandedAttemptActions => {
    const exitChallenged = objectTouchesExitEdgeOnGraph(graph, objectId)
    const primary = exitChallenged
        ? primaryAction.withChallenges([
            ...primaryAction.challenges(),
            new ExitEdgeChallenge(exitEdgeChallengeId(primaryAction.id), describeExitEdgeChallenge()),
        ])
        : primaryAction
    return attemptActionsFromBoundaryOutcomes(primary, objectId, graph, getGraph)
}
