jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentTopology: {
            get: jest.fn(),
            invalidate: jest.fn(),
        },
        AffordanceCache: {
            set: jest.fn(),
            invalidate: jest.fn(),
            getAffordanceRowIncludingStale: jest.fn(),
            queryAffordanceRows: jest.fn(),
        },
    },
}))

jest.mock('./catalogRow')
jest.mock('./hydrateAffordanceTopology')

import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import internalCache from '../../internalCache'
import {
    createAffordanceRowForHydrate,
    getAffordanceRow,
    markAffordanceCatalogHydratedAtVersion,
} from './catalogRow'
import { ensureAffordanceTopology } from './ensureAffordanceTopology'
import { hydrateAffordanceTopologyRow } from './hydrateAffordanceTopology'
import { passThroughSingleFlightAffordanceTopologyHydrate } from './singleFlightAffordanceTopologyHydrate'
import type { AffordanceCacheRow } from './baseClasses'

const getAffordanceRowMock = getAffordanceRow as jest.MockedFunction<typeof getAffordanceRow>
const createAffordanceRowMock = createAffordanceRowForHydrate as jest.MockedFunction<typeof createAffordanceRowForHydrate>
const markHydratedMock = markAffordanceCatalogHydratedAtVersion as jest.MockedFunction<typeof markAffordanceCatalogHydratedAtVersion>
const hydrateRowMock = hydrateAffordanceTopologyRow as jest.MockedFunction<typeof hydrateAffordanceTopologyRow>
const componentTopologyGet = internalCache.ComponentTopology.get as jest.Mock

const roomId = 'ROOM#room' as const
const perspective: Perspective = { assetStack: ['ASSET#a'] }

const affordanceRow = (overrides: Partial<AffordanceCacheRow> = {}): AffordanceCacheRow => ({
    EphemeraId: roomId,
    DataCategory: 'Affordance::PERSPECTIVE#v1#hex',
    assetStack: ['ASSET#a'],
    catalogVersion: 1,
    hydratedCatalogVersion: 1,
    topology: { roomUniversalKey: roomId, exits: [] },
    ...overrides,
})

describe('ensureAffordanceTopology', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        componentTopologyGet.mockResolvedValue({ roomUniversalKey: roomId, exits: [] })
        markHydratedMock.mockResolvedValue(true)
        hydrateRowMock.mockResolvedValue(undefined)
    })

    it('returns without hydrate when catalog is ready', async () => {
        getAffordanceRowMock.mockResolvedValue(affordanceRow())

        await ensureAffordanceTopology(
            { roomId, perspective },
            { runWithSingleFlight: passThroughSingleFlightAffordanceTopologyHydrate }
        )

        expect(hydrateRowMock).not.toHaveBeenCalled()
        expect(componentTopologyGet).not.toHaveBeenCalled()
    })

    it('creates row on first resolve then hydrates when stale', async () => {
        const stale = affordanceRow({ hydratedCatalogVersion: 0 })
        const ready = affordanceRow({ hydratedCatalogVersion: 1, catalogVersion: 1 })
        getAffordanceRowMock
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(stale)
            .mockResolvedValue(ready)
        createAffordanceRowMock.mockResolvedValue(stale)

        await ensureAffordanceTopology(
            { roomId, perspective },
            { runWithSingleFlight: passThroughSingleFlightAffordanceTopologyHydrate }
        )

        expect(createAffordanceRowMock).toHaveBeenCalled()
        expect(hydrateRowMock).toHaveBeenCalled()
        expect(componentTopologyGet).toHaveBeenCalled()
        expect(markHydratedMock).toHaveBeenCalled()
    })
})
