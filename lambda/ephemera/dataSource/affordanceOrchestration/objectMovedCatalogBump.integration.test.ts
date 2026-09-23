/**
 * Cross-layer integration for Phase 2 of the nestedObjectLook plan: real `affordanceOrchestration`
 * `Object Moved` handling -> real `nonRoomHostsAffectedByObjectMoved` -> real
 * `bumpNonRoomHostCatalogsForObjectMoved` -> real `internalCache.RenderCache` (mtw-gateways
 * `RenderCacheCacheHandler`), against a mocked `ephemeraDB` only (the leaf boundary, same
 * convention every integration test in this codebase uses).
 */
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'
import { affordanceOrchestrationDataSource } from './index'
import { EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX } from '../renderCache/catalogRow'
import type { EphemeraCacheCatalogRow } from '../renderCache/baseClasses'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const catalogRow = (EphemeraId: string, DataCategory: string): EphemeraCacheCatalogRow => ({
    EphemeraId: EphemeraId as EphemeraCacheCatalogRow['EphemeraId'],
    DataCategory: DataCategory as EphemeraCacheCatalogRow['DataCategory'],
    assetStack: ['ASSET#canon'],
    catalogVersion: 1,
    hydratedCatalogVersion: 1,
})

const shelfRow = catalogRow('OBJECT#shelf', `${EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX}PERSPECTIVE#v1#shelf`)
const tableRow = catalogRow('OBJECT#table', `${EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX}PERSPECTIVE#v1#table`)

const rowsByComponent: Record<string, EphemeraCacheCatalogRow[]> = {
    'OBJECT#shelf': [shelfRow],
    'OBJECT#table': [tableRow],
    'ROOM#hall': [],
}

describe('Object Moved -> non-Room catalog bump (integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        internalCache.clear()
        ;(ephemeraDBMock.query as jest.Mock).mockImplementation(async ({ Key }: any) => (
            rowsByComponent[Key.EphemeraId] ?? []
        ))
        ephemeraDBMock.optimisticUpdate.mockResolvedValue(undefined)
    })

    const dispatchObjectMoved = async (payload: {
        objectId: string;
        froms: string[];
        to: string | null;
    }) => {
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'mtw.ephemera.positions',
                    streamKey: payload.objectId,
                    timestamp: Date.now(),
                    type: 'Object Moved',
                },
                getContent: () => Promise.resolve({
                    type: 'Object Moved' as const,
                    beatAnchorTime: 1,
                    ...payload,
                }),
            },
        ]
        await affordanceOrchestrationDataSource.receiveEvents?.({
            events,
            streamEvent: jest.fn().mockResolvedValue(undefined),
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })
    }

    it('bumps catalogVersion for an Object host an item moved into', async () => {
        await dispatchObjectMoved({ objectId: 'OBJECT#cup', froms: ['ROOM#hall'], to: 'OBJECT#table' })

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        const [{ Key }] = ephemeraDBMock.optimisticUpdate.mock.calls[0]
        expect(Key).toEqual({ EphemeraId: 'OBJECT#table', DataCategory: tableRow.DataCategory })
    })

    it('bumps catalogVersion for an Object host an item moved out of', async () => {
        await dispatchObjectMoved({ objectId: 'OBJECT#cup', froms: ['OBJECT#shelf'], to: 'ROOM#hall' })

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        const [{ Key }] = ephemeraDBMock.optimisticUpdate.mock.calls[0]
        expect(Key).toEqual({ EphemeraId: 'OBJECT#shelf', DataCategory: shelfRow.DataCategory })
    })

    it('leaves object catalogs untouched for a room-only move', async () => {
        await dispatchObjectMoved({ objectId: 'CHARACTER#pc', froms: ['ROOM#hall'], to: 'ROOM#hall' })

        expect(ephemeraDBMock.optimisticUpdate).not.toHaveBeenCalled()
    })
})
