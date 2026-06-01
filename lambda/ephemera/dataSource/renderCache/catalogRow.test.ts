jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        query: jest.fn(),
        getItem: jest.fn(),
        putItem: jest.fn(),
        optimisticUpdate: jest.fn(),
    },
}))

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        RenderCache: {
            invalidate: jest.fn(),
            setCatalogRow: jest.fn(),
            getCatalogRows: jest.fn(),
            getCatalogRow: jest.fn(),
        },
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'
import {
    conditionalInvalidateCatalogRow,
    createCatalogRowForHydrate,
    getCatalogRow,
    markCatalogHydratedAtVersion,
    perspectiveKeyFromCatalogDataCategory,
    putCatalogRow,
    queryCatalogRowsForComponent,
} from './catalogRow'
import type { EphemeraCacheCatalogRow } from './baseClasses'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const renderCacheInvalidate = internalCache.RenderCache.invalidate as jest.Mock
const renderCacheSetCatalogRow = internalCache.RenderCache.setCatalogRow as jest.Mock
const renderCacheGetCatalogRows = internalCache.RenderCache.getCatalogRows as jest.Mock
const renderCacheGetCatalogRow = internalCache.RenderCache.getCatalogRow as jest.Mock

const componentId = 'ROOM#test-room' as const

const catalogRow = (overrides: Partial<EphemeraCacheCatalogRow> = {}): EphemeraCacheCatalogRow => ({
    EphemeraId: componentId,
    DataCategory: 'Cache::PERSPECTIVE#v1#abc',
    assetStack: ['ASSET#canon', 'ASSET#overlay'],
    catalogVersion: 2,
    hydratedCatalogVersion: 2,
    currentCacheId: 'CACHE#ptr',
    ...overrides,
})

describe('catalogRow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ephemeraDBMock.optimisticUpdate.mockResolvedValue(undefined)
        ephemeraDBMock.putItem.mockResolvedValue(undefined)
    })

    it('queryCatalogRowsForComponent delegates to internalCache.RenderCache', async () => {
        const valid = catalogRow()
        renderCacheGetCatalogRows.mockResolvedValue([valid])

        const result = await queryCatalogRowsForComponent(componentId)

        expect(renderCacheGetCatalogRows).toHaveBeenCalledWith(componentId)
        expect(result).toEqual([valid])
    })

    it('getCatalogRow delegates to internalCache.RenderCache', async () => {
        const valid = catalogRow()
        renderCacheGetCatalogRow.mockResolvedValue(valid)

        const result = await getCatalogRow(componentId, 'PERSPECTIVE#v1#abc')

        expect(renderCacheGetCatalogRow).toHaveBeenCalledWith(componentId, 'PERSPECTIVE#v1#abc')
        expect(result).toEqual(valid)
    })

    it('conditionalInvalidateCatalogRow bumps when ready and clears pointer', async () => {
        const row = catalogRow()
        await conditionalInvalidateCatalogRow(row)

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        const { updateReducer } = (ephemeraDBMock.optimisticUpdate as jest.Mock).mock.calls[0][0]
        const draft = { ...row }
        updateReducer(draft)
        expect(draft.catalogVersion).toBe(3)
        expect(draft.currentCacheId).toBeUndefined()
        expect(renderCacheInvalidate).toHaveBeenCalledWith(componentId)
    })

    it('conditionalInvalidateCatalogRow does not bump when already stale', async () => {
        const row = catalogRow({ hydratedCatalogVersion: 1, catalogVersion: 2, currentCacheId: 'CACHE#ptr' })
        await conditionalInvalidateCatalogRow(row)

        const { updateReducer } = (ephemeraDBMock.optimisticUpdate as jest.Mock).mock.calls[0][0]
        const draft = { ...row }
        updateReducer(draft)
        expect(draft.catalogVersion).toBe(2)
        expect(draft.currentCacheId).toBeUndefined()
    })

    it('createCatalogRowForHydrate writes initial catalog row', async () => {
        const created = await createCatalogRowForHydrate({
            componentId,
            perspectiveKey: 'PERSPECTIVE#v1#new',
            assetStack: ['ASSET#a'],
        })

        expect(created.catalogVersion).toBe(1)
        expect(created.hydratedCatalogVersion).toBe(0)
        expect(ephemeraDBMock.putItem).toHaveBeenCalledWith(created)
        expect(renderCacheSetCatalogRow).toHaveBeenCalledWith({ row: created })
        expect(renderCacheInvalidate).not.toHaveBeenCalled()
    })

    it('perspectiveKeyFromCatalogDataCategory parses SK suffix', () => {
        expect(perspectiveKeyFromCatalogDataCategory('Cache::PERSPECTIVE#v1#abc')).toBe('PERSPECTIVE#v1#abc')
        expect(perspectiveKeyFromCatalogDataCategory('CACHE#x')).toBeUndefined()
    })

    it('putCatalogRow writes the row', async () => {
        const row = catalogRow()
        await putCatalogRow(row)
        expect(ephemeraDBMock.putItem).toHaveBeenCalledWith(row)
        expect(renderCacheSetCatalogRow).toHaveBeenCalledWith({ row })
    })

    it('markCatalogHydratedAtVersion writes when catalogVersion unchanged', async () => {
        const row = catalogRow({ catalogVersion: 2, hydratedCatalogVersion: 0 })
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer, successCallback }) => {
            const draft = { ...row }
            updateReducer(draft)
            await successCallback?.(draft, row)
            return draft
        })

        const wrote = await markCatalogHydratedAtVersion(componentId, 'PERSPECTIVE#v1#abc', 2)

        expect(wrote).toBe(true)
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ checkKeys: ['catalogVersion'] })
        )
        expect(renderCacheInvalidate).toHaveBeenCalledWith(componentId)
    })

    it('markCatalogHydratedAtVersion returns false when catalog bumped mid-hydrate', async () => {
        const row = catalogRow({ catalogVersion: 3, hydratedCatalogVersion: 0 })
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer, successCallback }) => {
            const prior = { ...row }
            const draft = { ...row }
            updateReducer(draft)
            if (draft.hydratedCatalogVersion !== prior.hydratedCatalogVersion) {
                await successCallback?.(draft, prior)
            }
            return row
        })

        const wrote = await markCatalogHydratedAtVersion(componentId, 'PERSPECTIVE#v1#abc', 2)

        expect(wrote).toBe(false)
        expect(renderCacheInvalidate).not.toHaveBeenCalled()
    })
})
