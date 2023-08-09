jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    ephemeraDB,
    legacyConnectionDB as connectionDB,
    connectionDB as newConnectionDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'

jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('../internalCache')
import internalCache from '../internalCache'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const connectionDBMock = connectionDB as jest.Mocked<typeof connectionDB>
const newConnectionDBMock = newConnectionDB as jest.Mocked<typeof newConnectionDB>
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
            RoomId: 'ROOM#TestABC',
            Name: 'Tess',
            Color: 'purple',
            HomeId: 'ROOM#VORTEX',
            assets: [],
            Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' }
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
        internalCacheMock.CharacterConnections.get.mockResolvedValue(['XYZ'])
        connectionDBMock.query.mockResolvedValueOnce([{ DataCategory: 'CHARACTER#ABC' }])
        newConnectionDBMock.transactWrite.mockImplementation(async (items) => {
            items.forEach((item) => {
                if ('Update' in item && item.Update.successCallback) {
                    item.Update.successCallback({ connections: [] })
                }
            })
        })
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ successCallback }) => {
            if (successCallback) {
                successCallback({ activeCharacters: [
                    {
                        EphemeraId: 'CHARACTER#BCD',
                        Name: 'TestToo',
                        ConnectionIds: ['BCD']
                    }
                ]})
            }
            return {}
        })
        await disconnectMessage({
            payloads: [{ type: 'Disconnect', connectionId: 'XYZ' }],
            messageBus
        })
        expect(newConnectionDBMock.transactWrite).toHaveBeenCalledTimes(1)
        expect(newConnectionDBMock.transactWrite.mock.calls[0][0]).toEqual([
            { Delete: { ConnectionId: 'CONNECTION#XYZ', DataCategory: 'CHARACTER#ABC' } },
            { Update: {
                Key: { ConnectionId: 'CHARACTER#ABC', DataCategory: 'Meta::Character' },
                updateKeys: ['connections'],
                updateReducer: expect.any(Function),
                deleteCondition: expect.any(Function),
                successCallback: expect.any(Function)
            }},
            { Update: {
                Key: { ConnectionId: 'Map', DataCategory: 'Subscriptions' },
                updateKeys: ['connections'],
                updateReducer: expect.any(Function)
            }}
        ])
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'EphemeraUpdate',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: 'CHARACTER#ABC',
                Connected: false,
                targets: ['GLOBAL', '!CONNECTION#XYZ']
            }]
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: ['ROOM#TestABC', '!CHARACTER#ABC'],
            displayProtocol: 'WorldMessage',
            message: [{
                tag: 'String',
                value: `Tess has disconnected.`
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
                    ConnectionIds: ['BCD']
                }
            ]
        })
    })

    it("should update correctly on redundant connections", async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValueOnce({
            EphemeraId: 'CHARACTER#ABC',
            Name: 'Tess',
            RoomId: 'ROOM#TestABC',
            HomeId: 'ROOM#VORTEX',
            assets: [],
            Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' }
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
        internalCacheMock.CharacterConnections.get.mockResolvedValue(['QRS', 'XYZ'])
        connectionDBMock.query.mockResolvedValueOnce([{ DataCategory: 'CHARACTER#ABC' }])
        connectionDBMock.query.mockResolvedValueOnce([{ DataCategory: 'CHARACTER#ABC' }])
        newConnectionDBMock.transactWrite.mockImplementation(async (items) => {
            items.forEach((item) => {
                if ('Update' in item && item.Update.successCallback) {
                    item.Update.successCallback({ connections: ['QRS'] })
                }
            })
        })
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ successCallback }) => {
            if (successCallback) {
                successCallback({ activeCharacters: [
                    {
                        EphemeraId: 'CHARACTER#BCD',
                        Name: 'TestToo',
                        ConnectionIds: ['BCD']
                    },
                    {
                        EphemeraId: 'CHARACTER#ABC',
                        Name: 'Tess',
                        ConnectionIds: ['QRS']
                    }
                ]})
            }
            return {}
        })
        await disconnectMessage({
            payloads: [{ type: 'Disconnect', connectionId: 'XYZ' }],
            messageBus
        })
        expect(newConnectionDBMock.transactWrite).toHaveBeenCalledTimes(1)
        expect(newConnectionDBMock.transactWrite.mock.calls[0][0]).toEqual([
            { Delete: { ConnectionId: 'CONNECTION#XYZ', DataCategory: 'CHARACTER#ABC' } },
            { Update: {
                Key: { ConnectionId: 'CHARACTER#ABC', DataCategory: 'Meta::Character' },
                updateKeys: ['connections'],
                updateReducer: expect.any(Function),
                deleteCondition: expect.any(Function),
                successCallback: expect.any(Function)
            }},
            { Update: {
                Key: { ConnectionId: 'Map', DataCategory: 'Subscriptions' },
                updateKeys: ['connections'],
                updateReducer: expect.any(Function)
            }}
        ])
        expect(messageBusMock.send).not.toHaveBeenCalled()
        expect(internalCacheMock.RoomCharacterList.set).toHaveBeenCalledWith({
            key: 'ROOM#TestABC',
            value: [
                {
                    EphemeraId: 'CHARACTER#BCD',
                    Name: 'TestToo',
                    ConnectionIds: ['BCD']
                },
                {
                    EphemeraId: 'CHARACTER#ABC',
                    Name: 'Tess',
                    ConnectionIds: ['QRS']
                }
            ]
        })
    })

})