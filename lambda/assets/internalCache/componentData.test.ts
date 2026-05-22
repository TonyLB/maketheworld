jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

const assetDBMock = jest.mocked(assetDB)

import { createComponentDataCacheHandler } from '@tonylb/mtw-gateways/ts/assets/components/componentData'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

const componentData = createComponentDataCacheHandler(assetDBMock)

describe('ComponentData cache class', () => {
    beforeEach(() => {
        componentData.clear()
        jest.clearAllMocks()
    })

    it('should return the default value when no data is found', async () => {
        assetDBMock.getItems.mockResolvedValue([])
        const componentId = 'ROOM#12345' as const
        const assetId = 'ASSET#Test' as const
        const result = await componentData.get(componentId, assetId)
        expect(result.component.universalKey).toBe(componentId)
        expect(result.assetId).toBe(assetId)
    })

    it('should return the data from the database when found', async () => {
        const ComponentId = 'ROOM#Test' as const
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
        assetDBMock.getItems.mockResolvedValue([
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
        ])
        const byAssets = await componentData.getAcrossAssets(ComponentId, ['ASSET#Test', 'ASSET#Extra'])
        expect(Object.keys(byAssets).sort()).toEqual(['ASSET#Extra', 'ASSET#Test'])
        expect(schemaToWML([byAssets['ASSET#Test'].schema])).toEqual(
            deIndentWML(`
                <Room uuid=(Test) key=(Room1)>
                    <ShortName>Lobby</ShortName>
                    <Situation key=(base) />
                </Room>
            `)
        )
        expect(schemaToWML([byAssets['ASSET#Extra'].schema])).toEqual(
            deIndentWML(`
                <Room uuid=(Test) key=(Room1)><Situation key=(baseTwo) /></Room>
            `)
        )
    })

})
