jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    ephemeraDB,
    connectionDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'

jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('../internalCache')
import internalCache from '../internalCache'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const connectionDBMock = connectionDB as jest.Mocked<typeof connectionDB>
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>
const internalCacheMock = jest.mocked(internalCache, true)

import registerCharacter from '.'

describe("registerCharacter", () => {
    const transactWriteMockImplementation = (props: Record<string, any>) => async (items) => {
        items.forEach((item) => {
            if ('Update' in item && item.Update.successCallback) {
                item.Update.successCallback(props)
            }
        })
    }

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
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            Color: 'purple',
            HomeId: 'ROOM#VORTEX',
            assets: [],
            Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' }
        })
        connectionDBMock.transactWrite.mockImplementation(transactWriteMockImplementation({ connections: ['TestConnection']}))
        await registerCharacter({
            payloads: [{ type: 'RegisterCharacter', characterId: 'CHARACTER#ABC' }],
            messageBus
        })
        expect(connectionDBMock.transactWrite).toHaveBeenCalledWith([
            { Put: { ConnectionId: 'CONNECTION#TestConnection', DataCategory: 'CHARACTER#ABC' } },
            {
                Update: {
                    Key: {
                        ConnectionId: 'CHARACTER#ABC',
                        DataCategory: 'Meta::Character'
                    },
                    updateKeys: ['connections'],
                    updateReducer: expect.any(Function),
                    successCallback: expect.any(Function)
                }
            }
        ])
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: "Registration",
                CharacterId: 'CHARACTER#ABC',
                RequestId: 'Request123'
            }
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'CheckLocation',
            characterId: 'CHARACTER#ABC',
            forceMove: true,
            arriveMessage: ' has connected.'
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'CacheCharacterAssets',
            characterId: 'CHARACTER#ABC'
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'EphemeraUpdate',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: 'CHARACTER#ABC',
                Connected: true,
                connectionTargets: ['GLOBAL', 'CONNECTION#TestConnection']
            }]
        })
        expect(internalCacheMock.CharacterConnections.set).toHaveBeenCalledWith('CHARACTER#ABC', ['TestConnection'])
    })

    it("should update correctly on subsequent connections", async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValueOnce({
            EphemeraId: 'CHARACTER#ABC',
            Name: 'Tess',
            RoomId: 'ROOM#TestABC',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            Color: 'purple',
            HomeId: 'ROOM#VORTEX',
            assets: [],
            Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' }
        })
        connectionDBMock.transactWrite.mockImplementation(transactWriteMockImplementation({ connections: ['previous', 'TestConnection']}))
        await registerCharacter({ payloads: [{ type: 'RegisterCharacter', characterId: 'CHARACTER#ABC' }], messageBus })
        expect(messageBusMock.send).toHaveBeenCalledTimes(1)
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: "Registration",
                CharacterId: 'CHARACTER#ABC',
                RequestId: 'Request123'
            }
        })
        expect(internalCacheMock.CharacterConnections.set).toHaveBeenCalledWith('CHARACTER#ABC', ['previous', 'TestConnection'])
    })

})