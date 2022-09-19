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

import registerCharacter from '.'

describe("registerCharacter", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        internalCacheMock.Global.get.mockResolvedValueOnce('TestConnection').mockResolvedValueOnce('Request123')
    })

    it("should update correctly on first connection", async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValueOnce({
            EphemeraId: 'CHARACTER#ABC',
            Name: 'Tess',
            RoomId: 'TestABC',
            Color: 'purple',
            HomeId: 'VORTEX'
        })
        internalCacheMock.RoomCharacterList.get.mockResolvedValueOnce([{
                EphemeraId: 'CHARACTER#BCD',
                Name: 'TestToo',
                ConnectionIds: ['QRS']
            }])
        connectionDBMock.getItem.mockResolvedValueOnce({})
        await registerCharacter({
            payloads: [{ type: 'RegisterCharacter', characterId: 'ABC' }],
            messageBus
        })
        expect(multiTableTransactWrite).toHaveBeenCalledTimes(1)
        expect(multiTableTransactWriteMock.mock.calls[0][0]).toMatchSnapshot()
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: "Registration",
                CharacterId: 'ABC',
                RequestId: 'Request123'
            }
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'EphemeraUpdate',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: 'ABC',
                Connected: true,
                Name: 'Tess',
                RoomId: 'TestABC',
                fileURL: '',
                Color: 'purple'
            }]
        })
    })

    it("should update correctly on subsequent connections", async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValueOnce({
            EphemeraId: 'CHARACTER#ABC',
            Name: 'Tess',
            RoomId: 'TestABC',
            Color: 'purple',
            HomeId: 'VORTEX'
        })
        internalCacheMock.RoomCharacterList.get.mockResolvedValueOnce([{
                EphemeraId: 'CHARACTER#ABC',
                Name: 'Tess',
                ConnectionIds: ['previous']
            }])
        connectionDBMock.getItem.mockResolvedValueOnce({
            connections: ['previous']
        })
        await registerCharacter({ payloads: [{ type: 'RegisterCharacter', characterId: 'ABC' }], messageBus })
        expect(multiTableTransactWrite).toHaveBeenCalledTimes(1)
        expect(multiTableTransactWriteMock.mock.calls[0][0]).toMatchSnapshot()
        expect(messageBusMock.send).toHaveBeenCalledTimes(1)
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: "Registration",
                CharacterId: 'ABC',
                RequestId: 'Request123'
            }
        })
    })

})