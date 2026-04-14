jest.mock('../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import * as schemaModule from '@tonylb/mtw-wml/ts/schema'
import messageBus from '../messageBus'
import internalCache from '../internalCache'
import roomUpdateMessage from './index'

describe('roomUpdateMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        messageBus.clear()
        internalCache.clear()
    })

    it('sends affordance PerceptionMessage per character only (wire RoomUpdate retired)', async () => {
        const roomId = 'ROOM#RU1' as const
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([
            { EphemeraId: 'CHARACTER#One', DisplayName: 'One', Color: 'blue', SessionIds: [] },
            { EphemeraId: 'CHARACTER#Two', DisplayName: 'Two', Color: 'purple', SessionIds: [] },
        ])
        const mergeSpy = jest.spyOn(internalCache.ComponentStackMerge, 'get').mockResolvedValue({ schema: {} } as any)
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<Aff />')

        const sendSpy = jest.spyOn(messageBus, 'send')

        await roomUpdateMessage({
            payloads: [{ type: 'RoomUpdate', roomId }],
            messageBus,
        })
        await messageBus.flush()

        const roomUpdateWireCalls = sendSpy.mock.calls.filter(
            (c) => c[0]?.type === 'PublishMessage' && (c[0] as any).displayProtocol === 'RoomUpdate'
        )
        expect(roomUpdateWireCalls).toHaveLength(0)

        const affordanceCalls = sendSpy.mock.calls.filter(
            (c) =>
                c[0]?.type === 'PublishMessage'
                && (c[0] as any).displayProtocol === 'PerceptionMessage'
                && (c[0] as any).metaData?.roomChannel === 'affordances'
        )
        expect(affordanceCalls).toHaveLength(2)
        const ids = affordanceCalls.map((c) => (c[0] as { messageId?: string }).messageId)
        expect(new Set(ids).size).toBe(2)
        expect(ids.every((id) => id?.startsWith('MESSAGE#'))).toBe(true)
        expect(affordanceCalls[0][0]).toMatchObject({
            targets: ['CHARACTER#One'],
            metaData: expect.objectContaining({
                componentUUID: roomId,
                displayMode: 'header',
                roomChannel: 'affordances',
            }),
        })
        expect(mergeSpy).toHaveBeenCalledWith('CHARACTER#One', roomId)
        expect(mergeSpy).toHaveBeenCalledWith('CHARACTER#Two', roomId)

        mergeSpy.mockRestore()
        schemaSpy.mockRestore()
        sendSpy.mockRestore()
    })
})
