jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => {
    const actual = jest.requireActual('@tonylb/mtw-utilities/ts/dynamoDB') as typeof import('@tonylb/mtw-utilities/ts/dynamoDB')
    return {
        ...actual,
        connectionDB: Object.assign({}, actual.connectionDB, {
            putItem: jest.fn(),
            transactWrite: jest.fn(),
            query: jest.fn().mockResolvedValue([]),
            getItems: jest.fn().mockResolvedValue([])
        })
    }
})
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
jest.mock('@tonylb/mtw-utilities/ts/eventBridge')
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'

import { connect } from './connect'

const connectionDBMock = jest.mocked(connectionDB)
const eventBridgeClientMock = jest.mocked(eventBridgeClient)

describe('authentication connect', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    const runReducer = (draft: { connections?: string[]; player?: string }) => {
        const transactWriteCall = connectionDBMock.transactWrite.mock.calls[0][0] as any[]
        const updateItem = transactWriteCall.find((item) => 'Update' in item)
        updateItem.Update.updateReducer(draft)
        return draft
    }

    it('creates connection/session records without writing Global/Sessions', async () => {
        connectionDBMock.putItem.mockResolvedValue({})
        connectionDBMock.transactWrite.mockResolvedValue(undefined as any)
        eventBridgeClientMock.send.mockResolvedValue({ FailedEntryCount: 0, Entries: [] } as any)

        const response = await connect('conn-1', 'PlayerOne', 'session-1')

        expect(response).toEqual({ statusCode: 200 })
        expect(connectionDBMock.putItem).toHaveBeenCalledWith(expect.objectContaining({
            ConnectionId: 'CONNECTION#conn-1',
            DataCategory: 'Meta::Connection',
            SessionId: 'session-1'
        }))
        expect(connectionDBMock.transactWrite).toHaveBeenCalledTimes(1)
        expect(connectionDBMock.transactWrite).toHaveBeenCalledWith([
            expect.objectContaining({
                Update: expect.objectContaining({
                    Key: {
                        ConnectionId: 'Meta::Session',
                        DataCategory: 'SESSION#session-1'
                    }
                })
            }),
            {
                Put: {
                    ConnectionId: 'PLAYER#PlayerOne',
                    DataCategory: 'SESSION#session-1'
                }
            }
        ])
        expect(connectionDBMock.transactWrite).not.toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({
                Update: expect.objectContaining({
                    Key: {
                        ConnectionId: 'Global',
                        DataCategory: 'Sessions'
                    }
                })
            })
        ]))
        expect(eventBridgeClientMock.send).toHaveBeenCalledWith([expect.objectContaining({
            Source: 'mtw.players',
            DetailType: 'Player Connected',
            Detail: expect.objectContaining({
                streamKey: 'PLAYER#PlayerOne',
                type: 'Player Connected',
                player: 'PlayerOne',
                connectionId: 'conn-1',
                sessionId: 'session-1',
            })
        })])
    })

    it('logs a visible error when PutEvents reports a partial failure', async () => {
        connectionDBMock.putItem.mockResolvedValue({})
        connectionDBMock.transactWrite.mockResolvedValue(undefined as any)
        eventBridgeClientMock.send.mockResolvedValue({
            FailedEntryCount: 1,
            Entries: [{ ErrorCode: 'InternalFailure', ErrorMessage: 'boom' }],
        } as any)
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

        const response = await connect('conn-1', 'PlayerOne', 'session-1')

        expect(response).toEqual({ statusCode: 200 })
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[mtw.authentication] Player Connected PutEvents failed',
            expect.objectContaining({
                failedEntryCount: 1,
                entries: [{ ErrorCode: 'InternalFailure', ErrorMessage: 'boom' }],
            })
        )
        consoleErrorSpy.mockRestore()
    })

    it('returns 403 without publishing Player Connected when the session belongs to another player', async () => {
        connectionDBMock.putItem.mockResolvedValue({})
        connectionDBMock.transactWrite.mockImplementation(async (items: any) => {
            const updateItem = items.find((item: any) => 'Update' in item)
            updateItem.Update.updateReducer({ connections: ['conn-existing'], player: 'VictimPlayer' })
        })

        const response = await connect('conn-1', 'AttackerPlayer', 'session-1')

        expect(response).toEqual({
            statusCode: 403,
            message: 'Invalid SessionID for this player'
        })
        expect(eventBridgeClientMock.send).not.toHaveBeenCalled()
    })

    it('does not mutate connections when rejecting a hijack attempt (D7)', async () => {
        connectionDBMock.putItem.mockResolvedValue({})
        connectionDBMock.transactWrite.mockResolvedValue(undefined as any)

        // Drive connect() once (transactWrite resolves without running the reducer) purely to capture
        // the real production reducer as connect() builds it.
        await connect('conn-1', 'AttackerPlayer', 'session-1')

        const draft = { connections: ['conn-existing'], player: 'VictimPlayer' }
        expect(() => runReducer(draft)).toThrow()
        expect(draft.connections).toEqual(['conn-existing'])
    })

    describe('stale session detection', () => {
        beforeEach(() => {
            connectionDBMock.putItem.mockResolvedValue({})
            connectionDBMock.transactWrite.mockResolvedValue(undefined as any)
            eventBridgeClientMock.send.mockResolvedValue({ FailedEntryCount: 0, Entries: [] } as any)
        })

        it('reports a session past the stale buffer as a Stale Session Problem in the same PutEvents batch', async () => {
            connectionDBMock.query.mockResolvedValue([
                { ConnectionId: 'PLAYER#PlayerOne', DataCategory: 'SESSION#session-1' },
                { ConnectionId: 'PLAYER#PlayerOne', DataCategory: 'SESSION#session-stale' }
            ] as any)
            connectionDBMock.getItems.mockResolvedValue([
                {
                    ConnectionId: 'Meta::Session',
                    DataCategory: 'SESSION#session-stale',
                    connections: [],
                    dropAfter: Date.now() - 20_000
                }
            ] as any)

            const response = await connect('conn-1', 'PlayerOne', 'session-1')

            expect(response).toEqual({ statusCode: 200 })
            expect(eventBridgeClientMock.send).toHaveBeenCalledTimes(1)
            const [entries] = eventBridgeClientMock.send.mock.calls[0]
            expect(entries).toHaveLength(2)
            expect(entries[1]).toEqual(expect.objectContaining({
                Source: 'mtw.players',
                DetailType: 'Stale Session Problem',
                Detail: expect.objectContaining({
                    type: 'Stale Session Problem',
                    sessionId: 'session-stale',
                    player: 'PlayerOne',
                    sourceOperation: 'connect',
                    attemptCount: 1,
                    dedupeKey: 'session-stale::staleSessionProblem::1'
                })
            }))
        })

        it('does not report a session inside its grace window', async () => {
            connectionDBMock.query.mockResolvedValue([
                { ConnectionId: 'PLAYER#PlayerOne', DataCategory: 'SESSION#session-1' },
                { ConnectionId: 'PLAYER#PlayerOne', DataCategory: 'SESSION#session-recent' }
            ] as any)
            connectionDBMock.getItems.mockResolvedValue([
                {
                    ConnectionId: 'Meta::Session',
                    DataCategory: 'SESSION#session-recent',
                    connections: [],
                    dropAfter: Date.now() - 1_000
                }
            ] as any)

            await connect('conn-1', 'PlayerOne', 'session-1')

            const [entries] = eventBridgeClientMock.send.mock.calls[0]
            expect(entries).toHaveLength(1)
        })

        it('never reports the session being connected to', async () => {
            connectionDBMock.query.mockResolvedValue([
                { ConnectionId: 'PLAYER#PlayerOne', DataCategory: 'SESSION#session-1' }
            ] as any)

            await connect('conn-1', 'PlayerOne', 'session-1')

            expect(connectionDBMock.getItems).not.toHaveBeenCalled()
            const [entries] = eventBridgeClientMock.send.mock.calls[0]
            expect(entries).toHaveLength(1)
        })

        it('does not fail connect or drop Player Connected when detection throws', async () => {
            connectionDBMock.query.mockRejectedValue(new Error('boom'))
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

            const response = await connect('conn-1', 'PlayerOne', 'session-1')

            expect(response).toEqual({ statusCode: 200 })
            const [entries] = eventBridgeClientMock.send.mock.calls[0]
            expect(entries).toHaveLength(1)
            expect(entries[0]).toEqual(expect.objectContaining({ DetailType: 'Player Connected' }))
            consoleErrorSpy.mockRestore()
        })
    })
})
