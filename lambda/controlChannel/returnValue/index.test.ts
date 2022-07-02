jest.mock('@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient')
import { apiClient } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"

jest.mock('../internalCache')
import internalCache from "../internalCache"

import returnValueMessage from './index'

const apiClientMock = apiClient as jest.Mocked<typeof apiClient>
const internalCacheMock = internalCache as jest.Mocked<typeof internalCache>

describe('ReturnValueMessage', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCacheMock.get.mockReturnValue("TestConnection")
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