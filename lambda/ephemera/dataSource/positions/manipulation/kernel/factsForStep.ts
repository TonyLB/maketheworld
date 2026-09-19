import { relationKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { buildObjectMovedFact } from '../membership/buildObjectMovedFact'
import { buildCharacterMovedFact } from '../membership/buildCharacterMovedFact'
import { buildRelationalFact } from '../relational/buildObjectRelationalFact'
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
 * carry's steps --- `[dissolveRelation*, transferMembership]` --- stream their dissolve facts before
 * the moved fact.
 *
 * Character-kind fact emission (folded in for the character-route Migrate row, BD-36): the character
 * subset of a `transferMembership`'s `entityIds` produces a `Character Moved` fact here too, via
 * `characterNames` (a caller-supplied lookup --- this function stays synchronous, so the name must
 * already be resolved, not fetched here). Folding this in (rather than layering it on top, in the
 * caller, after `commitStepSequence` returns) is what keeps `Character Moved` streaming before the
 * kernel's own `RoomUpdate` publish loop, mirroring `Object Moved`'s existing ordering guarantee ---
 * `orchestrateCharacterRoomMembership.ts`'s test suite asserts this ordering, and only folding the fact in
 * here (rather than leaving it to run after the kernel call returns) can preserve it.
 *
 * One combined `Object Moved`/`Character Moved` fact per entity, with `froms: [...fromHostIds]`/
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
        const objectFacts = [...step.entityIds]
            .filter(isEphemeraObjectId)
            .map((objectId) => buildObjectMovedFact({ objectId, diff, beatAnchorTime }))
            .filter((fact): fact is ObjectMovedPublishedPayload => fact !== undefined)
        const characterFacts = [...step.entityIds]
            .filter(isEphemeraCharacterId)
            .map((characterId) =>
                buildCharacterMovedFact({
                    characterId,
                    diff,
                    beatAnchorTime,
                    characterName: characterNames.get(characterId),
                })
            )
            .filter((fact): fact is CharacterMovedPublishedPayload => fact !== undefined)
        return [...objectFacts, ...characterFacts]
    }

    // a crossing leg's port-address endpoint has no established fact shape yet --- same
    // "not a narration channel yet" deferral `addPresenceBinding`/`removePresenceBinding` already use above.
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
