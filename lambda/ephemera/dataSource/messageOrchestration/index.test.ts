jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import messageBus from '../../messageBus'
import type { PublishMessage } from '../../messageBus/baseClasses'
import { sendMessageBundleDeclared, sendMessageSlotReported } from './subscribedEvents'
import { ephemeraMessageOrchestrationDataSource } from './index'

const BUNDLE_A = 'bundle-a'

const worldMessage = (text: string): PublishMessage => ({
    type: 'PublishMessage',
    targets: ['ROOM#a'],
    displayProtocol: 'WorldMessage',
    message: [text],
})

const originalMessageBusPublish = messageBus.publish.bind(messageBus)

describe('mtw.ephemera.messageOrchestration DataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        messageBus.clear()
    })

    function spyPublish() {
        return jest.spyOn(messageBus, 'publish').mockImplementation((payload) => {
            originalMessageBusPublish(payload)
        })
    }

    it('registers subscription and flush completes without error when queue is empty', async () => {
        expect(ephemeraMessageOrchestrationDataSource.dataSourceKey).toBe('mtw.ephemera.messageOrchestration')
        await expect(messageBus.flushAndSettle()).resolves.toBeUndefined()
    })

    it('flushes PublishMessage events in declared order once every slot has reported', async () => {
        const publishSpy = spyPublish()

        sendMessageBundleDeclared(messageBus, BUNDLE_A, {
            bundleId: BUNDLE_A,
            slots: [
                { slotId: 'leave', expectedPublishType: 'WorldMessage' },
                { slotId: 'arrive', expectedPublishType: 'WorldMessage' },
            ],
        })
        sendMessageSlotReported(messageBus, BUNDLE_A, {
            bundleId: BUNDLE_A,
            slotId: 'arrive',
            message: worldMessage('Alice has arrived.'),
        })
        sendMessageSlotReported(messageBus, BUNDLE_A, {
            bundleId: BUNDLE_A,
            slotId: 'leave',
            message: worldMessage('Alice has left.'),
        })
        await messageBus.flushAndSettle()

        const worldPublishes = publishSpy.mock.calls
            .map((call) => call[0])
            .filter((message) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')

        expect(worldPublishes.map((m: any) => m.message)).toEqual([
            ['Alice has left.'],
            ['Alice has arrived.'],
        ])
        publishSpy.mockRestore()
    })

    it('settles a bundle with an unresolved slot by publishing only the resolved subset', async () => {
        const publishSpy = spyPublish()

        sendMessageBundleDeclared(messageBus, BUNDLE_A, {
            bundleId: BUNDLE_A,
            slots: [
                { slotId: 'leave', expectedPublishType: 'WorldMessage' },
                { slotId: 'arrive', expectedPublishType: 'WorldMessage' },
            ],
        })
        sendMessageSlotReported(messageBus, BUNDLE_A, {
            bundleId: BUNDLE_A,
            slotId: 'leave',
            message: worldMessage('Alice has left.'),
        })
        await messageBus.flushAndSettle()

        const worldPublishes = publishSpy.mock.calls
            .map((call) => call[0])
            .filter((message) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')

        expect(worldPublishes.map((m: any) => m.message)).toEqual([['Alice has left.']])
        publishSpy.mockRestore()
    })

})
