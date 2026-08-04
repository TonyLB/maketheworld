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

    //
    // Two invocations first-resolving the same (component, perspective) concurrently: the loser's
    // create is rejected rather than clobbering the winner's row back to hydratedCatalogVersion 0.
    // The re-read must bypass the memo, which already cached `undefined` from the initial miss.
    //
    it('recovers the winner row when a concurrent create wins the race', async () => {
        const winner = catalogRow()
        getCatalogRowMock
            .mockResolvedValueOnce(undefined)
            .mockResolvedValue(winner)
        createCatalogRowMock.mockRejectedValue(new Error('Catalog row already exists'))

        await ensureAuthoredCatalog(
            { componentId, perspective },
            { runWithSingleFlight: passThroughSingleFlightAuthoredCatalogHydrate }
        )

        expect(internalCache.RenderCache.invalidate).toHaveBeenCalledWith(componentId)
        // Winner was already hydrated, so the loser must not re-hydrate it.
        expect(hydrateDiffMock).not.toHaveBeenCalled()
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

    describe('improvisation merge participation', () => {
        // Same read sequencing as 'hydrates stale catalog without creating a new row': stale on the
        // two pre-hydrate reads, ready on the post-mark readback (otherwise ensure throws INCOMPLETE).
        const stageStaleThenReady = (id: EphemeraCacheCatalogRow['EphemeraId']) => {
            const stale = catalogRow({ EphemeraId: id, catalogVersion: 2, hydratedCatalogVersion: 1 })
            const ready = catalogRow({ EphemeraId: id, catalogVersion: 2, hydratedCatalogVersion: 2 })
            getCatalogRowMock.mockResolvedValueOnce(stale).mockResolvedValueOnce(stale).mockResolvedValue(ready)
        }

        it('appends ASSET#IMPROVISATION to merge participation for an OBJECT# host', async () => {
            // An Object's SITUATION#DEFAULT facet lives on its (OBJECT#, ASSET#IMPROVISATION) pair
            // row; without this layer the merge cannot see it and no CACHE# row is ever written.
            const objectId = 'OBJECT#obj' as const
            stageStaleThenReady(objectId)

            await ensureAuthoredCatalog(
                { componentId: objectId, perspective },
                { runWithSingleFlight: passThroughSingleFlightAuthoredCatalogHydrate }
            )

            expect(componentExamplesGet).toHaveBeenCalledWith(
                expect.objectContaining({
                    hostUniversalKey: objectId,
                    mergeParticipationOrder: ['ASSET#a', 'ASSET#IMPROVISATION'],
                })
            )
        })

        it('appends ASSET#IMPROVISATION to merge participation for a CHARACTER# host', async () => {
            // A guest Character's SITUATION#DEFAULT facet lives on its (CHARACTER#, ASSET#IMPROVISATION)
            // pair row; without this layer the merge cannot see it and no CACHE# row is ever written.
            const characterId = 'CHARACTER#char' as const
            stageStaleThenReady(characterId)

            await ensureAuthoredCatalog(
                { componentId: characterId, perspective },
                { runWithSingleFlight: passThroughSingleFlightAuthoredCatalogHydrate }
            )

            expect(componentExamplesGet).toHaveBeenCalledWith(
                expect.objectContaining({
                    hostUniversalKey: characterId,
                    mergeParticipationOrder: ['ASSET#a', 'ASSET#IMPROVISATION'],
                })
            )
        })

        it('leaves merge participation untouched for a non-improvisation host', async () => {
            stageStaleThenReady(componentId)

            await ensureAuthoredCatalog(
                { componentId, perspective },
                { runWithSingleFlight: passThroughSingleFlightAuthoredCatalogHydrate }
            )

            expect(componentExamplesGet).toHaveBeenCalledWith(
                expect.objectContaining({ mergeParticipationOrder: ['ASSET#a'] })
            )
        })

        it('keeps the catalog row assetStack free of the improvisation layer (merge-only append)', async () => {
            const objectId = 'OBJECT#obj' as const
            stageStaleThenReady(objectId)

            await ensureAuthoredCatalog(
                { componentId: objectId, perspective },
                { runWithSingleFlight: passThroughSingleFlightAuthoredCatalogHydrate }
            )

            expect(hydrateDiffMock).toHaveBeenCalledWith(
                expect.objectContaining({ assetStack: ['ASSET#a'] })
            )
        })
    })
})
