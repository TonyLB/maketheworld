jest.mock('./catalogRow', () => ({
    conditionalInvalidateCatalogRow: jest.fn(),
    getCatalogRow: jest.fn(),
}))

import { conditionalInvalidateCatalogRow, getCatalogRow } from './catalogRow'
import { handleRenderCacheFinding } from './handleRenderCacheFinding'
import type { EphemeraCacheCatalogRow } from './baseClasses'
import type { DiagnosticsEphemeraRenderCacheFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

const mockConditionalInvalidate = conditionalInvalidateCatalogRow as jest.Mock
const mockGetCatalog = getCatalogRow as jest.Mock

const catalogRow = (): EphemeraCacheCatalogRow => ({
    EphemeraId: 'ROOM#hall',
    DataCategory: 'Cache::PERSPECTIVE#v1#abc',
    assetStack: ['ASSET#canon'],
    catalogVersion: 1,
    hydratedCatalogVersion: 1,
})

const baseFinding: DiagnosticsEphemeraRenderCacheFindingEvent = {
    type: 'Ephemera RenderCache Finding',
    targetCatalogs: [
        { ephemeraId: 'ROOM#hall', perspectiveKey: 'PERSPECTIVE#v1#abc' },
    ],
    status: 'missing',
    diagnosticRunId: 'run-1',
    timestamp: '2025-01-01T00:00:00.000Z',
}

describe('handleRenderCacheFinding', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockConditionalInvalidate.mockResolvedValue(undefined)
        mockGetCatalog.mockResolvedValue(catalogRow())
    })

    it('bumps catalog row for each targetCatalog entry', async () => {
        await handleRenderCacheFinding(baseFinding)

        expect(mockGetCatalog).toHaveBeenCalledWith('ROOM#hall', 'PERSPECTIVE#v1#abc')
        expect(mockConditionalInvalidate).toHaveBeenCalledTimes(1)
    })

    it('no-ops when catalog row is missing (V1)', async () => {
        mockGetCatalog.mockResolvedValue(undefined)

        await handleRenderCacheFinding(baseFinding)

        expect(mockConditionalInvalidate).not.toHaveBeenCalled()
    })

    it('no-ops when targetCatalogs is empty', async () => {
        await handleRenderCacheFinding({
            ...baseFinding,
            targetCatalogs: [],
        })

        expect(mockGetCatalog).not.toHaveBeenCalled()
        expect(mockConditionalInvalidate).not.toHaveBeenCalled()
    })

    it('bumps multiple target catalogs', async () => {
        await handleRenderCacheFinding({
            ...baseFinding,
            targetCatalogs: [
                { ephemeraId: 'ROOM#hall', perspectiveKey: 'PERSPECTIVE#v1#abc' },
                { ephemeraId: 'ROOM#other', perspectiveKey: 'PERSPECTIVE#v1#def' },
            ],
        })

        expect(mockGetCatalog).toHaveBeenCalledTimes(2)
        expect(mockConditionalInvalidate).toHaveBeenCalledTimes(2)
    })
})
