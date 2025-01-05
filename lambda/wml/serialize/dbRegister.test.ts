import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

jest.mock('@tonylb/mtw-utilities/ts/graphStorage/update', () => {
    return jest.fn().mockImplementation(() => {
        return {
            setEdges: mockSetEdges,
            flush: jest.fn()
        }
    })
})

jest.mock('../clients')
import { snsClient } from '../clients'

import { dbRegister } from './dbRegister'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

const assetDBMock = assetDB as jest.Mocked<typeof assetDB>
const snsClientMock = snsClient as jest.Mocked<typeof snsClient>
const mockSetEdges = jest.fn()

describe('dbRegister', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        mockSetEdges.mockClear()
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
            namespaceIdToDB: [
                { internalKey: 'Welcome', universalKey: 'ROOM#12345' }
            ],
            standard: new StandardForm(`
                <Asset key=(TEST)>
                    <Map key=(Village)>
                        <Name>Test Village</Name>
                        <Room key=(Welcome)><Position x="0" y="100" /></Room>
                    </Map>
                    <Room key=(Welcome)>
                        <ShortName>Welcome</ShortName>
                    </Room>
                    <Feature key=(clockTower) />
                    <Variable key=(power) default={true} />
                    <Action key=(togglePower) src={power = !power} />
                </Asset>
            `)
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
            standard: new StandardForm(`
                <Asset key=(test)>
                    <Import from=(primitives)>
                        <Room key=(VORTEX) />
                    </Import>
                    <Room key=(VORTEX)>
                        <ShortName>Welcome</ShortName>
                    </Room>
                </Asset>
            `)
        } as any)
        expect(mockSetEdges).toHaveBeenCalledTimes(1)
        expect(mockSetEdges).toHaveBeenCalledWith([{
            itemId: 'ASSET#test',
            edges: [{ target: 'ASSET#primitives', context: '' }],
            options: { direction: 'back' }
        }])
    })

})