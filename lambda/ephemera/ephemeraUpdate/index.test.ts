jest.mock('@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient')
import { apiClient } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"

jest.mock('../internalCache')
import internalCache from "../internalCache"

import ephemeraUpdateMessage from '.'

const apiClientMock = apiClient as jest.Mocked<typeof apiClient>
const internalCacheMock = jest.mocked(internalCache, true)

describe('EphemeraUpdateMessage', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should call apiClient against registered connectionId', async () => {
        internalCacheMock.Global.get.mockResolvedValueOnce("TestConnection").mockResolvedValueOnce('Request123')
        await ephemeraUpdateMessage({
            payloads: [{
                type: 'EphemeraUpdate',
                global: false,
                updates: [{
                    type: 'CharacterInPlay',
                    CharacterId: 'CHARACTER#ABC',
                    Connected: true,
                    RoomId: 'VORTEX',
                    Name: 'Tess',
                    fileURL: 'TestURL',
                    Color: 'purple',
                    targets: []
                }]
            }]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'TestConnection',
            Data: '{\"messageType\":\"Ephemera\",\"RequestId\":\"Request123\",\"updates\":[{\"type\":\"CharacterInPlay\",\"CharacterId\":\"CHARACTER#ABC\",\"Connected\":true,\"RoomId\":\"VORTEX\",\"Name\":\"Tess\",\"fileURL\":\"TestURL\",\"Color\":\"purple\",\"targets\":[]}]}'
        })
    })

    it('should call apiClient against all connectionIds for global message', async () => {
        internalCacheMock.Global.get.mockImplementation(async (key) => {
            switch(key) {
                case 'ConnectionId':
                    return 'TestConnection'
                case 'connections':
                    return ['Connection1', 'Connection2']
                default:
                    return 'Request123'
            }
        })
        await ephemeraUpdateMessage({
            payloads: [{
                type: 'EphemeraUpdate',
                global: true,
                updates: [{
                    type: 'CharacterInPlay',
                    CharacterId: 'CHARACTER#ABC',
                    Connected: true,
                    RoomId: 'VORTEX',
                    Name: 'Tess',
                    fileURL: 'TestURL',
                    Color: 'purple',
                    targets: []
                }]
            }]
        })
        const expectedData = '{\"messageType\":\"Ephemera\",\"RequestId\":\"Request123\",\"updates\":[{\"type\":\"CharacterInPlay\",\"CharacterId\":\"CHARACTER#ABC\",\"Connected\":true,\"RoomId\":\"VORTEX\",\"Name\":\"Tess\",\"fileURL\":\"TestURL\",\"Color\":\"purple\",\"targets\":[]}]}'
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'Connection1',
            Data: expectedData
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'Connection2',
            Data: expectedData
        })
    })

})