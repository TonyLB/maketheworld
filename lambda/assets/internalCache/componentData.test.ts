jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

const assetDBMock = jest.mocked(assetDB)

import { ComponentData } from './componentData'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

const componentData = new ComponentData()

describe('ComponentData cache class', () => {
    beforeEach(() => {
        componentData.clear()
        jest.clearAllMocks()
    })

    it('should return the default value when no data is found', async () => {
        assetDBMock.query.mockResolvedValue([])
        const componentId = 'ROOM#12345'
        const result = await componentData.get([componentId])
        expect(result).toEqual([
            {
                ComponentId: componentId,
                byAssets: []
            }
        ])
    })

    it('should return the data from the database when found', async () => {
        const ComponentId = 'ROOM#Test'
        const mockData = [
            { tag: 'Room', key: 'Room1', AssetId: `ROOM#Test`, DataCategory: 'ASSET#Test', shortName: 'Lobby', exits: [], examples: [{ tag: 'Example', key: 'base' }] },
            { tag: 'Room', key: 'Room1', AssetId: `ROOM#Test`, DataCategory: 'ASSET#Extra', exits: [], examples: [{ tag: 'Example', key: 'baseTwo' }] },
        ]
        assetDBMock.query.mockResolvedValue(mockData)
        const result = await componentData.get([ComponentId])
        expect(result).toEqual([
            {
                ComponentId,
                byAssets: expect.any(Array)
            }
        ])
        expect(result[0].byAssets.map(({ component }) => (schemaToWML([component.schema])))).toEqual([
            deIndentWML(`
                <Room key=(Room1)>
                    <ShortName>Lobby</ShortName>
                    <Example key=(base) />
                </Room>
            `),
            deIndentWML(`
                <Room key=(Room1)><Example key=(baseTwo) /></Room>
            `)
        ])
    })

})