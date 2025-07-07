import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { ExamplesData } from './examples'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('ExamplesData', () => {
    let examplesData: ExamplesData

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        examplesData = new ExamplesData()
    })

    it('should fetch examples correctly', async () => {
        ephemeraMock.query.mockResolvedValue([{
            EphemeraId: 'ROOM#TestOne',
            DataCategory: 'EXAMPLE#Base::TestAsset',
            name: ['Example Name'],
            description: ['Example Description'],
            summary: ['Example Summary']
        }])

        const output = await examplesData.get(['ROOM#TestOne'])
        expect(output).toEqual({
            'ROOM#TestOne': [{
                assetId: 'TestAsset',
                examples: [expect.any(StandardExample)]
            }]
        })
        expect(output['ROOM#TestOne'][0].examples[0].toJSON()).toEqual({
            tag: 'Example',
            universalKey: 'EXAMPLE#Base',
            name: ['Example Name'],
            description: ['Example Description'],
            summary: ['Example Summary']
        })
        expect(ephemeraMock.query).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.query).toHaveBeenCalledWith({
            Key: { EphemeraId: 'ROOM#TestOne' },
            KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
            ExpressionAttributeValues: {
                ':dcPrefix': 'EXAMPLE#'
            },
            ProjectionFields: ['DataCategory', 'name', 'description', 'summary']
        })
    })

    it('should handle empty fetch results', async () => {
        ephemeraMock.query.mockResolvedValue([])

        const output = await examplesData.get(['ROOM#TestOne'])
        expect(output).toEqual({
            'ROOM#TestOne': []
        })
        expect(ephemeraMock.query).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.query).toHaveBeenCalledWith({
            Key: { EphemeraId: 'ROOM#TestOne' },
            KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
            ExpressionAttributeValues: {
                ':dcPrefix': 'EXAMPLE#'
            },
            ProjectionFields: ['DataCategory', 'name', 'description', 'summary']
        })
    })

    it('should set and get overridden examples', async () => {
        const example = new StandardExample({
            tag: 'Example',
            universalKey: 'EXAMPLE#Base',
            name: ['Example Name'],
            description: ['Example Description'],
            summary: ['Example Summary']
        })

        examplesData.set('ROOM#TestOne', [{
            assetId: 'TestAsset',
            examples: [example]
        }])

        const output = await examplesData.get(['ROOM#TestOne'])
        expect(output).toEqual({
            'ROOM#TestOne': [{
                assetId: 'TestAsset',
                examples: [example]
            }]
        })
        expect(examplesData.isOverridden('ROOM#TestOne')).toBe(true)
    })

    it('should invalidate cache correctly', async () => {
        const example = new StandardExample({
            tag: 'Example',
            universalKey: 'EXAMPLE#Base',
            name: ['Example Name'],
            description: ['Example Description'],
            summary: ['Example Summary']
        })

        examplesData.set('ROOM#TestOne', [{
            assetId: 'TestAsset',
            examples: [example]
        }])

        examplesData.invalidate('ROOM#TestOne')
        expect(examplesData.isOverridden('ROOM#TestOne')).toBeUndefined()

        ephemeraMock.query.mockResolvedValue([{
            EphemeraId: 'ROOM#TestOne',
            DataCategory: 'EXAMPLE#Base::TestAsset',
            name: ['Example Name'],
            description: ['Example Description'],
            summary: ['Example Summary']
        }])

        const output = await examplesData.get(['ROOM#TestOne'])
        expect(output).toEqual({
            'ROOM#TestOne': [{
                assetId: 'TestAsset',
                examples: [expect.any(StandardExample)]
            }]
        })
        expect(output['ROOM#TestOne'][0].examples[0].toJSON()).toEqual(example.toJSON())
        expect(ephemeraMock.query).toHaveBeenCalledTimes(1)
    })
})