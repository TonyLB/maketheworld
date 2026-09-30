import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicGraph } from '../../positions/ludicGraph'
import { boundaryEdgeOutcomes } from '../../positions/ludicGraph/expandValidate/interactionUnderTransfer'
import type { HostRelationalEdge } from '../../positions/ludicGraph/baseClasses'
import type { DissolveRelationChange, Referent } from '../enrich/objectManipulation/plan/ungroundedPrimitive'
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
    // CA-1: Under-defer wording is carried forward as an explicit open item --- no worked
    // example has produced one to design real wording against yet.
    'Boundary relation to dissolve: the subject is Under something that must move first.'

/**
 * Expansion (Target shape): translates a boundary-edge classification into the extra
 * actions the graph requires --- one per boundary edge, challenge-free for a `dissolve`
 * outcome, carrying a graph challenge (CustomEdgeChallenge / UnderDeferChallenge) for a
 * `defer` outcome. CA-7 (slice 2): this calls `boundaryEdgeOutcomes` directly rather than
 * reading it out of Synthesize's executor outcome, which doesn't expose the edge today ---
 * a duplicate but cheap, pure, in-memory classification, not a widening of `executor.ts`'s
 * outcome types.
 */
export const attemptActionsFromBoundaryOutcomes = (
    primaryAction: AttemptAction,
    transferSet: ReadonlySet<EphemeraObjectId>,
    graph: EphemeraLudicGraph,
    referentOf: (id: EphemeraObjectId) => Referent
): AttemptAction[] => {
    const outcomes = boundaryEdgeOutcomes(transferSet, graph)
        // Safe filter, matching executor.ts's own: no producer can build a port-qualified
        // boundary edge yet (Object-only carry/boundary machinery, ludicGraph/AGENT.md's
        // BD-36 paragraph) --- skip rather than assume.
        .filter((entry) =>
            typeof entry.edge.from === 'string' && isEphemeraObjectId(entry.edge.from)
            && typeof entry.edge.to === 'string' && isEphemeraObjectId(entry.edge.to))
    const boundaryActions = outcomes.map((entry): AttemptAction => {
        const movedId = (entry.movedRole === 'subject' ? entry.edge.from : entry.edge.to) as EphemeraObjectId
        const otherId = (entry.movedRole === 'subject' ? entry.edge.to : entry.edge.from) as EphemeraObjectId
        const desiredResult: DissolveRelationChange = {
            kind: 'change',
            primitive: 'dissolveRelation',
            subject: referentOf(movedId),
            target: referentOf(otherId),
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
