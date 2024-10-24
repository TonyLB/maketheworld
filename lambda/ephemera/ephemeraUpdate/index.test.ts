jest.mock('@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient')
import { apiClient } from "@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient"

jest.mock('../internalCache')
import internalCache from "../internalCache"

import ephemeraUpdateMessage from '.'

const apiClientMock = apiClient as jest.Mocked<typeof apiClient>
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

describe('EphemeraUpdateMessage', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should call apiClient against registered connectionId', async () => {
        internalCacheMock.Global.get.mockResolvedValueOnce('Request123').mockResolvedValueOnce([])
        internalCacheMock.SessionConnections.get.mockResolvedValueOnce(['TestConnection'])
        await ephemeraUpdateMessage({
            payloads: [{
                type: 'EphemeraUpdate',
                updates: [{
                    type: 'CharacterInPlay',
                    CharacterId: 'CHARACTER#ABC',
                    Connected: true,
                    RoomId: 'ROOM#VORTEX',
                    Name: 'Tess',
                    fileURL: 'TestURL',
                    Color: 'purple',
                    connectionTargets: ['SESSION#TestSession']
                }]
            }]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'TestConnection',
            Data: '{\"messageType\":\"Ephemera\",\"RequestId\":\"Request123\",\"updates\":[{\"type\":\"CharacterInPlay\",\"CharacterId\":\"CHARACTER#ABC\",\"Connected\":true,\"RoomId\":\"ROOM#VORTEX\",\"Name\":\"Tess\",\"fileURL\":\"TestURL\",\"Color\":\"purple\"}]}'
        })
    })

    it('should call apiClient against all connectionIds for global message', async () => {
        internalCacheMock.Global.get.mockImplementation(async (key) => {
            switch(key) {
                case 'ConnectionId':
                    return 'TestConnection'
                case 'sessions':
                    return ['Session1']
                case 'mapSubscriptions':
                    return []
                default:
                    return 'Request123'
            }
        })
        internalCacheMock.SessionConnections.get.mockResolvedValue(['Connection1', 'Connection2'])
        await ephemeraUpdateMessage({
            payloads: [{
                type: 'EphemeraUpdate',
                updates: [{
                    type: 'CharacterInPlay',
                    CharacterId: 'CHARACTER#ABC',
                    Connected: true,
                    RoomId: 'ROOM#VORTEX',
                    Name: 'Tess',
                    fileURL: 'TestURL',
                    Color: 'purple',
                    connectionTargets: ['GLOBAL']
                }]
            }]
        })
        const expectedData = '{\"messageType\":\"Ephemera\",\"RequestId\":\"Request123\",\"updates\":[{\"type\":\"CharacterInPlay\",\"CharacterId\":\"CHARACTER#ABC\",\"Connected\":true,\"RoomId\":\"ROOM#VORTEX\",\"Name\":\"Tess\",\"fileURL\":\"TestURL\",\"Color\":\"purple\"}]}'
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