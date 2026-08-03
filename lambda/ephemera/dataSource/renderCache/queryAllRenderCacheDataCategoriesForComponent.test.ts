jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { queryAllRenderCacheDataCategoriesForComponent } from './queryAllRenderCacheDataCategoriesForComponent'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const componentId = 'OBJECT#test-object-uuid' as const

const minimalCacheRow = {
    EphemeraId: componentId,
    DataCategory: 'CACHE#abc',
    markState: { markValue: [] },
    renderedContent: { description: [] },
    provenance: { type: 'authored' as const },
    perspectiveId: 'test-perspective',
    perspectiveMatcher: { requiredAssetIds: ['ASSET#a'], forbiddenAssetIds: [] },
}

const minimalCatalogRow = {
    EphemeraId: componentId,
    DataCategory: 'Cache::perspective-key',
    assetStack: ['ASSET#a'],
    catalogVersion: 1,
    hydratedCatalogVersion: 1,
}

describe('dataSource/renderCache/queryAllRenderCacheDataCategoriesForComponent', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns DataCategory strings from both CACHE# and Cache:: rows', async () => {
        (ephemeraDBMock.query as jest.Mock).mockImplementation((props: { ExpressionAttributeValues: Record<string, unknown> }) => {
            const prefix = props.ExpressionAttributeValues[':dcPrefix']
            return Promise.resolve(prefix === 'CACHE#' ? [minimalCacheRow] : [minimalCatalogRow])
        })

        const result = await queryAllRenderCacheDataCategoriesForComponent(componentId)

        expect(result).toEqual(['CACHE#abc', 'Cache::perspective-key'])
    })

    it('returns an empty array when the host has never hydrated', async () => {
        (ephemeraDBMock.query as jest.Mock).mockResolvedValue([])

        const result = await queryAllRenderCacheDataCategoriesForComponent(componentId)

        expect(result).toEqual([])
    })
})
