import {
    stripAssetIdForSortKey,
    metaImportDataCategory,
    metaImportSortKeyEndsWithChild,
    parseMetaImportDataCategory,
    prefixedAssetIdsFromHop,
    queryImportVerticalMeta,
    componentRowsFromUniversalPartitionLines,
    type ImportVerticalAssetDB,
} from './index'

describe('component verticals gateway (Meta::Import)', () => {
    describe('componentRowsFromUniversalPartitionLines', () => {
        it('parses NDJSON component lines using DataCategory as child asset id', () => {
            const line = {
                AssetId: 'ROOM#r1',
                DataCategory: 'ASSET#childB',
                key: 'r1',
                universalKey: 'ROOM#r1',
                tag: 'Room' as const,
                shortName: 'Room',
                exits: [] as { reference: { tag: 'Room'; key: string }; payload: string }[],
                examples: [{ key: 'base', tag: 'Example' as const }],
                from: 'ASSET#parentA',
            }
            const rows = componentRowsFromUniversalPartitionLines([line as any])
            expect(rows).toHaveLength(1)
            expect(rows[0].childAssetId).toBe('ASSET#childB')
            expect(rows[0].component.tag).toBe('Room')
        })

        it('returns empty when no valid NDJSON lines', () => {
            expect(componentRowsFromUniversalPartitionLines([{ AssetId: 'x', DataCategory: 'ASSET#y' }] as any)).toEqual([])
        })
    })

    describe('stripAssetIdForSortKey', () => {
        it('removes ASSET# prefix', () => {
            expect(stripAssetIdForSortKey('ASSET#abc')).toBe('abc')
            expect(stripAssetIdForSortKey('abc')).toBe('abc')
        })
    })

    describe('metaImportDataCategory', () => {
        it('builds parent-first Meta::Import sort key', () => {
            expect(
                metaImportDataCategory({
                    parentAssetId: 'ASSET#parent',
                    childAssetId: 'ASSET#child',
                })
            ).toBe('Meta::Import::parent::child')
        })
    })

    describe('metaImportSortKeyEndsWithChild', () => {
        it('matches suffix for stripped child id', () => {
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

    describe('parseMetaImportDataCategory', () => {
        it('parses valid Meta::Import keys', () => {
            expect(parseMetaImportDataCategory('Meta::Import::p::c')).toEqual({
                parentStripped: 'p',
                childStripped: 'c',
            })
        })

        it('returns undefined for wrong prefix or malformed keys', () => {
            expect(parseMetaImportDataCategory('Meta::Room::x')).toBeUndefined()
            expect(parseMetaImportDataCategory('Meta::Import::onlyOne')).toBeUndefined()
            expect(parseMetaImportDataCategory('Meta::Import::')).toBeUndefined()
        })
    })

    describe('prefixedAssetIdsFromHop', () => {
        it('wraps stripped segments as ASSET# ids', () => {
            expect(prefixedAssetIdsFromHop({ parentStripped: 'a', childStripped: 'b' })).toEqual({
                parentAssetId: 'ASSET#a',
                childAssetId: 'ASSET#b',
            })
        })
    })

    describe('queryImportVerticalMeta', () => {
        it('queries the universal-key partition and maps hops', async () => {
            const query = jest.fn().mockResolvedValue([
                {
                    AssetId: 'ROOM#Vortex',
                    DataCategory: 'Meta::Import::parentA::childB',
                },
                {
                    AssetId: 'ROOM#Vortex',
                    DataCategory: 'Meta::Broken',
                },
            ])
            const assetDB = { query } as unknown as ImportVerticalAssetDB

            const hops = await queryImportVerticalMeta(assetDB, 'ROOM#Vortex')

            expect(query).toHaveBeenCalledWith({
                Key: { AssetId: 'ROOM#Vortex' },
                KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
                ExpressionAttributeValues: { ':prefix': 'Meta::Import::' },
                ProjectionFields: ['AssetId', 'DataCategory'],
            })
            expect(hops).toEqual([
                {
                    universalKey: 'ROOM#Vortex',
                    dataCategory: 'Meta::Import::parentA::childB',
                    parentStripped: 'parentA',
                    childStripped: 'childB',
                    parentAssetId: 'ASSET#parentA',
                    childAssetId: 'ASSET#childB',
                },
            ])
        })

        it('returns empty when query returns no rows', async () => {
            const assetDB = {
                query: jest.fn().mockResolvedValue([]),
            } as unknown as ImportVerticalAssetDB
            await expect(queryImportVerticalMeta(assetDB, 'FEATURE#X')).resolves.toEqual([])
        })
    })
})
