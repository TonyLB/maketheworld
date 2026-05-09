import { metaImportDataCategory, metaImportSortKeyEndsWithChild, stripAssetIdForSortKey } from './importVerticalKeys'

describe('importVerticalKeys', () => {
    it('stripAssetIdForSortKey removes ASSET# prefix', () => {
        expect(stripAssetIdForSortKey('ASSET#abc')).toBe('abc')
        expect(stripAssetIdForSortKey('abc')).toBe('abc')
    })

    it('metaImportDataCategory builds parent-first Meta::Import sort key', () => {
        expect(
            metaImportDataCategory({
                parentAssetId: 'ASSET#parent',
                childAssetId: 'ASSET#child',
            })
        ).toBe('Meta::Import::parent::child')
    })

    it('metaImportSortKeyEndsWithChild matches suffix for stripped child id', () => {
        expect(
            metaImportSortKeyEndsWithChild({
                dataCategory: 'Meta::Import::par::child',
                childAssetId: 'ASSET#child',
            })
        ).toBe(true)
        expect(
            metaImportSortKeyEndsWithChild({
                dataCategory: 'Meta::Import::par::other',
                childAssetId: 'ASSET#child',
            })
        ).toBe(false)
    })
})
