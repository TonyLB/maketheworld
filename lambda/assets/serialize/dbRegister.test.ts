import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
jest.mock('@tonylb/mtw-utilities/ts/eventBridge', () => ({
    send: jest.fn()
}))

jest.mock('../internalCache', () => ({
    PlayerLibrary: {
        set: jest.fn()
    },
    Library: {
        set: jest.fn()
    }
}))

jest.mock('@tonylb/mtw-utilities/ts/graphStorage/update')
import GraphUpdate from '@tonylb/mtw-utilities/ts/graphStorage/update'

import { dbRegister } from './dbRegister'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

const assetDBMock = assetDB as jest.Mocked<typeof assetDB>
const GraphUpdateMock = GraphUpdate as jest.Mock<GraphUpdate<any, string>>

describe('dbRegister', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        GraphUpdateMock.mockClear()
    })

    it('should save meta for Asset type', async () => {
        await dbRegister({
            address: {
                fileName: 'test',
                zone: 'Library'
            },
            status: {
                json: 'Clean'
            },
            standard: new StandardForm(`
                <Asset key=(TEST)>
                    <Map key=(Village)>
                        <Room key=(Welcome)><Position x="0" y="100" /></Room>
                    </Map>
                    <Room key=(Welcome)><Name>Welcome</Name></Room>
                    <Feature key=(clockTower) />
                    <Variable key=(power) default={true} />
                    <Action key=(togglePower) src={power = !power} />
                </Asset>
            `).withUpdatedUniversalKeys((key) => (key === 'Welcome' ? 'ROOM#12345' : undefined))
        } as any)
        expect(assetDBMock.putItem.mock.calls[0][0]).toMatchSnapshot()
    })

    it('should save asset graph edges when asset has imports', async () => {
        await dbRegister({
            address: {
                fileName: 'test',
                zone: 'Library'
            },
            status: {
                json: 'Clean'
            },
            namespaceIdToDB: [],
            universalKey: jest.fn().mockReturnValue(undefined),
            standard: new StandardForm(`
                <Asset key=(test)>
                    <Room uuid=(ROOM#VORTEX) from=(ASSET#primitives) />
                </Asset>
            `)
        } as any)
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledTimes(1)
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith([{
            itemId: 'ASSET#test',
            edges: [{ target: 'ASSET#primitives', context: '' }],
            options: { direction: 'back' }
        }])
    })

})