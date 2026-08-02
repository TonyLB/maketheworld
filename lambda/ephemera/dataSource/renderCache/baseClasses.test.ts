import {
    buildCacheCatalogDataCategory,
    buildSituationAdjacencyDataCategory,
    isEphemeraCacheCatalogRow,
    isSituationCacheAdjacencyRow,
    parseSituationAdjacencyDataCategory,
} from './baseClasses'

describe('renderCache catalog and adjacency SK helpers', () => {
    it('buildCacheCatalogDataCategory prefixes perspective key', () => {
        expect(buildCacheCatalogDataCategory('PERSPECTIVE#v1#abc')).toBe('Cache::PERSPECTIVE#v1#abc')
    })

    it('buildSituationAdjacencyDataCategory encodes host and perspective', () => {
        expect(
            buildSituationAdjacencyDataCategory('ROOM#hall', 'PERSPECTIVE#v1#abc')
        ).toBe('Link::ROOM#hall::Cache::PERSPECTIVE#v1#abc')
    })

    it('parseSituationAdjacencyDataCategory round-trips built SK', () => {
        const sk = buildSituationAdjacencyDataCategory('FEATURE#f1', 'PERSPECTIVE#v1#deadbeef')
        expect(parseSituationAdjacencyDataCategory(sk)).toEqual({
            hostEphemeraId: 'FEATURE#f1',
            perspectiveKey: 'PERSPECTIVE#v1#deadbeef',
        })
    })

    it('parseSituationAdjacencyDataCategory rejects invalid SK', () => {
        expect(parseSituationAdjacencyDataCategory('Cache::only')).toBeUndefined()
        expect(parseSituationAdjacencyDataCategory('Link::ROOM#x::not-cache')).toBeUndefined()
    })

    it('parseSituationAdjacencyDataCategory admits Object and Character hosts', () => {
        expect(
            parseSituationAdjacencyDataCategory(buildSituationAdjacencyDataCategory('OBJECT#o1', 'PERSPECTIVE#v1#abc'))
        ).toEqual({ hostEphemeraId: 'OBJECT#o1', perspectiveKey: 'PERSPECTIVE#v1#abc' })
        expect(
            parseSituationAdjacencyDataCategory(buildSituationAdjacencyDataCategory('CHARACTER#c1', 'PERSPECTIVE#v1#abc'))
        ).toEqual({ hostEphemeraId: 'CHARACTER#c1', perspectiveKey: 'PERSPECTIVE#v1#abc' })
    })
})

describe('renderCache catalog and adjacency row guards', () => {
    const catalogRow = {
        EphemeraId: 'ROOM#test',
        DataCategory: 'Cache::PERSPECTIVE#v1#abc',
        assetStack: ['ASSET#a'],
        catalogVersion: 1,
        hydratedCatalogVersion: 0,
    }

    const adjacencyRow = {
        EphemeraId: 'SITUATION#default',
        DataCategory: 'Link::ROOM#test::Cache::PERSPECTIVE#v1#abc',
        assetStack: ['ASSET#a'],
    }

    it('isEphemeraCacheCatalogRow accepts valid catalog rows', () => {
        expect(isEphemeraCacheCatalogRow(catalogRow)).toBe(true)
        expect(isEphemeraCacheCatalogRow({
            ...catalogRow,
            currentCacheId: 'CACHE#uuid',
        })).toBe(true)
    })

    it('isEphemeraCacheCatalogRow rejects invalid catalog rows', () => {
        expect(isEphemeraCacheCatalogRow({ ...catalogRow, catalogVersion: 0 })).toBe(false)
        expect(isEphemeraCacheCatalogRow({ ...catalogRow, assetStack: [] })).toBe(false)
    })

    it('isEphemeraCacheCatalogRow accepts Object and Character hosts', () => {
        expect(isEphemeraCacheCatalogRow({ ...catalogRow, EphemeraId: 'OBJECT#o1' })).toBe(true)
        expect(isEphemeraCacheCatalogRow({ ...catalogRow, EphemeraId: 'CHARACTER#c1' })).toBe(true)
    })

    it('isSituationCacheAdjacencyRow accepts valid adjacency rows', () => {
        expect(isSituationCacheAdjacencyRow(adjacencyRow)).toBe(true)
    })

    it('isSituationCacheAdjacencyRow rejects malformed adjacency SK', () => {
        expect(isSituationCacheAdjacencyRow({
            ...adjacencyRow,
            DataCategory: 'Link::ROOM#test::Cache::',
        })).toBe(false)
    })
})
