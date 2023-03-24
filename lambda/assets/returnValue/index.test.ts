jest.mock('../clients')
import { apiClient } from "../clients"
jest.mock('@tonylb/mtw-asset-workspace/dist/', () => {
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
            namespaceIdToDB: {
                VORTEX: 'VORTEX'
            }
        }
    })
})

jest.mock('../internalCache')
import internalCache from "../internalCache"

import returnValueMessage from './index'

const apiClientMock = apiClient as jest.Mocked<typeof apiClient>
const internalCacheMock = jest.mocked(internalCache, true)

describe('ReturnValueMessage', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCacheMock.Connection.get.mockResolvedValue("TestConnection")
    })

    it('should call apiClient against registered connectionId', async () => {
        await returnValueMessage({
            payloads: [{
                type: 'ReturnValue',
                body: {
                    result: 'ActionSuccessful'
                }
            }]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'TestConnection',
            Data: '{"result":"ActionSuccessful"}'
        })
    })
})