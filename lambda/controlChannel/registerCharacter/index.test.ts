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
const internalCacheMock = internalCache as jest.Mocked<typeof internalCache>

import registerCharacter from '.'

describe("registerCharacter", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        internalCacheMock.get.mockResolvedValueOnce('TestConnection').mockResolvedValueOnce('Request123')
    })

    it("should update correctly on first connection", async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            Name: 'Tess',
            RoomId: 'TestABC',
            Color: 'purple'
        })
        .mockResolvedValueOnce({
            activeCharacters: [{
                EphemeraId: 'CHARACTER#BCD',
                Name: 'TestToo'
            }]
        })
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
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            Name: 'Tess',
            RoomId: 'TestABC'
        })
        .mockResolvedValueOnce({
            activeCharacters: [{
                EphemeraId: 'CHARACTER#ABC',
                Name: 'Tess',
                ConnectionIds: ['previous']
            }]
        })
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