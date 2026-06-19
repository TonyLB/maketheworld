jest.mock('@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient')
import { apiClient } from "@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient"

jest.mock('../internalCache')
import internalCache from "../internalCache"

jest.mock('../dataSource/positions/membership/resolveCharacterRoomId', () => ({
    resolveCharacterRoomId: jest.fn(),
}))

import { resolveCharacterRoomId } from '../dataSource/positions/membership/resolveCharacterRoomId'
import ephemeraUpdateMessage from '.'

const apiClientMock = apiClient as jest.Mocked<typeof apiClient>
const resolveCharacterRoomIdMock = resolveCharacterRoomId as jest.MockedFunction<typeof resolveCharacterRoomId>
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

describe('EphemeraUpdateMessage', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        resolveCharacterRoomIdMock.mockResolvedValue('ROOM#VORTEX')
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
                    DisplayName: 'Tess',
                    fileURL: 'TestURL',
                    Color: 'purple',
                    connectionTargets: ['SESSION#TestSession']
                }]
            }]
        })
        expect(apiClientMock.send).toHaveBeenCalledTimes(1)
        const sent = JSON.parse(apiClientMock.send.mock.calls[0][0].Data)
        expect(sent).toEqual({
            messageType: 'Ephemera',
            RequestId: 'Request123',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: 'CHARACTER#ABC',
                Connected: true,
                RoomId: 'ROOM#VORTEX',
                DisplayName: 'Tess',
                fileURL: 'TestURL',
                Color: 'purple',
            }],
        })
    })

    it('should call apiClient against all connectionIds for global message', async () => {
        internalCacheMock.Global.get.mockImplementation(async (key) => {
            switch(key) {
                case 'ConnectionId':
                    return 'TestConnection'
                case 'sessions':
                    return ['Session1']
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
                    DisplayName: 'Tess',
                    fileURL: 'TestURL',
                    Color: 'purple',
                    connectionTargets: ['GLOBAL']
                }]
            }]
        })
        const expectedPayload = {
            messageType: 'Ephemera',
            RequestId: 'Request123',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: 'CHARACTER#ABC',
                Connected: true,
                RoomId: 'ROOM#VORTEX',
                DisplayName: 'Tess',
                fileURL: 'TestURL',
                Color: 'purple',
            }],
        }
        expect(apiClientMock.send).toHaveBeenCalledTimes(2)
        for (const connectionId of ['Connection1', 'Connection2']) {
            const call = apiClientMock.send.mock.calls.find(([args]) => args.ConnectionId === connectionId)
            expect(call).toBeDefined()
            expect(JSON.parse(call![0].Data)).toEqual(expectedPayload)
        }
    })

    it('enriches partial CharacterInPlay with resolveCharacterRoomId, not legacy meta RoomId', async () => {
        internalCacheMock.Global.get.mockResolvedValueOnce('Request123').mockResolvedValueOnce([])
        internalCacheMock.SessionConnections.get.mockResolvedValueOnce(['TestConnection'])
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#ABC',
            Name: 'Tess',
            RoomId: 'ROOM#legacy-stale',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            assets: [],
            Color: 'purple',
            fileURL: 'TestURL',
        })
        resolveCharacterRoomIdMock.mockResolvedValue('ROOM#Bridge')

        await ephemeraUpdateMessage({
            payloads: [{
                type: 'EphemeraUpdate',
                updates: [{
                    type: 'CharacterInPlay',
                    CharacterId: 'CHARACTER#ABC',
                    Connected: true,
                    connectionTargets: ['SESSION#TestSession'],
                }]
            }]
        })

        expect(resolveCharacterRoomIdMock).toHaveBeenCalledWith('CHARACTER#ABC')
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'TestConnection',
            Data: expect.stringContaining('"RoomId":"ROOM#Bridge"'),
        })
        expect(apiClientMock.send).not.toHaveBeenCalledWith(
            expect.objectContaining({
                Data: expect.stringContaining('"RoomId":"ROOM#legacy-stale"'),
            })
        )
    })

})
