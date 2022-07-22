jest.mock('@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient')
import { apiClient } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"

jest.mock('../internalCache')
import internalCache from "../internalCache"

jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock("@tonylb/mtw-utilities/dist/dynamoDB")
import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import { uploadResponseMessage } from "./uploadResponse"

const assetDBMock = assetDB as jest.Mocked<typeof assetDB>
const apiClientMock = apiClient as jest.Mocked<typeof apiClient>
const internalCacheMock = jest.mocked(internalCache, true)
const messageBusMock = jest.mocked(messageBus, true)

describe('UploadResponseMessage', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCacheMock.UploadSubscriptions.get.mockResolvedValue([{
            player: 'TestPlayer',
            RequestId: '1234',
            connections: ['ABCD']
        }])
    })

    it('should call apiClient against registered connectionId', async () => {
        await uploadResponseMessage({
            payloads: [{
                type: 'UploadResponse',
                uploadId: 'DEF',
                messageType: 'Success'
            }],
            messageBus
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'ABCD',
            Data: '{\"messageType\":\"Success\",\"operation\":\"Upload\",\"RequestId\":\"1234\"}'
        })
        expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
            AssetId: 'UPLOAD#DEF',
            DataCategory: 'PLAYER#TestPlayer'
        })
    })
})