import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ExitPayload } from '@tonylb/mtw-wml/ts/standardize/keys/facets/dataTypes/facet'
import type { FacetListData } from '@tonylb/mtw-wml/ts/standardize/keys/abstract'
import type { ExitFacetList } from '@tonylb/mtw-wml/ts/standardize/keys/facets/exit'

/**
 * Projected room exit topology at one participation order (ephemeraWire exits shape).
 */
export type ProjectedRoomTopology = {
    roomUniversalKey: EphemeraId;
    exits: FacetListData<ExitPayload>;
}

export function emptyProjectedRoomTopology(roomUniversalKey: EphemeraId): ProjectedRoomTopology {
    return {
        roomUniversalKey,
        exits: [],
    }
}

export function projectedRoomTopologyFromExitList(
    roomUniversalKey: EphemeraId,
    exitList: ExitFacetList
): ProjectedRoomTopology {
    return {
        roomUniversalKey,
        exits: exitList.toJSON(),
    }
}
