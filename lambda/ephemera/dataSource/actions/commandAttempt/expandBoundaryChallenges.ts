import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicGraph } from '../../positions/ludicGraph'
import { boundaryEdgeOutcomes } from '../../positions/ludicGraph/expandValidate/interactionUnderTransfer'
import type { HostRelationalEdge } from '../../positions/ludicGraph/baseClasses'
import type { DissolveRelationChange, GroundedReferent } from '../enrich/objectManipulation/plan/planStep'
import { graphNodeRef } from '../enrich/objectManipulation/plan/planStep'
import { isEphemeraThingId, type EphemeraThingId } from '../enrich/objectManipulation/thing'
import type { AttemptAction } from './action'
import { PositionAttemptAction } from './action'
import type { Challenge } from './challenge'
import { CustomEdgeChallenge, UnderDeferChallenge } from './challenge'

let challengeIdCounter = 0
const mintChallengeId = (): string => {
    challengeIdCounter += 1
    return `boundaryChallenge-${challengeIdCounter}`
}

const describeCustomEdgeChallenge = (edge: Extract<HostRelationalEdge, { kind: 'Custom' }>): string =>
    `Boundary relation to dissolve: ${edge.relationLabel}.`

const describeUnderDeferChallenge = (): string =>
    // Under-defer wording waits on choosing between its readings (clearance or pinned), which
    // needs world knowledge; see the objectManipulationIterations plan's "What the table does
    // not capture".
    'Boundary relation to dissolve: the subject is Under something that must move first.'

/**
 * Expansion: the facilitating actions a whole-object transfer needs. Its precondition is
 * that the moved object is connected to nothing outside itself, so each boundary edge the
 * relation-under-transfer table classifies adds one prior action whose desired result is
 * "this relation no longer holds". A `dissolve` cell gives an action with no challenge. A
 * `defer` cell gives one carrying a graph challenge (`CustomEdgeChallenge`, or
 * `UnderDeferChallenge` for an `Under` subject-move) for Adjudicate to judge. The action
 * states the result, not the method: untying and cutting a lashing leave the same graph.
 *
 * This is the actions pipeline's one classification of boundary edges: the dry run lowers
 * these actions rather than classifying again, and only the commit side re-classifies,
 * against a later snapshot.
 *
 * Each dissolve's referents are grounded (`graphNode`s): Expansion finds the edge's far end
 * in the graph, and no phrase named it. `subject`/`target` follow the edge's own direction,
 * whichever end is the moved object. The Change carries no `host`: the executor's
 * `dissolveRelation` command-expansion rediscovers this exact edge by chain discovery
 * (`findRelationalChain`), the same mechanism the ingress relational route uses.
 */
export const attemptActionsFromBoundaryOutcomes = (
    primaryAction: AttemptAction,
    transferSet: ReadonlySet<EphemeraObjectId>,
    graph: EphemeraLudicGraph
): AttemptAction[] => {
    const outcomes = boundaryEdgeOutcomes(transferSet, graph)
        // A port-qualified endpoint has no producer on a boundary edge yet (ludicGraph/AGENT.md's
        // BD-36 paragraph), so only edges between things are expanded.
        .filter((entry) => isEphemeraThingId(entry.edge.from) && isEphemeraThingId(entry.edge.to))
    const boundaryActions = outcomes.map((entry): AttemptAction => {
        const desiredResult: DissolveRelationChange<GroundedReferent> = {
            kind: 'change',
            primitive: 'dissolveRelation',
            // Safe: filtered to things above.
            subject: graphNodeRef(entry.edge.from as EphemeraThingId),
            target: graphNodeRef(entry.edge.to as EphemeraThingId),
            ...relationKindAndLabelOf(entry.edge),
        }

        let challenges: Challenge[] = []
        if (entry.outcome === 'defer') {
            if (entry.edge.kind === 'Custom') {
                challenges = [new CustomEdgeChallenge(mintChallengeId(), entry.edge, describeCustomEdgeChallenge(entry.edge))]
            } else {
                challenges = [new UnderDeferChallenge(mintChallengeId(), entry.edge, describeUnderDeferChallenge())]
            }
        }

        return new PositionAttemptAction(
            challenges,
            desiredResult,
            entry.edge.kind === 'Custom' ? `Dissolve: ${entry.edge.relationLabel}` : `Dissolve: ${entry.edge.kind}`
        )
    })

    return [primaryAction, ...boundaryActions]
}
