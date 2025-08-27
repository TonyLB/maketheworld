jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

const assetDBMock = jest.mocked(assetDB)

import { AssetData } from './assetData'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

const assetData = new AssetData()

describe('AssetData cache class', () => {
    beforeEach(() => {
        assetData.clear()
        jest.clearAllMocks()
    })

    it('should return the default value when no data is found', async () => {
        assetDBMock.query.mockResolvedValue([])
        const assetId = 'ASSET#12345'
        const result = await assetData.get([assetId])
        expect(result).toEqual([
            {
                AssetId: assetId,
                standardForm: expect.any(Object)
            }
        ])
    })

    it('should return the data from the database when found', async () => {
        const assetId = 'ASSET#Test'
        const mockData = [
            { tag: 'Room', key: 'Room1', AssetId: `ROOM#ABCDEF`, DataCategory: 'ASSET#Test', shortName: 'Lobby', exits: [], examples: ['EXAMPLE#GHIJKL'] },
            { tag: 'Example', AssetId: 'EXAMPLE#GHIJKL', DataCategory: 'ASSET#Test', context: ['ROOM#ABCDEF'], name: ['Plain lobby'], description: ['A featureless lobby'], summary: [] }
        ]
        assetDBMock.query.mockResolvedValue(mockData)
        const result = await assetData.get([assetId])
        expect(result).toEqual([
            {
                AssetId: assetId,
                standardForm: expect.any(Object)
            }
        ])
        expect(schemaToWML([result[0].standardForm.schema])).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room uuid=(ABCDEF) key=(Room1)>
                    <ShortName>Lobby</ShortName>
                    <Example uuid=(GHIJKL)>
                        <Name>Plain lobby</Name>
                        <Description>A featureless lobby</Description>
                    </Example>
                </Room>
            </Asset>
        `))
    })

})