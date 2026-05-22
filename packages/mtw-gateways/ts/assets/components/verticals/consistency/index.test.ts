import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    ImportVerticalConsistencyAnalyzer,
    type ImportVerticalConsistencyAnalyzerDeps,
    type ImportVerticalUniversalPartitionRow,
} from './index'
import type { ImportVerticalHop } from '../fetch'
import { metaImportDataCategory, stripAssetIdForSortKey } from '../keys'
import { authoritativeComponentDataFromUniversalPartitionRows } from '../../componentData/dynamoStandardComponents'

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

function makeHop(parentAssetId: string, childAssetId: string): ImportVerticalHop {
    const parentStripped = stripAssetIdForSortKey(parentAssetId)
    const childStripped = stripAssetIdForSortKey(childAssetId)
    return {
        universalKey,
        dataCategory: metaImportDataCategory({ parentAssetId, childAssetId }),
        parentStripped,
        childStripped,
        parentAssetId: parentAssetId as AssetUUID,
        childAssetId: childAssetId as AssetUUID,
    }
}

describe('ImportVerticalConsistencyAnalyzer', () => {
    it('throws when reading findings before check', () => {
        const deps: ImportVerticalConsistencyAnalyzerDeps = {
            authoritativeComponentData: { get: async () => [] },
            metaImportProjection: { get: async () => [] },
        }
        const analyzer = new ImportVerticalConsistencyAnalyzer(deps)
        expect(() => analyzer.getFindings()).toThrow(/check\(\) first/)
    })

    it('classifies aligned when expected Meta rows match derived hops', async () => {
        const child = 'ASSET#childB'
        const parent = 'ASSET#parentA'
        const partitionRow = ndjsonRoomLine(child, parent)
        const auth = authoritativeComponentDataFromUniversalPartitionRows(universalKey, [partitionRow])

        const deps: ImportVerticalConsistencyAnalyzerDeps = {
            authoritativeComponentData: { get: async () => [auth] },
            metaImportProjection: {
                get: async () => [{ universalKey, hops: [makeHop(parent, child)] }],
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
            metaImportProjection: { get: async () => [{ universalKey, hops: [] }] },
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
                get: async () => [
                    { universalKey, hops: [makeHop('ASSET#orphan', 'ASSET#only')] },
                ],
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
                get: async () => [
                    { universalKey, hops: [makeHop('ASSET#wrong', 'ASSET#hop')] },
                ],
            },
        }
        const analyzer = new ImportVerticalConsistencyAnalyzer(deps)
        await analyzer.check(universalKey)
        const f = analyzer.getFindings()
        expect(f.classification).toBe('stale')
        expect(f.categoriesToAdd.length).toBeGreaterThan(0)
        expect(f.metaRowsToDelete.length).toBe(1)
    })

    it('treats a missing entry for the universalKey as no existing hops', async () => {
        const child = 'ASSET#childB'
        const parent = 'ASSET#parentA'
        const partitionRow = ndjsonRoomLine(child, parent)
        const auth = authoritativeComponentDataFromUniversalPartitionRows(universalKey, [partitionRow])

        const deps: ImportVerticalConsistencyAnalyzerDeps = {
            authoritativeComponentData: { get: async () => [auth] },
            metaImportProjection: { get: async () => [] },
        }
        const analyzer = new ImportVerticalConsistencyAnalyzer(deps)
        await analyzer.check(universalKey)
        const f = analyzer.getFindings()
        expect(f.existingCategories).toEqual([])
        expect(f.classification).toBe('missing')
        expect(f.metaRowsToDelete).toEqual([])
    })
})
