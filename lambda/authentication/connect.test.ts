jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
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
        eventBridgeClientMock.send.mockResolvedValue(undefined as any)

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
                ConnectionId: 'SESSION#session-1',
                DataCategory: 'Meta::Session'
            }
        }))
        expect(connectionDBMock.optimisticUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
            Key: {
                ConnectionId: 'Global',
                DataCategory: 'Sessions'
            }
        }))
        expect(eventBridgeClientMock.send).toHaveBeenCalledWith([expect.objectContaining({
            DetailType: 'Player Connected'
        })])
    })
})
