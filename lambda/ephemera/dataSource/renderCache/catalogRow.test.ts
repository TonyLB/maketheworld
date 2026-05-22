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
        },
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'
import {
    conditionalInvalidateCatalogRow,
    createCatalogRowForHydrate,
    getCatalogRow,
    perspectiveKeyFromCatalogDataCategory,
    putCatalogRow,
    queryCatalogRowsForComponent,
} from './catalogRow'
import type { EphemeraCacheCatalogRow } from './baseClasses'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const renderCacheInvalidate = internalCache.RenderCache.invalidate as jest.Mock

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

    it('queryCatalogRowsForComponent filters invalid rows', async () => {
        const valid = catalogRow()
        ;(ephemeraDBMock.query as jest.Mock).mockResolvedValue([valid, { EphemeraId: componentId, DataCategory: 'Cache::' }])

        const result = await queryCatalogRowsForComponent(componentId)

        expect(ephemeraDBMock.query).toHaveBeenCalledWith(
            expect.objectContaining({
                ExpressionAttributeValues: { ':dcPrefix': 'Cache::' },
            })
        )
        expect(result).toEqual([valid])
    })

    it('getCatalogRow returns undefined for invalid shape', async () => {
        ;(ephemeraDBMock.getItem as jest.Mock).mockResolvedValue({ EphemeraId: componentId, DataCategory: 'Cache::x' })

        const result = await getCatalogRow(componentId, 'PERSPECTIVE#v1#x')

        expect(result).toBeUndefined()
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
    })

    it('perspectiveKeyFromCatalogDataCategory parses SK suffix', () => {
        expect(perspectiveKeyFromCatalogDataCategory('Cache::PERSPECTIVE#v1#abc')).toBe('PERSPECTIVE#v1#abc')
        expect(perspectiveKeyFromCatalogDataCategory('CACHE#x')).toBeUndefined()
    })

    it('putCatalogRow writes the row', async () => {
        const row = catalogRow()
        await putCatalogRow(row)
        expect(ephemeraDBMock.putItem).toHaveBeenCalledWith(row)
    })
})
