import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    ImportVerticalConsistencyAnalyzer,
    type ImportVerticalConsistencyAnalyzerDeps,
    type ImportVerticalUniversalPartitionRow,
} from './consistency'
import { metaImportDataCategory } from './keys'
import { authoritativeComponentDataFromUniversalPartitionRows } from '../assetMeta/dynamoStandardComponents'

const universalKey = 'ROOM#r1' as EphemeraId

function ndjsonRoomLine(childAssetId: string, fromParent: string): ImportVerticalUniversalPartitionRow {
    return {
        AssetId: universalKey,
        DataCategory: childAssetId,
        key: 'r1',
        universalKey,
        tag: 'Room' as const,
        shortName: 'Room',
        exits: [] as { reference: { tag: 'Room'; key: string }; payload: string }[],
        examples: [{ key: 'base', tag: 'Example' as const }],
        from: fromParent,
    } as ImportVerticalUniversalPartitionRow
}

describe('ImportVerticalConsistencyAnalyzer', () => {
    it('throws when reading findings before check', () => {
        const deps: ImportVerticalConsistencyAnalyzerDeps = {
            authoritativeComponentData: { get: async () => [] },
            metaImportProjection: { loadMetaImportRows: async () => [] },
        }
        const analyzer = new ImportVerticalConsistencyAnalyzer(deps)
        expect(() => analyzer.getFindings()).toThrow(/check\(\) first/)
    })

    it('classifies aligned when expected Meta rows match derived hops', async () => {
        const child = 'ASSET#childB'
        const parent = 'ASSET#parentA'
        const expectedDc = metaImportDataCategory({ parentAssetId: parent, childAssetId: child })
        const partitionRow = ndjsonRoomLine(child, parent)
        const auth = authoritativeComponentDataFromUniversalPartitionRows(universalKey, [partitionRow])

        const deps: ImportVerticalConsistencyAnalyzerDeps = {
            authoritativeComponentData: { get: async () => [auth] },
            metaImportProjection: {
                loadMetaImportRows: async () => [{ DataCategory: expectedDc }],
            },
        }
        const analyzer = new ImportVerticalConsistencyAnalyzer(deps)
        await analyzer.check(universalKey)
        const f = analyzer.getFindings()
        expect(f.classification).toBe('aligned')
        expect(f.categoriesToAdd).toEqual([])
        expect(f.metaRowsToDelete).toEqual([])
    })

    it('classifies missing when Meta index lacks expected category', async () => {
        const child = 'ASSET#childB'
        const parent = 'ASSET#parentA'
        const partitionRow = ndjsonRoomLine(child, parent)
        const auth = authoritativeComponentDataFromUniversalPartitionRows(universalKey, [partitionRow])

        const deps: ImportVerticalConsistencyAnalyzerDeps = {
            authoritativeComponentData: { get: async () => [auth] },
            metaImportProjection: { loadMetaImportRows: async () => [] },
        }
        const analyzer = new ImportVerticalConsistencyAnalyzer(deps)
        await analyzer.check(universalKey)
        const f = analyzer.getFindings()
        expect(f.classification).toBe('missing')
        expect(f.categoriesToAdd.length).toBeGreaterThan(0)
        expect(f.metaRowsToDelete).toEqual([])
    })

    it('classifies orphan when index has extra Meta row', async () => {
        const deps: ImportVerticalConsistencyAnalyzerDeps = {
            authoritativeComponentData: {
                get: async () => [
                    authoritativeComponentDataFromUniversalPartitionRows(universalKey, []),
                ],
            },
            metaImportProjection: {
                loadMetaImportRows: async () => [{ DataCategory: 'Meta::Import::orphan::only' }],
            },
        }
        const analyzer = new ImportVerticalConsistencyAnalyzer(deps)
        await analyzer.check(universalKey)
        const f = analyzer.getFindings()
        expect(f.classification).toBe('orphan')
        expect(f.categoriesToAdd).toEqual([])
        expect(f.metaRowsToDelete.length).toBe(1)
    })

    it('classifies stale when both missing and orphan', async () => {
        const child = 'ASSET#childB'
        const parent = 'ASSET#parentA'
        const partitionRow = ndjsonRoomLine(child, parent)
        const auth = authoritativeComponentDataFromUniversalPartitionRows(universalKey, [partitionRow])

        const deps: ImportVerticalConsistencyAnalyzerDeps = {
            authoritativeComponentData: { get: async () => [auth] },
            metaImportProjection: {
                loadMetaImportRows: async () => [{ DataCategory: 'Meta::Import::wrong::hop' }],
            },
        }
        const analyzer = new ImportVerticalConsistencyAnalyzer(deps)
        await analyzer.check(universalKey)
        const f = analyzer.getFindings()
        expect(f.classification).toBe('stale')
        expect(f.categoriesToAdd.length).toBeGreaterThan(0)
        expect(f.metaRowsToDelete.length).toBe(1)
    })

    it('ignores non-Meta rows in metaImportProjection', async () => {
        const deps: ImportVerticalConsistencyAnalyzerDeps = {
            authoritativeComponentData: {
                get: async () => [
                    authoritativeComponentDataFromUniversalPartitionRows(universalKey, []),
                ],
            },
            metaImportProjection: {
                loadMetaImportRows: async () => [
                    { DataCategory: 'Meta::Room' },
                    { DataCategory: 'Meta::Import::x::y' },
                ],
            },
        }
        const analyzer = new ImportVerticalConsistencyAnalyzer(deps)
        await analyzer.check(universalKey)
        const f = analyzer.getFindings()
        expect(f.existingCategories).toEqual(['Meta::Import::x::y'])
        expect(f.classification).toBe('orphan')
    })
})
