jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    ephemeraDB,
    connectionDB,
    multiTableTransactWrite
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'

jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('../internalCache')
import internalCache from '../internalCache'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const connectionDBMock = connectionDB as jest.Mocked<typeof connectionDB>
const multiTableTransactWriteMock = multiTableTransactWrite as jest.Mock
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>
const internalCacheMock = jest.mocked(internalCache, true)

import disconnectMessage from '.'

describe("disconnectMessage", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it("should update correctly on last connection", async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValueOnce({
            EphemeraId: 'CHARACTER#ABC',
            RoomId: 'TestABC',
            Name: 'Tess',
            Color: 'purple',
            HomeId: 'VORTEX'
        })
        internalCacheMock.RoomCharacterList.get.mockResolvedValueOnce([
                {
                    EphemeraId: 'CHARACTER#BCD',
                    Name: 'TestToo',
                    ConnectionIds: ['BCD']
                },
                {
                    EphemeraId: 'CHARACTER#ABC',
                    Name: 'Tess',
                    ConnectionIds: ['XYZ']
                }
            ])
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
        expect(internalCacheMock.RoomCharacterList.set).toHaveBeenCalledWith({
            key: 'TestABC',
            value: [
                {
                    EphemeraId: 'CHARACTER#BCD',
                    Name: 'TestToo',
                    ConnectionIds: ['BCD']
                }
            ]
        })
    })

    it("should update correctly on redundant connections", async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValueOnce({
            EphemeraId: 'CHARACTER#ABC',
            Name: 'Tess',
            RoomId: 'TestABC',
            HomeId: 'VORTEX'
        })
        internalCacheMock.RoomCharacterList.get.mockResolvedValueOnce([
                {
                    EphemeraId: 'CHARACTER#BCD',
                    Name: 'TestToo',
                    ConnectionIds: ['BCD']
                },
                {
                    EphemeraId: 'CHARACTER#ABC',
                    Name: 'Tess',
                    ConnectionIds: ['QRS', 'XYZ']
                }
            ])
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
        expect(internalCacheMock.RoomCharacterList.set).toHaveBeenCalledWith({
            key: 'TestABC',
            value: [
                {
                    EphemeraId: 'CHARACTER#BCD',
                    Name: 'TestToo',
                    ConnectionIds: ['BCD']
                },
                {
                    EphemeraId: 'CHARACTER#ABC',
                    Name: 'Tess',
                    ConnectionIds: ['QRS'],
                    HomeId: 'VORTEX',
                    RoomId: 'TestABC'
                }
            ]
        })
    })

})