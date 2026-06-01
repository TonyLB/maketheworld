jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentExamples: {
            get: jest.fn(),
            invalidate: jest.fn(),
        },
        RenderCache: {
            invalidate: jest.fn(),
        },
    },
}))

jest.mock('./catalogRow')
jest.mock('./hydrateAuthoredCatalogDiff')

import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import internalCache from '../../internalCache'
import { emptyAuthoredExampleSet } from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import {
    createCatalogRowForHydrate,
    getCatalogRow,
    markCatalogHydratedAtVersion,
} from './catalogRow'
import { ensureAuthoredCatalog } from './ensureAuthoredCatalog'
import { hydrateAuthoredCatalogDiff } from './hydrateAuthoredCatalogDiff'
import { passThroughSingleFlightAuthoredCatalogHydrate } from './singleFlightAuthoredCatalogHydrate'
import type { EphemeraCacheCatalogRow } from './baseClasses'

const getCatalogRowMock = getCatalogRow as jest.MockedFunction<typeof getCatalogRow>
const createCatalogRowMock = createCatalogRowForHydrate as jest.MockedFunction<typeof createCatalogRowForHydrate>
const markHydratedMock = markCatalogHydratedAtVersion as jest.MockedFunction<typeof markCatalogHydratedAtVersion>
const hydrateDiffMock = hydrateAuthoredCatalogDiff as jest.MockedFunction<typeof hydrateAuthoredCatalogDiff>
const componentExamplesGet = internalCache.ComponentExamples.get as jest.Mock

const componentId = 'ROOM#room' as const
const perspective: Perspective = { assetStack: ['ASSET#a'] }

const catalogRow = (overrides: Partial<EphemeraCacheCatalogRow> = {}): EphemeraCacheCatalogRow => ({
    EphemeraId: componentId,
    DataCategory: 'Cache::PERSPECTIVE#v1#hex',
    assetStack: ['ASSET#a'],
    catalogVersion: 1,
    hydratedCatalogVersion: 1,
    ...overrides,
})

describe('ensureAuthoredCatalog', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        componentExamplesGet.mockResolvedValue(emptyAuthoredExampleSet())
        markHydratedMock.mockResolvedValue(true)
        hydrateDiffMock.mockResolvedValue(undefined)
    })

    it('returns without hydrate when catalog is ready', async () => {
        getCatalogRowMock.mockResolvedValue(catalogRow())

        await ensureAuthoredCatalog(
            { componentId, perspective },
            { runWithSingleFlight: passThroughSingleFlightAuthoredCatalogHydrate }
        )

        expect(hydrateDiffMock).not.toHaveBeenCalled()
        expect(componentExamplesGet).not.toHaveBeenCalled()
    })

    it('creates catalog on first resolve then hydrates when stale', async () => {
        const stale = catalogRow({ hydratedCatalogVersion: 0 })
        const ready = catalogRow({ hydratedCatalogVersion: 1, catalogVersion: 1 })
        getCatalogRowMock
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(stale)
            .mockResolvedValue(ready)
        createCatalogRowMock.mockResolvedValue(stale)

        await ensureAuthoredCatalog(
            { componentId, perspective },
            { runWithSingleFlight: passThroughSingleFlightAuthoredCatalogHydrate }
        )

        expect(createCatalogRowMock).toHaveBeenCalled()
        expect(hydrateDiffMock).toHaveBeenCalled()
        expect(markHydratedMock).toHaveBeenCalledWith(
            componentId,
            expect.any(String),
            stale.catalogVersion
        )
    })

    it('hydrates stale catalog without creating a new row', async () => {
        const stale = catalogRow({ catalogVersion: 2, hydratedCatalogVersion: 1 })
        const ready = catalogRow({ catalogVersion: 2, hydratedCatalogVersion: 2 })
        getCatalogRowMock.mockResolvedValueOnce(stale).mockResolvedValueOnce(stale).mockResolvedValue(ready)

        await ensureAuthoredCatalog(
            { componentId, perspective },
            { runWithSingleFlight: passThroughSingleFlightAuthoredCatalogHydrate }
        )

        expect(createCatalogRowMock).not.toHaveBeenCalled()
        expect(hydrateDiffMock).toHaveBeenCalledWith(
            expect.objectContaining({ incomingCatalogVersion: 2 })
        )
    })
})
