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

const transactionCanceled = () => {
    const err = new Error('Transaction canceled') as Error & { name?: string; code?: string }
    err.name = 'TransactionCanceledException'
    return err
}

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

    it('drops stale session and emits Session Disconnect before Library/Map bookkeeping; no Global/Sessions write', async () => {
        mockShouldDropOptimisticUpdate()
        connectionDBMock.query.mockResolvedValue([])
        connectionDBMock.transactWrite.mockResolvedValue(undefined as any)
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
        expect(connectionDBMock.transactWrite).toHaveBeenCalledTimes(1)
        const transactArgs = connectionDBMock.transactWrite.mock.calls[0][0]
        expect(transactArgs).toEqual(expect.arrayContaining([
            expect.objectContaining({
                Update: expect.objectContaining({
                    Key: {
                        ConnectionId: 'Library',
                        DataCategory: 'Subscriptions'
                    }
                })
            }),
            expect.objectContaining({
                Update: expect.objectContaining({
                    Key: {
                        ConnectionId: 'Map',
                        DataCategory: 'Subscriptions'
                    }
                })
            })
        ]))
        expect(transactArgs).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                Update: expect.objectContaining({
                    Key: {
                        ConnectionId: 'Global',
                        DataCategory: 'Sessions'
                    }
                })
            })
        ]))
        expect(eventBridgeClientMock.send).toHaveBeenCalledTimes(1)
        expect(eventBridgeClientMock.send.mock.calls[0][0]).toEqual([{
            DetailType: 'Session Disconnect',
            Detail: { sessionId: 'session-1' }
        }])
        expect(connectionDBMock.deleteItem).toHaveBeenCalledWith({
            ConnectionId: 'Meta::Session',
            DataCategory: 'SESSION#session-1'
        })
        expect(connectionDBMock.transactWrite.mock.invocationCallOrder[0]).toBeGreaterThan(
            eventBridgeClientMock.send.mock.invocationCallOrder[0]
        )
    })

    it('after 3 TransactionCanceled failures emits Session Disconnect Problem with attemptCount 3 and logs bookkeeping failures', async () => {
        jest.useFakeTimers()
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        mockShouldDropOptimisticUpdate()
        connectionDBMock.query.mockResolvedValue([])
        connectionDBMock.transactWrite.mockRejectedValue(transactionCanceled())
        eventBridgeClientMock.send.mockResolvedValue(undefined as any)

        const run = handler({
            message: 'checkSession',
            sessionId: 'session-1'
        })
        await jest.runAllTimersAsync()
        await run

        expect(eventBridgeClientMock.send).toHaveBeenCalledTimes(2)
        expect(eventBridgeClientMock.send.mock.calls[0][0]).toEqual([{
            DetailType: 'Session Disconnect',
            Detail: { sessionId: 'session-1' }
        }])
        const problemBatch = eventBridgeClientMock.send.mock.calls[1][0]
        expect(problemBatch[0].DetailType).toBe('Session Disconnect Problem')
        expect(problemBatch[0].Detail).toMatchObject({
            sessionId: 'session-1',
            player: 'test-player',
            sourceOperation: 'checkSession',
            attemptCount: 3
        })
        expect(typeof problemBatch[0].Detail.dedupeKey).toBe('string')

        const logEvents = logSpy.mock.calls.map(([line]) => JSON.parse(line as string))
        expect(logEvents.filter((e) => e.event === 'session-disconnect-bookkeeping-retry')).toHaveLength(2)
        expect(logEvents.some((e) => e.event === 'session-disconnect-bookkeeping-failed')).toBe(true)

        logSpy.mockRestore()
        jest.useRealTimers()
    })

    it('on bookkeeping success after one TransactionCanceled, emits Session Disconnect only (no problem report)', async () => {
        jest.useFakeTimers()
        mockShouldDropOptimisticUpdate()
        connectionDBMock.query.mockResolvedValue([])
        connectionDBMock.transactWrite
            .mockRejectedValueOnce(transactionCanceled())
            .mockResolvedValueOnce(undefined as any)
        eventBridgeClientMock.send.mockResolvedValue(undefined as any)

        const run = handler({
            message: 'checkSession',
            sessionId: 'session-1'
        })
        await jest.runAllTimersAsync()
        await run

        expect(connectionDBMock.transactWrite).toHaveBeenCalledTimes(2)
        expect(eventBridgeClientMock.send).toHaveBeenCalledTimes(1)
        expect(eventBridgeClientMock.send.mock.calls[0][0]).toEqual([{
            DetailType: 'Session Disconnect',
            Detail: { sessionId: 'session-1' }
        }])
        jest.useRealTimers()
    })

    it('on non-retryable transactWrite error, still emitted Session Disconnect then Session Disconnect Problem with attemptCount 1', async () => {
        mockShouldDropOptimisticUpdate()
        connectionDBMock.query.mockResolvedValue([])
        const err = new Error('boom') as Error & { name?: string }
        err.name = 'ValidationException'
        connectionDBMock.transactWrite.mockRejectedValue(err)
        eventBridgeClientMock.send.mockResolvedValue(undefined as any)

        await handler({
            message: 'checkSession',
            sessionId: 'session-1'
        })

        expect(eventBridgeClientMock.send).toHaveBeenCalledTimes(2)
        expect(eventBridgeClientMock.send.mock.calls[0][0]).toEqual([{
            DetailType: 'Session Disconnect',
            Detail: { sessionId: 'session-1' }
        }])
        expect(eventBridgeClientMock.send.mock.calls[1][0][0].DetailType).toBe('Session Disconnect Problem')
        expect(eventBridgeClientMock.send.mock.calls[1][0][0].Detail).toMatchObject({
            sessionId: 'session-1',
            attemptCount: 1
        })
    })

    it('refresh overlap: problem report and Session Disconnect reference only the session under checkSession', async () => {
        jest.useFakeTimers()
        mockShouldDropOptimisticUpdate()
        connectionDBMock.query.mockResolvedValue([])
        connectionDBMock.transactWrite.mockRejectedValue(transactionCanceled())
        eventBridgeClientMock.send.mockResolvedValue(undefined as any)

        const run = handler({
            message: 'checkSession',
            sessionId: 'session-old'
        })
        await jest.runAllTimersAsync()
        await run

        expect(eventBridgeClientMock.send.mock.calls[0][0][0].Detail.sessionId).toBe('session-old')
        expect(eventBridgeClientMock.send.mock.calls[1][0][0].Detail.sessionId).toBe('session-old')
        jest.useRealTimers()
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
