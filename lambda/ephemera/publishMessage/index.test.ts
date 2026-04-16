jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { messageDeltaDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
jest.mock('@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient')
import { apiClient } from '@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient'

jest.mock('uuid')
import { v4 as uuidv4 } from 'uuid'

jest.mock('../internalCache')
import internalCache from "../internalCache"

import publishMessage from './index'

const messageDeltaDBMock = messageDeltaDB as jest.Mocked<typeof messageDeltaDB>
const apiClientMock = apiClient as jest.Mocked<typeof apiClient>
const uuidMock = uuidv4 as jest.Mock
// @ts-ignore
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
        cacheMock.CharacterSessions.get.mockResolvedValue(['Z123'])
        cacheMock.SessionConnections.get.mockResolvedValue(['Y123', 'Y456'])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                message: ['Test']
            }]
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "1000000000000::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000000,
            Message: ['Test'],
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
                    Message: ['Test'],
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
                    Message: ['Test'],
                    DisplayProtocol: 'WorldMessage'
                }]
            })
        })
    })

    it('should dispatch WorldOOCMessage with same wire shape as WorldMessage', async () => {
        cacheMock.OrchestrateMessages.allOffsets.mockReturnValue({})
        cacheMock.CharacterSessions.get.mockResolvedValue(['Z123'])
        cacheMock.SessionConnections.get.mockResolvedValue(['Y123'])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['Out of world']
            }]
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: 'CHARACTER#123',
            DeltaId: '1000000000000::MESSAGE#UUID',
            RowId: 'MESSAGE#UUID',
            CreatedTime: 1000000000000,
            Message: ['Out of world'],
            DisplayProtocol: 'WorldOOCMessage'
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'Y123',
            Data: JSON.stringify({
                messageType: 'Messages',
                messages: [{
                    Target: 'CHARACTER#123',
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000000,
                    Message: ['Out of world'],
                    DisplayProtocol: 'WorldOOCMessage'
                }]
            })
        })
    })

    it('uses shared messageId and explicit createdTime for WorldMessage when provided', async () => {
        cacheMock.OrchestrateMessages.allOffsets.mockReturnValue({})
        cacheMock.CharacterSessions.get.mockResolvedValue(['Z123'])
        cacheMock.SessionConnections.get.mockResolvedValue(['Y123'])
        await publishMessage({
            payloads: [
                {
                    type: 'PublishMessage',
                    targets: ['CHARACTER#123'],
                    displayProtocol: 'WorldMessage',
                    message: ['Hypothesis: Generating...'],
                    messageId: 'MESSAGE#SHARED',
                    createdTime: 1000000000000,
                },
                {
                    type: 'PublishMessage',
                    targets: ['CHARACTER#123'],
                    displayProtocol: 'WorldMessage',
                    message: ['Hypothesis: Stubbed'],
                    messageId: 'MESSAGE#SHARED',
                    createdTime: 1000000000001,
                },
            ],
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: 'CHARACTER#123',
            DeltaId: '1000000000000::MESSAGE#SHARED',
            RowId: 'MESSAGE#SHARED',
            CreatedTime: 1000000000000,
            Message: ['Hypothesis: Generating...'],
            DisplayProtocol: 'WorldMessage',
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: 'CHARACTER#123',
            DeltaId: '1000000000001::MESSAGE#SHARED',
            RowId: 'MESSAGE#SHARED',
            CreatedTime: 1000000000001,
            Message: ['Hypothesis: Stubbed'],
            DisplayProtocol: 'WorldMessage',
        })
    })

    it('should remap room targets dynamically', async () => {
        cacheMock.OrchestrateMessages.allOffsets.mockReturnValue({})
        cacheMock.RoomCharacterList.get.mockResolvedValue([{
            EphemeraId: 'CHARACTER#123',
            DisplayName: '',
            SessionIds: ['Z123']
        },
        {
            EphemeraId: 'CHARACTER#456',
            DisplayName: '',
            SessionIds: ['Z456']
        }])
        cacheMock.CharacterSessions.get.mockImplementation(async (characterId) => {
            return characterId === 'CHARACTER#123' ? ['Z123'] : ['Z456']
        })
        cacheMock.SessionConnections.get.mockImplementation(async (sessionIds) => {
            // sessionIds is an array, not a single string
            const returnValue = (sessionIds.includes('Z123')) ? ['Y123'] : ['Y456']
            return returnValue
        })
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['ROOM#ABC'],
                displayProtocol: 'WorldMessage',
                message: ['Test']
            }]
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "1000000000000::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000000,
            Message: ['Test'],
            DisplayProtocol: 'WorldMessage'
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#456",
            DeltaId: "1000000000000::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000000,
            Message: ['Test'],
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
                    Message: ['Test'],
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
                    Message: ['Test'],
                    DisplayProtocol: 'WorldMessage'
                }]
            })
        })
    })

    it('should exclude not-character targets', async () => {
        cacheMock.OrchestrateMessages.allOffsets.mockReturnValue({})
        cacheMock.RoomCharacterList.get.mockResolvedValue([{
            EphemeraId: 'CHARACTER#123',
            DisplayName: '',
            SessionIds: ['Z123']
        },
        {
            EphemeraId: 'CHARACTER#456',
            DisplayName: '',
            SessionIds: ['Z456']
        }])
        cacheMock.SessionConnections.get.mockImplementation(async (sessionId) => (sessionId === 'Z123' ? ['Y123'] : ['Y456'] ))
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['ROOM#ABC', '!CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                message: ['Test']
            }]
        })
        expect(messageDeltaDBMock.putItem).not.toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "1000000000000::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000000,
            Message: ['Test'],
            DisplayProtocol: 'WorldMessage'
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#456",
            DeltaId: "1000000000000::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000000,
            Message: ['Test'],
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
                    Message: ['Test'],
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
                    Message: ['Test'],
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
        cacheMock.CharacterSessions.get.mockResolvedValue(['Z123'])
        cacheMock.SessionConnections.get.mockResolvedValue(['Y123'])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                messageGroupId: 'UUID#3',
                message: ['Test leaves']
            },
            {
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                messageGroupId: 'UUID#2',
                message: ['Test arrives']
            },
            {
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                messageGroupId: 'UUID#1',
                message: ['Room description']
            }]
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "999999999999::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 999999999999,
            Message: ['Test leaves'],
            DisplayProtocol: 'WorldMessage'
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "1000000000000::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000000,
            Message: ['Room description'],
            DisplayProtocol: 'WorldMessage'
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "1000000000001::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000001,
            Message: ['Test arrives'],
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
                    Message: ['Test leaves'],
                    DisplayProtocol: 'WorldMessage'
                },
                {
                    Target: "CHARACTER#123",
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000000,
                    Message: ['Room description'],
                    DisplayProtocol: 'WorldMessage'
                },
                {
                    Target: "CHARACTER#123",
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000001,
                    Message: ['Test arrives'],
                    DisplayProtocol: 'WorldMessage'
                }]
            })
        })
    })

})