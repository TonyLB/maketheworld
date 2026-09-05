import type { EphemeraFeatureId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraFeatureId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'

import internalCache from '../../../../internalCache'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { streamEventFromMessageBus } from '../../publishedEvents'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { MutationKernelStep } from '../kernel/kernelStep'
import { containmentPopulationSteps } from './containmentPopulationSteps'

/**
 * The shape a `ludicGraph.nodes` entry carries regardless of which of `StandardReference`'s two
 * serialized forms it took (`ComponentUUID` string, or `{key, universalKey, tag}` object) --- both
 * already carry the fully-prefixed `EphemeraId` (`ROOM#...`/`FEATURE#...`) in `universalKey`, so no
 * separate tag-to-prefix resolution step is needed here.
 */
export type ContainmentChildReference = { universalKey?: string } | string

export type PopulateContainmentAtCacheDependencies = {
    messageBus: MessageBus
    /** Test seam only --- production callers always derive this from `messageBus`. */
    streamEvent?: StreamEventFunction<PositionsPublishedPayload>
}

const universalKeyOf = (reference: ContainmentChildReference): string | undefined =>
    typeof reference === 'string' ? reference : reference.universalKey

/**
 * RD-4 (`AGENT.presenceRefactor.planning.md` step 3): the orchestrator half of cache-time
 * containment population. Reads current state (never assumed) so a `cacheAsset` rerun over
 * already-cached, unchanged state costs nothing beyond the reads --- see
 * `containmentPopulationSteps.ts`'s doc comment for why neither `transferMembership`'s pure-add
 * branch nor `addPresencePort` is safe to replay unconditionally.
 *
 * One `commitStepSequence` call for every child named in one parent update, not one call per
 * child --- a separate commit per child would open a window where some children of the same
 * `cacheAsset` pass are populated and others are not, on a write PR-7 already flagged should be
 * atomic (`AGENT.presence.planning.md`'s PR-7: "a wrong write that produces a plausible state").
 * `commitStepSequence` already no-ops on an empty `steps` array, so a parent update whose every
 * child is already fully populated makes no transaction at all.
 */
export const populateContainmentAtCache = async (
    parentId: EphemeraMembershipHostId,
    childReferences: readonly ContainmentChildReference[],
    deps: PopulateContainmentAtCacheDependencies
): Promise<void> => {
    const childIds = childReferences
        .map(universalKeyOf)
        .filter((key): key is EphemeraRoomId | EphemeraFeatureId =>
            typeof key === 'string' && (isEphemeraRoomId(key) || isEphemeraFeatureId(key))
        )

    if (childIds.length === 0) {
        return
    }

    const parentGraph = await internalCache.Positions.getLudicGraph(parentId)
    const stepsByChild = await Promise.all(
        childIds.map(async (childId) => {
            const childGraph = await internalCache.Positions.getLudicGraph(childId)
            return containmentPopulationSteps(parentId, childId, parentGraph, childGraph)
        })
    )
    const steps: MutationKernelStep[] = stepsByChild.flat()

    if (steps.length === 0) {
        return
    }

    const streamEvent = deps.streamEvent ?? streamEventFromMessageBus(deps.messageBus)
    const result = await commitStepSequence(
        { steps },
        {
            messageBus: deps.messageBus,
            streamEvent,
            // Every subject/target this batch's establishRelation steps names resolves to the
            // same lock target, `parentId` --- mirrors `applyObjectRelationalChange`'s own
            // same-host convention. `transferMembership`/`addPresencePort` steps don't consult
            // this resolver at all (their hosts are already explicit fields).
            getCurrentHost: () => parentId,
        }
    )

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] populateContainmentAtCache failed for ${parentId}: ${result.errorMessage}`)
    }
}
