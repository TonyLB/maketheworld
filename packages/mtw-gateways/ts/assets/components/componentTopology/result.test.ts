import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { emptyProjectedRoomTopology, projectedRoomTopologyFromExitList } from './result'
import { ExitFacetList } from '@tonylb/mtw-wml/ts/standardize/keys/facets/exit'
import { StandardExitFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/exit'

describe('ProjectedRoomTopology helpers', () => {
    const highway = 'ROOM#highway' as EphemeraId

    it('emptyProjectedRoomTopology returns empty exits', () => {
        expect(emptyProjectedRoomTopology(highway)).toEqual({
            roomUniversalKey: highway,
            exits: [],
        })
    })

    it('projectedRoomTopologyFromExitList wraps ExitFacetList JSON', () => {
        const exitList = new ExitFacetList([
            new StandardExitFacet({
                reference: 'ROOM#townCenter',
                payload: 'east',
            }),
        ])
        expect(projectedRoomTopologyFromExitList(highway, exitList)).toEqual({
            roomUniversalKey: highway,
            exits: exitList.toJSON(),
        })
    })
})
