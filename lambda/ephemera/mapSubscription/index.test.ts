jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../internalCache')

import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../internalCache'
import { mapSubscriptionMessage, mapUnsubscribeMessage } from './index'

const connectionDBMock = jest.mocked(connectionDB)
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

describe('mapSubscription stub window', () => {
    const messageBus = {
        send: jest.fn()
    } as any

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('subscribe returns ack with empty snapshot and no map bookkeeping writes', async () => {
        internalCacheMock.Global.get
            .mockImplementationOnce(async () => ('req-1'))
            .mockImplementationOnce(async () => ('session-1'))
        connectionDBMock.getItems.mockResolvedValue([{ DataCategory: 'CHARACTER#one' }] as any)
        connectionDBMock.getItem.mockResolvedValue({ DataCategory: 'SESSION#session-1' } as any)

        await mapSubscriptionMessage({
            payloads: [{ type: 'SubscribeToMaps', characterId: 'CHARACTER#one' }],
            messageBus
        })

        expect(connectionDBMock.transactWrite).not.toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'SubscribeToMaps',
                RequestId: 'req-1',
                maps: [{ characterId: 'CHARACTER#one', maps: [] }]
            }
        })
    })

    it('unsubscribe keeps ack semantics and does not write map rows', async () => {
        internalCacheMock.Global.get.mockImplementationOnce(async () => ('req-2'))

        await mapUnsubscribeMessage({
            payloads: [{ type: 'UnsubscribeFromMaps', characterId: 'CHARACTER#one' }],
            messageBus
        })

        expect(connectionDBMock.optimisticUpdate).not.toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'UnsubscribeFromMaps',
                RequestId: 'req-2'
            }
        })
    })
})
