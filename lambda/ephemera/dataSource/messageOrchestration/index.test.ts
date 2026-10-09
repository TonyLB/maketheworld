jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import messageBus from '../../messageBus'
import type { PublishMessage, PublishTarget } from '../../messageBus/baseClasses'
import type { MessageOrchestrationSlotSpec } from './localApiEvents'
import { sendMessageBundleDeclared, sendMessageSlotReported } from './subscribedEvents'
import { ephemeraMessageOrchestrationDataSource, registerIngressSlot, reportIngressContent } from './index'

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


    describe('direct-address ingress listeners', () => {
        const headerSpec = (slotId: string, targets: PublishTarget[]): MessageOrchestrationSlotSpec => ({
            slotId,
            expectedPublishType: 'PerceptionMessage' as const,
            componentId: 'ROOM#a',
            perspectiveKey: 'PERSPECTIVE#a',
            contentStream: 'render' as const,
            format: 'header' as const,
            targets,
        })
        const placeholder = { kind: 'roomPlaceholder' as const, componentId: 'ROOM#a' as any, bodyText: 'Generating', status: 'generating' as const }
        const terminal = (summary: string) => ({
            kind: 'roomRender' as const,
            componentId: 'ROOM#a' as any,
            renderedContent: { description: [], summary: [summary] } as any,
        })
        const perceptionPublishes = (spy: jest.SpyInstance) => spy.mock.calls
            .map((call) => call[0])
            .filter((m) => m?.type === 'PublishMessage' && m?.displayProtocol === 'PerceptionMessage')

        it('publishes the placeholder as it arrives, then the terminal under the same MessageId at a strictly greater time', async () => {
            const publishSpy = spyPublish()
            await registerIngressSlot(messageBus, { createdTime: 5000, messageId: 'MESSAGE#one' }, headerSpec('s', ['CHARACTER#a']))
            reportIngressContent(messageBus, 'ROOM#a', 'PERSPECTIVE#a', 'render', placeholder)
            reportIngressContent(messageBus, 'ROOM#a', 'PERSPECTIVE#a', 'render', terminal('Final'))

            const published = perceptionPublishes(publishSpy)
            expect(published).toHaveLength(2)
            expect(published[0]).toMatchObject({ messageId: 'MESSAGE#one', createdTime: 5000, targets: ['CHARACTER#a'] })
            expect(published[0].metaData.status).toBe('generating')
            expect(published[1].messageId).toBe('MESSAGE#one')
            expect(published[1].createdTime).toBeGreaterThan(5000)
            expect(published[1].metaData.status).toBeUndefined()
            publishSpy.mockRestore()
        })

        it('a wave after settle keeps the MessageId and is stamped after everything the listener already sent', async () => {
            const publishSpy = spyPublish()
            await registerIngressSlot(messageBus, { createdTime: 5000, messageId: 'MESSAGE#one' }, headerSpec('s', ['CHARACTER#a']))
            reportIngressContent(messageBus, 'ROOM#a', 'PERSPECTIVE#a', 'render', placeholder)
            await messageBus.flushAndSettle()
            reportIngressContent(messageBus, 'ROOM#a', 'PERSPECTIVE#a', 'render', terminal('Final'))

            const published = perceptionPublishes(publishSpy)
            expect(published).toHaveLength(2)
            expect(published[1].messageId).toBe('MESSAGE#one')
            expect(published[1].createdTime).toBeGreaterThan(published[0].createdTime)
            publishSpy.mockRestore()
        })

        it('a late registrant gets the latest replayed content, once, at its own time and MessageId', async () => {
            const publishSpy = spyPublish()
            await registerIngressSlot(messageBus, { createdTime: 5000, messageId: 'MESSAGE#one' }, headerSpec('s1', ['CHARACTER#a']))
            reportIngressContent(messageBus, 'ROOM#a', 'PERSPECTIVE#a', 'render', placeholder)
            reportIngressContent(messageBus, 'ROOM#a', 'PERSPECTIVE#a', 'render', terminal('Final'))
            await registerIngressSlot(messageBus, { createdTime: 5007, messageId: 'MESSAGE#two' }, headerSpec('s2', ['CHARACTER#b']))

            const published = perceptionPublishes(publishSpy)
            expect(published.map((m) => [m.messageId, m.createdTime, m.targets])).toEqual([
                ['MESSAGE#one', 5000, ['CHARACTER#a']],
                ['MESSAGE#one', expect.any(Number), ['CHARACTER#a']],
                ['MESSAGE#two', 5007, ['CHARACTER#b']],
            ])
            expect(published[2].metaData.status).toBeUndefined()
            publishSpy.mockRestore()
        })

        it('a bundle listener and a direct listener on one bucket are each delivered by their own mechanism', async () => {
            const publishSpy = spyPublish()
            sendMessageBundleDeclared(messageBus, BUNDLE_A, {
                bundleId: BUNDLE_A,
                slots: [{ slotId: 'header', expectedPublishType: 'PerceptionMessage' }],
            })
            await registerIngressSlot(messageBus, BUNDLE_A, headerSpec('header', ['CHARACTER#a']))
            await registerIngressSlot(messageBus, { createdTime: 5000, messageId: 'MESSAGE#one' }, headerSpec('s', ['CHARACTER#b']))
            reportIngressContent(messageBus, 'ROOM#a', 'PERSPECTIVE#a', 'render', terminal('Final'))
            await messageBus.flushAndSettle()

            const published = perceptionPublishes(publishSpy)
            expect(published.map((m) => m.targets[0]).sort()).toEqual(['CHARACTER#a', 'CHARACTER#b'])
            expect(published.find((m) => m.targets[0] === 'CHARACTER#b')).toMatchObject({ messageId: 'MESSAGE#one', createdTime: 5000 })
            publishSpy.mockRestore()
        })

        it('a listener that never received content publishes nothing', async () => {
            const publishSpy = spyPublish()
            await registerIngressSlot(messageBus, { createdTime: 5000, messageId: 'MESSAGE#one' }, headerSpec('s', ['CHARACTER#a']))
            await messageBus.flushAndSettle()
            expect(perceptionPublishes(publishSpy)).toHaveLength(0)
            publishSpy.mockRestore()
        })
    })
})
