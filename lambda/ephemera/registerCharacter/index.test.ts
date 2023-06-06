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
            RoomId: 'ROOM#TestABC',
            Color: 'purple',
            HomeId: 'ROOM#VORTEX',
            assets: [],
            Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' }
        })
        internalCacheMock.RoomCharacterList.get.mockResolvedValueOnce([{
                EphemeraId: 'CHARACTER#BCD',
                Name: 'TestToo',
                ConnectionIds: ['QRS']
            }])
        internalCacheMock.CharacterConnections.get.mockResolvedValue([])
        await registerCharacter({
            payloads: [{ type: 'RegisterCharacter', characterId: 'CHARACTER#ABC' }],
            messageBus
        })
        expect(multiTableTransactWrite).toHaveBeenCalledTimes(1)
        expect(multiTableTransactWriteMock.mock.calls[0][0]).toMatchSnapshot()
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: "Registration",
                CharacterId: 'CHARACTER#ABC',
                RequestId: 'Request123'
            }
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'EphemeraUpdate',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: 'CHARACTER#ABC',
                Connected: true,
                Name: 'Tess',
                RoomId: 'ROOM#TestABC',
                fileURL: '',
                Color: 'purple',
                targets: ['GLOBAL', 'CONNECTION#TestConnection']
            }]
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: ['ROOM#TestABC', '!CHARACTER#ABC'],
            displayProtocol: 'WorldMessage',
            message: [{
                tag: 'String',
                value: `Tess has connected.`
            }]
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'RoomUpdate',
            roomId: 'ROOM#TestABC'
        })
        expect(internalCacheMock.RoomCharacterList.set).toHaveBeenCalledWith({
            key: 'ROOM#TestABC',
            value: [
                {
                    EphemeraId: 'CHARACTER#BCD',
                    Name: 'TestToo',
                    ConnectionIds: ['QRS']
                },
                {
                    EphemeraId: 'CHARACTER#ABC',
                    Name: 'Tess',
                    Color: 'purple',
                    ConnectionIds: ['TestConnection']
                }
            ]
        })
    })

    it("should update correctly on subsequent connections", async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValueOnce({
            EphemeraId: 'CHARACTER#ABC',
            Name: 'Tess',
            RoomId: 'ROOM#TestABC',
            Color: 'purple',
            HomeId: 'ROOM#VORTEX',
            assets: [],
            Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' }
        })
        internalCacheMock.RoomCharacterList.get.mockResolvedValueOnce([{
                EphemeraId: 'CHARACTER#ABC',
                Name: 'Tess',
                ConnectionIds: ['previous']
            }])
        internalCacheMock.CharacterConnections.get.mockResolvedValue(['previous'])
        await registerCharacter({ payloads: [{ type: 'RegisterCharacter', characterId: 'CHARACTER#ABC' }], messageBus })
        expect(multiTableTransactWrite).toHaveBeenCalledTimes(1)
        expect(multiTableTransactWriteMock.mock.calls[0][0]).toMatchSnapshot()
        expect(messageBusMock.send).toHaveBeenCalledTimes(2)
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: "Registration",
                CharacterId: 'CHARACTER#ABC',
                RequestId: 'Request123'
            }
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'Perception',
            characterId: 'CHARACTER#ABC',
            ephemeraId: 'ROOM#TestABC',
            header: true
        })
        expect(internalCacheMock.RoomCharacterList.set).toHaveBeenCalledWith({
            key: 'ROOM#TestABC',
            value: [{
                EphemeraId: 'CHARACTER#ABC',
                Name: 'Tess',
                Color: 'purple',
                ConnectionIds: ['previous', 'TestConnection']
            }]
        })
    })

})