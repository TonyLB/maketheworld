jest.mock('../renderCache/catalogRow', () => ({
    conditionalInvalidateCatalogRow: jest.fn(),
    queryCatalogRowsForComponent: jest.fn(),
}))

import {
    conditionalInvalidateCatalogRow,
    queryCatalogRowsForComponent,
} from '../renderCache/catalogRow'
import { bumpNonRoomHostCatalogsForObjectMoved } from './bumpNonRoomHostCatalogsForObjectMoved'
import type { EphemeraCacheCatalogRow } from '@tonylb/mtw-gateways/ts/ephemera/renderCache'

const mockConditionalInvalidate = conditionalInvalidateCatalogRow as jest.Mock
const mockQueryCatalog = queryCatalogRowsForComponent as jest.Mock

const catalogRow = (overrides: Partial<EphemeraCacheCatalogRow> = {}): EphemeraCacheCatalogRow => ({
    EphemeraId: 'OBJECT#table',
    DataCategory: 'Cache::PERSPECTIVE#v1#abc',
    assetStack: ['ASSET#canon'],
    catalogVersion: 1,
    hydratedCatalogVersion: 1,
    ...overrides,
})

describe('bumpNonRoomHostCatalogsForObjectMoved', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockConditionalInvalidate.mockResolvedValue(undefined)
    })

    it('bumps every catalog row for every host, unconditionally', async () => {
        const tableRow = catalogRow({ EphemeraId: 'OBJECT#table' })
        const boxRow = catalogRow({ EphemeraId: 'OBJECT#box', DataCategory: 'Cache::PERSPECTIVE#v1#other' })
        mockQueryCatalog.mockImplementation(async (hostId: string) => (
            hostId === 'OBJECT#table' ? [tableRow] : [boxRow]
        ))

        await bumpNonRoomHostCatalogsForObjectMoved(['OBJECT#table', 'OBJECT#box'] as any)

        expect(mockQueryCatalog).toHaveBeenCalledWith('OBJECT#table')
        expect(mockQueryCatalog).toHaveBeenCalledWith('OBJECT#box')
        expect(mockConditionalInvalidate).toHaveBeenCalledTimes(2)
        expect(mockConditionalInvalidate).toHaveBeenCalledWith(tableRow)
        expect(mockConditionalInvalidate).toHaveBeenCalledWith(boxRow)
    })

    it('makes no bump calls for a host with zero catalog rows', async () => {
        mockQueryCatalog.mockResolvedValue([])

        await bumpNonRoomHostCatalogsForObjectMoved(['OBJECT#empty'] as any)

        expect(mockConditionalInvalidate).not.toHaveBeenCalled()
    })

    it('makes no calls at all for an empty host list', async () => {
        await bumpNonRoomHostCatalogsForObjectMoved([])

        expect(mockQueryCatalog).not.toHaveBeenCalled()
        expect(mockConditionalInvalidate).not.toHaveBeenCalled()
    })
})
