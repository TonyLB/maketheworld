jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => {
    const actual = jest.requireActual('@tonylb/mtw-utilities/ts/dynamoDB') as typeof import('@tonylb/mtw-utilities/ts/dynamoDB')
    return {
        ...actual,
        connectionDB: Object.assign({}, actual.connectionDB, {
            optimisticUpdate: jest.fn(),
            query: jest.fn(),
            transactWrite: jest.fn()
        }),
        exponentialBackoffWrapper: jest.fn()
    }
})
import { connectionDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
jest.mock('@tonylb/mtw-utilities/ts/eventBridge')
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'

import { handler } from './app'

const connectionDBMock = jest.mocked(connectionDB)
const exponentialBackoffWrapperMock = jest.mocked(exponentialBackoffWrapper)
const eventBridgeClientMock = jest.mocked(eventBridgeClient)

describe('connections app checkSession', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        exponentialBackoffWrapperMock.mockImplementation(async (fn: any) => (fn()))
    })

    it('drops stale session and emits Session Disconnect without Global/Sessions write', async () => {
        connectionDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer }: any) => {
            const draft: { connections: string[]; dropAfter?: number; shouldDrop?: string } = {
                connections: [],
                dropAfter: Date.now() - 1000
            }
            updateReducer(draft)
            return draft
        })
        connectionDBMock.query.mockResolvedValue([])
        connectionDBMock.transactWrite.mockResolvedValue(undefined as any)
        eventBridgeClientMock.send.mockResolvedValue(undefined as any)

        await handler({
            message: 'checkSession',
            sessionId: 'session-1'
        })

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
        expect(eventBridgeClientMock.send).toHaveBeenCalledWith([{
            DetailType: 'Session Disconnect',
            Detail: { sessionId: 'session-1' }
        }])
    })
})
