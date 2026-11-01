import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraLudicTerminalKey, ephemeraLudicTerminalsEqual, isEphemeraLudicEdgeTerminal, relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicGraph } from '../../positions/ludicGraph'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { classifyInteractionUnderTransfer } from '../../positions/ludicGraph/expandValidate/interactionUnderTransfer'
import type { ActorBoundaryRelations } from '../../positions/ludicCache/actorCache'
import type { BoundaryRelation } from '../../positions/ludicCache/boundaryRelations'
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
import { CustomEdgeChallenge, ExitEdgeChallenge, SecuredToChallenge } from './challenge'
import { objectTouchesExitEdgeOnGraph } from '../enrich/objectManipulation/membershipObservation'
import type { NarrationUnit } from './narrationUnit'

/**
 * A challenge's `id` is its key: structural, so a fresh run of the same (attempt, identity) pair
 * mints the same ids in any module instance, which is what lets a stored answer find its challenge.
 * Each id is scoped by the primary action's id (Plan-minted, so stable across reruns of a frozen root).
 */
const exitEdgeChallengeId = (primaryActionId: string): string => `exitEdge:${primaryActionId}`

/**
 * The key a Custom edge's challenge has by structure alone. An edge that later gains an `edgeId` is
 * keyed by it instead, so this is also the alias a stored answer under the old key is matched by
 * (`applyChallengeAnswers`). Structural keys contain `|` and edge ids are bare uuids, so the two forms cannot collide.
 */
export const customEdgeStructuralChallengeId = (
    primaryActionId: string,
    edge: Extract<HostRelationalEdge, { kind: 'Custom' }>
): string => `customEdge:${primaryActionId}:${[ephemeraLudicTerminalKey(edge.from), ephemeraLudicTerminalKey(edge.to), edge.kind, edge.relationLabel].join('|')}`

const customEdgeChallengeId = (
    primaryActionId: string,
    edge: Extract<HostRelationalEdge, { kind: 'Custom' }>
): string => edge.edgeId === undefined
    ? customEdgeStructuralChallengeId(primaryActionId, edge)
    : `customEdge:${primaryActionId}:${edge.edgeId}`

const describeCustomEdgeChallenge = (edge: Extract<HostRelationalEdge, { kind: 'Custom' }>): string =>
    `Boundary relation to dissolve: ${edge.relationLabel}.`

const securedToChallengeId = (primaryActionId: string, edge: HostRelationalEdge): string =>
    `securedTo:${primaryActionId}:${edge.edgeId ?? [ephemeraLudicTerminalKey(edge.from), ephemeraLudicTerminalKey(edge.to)].join('|')}`

const describeSecuredToChallenge = (): string =>
    'Secured: the moved object is secured to something, and cannot be moved until it is freed.'

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
 * in the actor's cache, and no phrase named it. A joined crossing in the cache names both true
 * ends directly; a boundary edge whose far end is an open leg (the relation reaches a shard the
 * cache did not walk) is followed through the graphs by `nameFarEnd`, the bounded read. `subject`/`target` follow the relation's
 * own direction, whichever end is the moved object. Expansion grounds them, so it also learns
 * where each is seen (`presencesOf`): every bucket holding that end **in the host whose leg touches that
 * end** (`endHosts`), each end on its own. An `Enumerated` split can still put the two ends in different buckets (a
 * wire in one room's half of a breadboard, connected to a spot in the other's); for a crossing,
 * the far end's host can lead to a different room entirely. The Change carries no `host`: the
 * executor's `dissolveRelation` command-expansion rediscovers this exact relation by chain
 * discovery (`findRelationalChain`), the same mechanism the ingress relational route uses.
 *
 * A relation whose chain cannot be walked (a shard `getGraph` does not have) or whose far end is
 * not a thing (a presence binding, PR-15) gets no dissolve: the move's commit-time recheck then
 * refuses it as uncovered, rather than Expansion guessing an end it cannot name.
 *
 * `sourceHosts` are the hosts the object leaves: one for most moves, several for a take of a thing in
 * several hosts (the take rule), whose boundary edges are the cache's relations with a leg held there.
 */
export const attemptActionsFromBoundaryOutcomes = (
    primaryAction: AttemptAction,
    objectId: EphemeraObjectId,
    sourceHosts: readonly EphemeraMembershipHostId[],
    cache: ActorBoundaryRelations,
    getGraph: ExpansionEnvironment['getGraph']
): ExpandedAttemptActions => {
    // The mover's hosting kind is a field of its node, not an edge, so it is never a boundary edge.
    const supports = cache.securedToSupportEdgeIds()
    const boundary = cache.boundaryRelationsOf(objectId, sourceHosts)
        .flatMap((relation) => boundaryActionForRelation(primaryAction, objectId, relation, supports, cache, getGraph))
    return {
        actions: [...boundary.map(({ action }) => action), primaryAction],
        narrationUnits: boundary.map(({ narrationUnit }) => narrationUnit),
    }
}

/**
 * The relation's two true ends, each with where it is seen. A joined crossing in the cache names both directly; an open leg
 * (the cache holds only "something hosted by that owner") is followed through the graphs by `nameFarEnd`.
 */
const relationEnds = (
    objectId: EphemeraObjectId,
    relation: BoundaryRelation,
    cache: ActorBoundaryRelations,
    getGraph: ExpansionEnvironment['getGraph']
): { moved: GroundedReferent; other: GroundedReferent; subject: GroundedReferent; target: GroundedReferent } | undefined => {
    const moved = graphNodeRef(objectId, cache.presencesOf(objectId, relation.moverHost))
    const far = relation.far.kind === 'named' ? relation.far.id : undefined
    const other = far !== undefined
        ? isEphemeraThingId(far) ? graphNodeRef(far, cache.presencesOf(far, relation.farHost)) : undefined
        : nameFarEnd(relation, objectId, getGraph)
    if (other === undefined) {
        return undefined
    }
    const [subject, target] = relation.movedRole === 'subject' ? [moved, other] : [other, moved]
    return { moved, other, subject, target }
}

/**
 * The bounded graph read (ISS8314): a changed edge whose far end the cache cannot name (an open leg) is followed
 * through its own legs in the graphs, from the mover's leg, to the relation's true far end. Bounded by the chain, not a search,
 * so it is the one place planning reads graphs for a relation, and it never digs for something it has not got. `undefined` when
 * the chain cannot be walked (a shard `getGraph` does not have) or its far end is not a thing: the move's commit-time recheck then
 * refuses it as uncovered, rather than Expansion guessing an end it cannot name.
 */
export const nameFarEnd = (
    relation: BoundaryRelation,
    objectId: EphemeraObjectId,
    getGraph: ExpansionEnvironment['getGraph']
): GroundedReferent | undefined => {
    const chain = findRelationalChainFromLeg({ hostId: relation.moverHost, edge: relation.edge }, { getGraph })
    if (chain.verdict !== 'found') {
        return undefined
    }
    const farId = chain.endpoints.find((endpoint) => !ephemeraLudicTerminalsEqual(endpoint, objectId))
    if (farId === undefined || !isEphemeraThingId(farId)) {
        return undefined
    }
    // The far end is seen from the shard holding its own leg: the chain's edge step touching it.
    const leg = chain.steps.find((step) => step.type === 'edge'
        && (ephemeraLudicTerminalsEqual(step.edge.from, farId) || ephemeraLudicTerminalsEqual(step.edge.to, farId)))
    const legGraph = leg === undefined ? undefined : getGraph(leg.hostId)
    return graphNodeRef(farId, legGraph === undefined ? undefined : presencesHolding(legGraph, farId))
}

/** One boundary relation's dissolve, with its narration unit; nothing for a block, a covered support, or an end that cannot be named. */
const boundaryActionForRelation = (
    primaryAction: AttemptAction,
    objectId: EphemeraObjectId,
    relation: BoundaryRelation,
    supports: ReadonlySet<string>,
    cache: ActorBoundaryRelations,
    getGraph: ExpansionEnvironment['getGraph']
): { action: AttemptAction; narrationUnit: NarrationUnit }[] => {
    const { edge } = relation
    const outcome = classifyInteractionUnderTransfer(edge.kind, relation.movedRole)
    // A block is a challenge on the primary action (`attemptActionsFromTransfer`), never a dissolve,
    // and it covers the `Custom` support that justifies it.
    if (outcome === 'block' || (edge.edgeId !== undefined && supports.has(edge.edgeId))) {
        return []
    }
    const ends = relationEnds(objectId, relation, cache, getGraph)
    if (ends === undefined) {
        return []
    }
    const desiredResult: DissolveRelationChange<GroundedReferent> = {
        kind: 'change',
        primitive: 'dissolveRelation',
        subject: ends.subject,
        target: ends.target,
        ...relationKindAndLabelOf(edge),
    }

    let challenges: Challenge[] = []
    if (outcome === 'defer') {
        // The classifier defers `Custom` (the one peer kind) and `ConnectedTo`; only `Custom` has a
        // challenge type. A `ConnectedTo` defer (a part leaving its whole) has no producer yet, so
        // reaching it is an invariant break until a challenge for it exists.
        if (edge.kind !== 'Custom') {
            throw new Error(`attemptActionsFromBoundaryOutcomes: a '${edge.kind}' boundary edge deferred, but only 'Custom' has a challenge`)
        }
        challenges = [new CustomEdgeChallenge(customEdgeChallengeId(primaryAction.id, edge), edge, describeCustomEdgeChallenge(edge))]
    }

    const action = new PositionAttemptAction(
        mintActionId(),
        challenges,
        desiredResult,
        edge.kind === 'Custom' ? `Dissolve: ${edge.relationLabel}` : `Dissolve: ${edge.kind}`
    )
    // A boundary edge has the moved object at exactly one end.
    return [{ action, narrationUnit: dissolveNarrationUnit(action.id, derivedReferentKey(ends.moved), derivedReferentKey(ends.other)) }]
}

/**
 * Expansion for any `transferMembership` (ISS8203 slice 3), whichever template produced it. A
 * transfer whose moved object touches an exit gets an {@link ExitEdgeChallenge} on the primary
 * action, and one with a `SecuredTo` boundary edge gets a {@link SecuredToChallenge} per edge; each
 * stays pending (the take or drop abstains); then the boundary dissolves are added
 * as {@link attemptActionsFromBoundaryOutcomes} does. `graphs` are the object's source hosts (several
 * for a take of a thing in several hosts: an exit contact in any one challenges the take). They are
 * read for exits only, which are not cache edges (they stay a room-graph read), and name the hosts the cache's relations
 * are limited to; `getGraph` reaches the shards a crossing relation continues into (the bounded read).
 */
export const attemptActionsFromTransfer = (
    primaryAction: AttemptAction,
    objectId: EphemeraObjectId,
    graphs: readonly EphemeraLudicGraph[],
    cache: ActorBoundaryRelations,
    getGraph: ExpansionEnvironment['getGraph']
): ExpandedAttemptActions => {
    const sourceHosts = graphs.map(({ hostId }) => hostId)
    const exitChallenged = graphs.some((graph) => objectTouchesExitEdgeOnGraph(graph, objectId))
    const securedChallenges = cache.boundaryRelationsOf(objectId, sourceHosts)
        .filter(({ edge, movedRole }) => classifyInteractionUnderTransfer(edge.kind, movedRole) === 'block')
        .map(({ edge }) => new SecuredToChallenge(securedToChallengeId(primaryAction.id, edge), describeSecuredToChallenge()))
    const added: Challenge[] = [
        ...(exitChallenged ? [new ExitEdgeChallenge(exitEdgeChallengeId(primaryAction.id), describeExitEdgeChallenge())] : []),
        ...securedChallenges,
    ]
    const primary = added.length > 0
        ? primaryAction.withChallenges([...primaryAction.challenges(), ...added])
        : primaryAction
    return attemptActionsFromBoundaryOutcomes(primary, objectId, sourceHosts, cache, getGraph)
}
