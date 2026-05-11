import {
    generateCacheKey,
    cacheKeyComponents,
    metaDataCategoryForEphemeraId,
    fetchComponentsForAssets,
    fetchCachedAssetIdsForComponent,
    defaultStoredEntryForCacheKey,
    authoritativeComponentDataFromUniversalPartitionRows,
    componentRowsFromUniversalPartitionLines,
    standardComponentPairFromAssetDbGetItemsRow,
    type ComponentAssetMetaAssetDB,
} from './index'

describe('component asset meta gateway', () => {
    describe('generateCacheKey / cacheKeyComponents', () => {
        it('round-trips a valid compound key', () => {
            const ephemeraId = 'ROOM#TestOne' as const
            const assetId = 'ASSET#Base' as const
            const key = generateCacheKey(ephemeraId, assetId)
            expect(key).toBe('ASSET#Base::ROOM#TestOne')
            expect(cacheKeyComponents(key)).toEqual({ EphemeraId: ephemeraId, assetId })
        })

        it('throws on invalid cache key segments', () => {
            expect(() => cacheKeyComponents('not-a-key')).toThrow(/CacheKey error/)
            expect(() => cacheKeyComponents('onlyone')).toThrow(/CacheKey error/)
        })
    })

    describe('metaDataCategoryForEphemeraId', () => {
        it('matches Meta::Type casing used for vertical meta rows', () => {
            expect(metaDataCategoryForEphemeraId('ROOM#abc')).toBe('Meta::Room')
            expect(metaDataCategoryForEphemeraId('FEATURE#xyz')).toBe('Meta::Feature')
        })
    })

    describe('dynamoStandardComponents', () => {
        it('authoritativeComponentDataFromUniversalPartitionRows parses NDJSON partition lines', () => {
            const universalKey = 'ROOM#r1'
            const line = {
                AssetId: universalKey,
                DataCategory: 'ASSET#childB',
                key: 'r1',
                universalKey,
                tag: 'Room' as const,
                shortName: 'Room',
                exits: [] as { reference: { tag: 'Room'; key: string }; payload: string }[],
                examples: [{ key: 'base', tag: 'Example' as const }],
                from: 'ASSET#parentA',
            }
            const auth = authoritativeComponentDataFromUniversalPartitionRows(universalKey as any, [line as any])
            expect(auth.ComponentId).toBe(universalKey)
            expect(auth.byAssets).toHaveLength(1)
            expect(auth.byAssets[0].AssetId).toBe('ASSET#childB')
            expect(auth.byAssets[0].component.tag).toBe('Room')
        })

        it('componentRowsFromUniversalPartitionLines matches partition rows to child rows', () => {
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
        })

        it('standardComponentPairFromAssetDbGetItemsRow matches fetchComponentsForAssets mapping', () => {
            const row = {
                DataCategory: 'ASSET#Layer',
                AssetId: 'FEATURE#TestOne',
                examples: ['EXAMPLE#ExampleTwo'],
            }
            const pair = standardComponentPairFromAssetDbGetItemsRow('FEATURE#TestOne', row as any)
            expect(pair.assetId).toBe('ASSET#Layer')
            expect(pair.component.universalKey).toBe('FEATURE#TestOne')
        })
    })

    describe('fetchComponentsForAssets', () => {
        it('calls getItems with expected keys and maps rows to components', async () => {
            const getItems = jest.fn().mockResolvedValue([
                {
                    DataCategory: 'ASSET#Layer',
                    AssetId: 'FEATURE#TestOne',
                    examples: ['EXAMPLE#ExampleTwo'],
                },
            ])
            const assetDB = { getItems, getItem: jest.fn() } as unknown as ComponentAssetMetaAssetDB

            const rows = await fetchComponentsForAssets(assetDB, 'FEATURE#TestOne', ['ASSET#Layer'])

            expect(getItems).toHaveBeenCalledWith({
                Keys: [{ AssetId: 'FEATURE#TestOne', DataCategory: 'ASSET#Layer' }],
                getAllFields: true,
            })
            expect(rows).toHaveLength(1)
            expect(rows[0].assetId).toBe('ASSET#Layer')
            expect(rows[0].component.universalKey).toBe('FEATURE#TestOne')
        })

        it('filters rows with invalid DataCategory', async () => {
            const getItems = jest.fn().mockResolvedValue([
                {
                    DataCategory: 'ASSET#Base',
                    AssetId: 'ROOM#TestOne',
                    shortName: 'OK',
                },
                {
                    DataCategory: '',
                    AssetId: 'ROOM#TestOne',
                    shortName: 'bad',
                },
            ])
            const assetDB = { getItems, getItem: jest.fn() } as unknown as ComponentAssetMetaAssetDB

            const rows = await fetchComponentsForAssets(assetDB, 'ROOM#TestOne', ['ASSET#Base', 'ASSET#Layer'])

            expect(rows).toHaveLength(1)
            expect(rows[0].assetId).toBe('ASSET#Base')
        })
    })

    describe('fetchCachedAssetIdsForComponent', () => {
        it('maps cached strings through AssetKey', async () => {
            const getItem = jest.fn().mockResolvedValue({ cached: ['alpha', 'beta'] })
            const assetDB = { getItems: jest.fn(), getItem } as unknown as ComponentAssetMetaAssetDB

            const ids = await fetchCachedAssetIdsForComponent(assetDB, 'ROOM#TestOne')

            expect(getItem).toHaveBeenCalledWith({
                Key: { AssetId: 'ROOM#TestOne', DataCategory: 'Meta::Room' },
                ProjectionFields: ['cached'],
            })
            expect(ids).toEqual(['ASSET#alpha', 'ASSET#beta'])
        })
    })

    describe('defaultStoredEntryForCacheKey', () => {
        it('returns a default StandardComponent for a valid key', () => {
            const entry = defaultStoredEntryForCacheKey('ASSET#Layer::ROOM#TestOne')
            expect(entry.assetId).toBe('ASSET#Layer')
            expect(entry.component.universalKey).toBe('ROOM#TestOne')
        })

        it('throws when format is invalid', () => {
            expect(() => defaultStoredEntryForCacheKey('no-delimiter')).toThrow(/Invalid cache key format/)
        })
    })
})
