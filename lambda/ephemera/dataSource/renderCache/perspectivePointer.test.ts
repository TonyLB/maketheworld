jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        getItem: jest.fn(),
        optimisticUpdate: jest.fn(),
    },
}))

jest.mock('./catalogRow', () => ({
    getCatalogRow: jest.fn(),
    queryCatalogRowsForComponent: jest.fn(),
    perspectiveKeyFromCatalogDataCategory: jest.requireActual('./catalogRow').perspectiveKeyFromCatalogDataCategory,
}))

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {},
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { getCatalogRow, queryCatalogRowsForComponent } from './catalogRow'
import {
    clearPerspectivePointer,
    collectPerspectivePointerEntries,
    resolvePerspectivePointer,
} from './perspectivePointer'
import type { EphemeraCacheCatalogRow } from './baseClasses'

const mockGetCatalog = getCatalogRow as jest.Mock
const mockQueryCatalog = queryCatalogRowsForComponent as jest.Mock
const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const roomId = 'ROOM#hall' as const
const perspectiveKey = 'PERSPECTIVE#v1#abc'

describe('perspectivePointer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ephemeraDBMock.optimisticUpdate.mockResolvedValue(undefined)
    })

    it('resolvePerspectivePointer returns catalog currentCacheId', async () => {
        mockGetCatalog.mockResolvedValue({
            EphemeraId: roomId,
            DataCategory: 'Cache::PERSPECTIVE#v1#abc',
            assetStack: ['ASSET#a'],
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
            currentCacheId: 'CACHE#from-catalog',
        } satisfies EphemeraCacheCatalogRow)

        const result = await resolvePerspectivePointer(roomId, perspectiveKey)

        expect(result).toBe('CACHE#from-catalog')
    })

    it('resolvePerspectivePointer returns undefined when catalog has no pointer', async () => {
        mockGetCatalog.mockResolvedValue(undefined)

        const result = await resolvePerspectivePointer(roomId, perspectiveKey)

        expect(result).toBeUndefined()
    })

    it('collectPerspectivePointerEntries returns catalog keys', async () => {
        mockQueryCatalog.mockResolvedValue([
            {
                EphemeraId: roomId,
                DataCategory: 'Cache::PERSPECTIVE#v1#cat',
                assetStack: ['ASSET#a'],
                catalogVersion: 1,
                hydratedCatalogVersion: 1,
                currentCacheId: 'CACHE#cat',
            },
        ] satisfies EphemeraCacheCatalogRow[])

        const entries = await collectPerspectivePointerEntries(roomId)

        expect(entries).toEqual([
            { perspectiveKey: 'PERSPECTIVE#v1#cat', cacheId: 'CACHE#cat' },
        ])
    })

    it('clearPerspectivePointer clears the catalog row pointer', async () => {
        mockGetCatalog.mockResolvedValue({
            EphemeraId: roomId,
            DataCategory: 'Cache::PERSPECTIVE#v1#abc',
            assetStack: ['ASSET#a'],
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
            currentCacheId: 'CACHE#ptr',
        } satisfies EphemeraCacheCatalogRow)

        await clearPerspectivePointer(roomId, perspectiveKey)

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
    })
})
