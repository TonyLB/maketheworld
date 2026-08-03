import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import {
    generateCacheKey,
    cacheKeyComponents,
    componentPairCacheKey,
    metaDataCategoryForEphemeraId,
    fetchComponentsForAssets,
    defaultStoredEntryForCacheKey,
    authoritativeComponentDataFromUniversalPartitionRows,
    componentRowsFromUniversalPartitionLines,
    standardComponentPairFromAssetDbGetItemsRow,
    type ComponentAssetMetaAssetDB,
} from './index'

describe('component data gateway', () => {
    describe('componentPairCacheKey / cacheKeyComponents', () => {
        it('round-trips a valid compound key', () => {
            const ephemeraId = 'ROOM#TestOne' as const
            const assetId = 'ASSET#Base' as const
            const key = componentPairCacheKey(ephemeraId, assetId)
            expect(key).toBe('ASSET#Base::ROOM#TestOne')
            expect(generateCacheKey(ephemeraId, assetId)).toBe(key)
            expect(cacheKeyComponents(key)).toEqual({ EphemeraId: ephemeraId, assetId })
        })

        it('round-trips AREA# universal keys (topology referrer loads)', () => {
            const areaId = 'AREA#WORLD' as const
            const assetId = 'ASSET#primitives' as const
            const key = componentPairCacheKey(areaId, assetId)
            expect(key).toBe('ASSET#primitives::AREA#WORLD')
            expect(cacheKeyComponents(key)).toEqual({ EphemeraId: areaId, assetId })
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

        it('standardComponentPairFromAssetDbGetItemsRow accepts ephemeraDB EphemeraId PK row', () => {
            const row = {
                DataCategory: 'ASSET#IMPROVISATION',
                EphemeraId: 'ROOM#TestOne',
                tag: 'Room' as const,
                key: 'TestOne',
                shortName: 'Test room',
                exits: [] as { reference: { tag: 'Room'; key: string }; payload: string }[],
                examples: [{ key: 'base', tag: 'Example' as const }],
            }
            const pair = standardComponentPairFromAssetDbGetItemsRow('ROOM#TestOne', row as any)
            expect(pair.assetId).toBe('ASSET#IMPROVISATION')
            expect(pair.component.universalKey).toBe('ROOM#TestOne')
        })

        it('round-trips an OBJECT# improvisation pair row with a SITUATION#DEFAULT situations facet (Phase 5 spawn-time prose)', () => {
            const row = {
                DataCategory: 'ASSET#IMPROVISATION',
                EphemeraId: 'OBJECT#TestAnvil',
                tag: 'Object' as const,
                shortName: 'Anvil',
                situations: [{
                    reference: 'SITUATION#DEFAULT' as const,
                    payload: { displayName: 'a heavy anvil', description: ['A cast-iron anvil sits here.'] },
                }],
            }
            const pair = standardComponentPairFromAssetDbGetItemsRow('OBJECT#TestAnvil', row as any)
            expect(pair.assetId).toBe('ASSET#IMPROVISATION')
            expect(pair.component).toBeInstanceOf(StandardObject)
            const component = pair.component as StandardObject
            expect(component.situations.length).toBe(1)
            expect(component.situations.items[0].reference.universalKey).toBe('SITUATION#DEFAULT')
            expect(component.situations.items[0].payload.toJSON()).toEqual({
                displayName: 'a heavy anvil',
                description: ['A cast-iron anvil sits here.'],
            })
        })

        it('strips referencedBy before StandardComponent construction', () => {
            const row = {
                DataCategory: 'ASSET#Layer',
                AssetId: 'ROOM#TestOne',
                tag: 'Room' as const,
                key: 'TestOne',
                universalKey: 'ROOM#TestOne',
                referencedBy: [{ referrerUniversalKey: 'AREA#region', referenceType: 'Edge' }],
            }
            const pair = standardComponentPairFromAssetDbGetItemsRow('ROOM#TestOne', row as any)
            expect(pair.referencedBy).toEqual([
                { referrerUniversalKey: 'AREA#region', referenceType: 'Edge' },
            ])
            expect((pair.component.toJSON() as { referencedBy?: unknown }).referencedBy).toBeUndefined()
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

    describe('defaultStoredEntryForCacheKey', () => {
        it('returns a default StandardComponent for a valid key', () => {
            const entry = defaultStoredEntryForCacheKey('ASSET#Layer::ROOM#TestOne')
            expect(entry.assetId).toBe('ASSET#Layer')
            expect(entry.component.universalKey).toBe('ROOM#TestOne')
        })

        it('returns a default StandardObject for OBJECT# improvisation cache key', () => {
            const entry = defaultStoredEntryForCacheKey('ASSET#IMPROVISATION::OBJECT#skates')
            expect(entry.assetId).toBe('ASSET#IMPROVISATION')
            expect(entry.component.universalKey).toBe('OBJECT#skates')
            expect(entry.component.tag).toBe('Object')
        })

        it('throws when format is invalid', () => {
            expect(() => defaultStoredEntryForCacheKey('no-delimiter')).toThrow(/Invalid cache key format/)
        })
    })
})
