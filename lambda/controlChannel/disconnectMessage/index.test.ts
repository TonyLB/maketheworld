jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    ephemeraDB,
    connectionDB,
    multiTableTransactWrite
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'

jest.mock('../messageBus')
import messageBus from '../messageBus'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const connectionDBMock = connectionDB as jest.Mocked<typeof connectionDB>
const multiTableTransactWriteMock = multiTableTransactWrite as jest.Mock
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>

import disconnectMessage from '.'

describe("disconnectMessage", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it("should update correctly on last connection", async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            RoomId: 'TestABC',
            Name: 'Tess',
            Color: 'purple'
        })
        .mockResolvedValueOnce({
            activeCharacters: [
                {
                    EphemeraId: 'CHARACTER#BCD',
                    Name: 'TestToo',
                    Connections: ['BCD']
                },
                {
                    EphemeraId: 'CHARACTER#ABC',
                    Name: 'Tess',
                    Connections: ['XYZ']
                }
            ]
        })
        connectionDBMock.getItem.mockResolvedValueOnce({
            connections: ['XYZ']
        })
        connectionDBMock.query.mockResolvedValueOnce([{ DataCategory: 'CHARACTER#ABC' }])
        await disconnectMessage({
            payloads: [{ type: 'Disconnect', connectionId: 'XYZ' }],
            messageBus
        })
        expect(multiTableTransactWrite).toHaveBeenCalledTimes(1)
        expect(multiTableTransactWriteMock.mock.calls[0][0]).toMatchSnapshot()
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'EphemeraUpdate',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: 'ABC',
                Connected: false,
                Name: 'Tess',
                RoomId: 'TestABC',
                fileURL: '',
                Color: 'purple'
            }]
        })
    })

    it("should update correctly on redundant connections", async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            RoomId: 'TestABC'
        })
        .mockResolvedValueOnce({
            activeCharacters: [
                {
                    EphemeraId: 'CHARACTER#BCD',
                    Name: 'TestToo',
                    Connections: ['BCD']
                },
                {
                    EphemeraId: 'CHARACTER#ABC',
                    Name: 'Tess',
                    Connections: ['QRS', 'XYZ']
                }
            ]
        })
        connectionDBMock.getItem.mockResolvedValueOnce({
            connections: ['QRS', 'XYZ']
        })
        connectionDBMock.query.mockResolvedValueOnce([{ DataCategory: 'CHARACTER#ABC' }])
        await disconnectMessage({
            payloads: [{ type: 'Disconnect', connectionId: 'XYZ' }],
            messageBus
        })
        expect(multiTableTransactWrite).toHaveBeenCalledTimes(1)
        expect(multiTableTransactWriteMock.mock.calls[0][0]).toMatchSnapshot()
        expect(messageBusMock.send).not.toHaveBeenCalled()
    })

})