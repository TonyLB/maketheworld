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
jest.mock('./staleSessionFinding', () => ({
    handleStaleSessionFinding: jest.fn().mockResolvedValue(undefined)
}))

import { handleStaleSessionFinding } from './staleSessionFinding'
import { handler } from './app'

const connectionDBMock = jest.mocked(connectionDB)
const eventBridgeClientMock = jest.mocked(eventBridgeClient)
const handleStaleSessionFindingMock = jest.mocked(handleStaleSessionFinding)
const queryMock = connectionDB.query as unknown as jest.Mock

describe('connections app checkSession', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.useRealTimers()
        connectionDBMock.getItem.mockResolvedValue({ player: 'test-player' })
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
        expect(eventBridgeClientMock.send.mock.calls[0][0]).toEqual([{
            DetailType: 'Session Disconnect',
            Detail: { sessionId: 'session-1' }
        }])
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
        expect(handleStaleSessionFindingMock).toHaveBeenCalledWith({ player: 'p1', diagnosticRunId: 'd1' })
    })
})
