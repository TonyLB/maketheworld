jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { messageDeltaDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
jest.mock('@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient')
import { apiClient } from '@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient'

jest.mock('uuid')
import { v4 as uuidv4 } from 'uuid'

jest.mock('../internalCache')
import internalCache from "../internalCache"

jest.mock('../internalCache/hydrateRoomRoster', () => ({
    getRoomCharacterList: jest.fn(),
}))
import { getRoomCharacterList } from '../internalCache/hydrateRoomRoster'

import publishMessage from './index'

const messageDeltaDBMock = messageDeltaDB as jest.Mocked<typeof messageDeltaDB>
const apiClientMock = apiClient as jest.Mocked<typeof apiClient>
const uuidMock = uuidv4 as jest.Mock
// @ts-ignore
const cacheMock = jest.mocked(internalCache, true)
const getRoomCharacterListMock = jest.mocked(getRoomCharacterList)

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

    it('should dispatch CommandTranscriptMessage with same wire shape as WorldMessage', async () => {
        cacheMock.CharacterSessions.get.mockResolvedValue(['Z123'])
        cacheMock.SessionConnections.get.mockResolvedValue(['Y123'])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'CommandTranscriptMessage',
                message: ['look north'],
            }],
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: 'CHARACTER#123',
            DeltaId: '1000000000000::MESSAGE#UUID',
            RowId: 'MESSAGE#UUID',
            CreatedTime: 1000000000000,
            Message: ['look north'],
            DisplayProtocol: 'CommandTranscriptMessage',
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'Y123',
            Data: JSON.stringify({
                messageType: 'Messages',
                messages: [{
                    Target: 'CHARACTER#123',
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000000,
                    Message: ['look north'],
                    DisplayProtocol: 'CommandTranscriptMessage',
                }],
            }),
        })
    })

    it('should dispatch CoyoteGameHypothesisMessage with same wire shape as WorldMessage', async () => {
        cacheMock.CharacterSessions.get.mockResolvedValue(['Z123'])
        cacheMock.SessionConnections.get.mockResolvedValue(['Y123'])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'CoyoteGameHypothesisMessage',
                message: ['Hypothesis: Generating...']
            }]
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: 'CHARACTER#123',
            DeltaId: '1000000000000::MESSAGE#UUID',
            RowId: 'MESSAGE#UUID',
            CreatedTime: 1000000000000,
            Message: ['Hypothesis: Generating...'],
            DisplayProtocol: 'CoyoteGameHypothesisMessage'
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'Y123',
            Data: JSON.stringify({
                messageType: 'Messages',
                messages: [{
                    Target: 'CHARACTER#123',
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000000,
                    Message: ['Hypothesis: Generating...'],
                    DisplayProtocol: 'CoyoteGameHypothesisMessage'
                }]
            })
        })
    })

    it('uses shared messageId and explicit createdTime for WorldMessage when provided', async () => {
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
                    message: ['Hypothesis: Something went wrong'],
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
            Message: ['Hypothesis: Something went wrong'],
            DisplayProtocol: 'WorldMessage',
        })
    })

    it('uses shared messageId and explicit createdTime for CoyoteGameHypothesisMessage when provided', async () => {
        cacheMock.CharacterSessions.get.mockResolvedValue(['Z123'])
        cacheMock.SessionConnections.get.mockResolvedValue(['Y123'])
        await publishMessage({
            payloads: [
                {
                    type: 'PublishMessage',
                    targets: ['CHARACTER#123'],
                    displayProtocol: 'CoyoteGameHypothesisMessage',
                    message: ['Hypothesis: Generating...'],
                    messageId: 'MESSAGE#SHARED',
                    createdTime: 1000000000000,
                },
                {
                    type: 'PublishMessage',
                    targets: ['CHARACTER#123'],
                    displayProtocol: 'CoyoteGameHypothesisMessage',
                    message: ['Hypothesis: Something went wrong'],
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
            DisplayProtocol: 'CoyoteGameHypothesisMessage',
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: 'CHARACTER#123',
            DeltaId: '1000000000001::MESSAGE#SHARED',
            RowId: 'MESSAGE#SHARED',
            CreatedTime: 1000000000001,
            Message: ['Hypothesis: Something went wrong'],
            DisplayProtocol: 'CoyoteGameHypothesisMessage',
        })
    })

    it('should dispatch CoyoteGameHelpMessage with minimal wire payload', async () => {
        cacheMock.CharacterSessions.get.mockResolvedValue(['Z123'])
        cacheMock.SessionConnections.get.mockResolvedValue(['Y123'])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'CoyoteGameHelpMessage',
            }]
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: 'CHARACTER#123',
            DeltaId: '1000000000000::MESSAGE#UUID',
            RowId: 'MESSAGE#UUID',
            CreatedTime: 1000000000000,
            DisplayProtocol: 'CoyoteGameHelpMessage'
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'Y123',
            Data: JSON.stringify({
                messageType: 'Messages',
                messages: [{
                    Target: 'CHARACTER#123',
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000000,
                    DisplayProtocol: 'CoyoteGameHelpMessage'
                }]
            })
        })
    })

    it('should respect explicit messageId and createdTime for CoyoteGameHelpMessage without Message payload', async () => {
        cacheMock.CharacterSessions.get.mockResolvedValue(['Z123'])
        cacheMock.SessionConnections.get.mockResolvedValue(['Y123'])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'CoyoteGameHelpMessage',
                messageId: 'MESSAGE#HELP',
                createdTime: 1000000000123,
            }]
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: 'CHARACTER#123',
            DeltaId: '1000000000123::MESSAGE#HELP',
            RowId: 'MESSAGE#HELP',
            CreatedTime: 1000000000123,
            DisplayProtocol: 'CoyoteGameHelpMessage'
        })
        expect(apiClientMock.send).toHaveBeenCalledWith({
            ConnectionId: 'Y123',
            Data: JSON.stringify({
                messageType: 'Messages',
                messages: [{
                    Target: 'CHARACTER#123',
                    MessageId: 'MESSAGE#HELP',
                    CreatedTime: 1000000000123,
                    DisplayProtocol: 'CoyoteGameHelpMessage'
                }]
            })
        })
        const firstCallPayload = JSON.parse(apiClientMock.send.mock.calls[0][0].Data)
        expect(firstCallPayload.messages[0]).not.toHaveProperty('Message')
    })

    it('should remap room targets dynamically', async () => {
        getRoomCharacterListMock.mockResolvedValue([{
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
        getRoomCharacterListMock.mockResolvedValue([{
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

    it('should assign sequential CreatedTime values by payload array order when no explicit createdTime is supplied', async () => {
        // messageGroupId/allOffsets()-driven reordering was retired in Phase 6 of the
        // messageOrchestration consolidation --- CreatedTime for a payload with no explicit
        // createdTime of its own is now always baseTime + its index in the payloads array.
        cacheMock.CharacterSessions.get.mockResolvedValue(['Z123'])
        cacheMock.SessionConnections.get.mockResolvedValue(['Y123'])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                message: ['Test leaves']
            },
            {
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                message: ['Room description']
            },
            {
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                message: ['Test arrives']
            }]
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "1000000000000::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000000,
            Message: ['Test leaves'],
            DisplayProtocol: 'WorldMessage'
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "1000000000001::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000001,
            Message: ['Room description'],
            DisplayProtocol: 'WorldMessage'
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: "CHARACTER#123",
            DeltaId: "1000000000002::MESSAGE#UUID",
            RowId: "MESSAGE#UUID",
            CreatedTime: 1000000000002,
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
                    CreatedTime: 1000000000000,
                    Message: ['Test leaves'],
                    DisplayProtocol: 'WorldMessage'
                },
                {
                    Target: "CHARACTER#123",
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000001,
                    Message: ['Room description'],
                    DisplayProtocol: 'WorldMessage'
                },
                {
                    Target: "CHARACTER#123",
                    MessageId: 'MESSAGE#UUID',
                    CreatedTime: 1000000000002,
                    Message: ['Test arrives'],
                    DisplayProtocol: 'WorldMessage'
                }]
            })
        })
    })

    it('sends immediate PerceptionMessage revisions in separate wire calls', async () => {
        cacheMock.CharacterSessions.get.mockResolvedValue(['Z123'])
        cacheMock.SessionConnections.get.mockResolvedValue(['Y123'])
        const perceptionMeta = {
            componentUUID: 'ROOM#TEST' as const,
            displayMode: 'header' as const,
            roomChannel: 'render' as const,
        }
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'PerceptionMessage',
                messageId: 'MESSAGE#SHARED',
                createdTime: 1000000000000,
                wmlContent: '<Asset uuid=(render)><Room uuid=(ROOM#TEST)><Render><DisplayName>Generating...</DisplayName></Render></Room></Asset>',
                metaData: perceptionMeta,
            }]
        })
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'PerceptionMessage',
                messageId: 'MESSAGE#SHARED',
                createdTime: 1000000000001,
                wmlContent: '<Asset uuid=(render)><Room uuid=(ROOM#TEST)><Render><DisplayName>Done</DisplayName></Render></Room></Asset>',
                metaData: perceptionMeta,
            }]
        })
        expect(apiClientMock.send).toHaveBeenCalledTimes(2)
        const firstPayload = JSON.parse(apiClientMock.send.mock.calls[0][0].Data)
        const secondPayload = JSON.parse(apiClientMock.send.mock.calls[1][0].Data)
        expect(firstPayload.messages[0].CreatedTime).toBe(1000000000000)
        expect(secondPayload.messages[0].CreatedTime).toBe(1000000000001)
        expect(firstPayload.messages[0].MessageId).toBe('MESSAGE#SHARED')
        expect(secondPayload.messages[0].MessageId).toBe('MESSAGE#SHARED')
    })

    it('uses explicit createdTime for PerceptionMessage when provided', async () => {
        cacheMock.CharacterSessions.get.mockResolvedValue(['Z123'])
        cacheMock.SessionConnections.get.mockResolvedValue(['Y123'])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'PerceptionMessage',
                messageId: 'MESSAGE#PERCEPTION',
                createdTime: 1000000000123,
                wmlContent: '<Asset uuid=(render)><Room uuid=(ROOM#TEST)></Room></Asset>',
                metaData: {
                    componentUUID: 'ROOM#TEST',
                    displayMode: 'header',
                    roomChannel: 'render',
                },
            }]
        })
        expect(messageDeltaDBMock.putItem).toHaveBeenCalledWith({
            Target: 'CHARACTER#123',
            DeltaId: '1000000000123::MESSAGE#PERCEPTION',
            RowId: 'MESSAGE#PERCEPTION',
            CreatedTime: 1000000000123,
            DisplayProtocol: 'PerceptionMessage',
            wmlContent: '<Asset uuid=(render)><Room uuid=(ROOM#TEST)></Room></Asset>',
            metaData: {
                componentUUID: 'ROOM#TEST',
                displayMode: 'header',
                roomChannel: 'render',
            },
        })
    })

})