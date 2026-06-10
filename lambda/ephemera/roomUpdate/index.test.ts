jest.mock('../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import messageBus from '../messageBus'
import internalCache from '../internalCache'
import roomUpdateMessage from './index'
import * as sendAffordanceRefresh from '../dataSource/affordanceOrchestration/sendAffordanceRefreshRequestedForRoom'

describe('roomUpdateMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        messageBus.clear()
        internalCache.clear()
    })

    it('enqueues Affordances Requested (reason: roster) instead of affordance PublishMessage', async () => {
        const roomId = 'ROOM#RU1' as const
        const sendSpy = jest
            .spyOn(sendAffordanceRefresh, 'sendAffordanceRefreshRequestedForRoom')
            .mockResolvedValue(undefined)
        const busSendSpy = jest.spyOn(messageBus, 'send')

        await roomUpdateMessage({
            payloads: [{ type: 'RoomUpdate', roomId }],
            messageBus,
        })
        await messageBus.flush()

        expect(sendSpy).toHaveBeenCalledTimes(1)
        expect(sendSpy).toHaveBeenCalledWith({
            roomId,
            reason: 'roster',
            messageBus,
        })

        const roomUpdateWireCalls = busSendSpy.mock.calls.filter(
            (c) => c[0]?.type === 'PublishMessage' && (c[0] as any).displayProtocol === 'RoomUpdate'
        )
        expect(roomUpdateWireCalls).toHaveLength(0)

        const affordanceCalls = busSendSpy.mock.calls.filter(
            (c) =>
                c[0]?.type === 'PublishMessage'
                && (c[0] as any).displayProtocol === 'PerceptionMessage'
                && (c[0] as any).metaData?.roomChannel === 'affordances'
        )
        expect(affordanceCalls).toHaveLength(0)

        sendSpy.mockRestore()
        busSendSpy.mockRestore()
    })
})
