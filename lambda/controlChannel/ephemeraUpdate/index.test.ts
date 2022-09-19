jest.mock('@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient')
import { apiClient } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"

jest.mock('../internalCache')
import internalCache from "../internalCache"

import ephemeraUpdateMessage from '.'

const apiClientMock = apiClient as jest.Mocked<typeof apiClient>
const internalCacheMock = internalCache as jest.Mocked<typeof internalCache>

describe('EphemeraUpdateMessage', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCacheMock.get.mockResolvedValueOnce("TestConnection").mockResolvedValueOnce('Request123')
    })

    it('should call apiClient against registered connectionId', async () => {
        await ephemeraUpdateMessage({
            payloads: [{
                type: 'EphemeraUpdate',
                updates: [{
                    type: 'CharacterInPlay',
                    CharacterId: 'ABC',
                    Connected: true,
                    RoomId: 'VORTEX',
                    Name: 'Tess',
                    fileURL: 'TestURL',
                    Color: 'purple'
                }]
            }]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'TestConnection',
            Data: '{\"messageType\":\"Ephemera\",\"RequestId\":\"Request123\",\"updates\":[{\"type\":\"CharacterInPlay\",\"CharacterId\":\"ABC\",\"Connected\":true,\"RoomId\":\"VORTEX\",\"Name\":\"Tess\",\"fileURL\":\"TestURL\",\"Color\":\"purple\"}]}'
        })
    })
})