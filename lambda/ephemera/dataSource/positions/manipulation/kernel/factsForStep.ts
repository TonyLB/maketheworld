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
 * move's steps --- `[dissolveRelation*, transferMembership]` --- stream their dissolve facts before
 * the moved fact.
 *
 * Character-kind fact emission (folded in for the character-route Migrate row, BD-36): a
 * `transferMembership` whose `entityId` is a character produces a `Character Moved` fact here too, via
 * `characterNames` (a caller-supplied lookup --- this function stays synchronous, so the name must
 * already be resolved, not fetched here). Folding this in (rather than layering it on top, in the
 * caller, after `commitStepSequence` returns) is what keeps `Character Moved` streaming before the
 * kernel's own `RoomUpdate` publish loop, mirroring `Object Moved`'s existing ordering guarantee ---
 * `commitStepSequence.test.ts` asserts this ordering, and only folding the fact in
 * here (rather than leaving it to run after the kernel call returns) can preserve it.
 *
 * One `Object Moved` or `Character Moved` fact per step, with `froms: [...fromHostIds]`/
 * `to: toHostId` --- matching `buildObjectMovedFact`/`buildCharacterMovedFact`'s existing multi-`froms`/
 * nullable-`to` diff shape --- rather than one fact per host, so the object-lifecycle routes'
 * (plural-`froms`, nullable-`to`) steps get the same single-fact-per-entity behavior as every other
 * caller.
 *
 * `priorGraphs` (object-lifecycle Migrate row): a `dissolveRelation` step's endpoint can be entirely
 * removed from the footprint by a later pure-remove `transferMembership` step in the same sequence
 * (destroy), leaving it absent from `finalGraphs` altogether. Falls back to the pre-apply snapshot to
 * re-derive the host it actually held the edge on, right before removal, rather than throwing ---
 * defaults to `finalGraphs` itself so every other caller (a real transfer, where the object always
 * lands on some footprint graph) is unaffected.
 *
 * `capture` yields no facts --- it is not a world event, just a read of one already reflected
 * (or not yet reflected) by whatever mutation facts stream around it.
 */
export const factsForStep = (
    step: MutationKernelStep,
    finalGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    beatAnchorTime: number,
    priorGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph> = finalGraphs,
    characterNames: ReadonlyMap<EphemeraCharacterId, string> = new Map()
): (ObjectMovedPublishedPayload | CharacterMovedPublishedPayload | ObjectRelationChangedPublishedPayload)[] => {
    if (step.kind === 'capture') {
        return []
    }

    // not a world event any narration channel reads today --- the object-move narrate
    // steps already cover "arrives," and a presence binding's own visibility is future work.
    if (step.kind === 'addPresenceBinding' || step.kind === 'removePresenceBinding') {
        return []
    }

    // same deferral as addPresenceBinding/removePresenceBinding --- a crossing port's own visibility is future work.
    if (step.kind === 'addCrossingPort' || step.kind === 'removeCrossingPort') {
        return []
    }

    if (step.kind === 'transferMembership') {
        const froms = [...step.fromHostIds]
        const diff = { froms, to: step.toHostId, changed: true }
        const entityId = step.entityId
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
    fact.subjectId === edge.subjectId
    && fact.targetId === edge.targetId
    && fact.operation === edge.operation
    && fact.relationKind === edge.relationKind
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
