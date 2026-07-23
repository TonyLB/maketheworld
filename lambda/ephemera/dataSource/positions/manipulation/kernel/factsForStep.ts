import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraPositionGraph } from '../../positionGraph'
import { buildObjectMovedFact } from '../../membership/buildObjectMovedFact'
import { buildObjectRelationalFact } from '../relational/buildObjectRelationalFact'
import type { ObjectMovedPublishedPayload, ObjectRelationChangedPublishedPayload } from '../../publishedEvents'
import type { KernelStep } from './kernelStep'

const findHostOf = (
    objectId: EphemeraObjectId,
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraPositionGraph>
): EphemeraMembershipHostId | undefined => {
    for (const [hostId, graph] of graphs) {
        if (graph.objectIds.has(objectId)) {
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
 * Scope boundary (named, not silently dropped): only the object subset of a `transferMembership`'s
 * `entityIds` produces a fact here this slice. Character movement's own fact
 * (`buildCharacterMovedFact`) stays owned by `applyCharacterRoomMembership.ts` until its migrate row
 * decides whether to fold into this mapping or stay layered on top --- BD-36 generalizes kernel
 * *dispatch*, not fact-emission, for the character branch.
 *
 * One combined `Object Moved` fact per object, with `froms: [...fromHostIds]`/`to: toHostId` ---
 * matching `buildObjectMovedFact`'s existing multi-`froms`/nullable-`to` diff shape --- rather than
 * one fact per host, so the object-lifecycle routes' widened (plural-`froms`, nullable-`to`) steps
 * keep the same single-fact-per-object behavior their non-kernel predecessors already had.
 *
 * `priorGraphs` (object-lifecycle Migrate row): a `dissolveRelation` step's endpoint can be entirely
 * removed from the footprint by a later pure-remove `transferMembership` step in the same sequence
 * (destroy), leaving it absent from `finalGraphs` altogether. Falls back to the pre-apply snapshot to
 * re-derive the host it actually held the edge on, right before removal, rather than throwing ---
 * defaults to `finalGraphs` itself so every other caller (a real transfer, where the object always
 * lands on some footprint graph) is unaffected.
 */
export const factsForStep = (
    step: KernelStep,
    finalGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraPositionGraph>,
    beatAnchorTime: number,
    priorGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraPositionGraph> = finalGraphs
): (ObjectMovedPublishedPayload | ObjectRelationChangedPublishedPayload)[] => {
    if (step.kind === 'transferMembership') {
        const froms = [...step.fromHostIds]
        return [...step.entityIds]
            .filter(isEphemeraObjectId)
            .map((objectId) =>
                buildObjectMovedFact({
                    objectId,
                    diff: { froms, to: step.toHostId, changed: true },
                    beatAnchorTime,
                })
            )
            .filter((fact): fact is ObjectMovedPublishedPayload => fact !== undefined)
    }

    const hostId = findHostOf(step.subjectId, finalGraphs) ?? findHostOf(step.subjectId, priorGraphs)
    if (hostId === undefined) {
        throw new Error(`factsForStep: cannot re-derive host for ${step.subjectId} from the final or prior graph map`)
    }
    return [
        buildObjectRelationalFact({
            subjectId: step.subjectId,
            targetId: step.targetId,
            hostId,
            relationKind: step.relationKind,
            relationLabel: step.relationLabel,
            operation: step.kind === 'establishRelation' ? 'establish' : 'dissolve',
            beatAnchorTime,
        }),
    ]
}
