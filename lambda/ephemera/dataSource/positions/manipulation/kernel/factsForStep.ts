import { relationKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { buildObjectMovedFact } from '../../membership/buildObjectMovedFact'
import { buildCharacterMovedFact } from '../../membership/buildCharacterMovedFact'
import { buildRelationalFact } from '../relational/buildObjectRelationalFact'
import type {
    CharacterMovedPublishedPayload,
    ObjectMovedPublishedPayload,
    ObjectRelationChangedPublishedPayload,
} from '../../publishedEvents'
import type { MutationKernelStep } from './kernelStep'

// LP4g: widened from EphemeraObjectId/graph.objectIds to the full terminal-kind set,
// via the kind-indifferent nodeIds getter LP4 built for exactly this purpose.
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
 * subset) and maps each to zero-or-more facts. Streaming in step order is what actually delivers
 * BD-28's original goal --- a carry's steps are `[dissolveRelation*, transferMembership]`, so
 * dissolve facts stream before the moved fact, genuinely new behavior (today's implicit
 * `removeObject`-stripping path never streams a fact for a carry-severed relation at all).
 *
 * Character-kind fact emission (folded in for the character-route Migrate row, BD-36): the character
 * subset of a `transferMembership`'s `entityIds` produces a `Character Moved` fact here too, via
 * `characterNames` (a caller-supplied lookup --- this function stays synchronous, so the name must
 * already be resolved, not fetched here). Folding this in (rather than layering it on top, in the
 * caller, after `commitStepSequence` returns) is what keeps `Character Moved` streaming before the
 * kernel's own `RoomUpdate` publish loop, mirroring `Object Moved`'s existing ordering guarantee ---
 * `applyCharacterRoomMembership.ts`'s test suite asserts this ordering, and only folding the fact in
 * here (rather than leaving it to run after the kernel call returns) can preserve it.
 *
 * One combined `Object Moved`/`Character Moved` fact per entity, with `froms: [...fromHostIds]`/
 * `to: toHostId` --- matching `buildObjectMovedFact`/`buildCharacterMovedFact`'s existing multi-`froms`/
 * nullable-`to` diff shape --- rather than one fact per host, so the object-lifecycle routes' widened
 * (plural-`froms`, nullable-`to`) steps keep the same single-fact-per-entity behavior their non-kernel
 * predecessors already had.
 *
 * `priorGraphs` (object-lifecycle Migrate row): a `dissolveRelation` step's endpoint can be entirely
 * removed from the footprint by a later pure-remove `transferMembership` step in the same sequence
 * (destroy), leaving it absent from `finalGraphs` altogether. Falls back to the pre-apply snapshot to
 * re-derive the host it actually held the edge on, right before removal, rather than throwing ---
 * defaults to `finalGraphs` itself so every other caller (a real transfer, where the object always
 * lands on some footprint graph) is unaffected.
 *
 * `capture` (PB-J) yields no facts --- it is not a world event, just a read of one already reflected
 * (or not yet reflected) by whatever mutation facts stream around it.
 */
export const factsForStep = (
    step: MutationKernelStep,
    finalGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    beatAnchorTime: number,
    priorGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph> = finalGraphs,
    characterNames: ReadonlyMap<EphemeraCharacterId, string> = new Map(),
    narratedInline?: boolean
): (ObjectMovedPublishedPayload | CharacterMovedPublishedPayload | ObjectRelationChangedPublishedPayload)[] => {
    if (step.kind === 'capture') {
        return []
    }

    if (step.kind === 'transferMembership') {
        const froms = [...step.fromHostIds]
        const diff = { froms, to: step.toHostId, changed: true }
        const objectFacts = [...step.entityIds]
            .filter(isEphemeraObjectId)
            .map((objectId) => buildObjectMovedFact({ objectId, diff, beatAnchorTime }))
            .filter((fact): fact is ObjectMovedPublishedPayload => fact !== undefined)
        // A character's membership hosts are always rooms (never a character-inventory host, unlike
        // an object) --- filtering here narrows the widened `EphemeraMembershipHostId` shape back to
        // `CharacterMovedPublishedPayload`'s room-only `froms`/`to`, rather than widening that payload
        // type to match a case that can't occur.
        const roomDiff = {
            froms: froms.filter(isEphemeraRoomId),
            to: step.toHostId !== null && isEphemeraRoomId(step.toHostId) ? step.toHostId : null,
            changed: true,
        }
        const characterFacts = [...step.entityIds]
            .filter(isEphemeraCharacterId)
            .map((characterId) =>
                buildCharacterMovedFact({
                    characterId,
                    diff: roomDiff,
                    beatAnchorTime,
                    characterName: characterNames.get(characterId),
                    ...(narratedInline !== undefined ? { narratedInline } : {}),
                })
            )
            .filter((fact): fact is CharacterMovedPublishedPayload => fact !== undefined)
        return [...objectFacts, ...characterFacts]
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
