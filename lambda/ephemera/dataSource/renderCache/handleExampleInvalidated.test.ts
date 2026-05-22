jest.mock('./catalogRow', () => ({
    conditionalInvalidateCatalogRow: jest.fn(),
    getCatalogRow: jest.fn(),
    queryCatalogRowsForComponent: jest.fn(),
}))

jest.mock('./situationAdjacency', () => ({
    deleteAllAdjacencyLinksForSituation: jest.fn(),
    queryAdjacencyLinksForSituation: jest.fn(),
}))

import {
    conditionalInvalidateCatalogRow,
    getCatalogRow,
    queryCatalogRowsForComponent,
} from './catalogRow'
import {
    deleteAllAdjacencyLinksForSituation,
    queryAdjacencyLinksForSituation,
} from './situationAdjacency'
import { handleExampleInvalidated } from './handleExampleInvalidated'
import type { EphemeraCacheCatalogRow, SituationCacheAdjacencyRow } from './baseClasses'

const mockConditionalInvalidate = conditionalInvalidateCatalogRow as jest.Mock
const mockQueryCatalog = queryCatalogRowsForComponent as jest.Mock
const mockGetCatalog = getCatalogRow as jest.Mock
const mockQueryAdjacency = queryAdjacencyLinksForSituation as jest.Mock
const mockDeleteAllAdjacency = deleteAllAdjacencyLinksForSituation as jest.Mock

const catalogRow = (overrides: Partial<EphemeraCacheCatalogRow> = {}): EphemeraCacheCatalogRow => ({
    EphemeraId: 'ROOM#hall',
    DataCategory: 'Cache::PERSPECTIVE#v1#abc',
    assetStack: ['ASSET#canon', 'ASSET#overlay'],
    catalogVersion: 1,
    hydratedCatalogVersion: 1,
    ...overrides,
})

const adjacencyLink = (host: string, stack: string[]): SituationCacheAdjacencyRow => ({
    EphemeraId: 'SITUATION#sit-1',
    DataCategory: `Link::${host}::Cache::PERSPECTIVE#v1#abc`,
    assetStack: stack as SituationCacheAdjacencyRow['assetStack'],
})

describe('handleExampleInvalidated', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockConditionalInvalidate.mockResolvedValue(undefined)
        mockGetCatalog.mockResolvedValue(undefined)
        mockDeleteAllAdjacency.mockResolvedValue(undefined)
    })

    it('component-scoped: bumps only rows whose assetStack includes editAssetId', async () => {
        const match = catalogRow({ assetStack: ['ASSET#canon', 'ASSET#overlay'] })
        const noMatch = catalogRow({
            DataCategory: 'Cache::PERSPECTIVE#v1#solo',
            assetStack: ['ASSET#canon'],
        })
        mockQueryCatalog.mockResolvedValue([match, noMatch])

        await handleExampleInvalidated({
            type: 'ExampleInvalidated',
            componentIds: ['ROOM#hall'],
            editAssetId: 'ASSET#overlay',
        })

        expect(mockConditionalInvalidate).toHaveBeenCalledTimes(1)
        expect(mockConditionalInvalidate).toHaveBeenCalledWith(match)
    })

    it('situation-scoped: fans out to host catalog rows with layer filter', async () => {
        mockQueryAdjacency.mockResolvedValue([
            adjacencyLink('ROOM#hall', ['ASSET#canon', 'ASSET#overlay']),
            adjacencyLink('ROOM#other', ['ASSET#canon']),
        ])
        mockGetCatalog.mockResolvedValue(catalogRow())

        await handleExampleInvalidated({
            type: 'ExampleInvalidated',
            situationId: 'SITUATION#sit-1',
            editAssetId: 'ASSET#overlay',
        })

        expect(mockGetCatalog).toHaveBeenCalledTimes(1)
        expect(mockGetCatalog).toHaveBeenCalledWith('ROOM#hall', 'PERSPECTIVE#v1#abc')
        expect(mockConditionalInvalidate).toHaveBeenCalledTimes(1)
        expect(mockDeleteAllAdjacency).not.toHaveBeenCalled()
    })

    it('situation-scoped: no-op when adjacency partition is empty', async () => {
        mockQueryAdjacency.mockResolvedValue([])

        await handleExampleInvalidated({
            type: 'ExampleInvalidated',
            situationId: 'SITUATION#sit-1',
            editAssetId: 'ASSET#overlay',
        })

        expect(mockConditionalInvalidate).not.toHaveBeenCalled()
    })

    it('situation-scoped entityRemoved: bumps all links and deletes partition', async () => {
        mockQueryAdjacency.mockResolvedValue([
            adjacencyLink('ROOM#hall', ['ASSET#canon']),
            adjacencyLink('ROOM#other', ['ASSET#other']),
        ])
        mockGetCatalog.mockResolvedValue(catalogRow())

        await handleExampleInvalidated({
            type: 'ExampleInvalidated',
            situationId: 'SITUATION#sit-1',
            editAssetId: 'ASSET#overlay',
            entityRemoved: true,
        })

        expect(mockConditionalInvalidate).toHaveBeenCalledTimes(2)
        expect(mockDeleteAllAdjacency).toHaveBeenCalledWith('SITUATION#sit-1')
    })
})
