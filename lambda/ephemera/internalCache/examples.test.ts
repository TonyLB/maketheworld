import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { ExamplesData } from './examples'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

const assetMock = assetDB as jest.Mocked<typeof assetDB>

const FEATURE_ID = 'FEATURE#TestOne' as const

describe('ExamplesData', () => {
    let examplesData: ExamplesData

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        examplesData = new ExamplesData()
    })

    it('should fetch examples correctly', async () => {
        assetMock.query.mockResolvedValue([{
            AssetId: FEATURE_ID,
            DataCategory: 'EXAMPLE#Base::TestAsset',
            displayName: ['Example Name'],
            description: ['Example Description'],
            summary: ['Example Summary']
        }])

        const output = await examplesData.get([FEATURE_ID])
        expect(output).toEqual({
            [FEATURE_ID]: [{
                assetId: 'TestAsset',
                examples: [expect.any(StandardExample)]
            }]
        })
        expect(output[FEATURE_ID][0].examples[0].toJSON()).toEqual({
            tag: 'Example',
            universalKey: 'EXAMPLE#Base',
            displayName: 'Example Name',
            description: ['Example Description'],
            summary: ['Example Summary']
        })
        expect(assetMock.query).toHaveBeenCalledTimes(1)
        expect(assetMock.query).toHaveBeenCalledWith({
            Key: { AssetId: FEATURE_ID },
            KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
            ExpressionAttributeValues: {
                ':dcPrefix': 'EXAMPLE#'
            },
            ProjectionFields: ['DataCategory', 'name', 'displayName', 'description', 'summary']
        })
    })

    it('should handle empty fetch results', async () => {
        assetMock.query.mockResolvedValue([])

        const output = await examplesData.get([FEATURE_ID])
        expect(output).toEqual({
            [FEATURE_ID]: []
        })
        expect(assetMock.query).toHaveBeenCalledTimes(1)
        expect(assetMock.query).toHaveBeenCalledWith({
            Key: { AssetId: FEATURE_ID },
            KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
            ExpressionAttributeValues: {
                ':dcPrefix': 'EXAMPLE#'
            },
            ProjectionFields: ['DataCategory', 'name', 'displayName', 'description', 'summary']
        })
    })

    it('should set and get overridden examples', async () => {
        const example = new StandardExample({
            tag: 'Example',
            universalKey: 'EXAMPLE#Base',
            displayName: 'Example Name',
            description: ['Example Description'],
            summary: ['Example Summary']
        })

        examplesData.set(FEATURE_ID, [{
            assetId: 'TestAsset',
            examples: [example]
        }])

        const output = await examplesData.get([FEATURE_ID])
        expect(output).toEqual({
            [FEATURE_ID]: [{
                assetId: 'TestAsset',
                examples: [example]
            }]
        })
        expect(examplesData.isOverridden(FEATURE_ID)).toBe(true)
    })

    it('should invalidate cache correctly', async () => {
        const example = new StandardExample({
            tag: 'Example',
            universalKey: 'EXAMPLE#Base',
            displayName: 'Example Name',
            description: ['Example Description'],
            summary: ['Example Summary']
        })

        examplesData.set(FEATURE_ID, [{
            assetId: 'TestAsset',
            examples: [example]
        }])

        examplesData.invalidate(FEATURE_ID)
        expect(examplesData.isOverridden(FEATURE_ID)).toBeUndefined()

        assetMock.query.mockResolvedValue([{
            AssetId: FEATURE_ID,
            DataCategory: 'EXAMPLE#Base::TestAsset',
            displayName: ['Example Name'],
            description: ['Example Description'],
            summary: ['Example Summary']
        }])

        const output = await examplesData.get([FEATURE_ID])
        expect(output).toEqual({
            [FEATURE_ID]: [{
                assetId: 'TestAsset',
                examples: [expect.any(StandardExample)]
            }]
        })
        expect(output[FEATURE_ID][0].examples[0].toJSON()).toEqual(example.toJSON())
        expect(assetMock.query).toHaveBeenCalledTimes(1)
    })
})
