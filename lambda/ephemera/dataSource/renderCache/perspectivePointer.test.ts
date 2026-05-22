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
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        ComponentStackMerge: { invalidate: jest.fn() },
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { getCatalogRow, queryCatalogRowsForComponent } from './catalogRow'
import {
    clearPerspectivePointer,
    collectPerspectivePointerEntries,
    resolvePerspectivePointer,
} from './perspectivePointer'
import type { EphemeraCacheCatalogRow } from './baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

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

    it('resolvePerspectivePointer prefers catalog currentCacheId', async () => {
        mockGetCatalog.mockResolvedValue({
            EphemeraId: roomId,
            DataCategory: 'Cache::PERSPECTIVE#v1#abc',
            assetStack: ['ASSET#a'],
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
            currentCacheId: 'CACHE#from-catalog',
        } satisfies EphemeraCacheCatalogRow)

        const meta: EphemeraMetaRoom = {
            EphemeraId: roomId,
            DataCategory: 'Meta::Room',
            currentCacheByPerspective: { [perspectiveKey]: 'CACHE#legacy' },
        }

        const result = await resolvePerspectivePointer(roomId, perspectiveKey, meta)

        expect(result).toBe('CACHE#from-catalog')
    })

    it('resolvePerspectivePointer falls back to Meta map when catalog has no pointer', async () => {
        mockGetCatalog.mockResolvedValue(undefined)

        const meta: EphemeraMetaRoom = {
            EphemeraId: roomId,
            DataCategory: 'Meta::Room',
            currentCacheByPerspective: { [perspectiveKey]: 'CACHE#legacy' },
        }

        const result = await resolvePerspectivePointer(roomId, perspectiveKey, meta)

        expect(result).toBe('CACHE#legacy')
    })

    it('collectPerspectivePointerEntries merges catalog and legacy keys', async () => {
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

        const meta: EphemeraMetaRoom = {
            EphemeraId: roomId,
            DataCategory: 'Meta::Room',
            currentCacheByPerspective: {
                'PERSPECTIVE#v1#cat': 'CACHE#ignored',
                'PERSPECTIVE#v1#legacy': 'CACHE#legacy',
            },
        }

        const entries = await collectPerspectivePointerEntries(roomId, meta)

        expect(entries).toEqual(
            expect.arrayContaining([
                { perspectiveKey: 'PERSPECTIVE#v1#cat', cacheId: 'CACHE#cat' },
                { perspectiveKey: 'PERSPECTIVE#v1#legacy', cacheId: 'CACHE#legacy' },
            ])
        )
        expect(entries).toHaveLength(2)
    })

    it('clearPerspectivePointer clears catalog and legacy Meta entry', async () => {
        mockGetCatalog.mockResolvedValue({
            EphemeraId: roomId,
            DataCategory: 'Cache::PERSPECTIVE#v1#abc',
            assetStack: ['ASSET#a'],
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
            currentCacheId: 'CACHE#ptr',
        } satisfies EphemeraCacheCatalogRow)

        await clearPerspectivePointer(roomId, perspectiveKey)

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(2)
    })
})
