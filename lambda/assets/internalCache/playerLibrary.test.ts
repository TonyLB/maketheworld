import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { CachePlayerLibraryData } from './playerLibrary'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        query: jest.fn()
    }
}))

const assetDBMock = jest.mocked(assetDB, { shallow: false })

describe('playerLibrary (internal cache)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns Assets with zone/ShortName/Summary for Draft and Personal, with empty Characters', async () => {
        assetDBMock.query.mockResolvedValue([
            {
                DataCategory: 'Meta::Asset',
                AssetId: 'ASSET#draftUUID1',
                Story: true,
                instance: false,
                zone: 'Draft',
                shortName: 'Draft One',
                summary: ['First draft asset']
            },
            {
                DataCategory: 'Meta::Asset',
                AssetId: 'ASSET#personalUUID1',
                Story: false,
                instance: true,
                zone: 'Personal',
                shortName: 'Personal One',
                summary: ['First personal asset']
            }
        ] as any)

        const cache = new CachePlayerLibraryData()
        const result = await cache.get('TestPlayer')

        // Projection should include zone and shortName/summary (DB field names)
        expect(assetDBMock.query).toHaveBeenCalled()
        const [[queryArgs]] = assetDBMock.query.mock.calls as any
        expect(queryArgs.ProjectionFields).toEqual(
            expect.arrayContaining(['AssetId', 'DataCategory', 'zone', 'shortName', 'summary'])
        )

        // Characters should be empty per Phase 1 cleanup
        expect(result.Characters).toEqual({})

        // Assets should include two entries with zone and metadata preserved
        expect(Object.keys(result.Assets).sort()).toEqual(['draftUUID1', 'personalUUID1'])
        expect(result.Assets['draftUUID1']).toMatchObject({
            AssetId: 'draftUUID1',
            Story: true,
            instance: false,
            zone: 'Draft',
            ShortName: 'Draft One',
            Summary: ['First draft asset']
        })
        expect(result.Assets['personalUUID1']).toMatchObject({
            AssetId: 'personalUUID1',
            Story: false,
            instance: true,
            zone: 'Personal',
            ShortName: 'Personal One',
            Summary: ['First personal asset']
        })

        // Draft URL is deprecated in Phase 1; maintained as empty string for shape compatibility
        expect(result.draftURL).toBe('')
    })
})


