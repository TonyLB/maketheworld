jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { messageDeltaDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
jest.mock('@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient')
import { apiClient } from '@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient'

jest.mock('uuid')
import { v4 as uuidv4 } from 'uuid'

jest.mock('../internalCache')
import internalCache from "../internalCache"

import publishMessage from './index'

const messageDeltaDBMock = messageDeltaDB as jest.Mocked<typeof messageDeltaDB>
const apiClientMock = apiClient as jest.Mocked<typeof apiClient>
const uuidMock = uuidv4 as jest.Mock
const cacheMock = jest.mocked(internalCache, true)

describe('PublishMessage', () => {
    const realDateNow = Date.now.bind(global.Date);

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        uuidMock.mockReturnValue('UUID')
        const dateNowStub = jest.fn(() => 1000000000000)
        global.Date.now = dateNowStub
    })

    afterEach(() => {
        global.Date.now = realDateNow
    })

    it('should correctly dispatch direct messages', async () => {
        cacheMock.OrchestrateMessages.allOffsets.mockReturnValue({})
        cacheMock.CharacterConnections.get.mockResolvedValue(['Y123', 'Y456'])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                message: [{ tag: 'String', value: 'Test' }]
            }]
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "1000000000000::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000000,
            Message: [{ tag: 'String', value: 'Test' }],
            DisplayProtocol: 'WorldMessage'
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'Y123',
            Data: JSON.stringify({
                messageType: 'Messages',
                messages: [{
                    Target: "CHARACTER#123",
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000000,
                    Message: [{ tag: 'String', value: 'Test' }],
                    DisplayProtocol: 'WorldMessage'
                }]
            })
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'Y456',
            Data: JSON.stringify({
                messageType: 'Messages',
                messages: [{
                    Target: "CHARACTER#123",
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000000,
                    Message: [{ tag: 'String', value: 'Test' }],
                    DisplayProtocol: 'WorldMessage'
                }]
            })
        })
    })

    it('should remap room targets dynamically', async () => {
        cacheMock.OrchestrateMessages.allOffsets.mockReturnValue({})
        cacheMock.RoomCharacterList.get.mockResolvedValue([{
            EphemeraId: 'CHARACTER#123',
            Name: '',
            ConnectionIds: ['Y123']
        },
        {
            EphemeraId: 'CHARACTER#456',
            Name: '',
            ConnectionIds: ['Y456']
        }])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['ROOM#ABC'],
                displayProtocol: 'WorldMessage',
                message: [{ tag: 'String', value: 'Test' }]
            }]
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "1000000000000::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000000,
            Message: [{ tag: 'String', value: 'Test' }],
            DisplayProtocol: 'WorldMessage'
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#456",
            DeltaId: "1000000000000::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000000,
            Message: [{ tag: 'String', value: 'Test' }],
            DisplayProtocol: 'WorldMessage'
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'Y123',
            Data: JSON.stringify({
                messageType: 'Messages',
                messages: [{
                    Target: "CHARACTER#123",
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000000,
                    Message: [{ tag: 'String', value: 'Test' }],
                    DisplayProtocol: 'WorldMessage'
                }]
            })
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'Y456',
            Data: JSON.stringify({
                messageType: 'Messages',
                messages: [{
                    Target: "CHARACTER#456",
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000000,
                    Message: [{ tag: 'String', value: 'Test' }],
                    DisplayProtocol: 'WorldMessage'
                }]
            })
        })
    })

    it('should exclude not-character targets', async () => {
        cacheMock.OrchestrateMessages.allOffsets.mockReturnValue({})
        cacheMock.RoomCharacterList.get.mockResolvedValue([{
            EphemeraId: 'CHARACTER#123',
            Name: '',
            ConnectionIds: ['Y123']
        },
        {
            EphemeraId: 'CHARACTER#456',
            Name: '',
            ConnectionIds: ['Y456']
        }])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['ROOM#ABC', '!CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                message: [{ tag: 'String', value: 'Test' }]
            }]
        })
        expect(messageDeltaDBMock.putItem).not.toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "1000000000000::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000000,
            Message: [{ tag: 'String', value: 'Test' }],
            DisplayProtocol: 'WorldMessage'
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#456",
            DeltaId: "1000000000000::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000000,
            Message: [{ tag: 'String', value: 'Test' }],
            DisplayProtocol: 'WorldMessage'
        })
        expect(apiClientMock.send).not.toHaveBeenCalledWith({
            ConnectionId: 'Y123',
            Data: JSON.stringify({
                messageType: 'Messages',
                messages: [{
                    Target: "CHARACTER#123",
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000000,
                    Message: [{ tag: 'String', value: 'Test' }],
                    DisplayProtocol: 'WorldMessage'
                }]
            })
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'Y456',
            Data: JSON.stringify({
                messageType: 'Messages',
                messages: [{
                    Target: "CHARACTER#456",
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000000,
                    Message: [{ tag: 'String', value: 'Test' }],
                    DisplayProtocol: 'WorldMessage'
                }]
            })
        })
    })

    it('should correctly sort messageGroups', async () => {
        cacheMock.OrchestrateMessages.allOffsets.mockReturnValue({
            'UUID#1': 0,
            'UUID#2': 1,
            'UUID#3': -1
        })
        cacheMock.CharacterConnections.get.mockResolvedValue(['Y123'])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                messageGroupId: 'UUID#3',
                message: [{ tag: 'String', value: 'Test leaves' }]
            },
            {
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                messageGroupId: 'UUID#2',
                message: [{ tag: 'String', value: 'Test arrives' }]
            },
            {
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                messageGroupId: 'UUID#1',
                message: [{ tag: 'String', value: 'Room description' }]
            }]
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "999999999999::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 999999999999,
            Message: [{ tag: 'String', value: 'Test leaves' }],
            DisplayProtocol: 'WorldMessage'
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "1000000000000::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000000,
            Message: [{ tag: 'String', value: 'Room description' }],
            DisplayProtocol: 'WorldMessage'
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "1000000000001::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000001,
            Message: [{ tag: 'String', value: 'Test arrives' }],
            DisplayProtocol: 'WorldMessage'
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'Y123',
            Data: JSON.stringify({
                messageType: 'Messages',
                messages: [{
                    Target: "CHARACTER#123",
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 999999999999,
                    Message: [{ tag: 'String', value: 'Test leaves' }],
                    DisplayProtocol: 'WorldMessage'
                },
                {
                    Target: "CHARACTER#123",
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000000,
                    Message: [{ tag: 'String', value: 'Room description' }],
                    DisplayProtocol: 'WorldMessage'
                },
                {
                    Target: "CHARACTER#123",
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000001,
                    Message: [{ tag: 'String', value: 'Test arrives' }],
                    DisplayProtocol: 'WorldMessage'
                }]
            })
        })
    })

})