import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraLudicTerminalsEqual, isHostingRelationKind, relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicGraph } from '../../positions/ludicGraph'
import { boundaryEdgeOutcomes } from '../../positions/ludicGraph/expandValidate/interactionUnderTransfer'
import type { HostRelationalEdge } from '../../positions/ludicGraph/baseClasses'
import { presencesHolding } from '../../positions/ludicGraph/presenceSubGraph'
import type { DissolveRelationChange, GroundedReferent } from '../enrich/objectManipulation/plan/planStep'
import { graphNodeRef } from '../enrich/objectManipulation/plan/planStep'
import { isEphemeraThingId, type EphemeraThingId } from '../enrich/objectManipulation/thing'
import type { AttemptAction } from './action'
import { mintActionId, PositionAttemptAction } from './action'
import type { Challenge } from './challenge'
import { CustomEdgeChallenge, ExitEdgeChallenge } from './challenge'
import { objectTouchesExitEdgeOnGraph } from '../enrich/objectManipulation/membershipObservation'

let challengeIdCounter = 0
const mintChallengeId = (): string => {
    challengeIdCounter += 1
    return `boundaryChallenge-${challengeIdCounter}`
}

const describeCustomEdgeChallenge = (edge: Extract<HostRelationalEdge, { kind: 'Custom' }>): string =>
    `Boundary relation to dissolve: ${edge.relationLabel}.`

const describeExitEdgeChallenge = (): string =>
    'Exit contact: the moved object touches an exit, which has no graph rule for moving it.'

/**
 * Expansion: the facilitating actions a whole-object transfer needs. Its precondition is
 * that the moved object is connected to nothing outside itself, so each boundary edge the
 * relation-under-transfer table classifies adds one prior action whose desired result is
 * "this relation no longer holds". A `dissolve` cell gives an action with no challenge. A
 * `defer` cell gives one carrying a graph challenge (`CustomEdgeChallenge`) for Adjudicate to judge. The action
 * states the result, not the method: untying and cutting a lashing leave the same graph.
 *
 * The actions are returned in execution order, facilitating dissolves first and the primary
 * action last (BD-28), so a consumer can lower them in sequence without knowing which is which.
 *
 * This is the one classification of boundary edges, on both sides: the dry run lowers these
 * actions rather than classifying again, and the commit side (`commitAttempt`) commits them as
 * the only source of facilitating dissolves. Its later re-check only refuses a move whose live
 * boundary edges these actions do not cover.
 *
 * Each dissolve's referents are grounded (`graphNode`s): Expansion finds the edge's far end
 * in the graph, and no phrase named it. `subject`/`target` follow the edge's own direction,
 * whichever end is the moved object. Expansion grounds them, so it also learns where each is
 * seen: every bucket of `graph` holding that end (`presencesHolding`), each end on its own, since
 * an `Enumerated` split can put the two ends of one edge in different buckets (a wire in one
 * room's half of a breadboard, connected to a spot in the other's). The Change carries no `host`: the executor's
 * `dissolveRelation` command-expansion rediscovers this exact edge by chain discovery
 * (`findRelationalChain`), the same mechanism the ingress relational route uses.
 */
export const attemptActionsFromBoundaryOutcomes = (
    primaryAction: AttemptAction,
    transferSet: ReadonlySet<EphemeraObjectId>,
    graph: EphemeraLudicGraph
): AttemptAction[] => {
    // A mover's own containment edge into the host it is leaving (the cup `On` the table, read
    // from the table's shard) is removed by the move itself, as `buildObjectMoveOp` does at
    // commit, so it is not a boundary edge and never reaches the hosting-kind classifier.
    const outcomes = boundaryEdgeOutcomes(transferSet, graph, (edge) =>
        isHostingRelationKind(edge.kind)
        && ephemeraLudicTerminalsEqual(edge.to, graph.rootId)
        && [...transferSet].some((objectId) => ephemeraLudicTerminalsEqual(edge.from, objectId)))
        // A port-qualified endpoint has no producer on a boundary edge yet (ludicGraph/AGENT.md's
        // BD-36 paragraph), so only edges between things are expanded. A crossing's far end, once
        // expanded, takes its presence from the shard holding its own leg, not from `graph`.
        .filter((entry) => isEphemeraThingId(entry.edge.from) && isEphemeraThingId(entry.edge.to))
    const boundaryActions = outcomes.map((entry): AttemptAction => {
        // Safe: filtered to things above.
        const subjectId = entry.edge.from as EphemeraThingId
        const targetId = entry.edge.to as EphemeraThingId
        const desiredResult: DissolveRelationChange<GroundedReferent> = {
            kind: 'change',
            primitive: 'dissolveRelation',
            subject: graphNodeRef(subjectId, presencesHolding(graph, subjectId)),
            target: graphNodeRef(targetId, presencesHolding(graph, targetId)),
            ...relationKindAndLabelOf(entry.edge),
        }

        let challenges: Challenge[] = []
        if (entry.outcome === 'defer') {
            // The classifier defers only `Custom` (the one peer kind); anything else is an invariant break.
            if (entry.edge.kind !== 'Custom') {
                throw new Error(`attemptActionsFromBoundaryOutcomes: a '${entry.edge.kind}' boundary edge deferred, but only 'Custom' defers`)
            }
            challenges = [new CustomEdgeChallenge(mintChallengeId(), entry.edge, describeCustomEdgeChallenge(entry.edge))]
        }

        return new PositionAttemptAction(
            mintActionId(),
            challenges,
            desiredResult,
            entry.edge.kind === 'Custom' ? `Dissolve: ${entry.edge.relationLabel}` : `Dissolve: ${entry.edge.kind}`
        )
    })

    return [...boundaryActions, primaryAction]
}

/**
 * Expansion for any `transferMembership` (ISS8203 slice 3), whichever template produced it. A
 * transfer whose moved object touches an exit gets an {@link ExitEdgeChallenge} on the primary
 * action, which stays pending (the take or drop abstains); then the boundary dissolves are added
 * as {@link attemptActionsFromBoundaryOutcomes} does. `graph` is the object's source host.
 */
export const attemptActionsFromTransfer = (
    primaryAction: AttemptAction,
    objectId: EphemeraObjectId,
    graph: EphemeraLudicGraph
): AttemptAction[] => {
    const exitChallenged = objectTouchesExitEdgeOnGraph(graph, objectId)
    const primary = exitChallenged
        ? primaryAction.withChallenges([
            ...primaryAction.challenges(),
            new ExitEdgeChallenge(mintChallengeId(), describeExitEdgeChallenge()),
        ])
        : primaryAction
    return attemptActionsFromBoundaryOutcomes(primary, new Set([objectId]), graph)
}
