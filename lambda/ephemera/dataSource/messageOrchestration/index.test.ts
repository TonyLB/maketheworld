jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import messageBus from '../../messageBus'
import type { PublishTarget } from '../../messageBus/baseClasses'
import type { IngressListenerSpec } from './contentIngress'
import { registerIngressSlot, reportIngressContent } from './index'

const originalMessageBusPublish = messageBus.publish.bind(messageBus)

describe('content ingress', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        messageBus.clear()
    })

    function spyPublish() {
        return jest.spyOn(messageBus, 'publish').mockImplementation((payload) => {
            originalMessageBusPublish(payload)
        })
    }

    it('flush completes without error when nothing registered', async () => {
        await expect(messageBus.flushAndSettle()).resolves.toBeUndefined()
    })

    describe('ingress listeners', () => {
        const headerSpec = (targets: PublishTarget[]): IngressListenerSpec => ({
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
            await registerIngressSlot(messageBus, { createdTime: 5000, messageId: 'MESSAGE#one' }, headerSpec(['CHARACTER#a']))
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
            await registerIngressSlot(messageBus, { createdTime: 5000, messageId: 'MESSAGE#one' }, headerSpec(['CHARACTER#a']))
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
            await registerIngressSlot(messageBus, { createdTime: 5000, messageId: 'MESSAGE#one' }, headerSpec(['CHARACTER#a']))
            reportIngressContent(messageBus, 'ROOM#a', 'PERSPECTIVE#a', 'render', placeholder)
            reportIngressContent(messageBus, 'ROOM#a', 'PERSPECTIVE#a', 'render', terminal('Final'))
            await registerIngressSlot(messageBus, { createdTime: 5007, messageId: 'MESSAGE#two' }, headerSpec(['CHARACTER#b']))

            const published = perceptionPublishes(publishSpy)
            expect(published.map((m) => [m.messageId, m.createdTime, m.targets])).toEqual([
                ['MESSAGE#one', 5000, ['CHARACTER#a']],
                ['MESSAGE#one', expect.any(Number), ['CHARACTER#a']],
                ['MESSAGE#two', 5007, ['CHARACTER#b']],
            ])
            expect(published[2].metaData.status).toBeUndefined()
            publishSpy.mockRestore()
        })

        it('two listeners on one bucket are each delivered at their own time and MessageId', async () => {
            const publishSpy = spyPublish()
            await registerIngressSlot(messageBus, { createdTime: 5000, messageId: 'MESSAGE#one' }, headerSpec(['CHARACTER#a']))
            await registerIngressSlot(messageBus, { createdTime: 5003, messageId: 'MESSAGE#two' }, headerSpec(['CHARACTER#b']))
            reportIngressContent(messageBus, 'ROOM#a', 'PERSPECTIVE#a', 'render', terminal('Final'))

            const published = perceptionPublishes(publishSpy)
            expect(published.map((m) => [m.messageId, m.createdTime, m.targets])).toEqual([
                ['MESSAGE#one', 5000, ['CHARACTER#a']],
                ['MESSAGE#two', 5003, ['CHARACTER#b']],
            ])
            publishSpy.mockRestore()
        })

        it('a listener that never received content publishes nothing', async () => {
            const publishSpy = spyPublish()
            await registerIngressSlot(messageBus, { createdTime: 5000, messageId: 'MESSAGE#one' }, headerSpec(['CHARACTER#a']))
            await messageBus.flushAndSettle()
            expect(perceptionPublishes(publishSpy)).toHaveLength(0)
            publishSpy.mockRestore()
        })
    })
})
