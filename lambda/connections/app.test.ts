jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => {
    const actual = jest.requireActual('@tonylb/mtw-utilities/ts/dynamoDB') as typeof import('@tonylb/mtw-utilities/ts/dynamoDB')
    return {
        ...actual,
        connectionDB: Object.assign({}, actual.connectionDB, {
            optimisticUpdate: jest.fn(),
            query: jest.fn(),
            transactWrite: jest.fn(),
            getItem: jest.fn(),
            deleteItem: jest.fn()
        })
    }
})
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
jest.mock('@tonylb/mtw-utilities/ts/eventBridge')
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
jest.mock('./disconnect', () => ({
    disconnect: jest.fn().mockResolvedValue(undefined),
    atomicallyRemoveCharacterAdjacency: jest.fn().mockResolvedValue(undefined),
    unregisterCharacterMessage: jest.fn()
}))
jest.mock('./invitationCodes', () => ({
    validateInvitationCode: jest.fn(),
    generateInvitationCode: jest.fn()
}))
jest.mock('./staleSessionFinding', () => ({
    handleStaleSessionFinding: jest.fn().mockResolvedValue(undefined)
}))
jest.mock('./registerCharacter', () => ({
    registerCharacterMessage: jest.fn()
}))

import { disconnect } from './disconnect'
import { generateInvitationCode, validateInvitationCode } from './invitationCodes'
import { registerCharacterMessage } from './registerCharacter'
import { handleStaleSessionFinding } from './staleSessionFinding'
import { handler } from './app'

const connectionDBMock = jest.mocked(connectionDB)
const eventBridgeClientMock = jest.mocked(eventBridgeClient)
const disconnectMock = jest.mocked(disconnect)
const generateInvitationCodeMock = jest.mocked(generateInvitationCode)
const validateInvitationCodeMock = jest.mocked(validateInvitationCode)
const registerCharacterMessageMock = jest.mocked(registerCharacterMessage)
const handleStaleSessionFindingMock = jest.mocked(handleStaleSessionFinding)
const queryMock = connectionDB.query as unknown as jest.Mock

describe('connections app checkSession', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.useRealTimers()
        connectionDBMock.getItem.mockResolvedValue({ player: 'test-player' })
        registerCharacterMessageMock.mockResolvedValue({
            messageType: 'Registration',
            CharacterId: 'CHARACTER#abc',
            RequestId: 'request-1'
        })
    })

    const mockShouldDropOptimisticUpdate = () => {
        connectionDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer }: any) => {
            const draft: { connections: string[]; dropAfter?: number; shouldDrop?: string } = {
                connections: [],
                dropAfter: Date.now() - 1000
            }
            updateReducer(draft)
            return draft
        })
    }

    it('routes websocket disconnect through api.connections lane', async () => {
        await handler({
            requestContext: {
                routeKey: '$disconnect',
                connectionId: 'abc123'
            }
        })

        expect(disconnectMock).toHaveBeenCalledTimes(1)
        expect(disconnectMock).toHaveBeenCalledWith('abc123')
    })

    it('routes validateInvitation via API adapter preserving response shape', async () => {
        validateInvitationCodeMock.mockResolvedValue(true)

        const response = await handler({
            requestContext: {
                resourcePath: '/validateInvitation'
            },
            body: JSON.stringify({
                invitationCode: 'ABC123'
            })
        })

        expect(validateInvitationCodeMock).toHaveBeenCalledTimes(1)
        expect(validateInvitationCodeMock).toHaveBeenCalledWith('ABC123')
        expect(response).toEqual({
            statusCode: 200,
            body: JSON.stringify({ valid: true }),
            headers: { 'Access-Control-Allow-Origin': '*' }
        })
    })

    it('routes generateInvitation direct invoke through api.connections adapter', async () => {
        generateInvitationCodeMock.mockResolvedValue('QW123E')

        const response = await handler({
            message: 'generateInvitation'
        })

        expect(generateInvitationCodeMock).toHaveBeenCalledTimes(1)
        expect(response).toEqual({ invitationCode: 'QW123E' })
    })

    it('routes websocket registercharacter through connections registration path', async () => {
        const response = await handler({
            requestContext: {
                routeKey: 'connections',
                connectionId: 'connection-1'
            },
            body: JSON.stringify({
                service: 'connections',
                message: 'registercharacter',
                CharacterId: 'CHARACTER#abc',
                RequestId: 'request-1'
            })
        })

        expect(registerCharacterMessageMock).toHaveBeenCalledTimes(1)
        expect(registerCharacterMessageMock).toHaveBeenCalledWith(expect.objectContaining({
            connectionId: 'connection-1',
            characterId: 'CHARACTER#abc',
            requestId: 'request-1',
            streamEvent: expect.any(Function)
        }))
        expect(response).toEqual({
            messageType: 'Registration',
            CharacterId: 'CHARACTER#abc',
            RequestId: 'request-1'
        })
    })

    it('drops stale session and emits Session Disconnect without Map bookkeeping', async () => {
        mockShouldDropOptimisticUpdate()
        queryMock.mockResolvedValue([])
        connectionDBMock.deleteItem.mockResolvedValue(undefined as any)
        eventBridgeClientMock.send.mockResolvedValue(undefined as any)

        await handler({
            message: 'checkSession',
            sessionId: 'session-1'
        })

        expect(connectionDBMock.getItem).toHaveBeenCalledWith(expect.objectContaining({
            Key: {
                ConnectionId: 'Meta::Session',
                DataCategory: 'SESSION#session-1'
            }
        }))
        expect(connectionDBMock.optimisticUpdate).toHaveBeenCalledWith(expect.objectContaining({
            Key: {
                ConnectionId: 'Meta::Session',
                DataCategory: 'SESSION#session-1'
            }
        }))
        expect(eventBridgeClientMock.send).toHaveBeenCalledTimes(1)
        expect(eventBridgeClientMock.send.mock.calls[0][0]).toEqual([expect.objectContaining({
            DetailType: 'Session Disconnect',
            Source: 'mtw.connections',
            Detail: expect.objectContaining({ sessionId: 'session-1' })
        })])
        expect(connectionDBMock.deleteItem).toHaveBeenCalledWith({
            ConnectionId: 'Meta::Session',
            DataCategory: 'SESSION#session-1'
        })
    })

    it('EventBridge Stale SessionId Finding dispatches to handleStaleSessionFinding', async () => {
        await handler({
            source: 'mtw.diagnostics',
            'detail-type': 'Stale SessionId Finding',
            detail: { player: 'p1', diagnosticRunId: 'd1' }
        })

        expect(handleStaleSessionFindingMock).toHaveBeenCalledTimes(1)
        expect(handleStaleSessionFindingMock).toHaveBeenCalledWith(expect.objectContaining({ player: 'p1', diagnosticRunId: 'd1' }))
    })
})
