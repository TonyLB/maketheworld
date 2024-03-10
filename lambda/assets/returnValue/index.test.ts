jest.mock('../clients')
import { snsClient } from "../clients"
jest.mock('@tonylb/mtw-asset-workspace/dist/readOnly', () => {
    return jest.fn().mockImplementation((address: any) => {
        return {
            status: {
                json: 'Clean'
            },
            address,
            get fileNameBase() {
                if (address.zone === 'Personal') {
                    return 'Personal/Test/Test'
                }
                else {
                    return 'Library/Test'
                }
            },
            loadJSON: jest.fn(),
            normal: {
                'Import-0': {
                    tag: 'Import',
                },
                Test: {
                    tag: 'Asset'
                }
            },
            namespaceIdToDB: [
                { internalKey: 'VORTEX', universalKey: 'ROOM#VORTEX' }
            ]
        }
    })
})

jest.mock('../internalCache')
import internalCache from "../internalCache"

import returnValueMessage from './index'

const snsClientMock = snsClient as jest.Mocked<typeof snsClient>
const internalCacheMock = jest.mocked(internalCache, true)

describe('ReturnValueMessage', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCacheMock.Connection.get.mockResolvedValue("TestConnection")
    })

    it('should call snsClient against registered connectionId', async () => {
        await returnValueMessage({
            payloads: [{
                type: 'ReturnValue',
                body: {
                    result: 'ActionSuccessful'
                }
            }]
        })
        expect((snsClientMock.send.mock.calls[0][0].input as any).Message).toEqual('{"result":"ActionSuccessful"}')
    })
})