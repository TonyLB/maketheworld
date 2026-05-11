jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

const assetDBMock = jest.mocked(assetDB)

import { createAuthoritativeComponentDataCacheHandler } from '@tonylb/mtw-gateways/ts/assets/components/assetMeta'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

const componentData = createAuthoritativeComponentDataCacheHandler(assetDBMock)

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
        const roomBase = new StandardRoom(deIndentWML(`
            <Room uuid=(Test) key=(Room1)>
                <ShortName>Lobby</ShortName>
                <Situation key=(base) uuid=(SITUATION#base) />
            </Room>
        `))
        const roomExtra = new StandardRoom(deIndentWML(`
            <Room uuid=(Test) key=(Room1)>
                <Situation key=(baseTwo) uuid=(SITUATION#baseTwo) />
            </Room>
        `))
        const mockData = [
            {
                ...roomBase.toJSON(),
                DataCategory: 'ASSET#Test',
                AssetId: ComponentId,
            },
            {
                ...roomExtra.toJSON(),
                DataCategory: 'ASSET#Extra',
                AssetId: ComponentId,
            },
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
                <Room uuid=(Test) key=(Room1)>
                    <ShortName>Lobby</ShortName>
                    <Situation key=(base) />
                </Room>
            `),
            deIndentWML(`
                <Room uuid=(Test) key=(Room1)><Situation key=(baseTwo) /></Room>
            `)
        ])
    })

})
