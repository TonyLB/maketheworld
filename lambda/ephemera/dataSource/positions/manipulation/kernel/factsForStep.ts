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
 */
export const factsForStep = (
    step: KernelStep,
    finalGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraPositionGraph>,
    beatAnchorTime: number
): (ObjectMovedPublishedPayload | ObjectRelationChangedPublishedPayload)[] => {
    if (step.kind === 'transferMembership') {
        return [...step.entityIds]
            .filter(isEphemeraObjectId)
            .map((objectId) =>
                buildObjectMovedFact({
                    objectId,
                    diff: { froms: [step.fromHostId], to: step.toHostId, changed: true },
                    beatAnchorTime,
                })
            )
            .filter((fact): fact is ObjectMovedPublishedPayload => fact !== undefined)
    }

    const hostId = findHostOf(step.subjectId, finalGraphs)
    if (hostId === undefined) {
        throw new Error(`factsForStep: cannot re-derive host for ${step.subjectId} from the final graph map`)
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
