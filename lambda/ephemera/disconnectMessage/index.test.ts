jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import {
    connectionDB,
    ephemeraDB,
} from '@tonylb/mtw-utilities/ts/dynamoDB/index'

jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('../internalCache')
import internalCache from '../internalCache'

const connectionDBMock = connectionDB as jest.Mocked<typeof connectionDB>
const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

import {
    disconnectCharacterMessage,
    unregisterCharacterMessage,
    atomicallyRemoveCharacterAdjacency,
} from '.'

describe('disconnectMessage handlers', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        internalCacheMock.Global.get.mockImplementation(async (arg) => {
            if (arg === 'ConnectionId') return 'TestConnection'
            if (arg === 'RequestId') return 'Request123'
            return ''
        })
    })

    describe('disconnectCharacterMessage', () => {
        it('publishes WorldMessage and RoomUpdate when CharacterMeta has a RoomId', async () => {
            internalCacheMock.CharacterMeta.get.mockResolvedValueOnce({
                EphemeraId: 'CHARACTER#ABC',
                Name: 'Tess',
                RoomId: 'ROOM#TestABC',
                RoomStack: [],
                Color: 'purple',
                HomeId: 'ROOM#VORTEX',
                assets: [],
                Pronouns: 'they/them',
            } as any)

            await disconnectCharacterMessage({
                payloads: [{ type: 'DisconnectCharacter', characterId: 'CHARACTER#ABC' }],
                messageBus,
            })

            expect(messageBusMock.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['ROOM#TestABC', '!CHARACTER#ABC'],
                displayProtocol: 'WorldMessage',
                message: ['Tess has disconnected.'],
            })
            expect(messageBusMock.send).toHaveBeenCalledWith({
                type: 'RoomUpdate',
                roomId: 'ROOM#TestABC',
            })
        })

        it('emits no messages when CharacterMeta lacks a RoomId', async () => {
            internalCacheMock.CharacterMeta.get.mockResolvedValueOnce(undefined as any)

            await disconnectCharacterMessage({
                payloads: [{ type: 'DisconnectCharacter', characterId: 'CHARACTER#ABC' }],
                messageBus,
            })

            expect(messageBusMock.send).not.toHaveBeenCalled()
        })
    })

    describe('unregisterCharacterMessage', () => {
        it('removes adjacency and emits Unregistration ReturnValue per payload', async () => {
            internalCacheMock.CharacterSessions.get.mockResolvedValue(['SESSION#1'])
            internalCacheMock.SessionConnections.get.mockResolvedValue(['TestConnection'])
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#ABC',
                Name: 'Tess',
                RoomId: 'ROOM#TestABC',
                RoomStack: [],
                Color: 'purple',
                HomeId: 'ROOM#VORTEX',
                assets: [],
                Pronouns: 'they/them',
            } as any)
            connectionDBMock.transactWrite.mockResolvedValue(undefined)
            ephemeraDBMock.optimisticUpdate.mockResolvedValue(undefined as any)

            await unregisterCharacterMessage({
                payloads: [{ type: 'UnregisterCharacter', characterId: 'CHARACTER#ABC' }],
                messageBus,
            })

            expect(connectionDBMock.transactWrite).toHaveBeenCalled()
            expect(messageBusMock.send).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'Unregistration',
                    CharacterId: 'CHARACTER#ABC',
                    RequestId: 'Request123',
                },
            })
        })
    })

    describe('atomicallyRemoveCharacterAdjacency', () => {
        it('skips the transaction when the character has no live connections', async () => {
            internalCacheMock.CharacterSessions.get.mockResolvedValue([])
            internalCacheMock.SessionConnections.get.mockResolvedValue([])
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#ABC',
                Name: 'Tess',
                RoomId: 'ROOM#TestABC',
                RoomStack: [],
                Color: 'purple',
                HomeId: 'ROOM#VORTEX',
                assets: [],
                Pronouns: 'they/them',
            } as any)

            await atomicallyRemoveCharacterAdjacency('TestConnection', 'CHARACTER#ABC')

            expect(connectionDBMock.transactWrite).not.toHaveBeenCalled()
            expect(ephemeraDBMock.optimisticUpdate).not.toHaveBeenCalled()
        })
    })
})
