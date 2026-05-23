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
            getCacheRows: jest.fn(),
            deleteCacheRecords: jest.fn(),
        },
    },
}))

jest.mock('./catalogRow')
jest.mock('./putCacheRecord')
jest.mock('./deleteCacheRecord')
jest.mock('./queryCacheRecordsForComponent')
jest.mock('./situationAdjacency', () => ({
    upsertAdjacencyForAuthoredSlice: jest.fn().mockResolvedValue(undefined),
    deleteAdjacencyForRemovedSlice: jest.fn().mockResolvedValue(undefined),
}))

import { authoredExampleSetFromEntries } from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import type { AuthoredExample } from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import { computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'
import { RenderCacheData } from '../../internalCache/renderCache'
import type { EphemeraCacheCatalogRow, EphemeraCacheDynamoItem } from './baseClasses'
import {
    createCatalogRowForHydrate,
    getCatalogRow,
    markCatalogHydratedAtVersion,
} from './catalogRow'
import { ensureAuthoredCatalog } from './ensureAuthoredCatalog'
import { putCacheRecord } from './putCacheRecord'
import { queryCacheRecordsForComponent } from './queryCacheRecordsForComponent'
import { passThroughSingleFlightAuthoredCatalogHydrate } from './singleFlightAuthoredCatalogHydrate'

const getCatalogRowMock = getCatalogRow as jest.MockedFunction<typeof getCatalogRow>
const createCatalogRowMock = createCatalogRowForHydrate as jest.MockedFunction<typeof createCatalogRowForHydrate>
const markHydratedMock = markCatalogHydratedAtVersion as jest.MockedFunction<typeof markCatalogHydratedAtVersion>
const putCacheRecordMock = putCacheRecord as jest.MockedFunction<typeof putCacheRecord>
const queryCacheMock = queryCacheRecordsForComponent as jest.MockedFunction<typeof queryCacheRecordsForComponent>
const componentExamplesGet = internalCache.ComponentExamples.get as jest.Mock

const componentId = 'ROOM#room' as const
const perspective: Perspective = { assetStack: ['ASSET#a'] }
const perspectiveKey = computePerspectiveKey(perspective.assetStack)

const markState = { markValue: [{ mark: 'MARK#m', value: 'hydrated' }] }

const authoredExample: AuthoredExample = {
    situationId: 'SITUATION#one',
    markState,
    renderedContent: { description: [] },
    provenance: { type: 'authored' },
}

let catalogState: EphemeraCacheCatalogRow | undefined
let cacheRows: EphemeraCacheDynamoItem[] = []

describe('authored catalog hydrate then exact match', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        catalogState = undefined
        cacheRows = []

        getCatalogRowMock.mockImplementation(async () => catalogState)
        createCatalogRowMock.mockImplementation(async (params) => {
            catalogState = {
                EphemeraId: params.componentId,
                DataCategory: `Cache::${params.perspectiveKey}`,
                assetStack: [...params.assetStack],
                catalogVersion: 1,
                hydratedCatalogVersion: 0,
            }
            return catalogState
        })
        markHydratedMock.mockImplementation(async (_componentId, _perspectiveKey, version) => {
            if (catalogState !== undefined && catalogState.catalogVersion === version) {
                catalogState = { ...catalogState, hydratedCatalogVersion: version }
            }
            return true
        })
        putCacheRecordMock.mockImplementation(async (id, record, existingDataCategory) => {
            const dataCategory = existingDataCategory ?? `CACHE#written-${cacheRows.length}`
            const item: EphemeraCacheDynamoItem = {
                EphemeraId: id,
                DataCategory: dataCategory,
                markState: record.markState,
                renderedContent: record.renderedContent,
                provenance: record.provenance,
                perspectiveId: record.perspectiveId,
                perspectiveMatcher: record.perspectiveMatcher,
                situationId: record.situationId,
                catalogVersion: record.catalogVersion,
            }
            const index = cacheRows.findIndex((r) => r.DataCategory === dataCategory)
            if (index >= 0) {
                cacheRows[index] = item
            } else {
                cacheRows.push(item)
            }
            return dataCategory
        })
        queryCacheMock.mockImplementation(async () => [...cacheRows])
        ;(internalCache.RenderCache.getCacheRows as jest.Mock).mockImplementation(async () => [...cacheRows])
        componentExamplesGet.mockResolvedValue(
            authoredExampleSetFromEntries([['SITUATION#one', authoredExample]])
        )
    })

    it('materializes versioned rows then getExactMatch hits current epoch only', async () => {
        catalogState = {
            EphemeraId: componentId,
            DataCategory: `Cache::${perspectiveKey}`,
            assetStack: ['ASSET#a'],
            catalogVersion: 2,
            hydratedCatalogVersion: 1,
        }

        await ensureAuthoredCatalog(
            { componentId, perspective },
            { runWithSingleFlight: passThroughSingleFlightAuthoredCatalogHydrate }
        )

        expect(catalogState?.hydratedCatalogVersion).toBe(2)
        expect(catalogState?.catalogVersion).toBe(2)
        const currentRow = cacheRows.find((r) => r.catalogVersion === 2)
        expect(currentRow).toBeDefined()

        cacheRows.push({
            EphemeraId: componentId,
            DataCategory: 'CACHE#orphanEpoch',
            markState,
            renderedContent: { description: [] },
            provenance: { type: 'authored' },
            perspectiveId: perspectiveKey,
            perspectiveMatcher: { requiredAssetIds: ['ASSET#a'], forbiddenAssetIds: [] },
            situationId: 'SITUATION#one',
            catalogVersion: 1,
        })

        ;(ephemeraDB.query as jest.Mock).mockResolvedValue(cacheRows)
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue(catalogState)
        const cache = new RenderCacheData()
        const hit = await cache.getExactMatch({
            componentId,
            proposedMarkState: markState,
            perspective,
        })

        expect(hit?.catalogVersion).toBe(2)
        expect(hit?.DataCategory).toBe(currentRow?.DataCategory)
        expect(hit?.DataCategory).not.toBe('CACHE#orphanEpoch')
    })
})
