import {
    catalogHydrateErrorMessage,
    catalogVersionSnapshot,
} from './catalogHydrateInstrumentation'

describe('catalogHydrateInstrumentation', () => {
    it('catalogVersionSnapshot marks missing row', () => {
        expect(catalogVersionSnapshot(undefined)).toEqual({
            catalogVersion: undefined,
            hydratedCatalogVersion: undefined,
            catalogStale: true,
            rowMissing: true,
        })
    })

    it('catalogVersionSnapshot reflects stale and ready rows', () => {
        expect(
            catalogVersionSnapshot({ catalogVersion: 2, hydratedCatalogVersion: 1 })
        ).toMatchObject({ catalogStale: true, rowMissing: false })
        expect(
            catalogVersionSnapshot({ catalogVersion: 1, hydratedCatalogVersion: 1 })
        ).toMatchObject({ catalogStale: false, rowMissing: false })
    })

    it('catalogHydrateErrorMessage normalizes unknown errors', () => {
        expect(catalogHydrateErrorMessage(new Error('boom'))).toBe('boom')
        expect(catalogHydrateErrorMessage('plain')).toBe('plain')
    })
})
