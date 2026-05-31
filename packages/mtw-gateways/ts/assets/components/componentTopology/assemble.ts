import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { projectRoomExits } from '@tonylb/mtw-wml/ts/standardize/projection/projectRoomExits'

import { aggregatePerspectiveExplicit, type AggregatePerspective } from '../aggregate/input'

import {
    validateAssembleRoomTopologyInput,
    type AssembleRoomTopologyInput,
} from './input'
import type { ComponentTopologyAggregatePort } from './ports'
import { filterAreaEdgeReferrers } from './referrers'
import {
    emptyProjectedRoomTopology,
    projectedRoomTopologyFromExitList,
    type ProjectedRoomTopology,
} from './result'

export type AssembleRoomTopologyAtPerspectiveArgs = {
    input: AssembleRoomTopologyInput;
    aggregate: ComponentTopologyAggregatePort;
}

/**
 * Batch assembly of projected room exits at one participation order (D12, D14, D31).
 * Room inverse lookup uses referencedByUnion from the first aggregate batch only.
 */
export async function assembleRoomTopologyAtPerspective(
    args: AssembleRoomTopologyAtPerspectiveArgs
): Promise<ProjectedRoomTopology> {
    const { input, aggregate } = args
    const validated = validateAssembleRoomTopologyInput(input)
    const { roomUniversalKey, mergeParticipationOrder } = validated

    const roomPerspective = aggregatePerspectiveExplicit({
        universalKey: roomUniversalKey,
        mergeParticipationOrder,
    })

    const [roomResult] = await aggregate.get([roomPerspective])
    if (!roomResult) {
        return emptyProjectedRoomTopology(roomUniversalKey)
    }

    const areaReferrerIds = filterAreaEdgeReferrers(roomResult.referencedByUnion)
    if (areaReferrerIds.length === 0) {
        return emptyProjectedRoomTopology(roomUniversalKey)
    }

    const areaPerspectives: AggregatePerspective[] = areaReferrerIds.map((universalKey) =>
        Object.freeze({
            universalKey: universalKey as EphemeraId,
            mergeParticipationOrder,
        })
    )
    const areaResults = await aggregate.get(areaPerspectives)

    const mergedAreas = areaResults
        .map((result) => result.merged)
        .filter((component): component is StandardArea => component instanceof StandardArea)

    const exitList = projectRoomExits(roomUniversalKey as ComponentUUID, mergedAreas)
    return projectedRoomTopologyFromExitList(roomUniversalKey, exitList)
}
