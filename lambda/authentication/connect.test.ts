jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => {
    const actual = jest.requireActual('@tonylb/mtw-utilities/ts/dynamoDB') as typeof import('@tonylb/mtw-utilities/ts/dynamoDB')
    return {
        ...actual,
        connectionDB: Object.assign({}, actual.connectionDB, {
            putItem: jest.fn(),
            optimisticUpdate: jest.fn()
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

    it('creates connection/session records without writing Global/Sessions', async () => {
        connectionDBMock.putItem.mockResolvedValue({})
        connectionDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer }: any) => {
            const draft: { connections?: string[]; player?: string } = {}
            updateReducer(draft)
            return draft
        })
        eventBridgeClientMock.send.mockResolvedValue({ FailedEntryCount: 0, Entries: [] } as any)

        const response = await connect('conn-1', 'PlayerOne', 'session-1')

        expect(response).toEqual({ statusCode: 200 })
        expect(connectionDBMock.putItem).toHaveBeenCalledWith(expect.objectContaining({
            ConnectionId: 'CONNECTION#conn-1',
            DataCategory: 'Meta::Connection',
            SessionId: 'session-1'
        }))
        expect(connectionDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(connectionDBMock.optimisticUpdate).toHaveBeenCalledWith(expect.objectContaining({
            Key: {
                ConnectionId: 'Meta::Session',
                DataCategory: 'SESSION#session-1'
            }
        }))
        expect(connectionDBMock.optimisticUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
            Key: {
                ConnectionId: 'Global',
                DataCategory: 'Sessions'
            }
        }))
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
        connectionDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer }: any) => {
            const draft: { connections?: string[]; player?: string } = {}
            updateReducer(draft)
            return draft
        })
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
})
