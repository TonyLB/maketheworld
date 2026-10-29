import { relationKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalPrimitive, RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { buildObjectMovedFact } from '../membership/buildObjectMovedFact'
import { buildCharacterMovedFact } from '../membership/buildCharacterMovedFact'
import { buildRelationalFact } from '../relational/buildObjectRelationalFact'
import type { RelationalIngressOperation } from '../relational/types'
import type {
    CharacterMovedPublishedPayload,
    ObjectMovedPublishedPayload,
    ObjectRelationChangedPublishedPayload,
} from '../../publishedEvents'
import type { MembershipChange } from './membershipChanges'
import type { MutationKernelStep } from './kernelStep'

// Kind-indifferent: checks graph.nodeIds (any terminal kind), not graph.objectIds.
const findHostOf = (
    id: EphemeraLudicTerminalPrimitive,
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
): EphemeraMembershipHostId | undefined => {
    for (const [hostId, graph] of graphs) {
        if (graph.nodeIds.has(id)) {
            return hostId
        }
    }
    return undefined
}

/**
 * BD-27c's generic fact-streaming mapping: walks the *output-ordered* steps (not a hand-assembled
 * subset) and maps each to zero-or-more facts. Streaming in step order (BD-28) is what guarantees a
 * move's `dissolveRelation` facts stream before its moved fact, which `commitStepSequence` streams
 * right after the mover's last presence step (`movedFactsFor`, below).
 *
 * `priorGraphs` (object-lifecycle Migrate row): a `dissolveRelation` step's endpoint can be entirely
 * removed from the footprint by a later departure in the same sequence (destroy), leaving it absent
 * from `finalGraphs` altogether. Falls back to the pre-apply snapshot to re-derive the host it
 * actually held the edge on, right before removal, rather than throwing --- defaults to `finalGraphs`
 * itself so every other caller is unaffected.
 *
 * Presence, create and destroy steps yield no facts of their own (their world event is the moved
 * fact, or the objects lane's own created/destroyed ids); `capture` yields none either --- it is not
 * a world event, just a read of one already reflected (or not yet reflected) by whatever mutation
 * facts stream around it.
 */
export const factsForStep = (
    step: MutationKernelStep,
    finalGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    beatAnchorTime: number,
    priorGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph> = finalGraphs
): ObjectRelationChangedPublishedPayload[] => {
    if (step.kind === 'capture') {
        return []
    }

    // not a world event any narration channel reads today --- the object-move narrate
    // steps already cover "arrives," and a presence binding's own visibility is future work.
    if (step.kind === 'addPresenceBinding' || step.kind === 'repairPresenceBinding'
        || step.kind === 'reparentPresenceBinding' || step.kind === 'joinPresenceBindings' || step.kind === 'splitPresenceBinding') {
        return []
    }

    // a creation is announced by the placement that follows it (`Object Moved` from nowhere); the
    // objects lane's `Objects Changed` `createdIds` is the creation event itself.
    if (step.kind === 'createComponent') {
        return []
    }

    // a destruction is announced by the move that precedes it (`Object Moved` to nowhere); the
    // objects lane's `Objects Changed` `destroyedIds` is the destruction event itself.
    if (step.kind === 'destroyComponent') {
        return []
    }

    // same deferral as addPresenceBinding/reparentPresenceBinding --- a crossing port's own visibility is future work.
    if (step.kind === 'addCrossingPort' || step.kind === 'removeCrossingPort') {
        return []
    }

    // a hosting kind is a property of one membership, and `Object Relation Changed` has no consumer
    // for it: the move's own fact already covers the arrival.
    if (step.kind === 'setHostingKind') {
        return []
    }

    // an id is not a change to what relates to what.
    if (step.kind === 'assignEdgeId') {
        return []
    }

    // a crossing leg names a port, not the edge's real pair, so it yields no fact; the edge's
    // one fact comes from `factForRelationalEdge`, when the caller supplies the edge.
    if (!isEphemeraLudicTerminalPrimitive(step.subjectId) || !isEphemeraLudicTerminalPrimitive(step.targetId)) {
        return []
    }

    const hostId = findHostOf(step.subjectId, finalGraphs) ?? findHostOf(step.subjectId, priorGraphs)
    if (hostId === undefined) {
        throw new Error(`factsForStep: cannot re-derive host for ${step.subjectId} from the final or prior graph map`)
    }
    return [
        buildRelationalFact({
            subjectId: step.subjectId,
            targetId: step.targetId,
            hostId,
            ...relationKindAndLabelFrom(step),
            operation: step.kind === 'establishRelation' ? 'establish' : 'dissolve',
            beatAnchorTime,
        }),
    ]
}

/**
 * A relational edge as the player's command named it: its real subject and target, not any
 * leg's port address. A caller that commits whole edges hands these to `commitStepSequence`
 * (`relationalEdges`), and each yields one `Object Relation Changed` fact, however many legs
 * its chain has.
 */
export type RelationalEdgeFactSource = {
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    operation: RelationalIngressOperation
} & RelationalKindAndLabel

/**
 * Whether a step's relational fact is the one a supplied edge already yields --- a one-leg chain,
 * whose single leg names the edge's real pair. A step fact that matches no supplied edge (a move's
 * own containment strip or containment establish, committed in the same attempt) is a fact in its
 * own right.
 */
export const isFactOfRelationalEdge = (
    fact: ObjectRelationChangedPublishedPayload,
    edge: RelationalEdgeFactSource
): boolean => (
    fact.operation === edge.operation
    && fact.relationKind === edge.relationKind
    && (
        (fact.subjectId === edge.subjectId && fact.targetId === edge.targetId)
        // `ConnectedTo` is symmetric: the fact may name the pair in either order.
        || (fact.relationKind === 'ConnectedTo' && fact.subjectId === edge.targetId && fact.targetId === edge.subjectId)
    )
    && (fact.relationKind !== 'Custom' || (edge.relationKind === 'Custom' && fact.relationLabel === edge.relationLabel))
)

/**
 * One edge's fact. The host is the subject's, re-derived from the graphs the same way
 * `factsForStep` does for a leg: the committed graphs, then the pre-apply snapshot (a dissolve
 * whose subject left the footprint).
 */
export const factForRelationalEdge = (
    edge: RelationalEdgeFactSource,
    finalGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    beatAnchorTime: number,
    priorGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph> = finalGraphs
): ObjectRelationChangedPublishedPayload => {
    const hostId = findHostOf(edge.subjectId, finalGraphs) ?? findHostOf(edge.subjectId, priorGraphs)
    if (hostId === undefined) {
        throw new Error(`factForRelationalEdge: cannot re-derive host for ${edge.subjectId} from the final or prior graph map`)
    }
    return buildRelationalFact({
        subjectId: edge.subjectId,
        targetId: edge.targetId,
        hostId,
        ...relationKindAndLabelFrom(edge),
        operation: edge.operation,
        beatAnchorTime,
    })
}

/**
 * A mover's one moved fact, from its net membership change (`membershipChangesOf`): `froms` are the
 * hosts it left, `to` the host it arrived at (a mover has one arrival; none is a departure). One
 * `Object Moved` or `Character Moved` per entity, with plural `froms` and nullable `to`, so the
 * lifecycle routes keep the single-fact-per-entity shape. `characterNames` is a caller-supplied lookup
 * (this function stays synchronous), so a `Character Moved` fact carries its display name.
 * Folding this into `commitStepSequence` (rather than layering it on top after the kernel returns)
 * keeps `Character Moved` streaming before the kernel's own `RoomUpdate` publish loop.
 */
export const movedFactsFor = (
    change: MembershipChange,
    beatAnchorTime: number,
    characterNames: ReadonlyMap<EphemeraCharacterId, string> = new Map()
): (ObjectMovedPublishedPayload | CharacterMovedPublishedPayload)[] => {
    const diff = { froms: change.left, to: change.arrived[0] ?? null, changed: true }
    const entityId = change.entityId
    const fact = isEphemeraObjectId(entityId)
        ? buildObjectMovedFact({ objectId: entityId, diff, beatAnchorTime })
        : isEphemeraCharacterId(entityId)
            ? buildCharacterMovedFact({
                characterId: entityId,
                diff,
                beatAnchorTime,
                characterName: characterNames.get(entityId),
            })
            : undefined
    return fact === undefined ? [] : [fact]
}
