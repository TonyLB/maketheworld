import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import type { MessageBus, PublishMessage } from '../../messageBus/baseClasses'
import {
    createMessageOrchestrationFanInHandlerContext,
    createMessageOrchestrationFanInStore,
    type MessageOrchestrationBundleDeclareLeg,
    type MessageOrchestrationSlotReportLeg,
} from './messageOrchestrationFanIn'

const BUNDLE_A = 'bundle-a'

const worldMessage = (text: string): PublishMessage => ({
    type: 'PublishMessage',
    targets: ['ROOM#a'],
    displayProtocol: 'WorldMessage',
    message: [text],
})

const declareLeg = (slotIds: string[]): MessageOrchestrationBundleDeclareLeg => ({
    kind: 'bundle-declare',
    bundleId: BUNDLE_A,
    slots: slotIds.map((slotId) => ({ slotId, expectedPublishType: 'WorldMessage' as const })),
})

const reportLeg = (slotId: string, text: string): MessageOrchestrationSlotReportLeg => ({
    kind: 'slot-report',
    bundleId: BUNDLE_A,
    slotId,
    message: worldMessage(text),
})

describe('messageOrchestrationFanIn', () => {
    const makeCtx = () => createMessageOrchestrationFanInHandlerContext({ publish: jest.fn() } as any)

    const publishedMessages = (messageBus: { publish: jest.Mock | MessageBus['publish'] }) => (
        (messageBus.publish as jest.Mock).mock.calls.map((call) => call[0])
    )

    describe('leg order independence', () => {
        it('flushes in declared order when declare arrives before reports', async () => {
            const store = createMessageOrchestrationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(declareLeg(['leave', 'header', 'arrive']))
            expect(store.getOpenPartialCount()).toBe(1)
            expect(publishedMessages(ctx.messageBus)).toHaveLength(0)

            await store.route(reportLeg('arrive', 'Alice has arrived.'))
            await store.route(reportLeg('leave', 'Alice has left.'))
            expect(store.getOpenPartialCount()).toBe(1)
            expect(publishedMessages(ctx.messageBus)).toHaveLength(0)

            await store.route(reportLeg('header', 'Room Header'))
            expect(store.getOpenPartialCount()).toBe(0)
            expect(publishedMessages(ctx.messageBus)).toHaveLength(3)
            expect(publishedMessages(ctx.messageBus).map((m) => m.message)).toEqual([
                ['Alice has left.'],
                ['Room Header'],
                ['Alice has arrived.'],
            ])
        })

        it('completes once declare arrives, even when reports arrive first', async () => {
            const store = createMessageOrchestrationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(reportLeg('leave', 'Alice has left.'))
            await store.route(reportLeg('arrive', 'Alice has arrived.'))
            expect(store.getOpenPartialCount()).toBe(1)
            expect(publishedMessages(ctx.messageBus)).toHaveLength(0)

            await store.route(declareLeg(['leave', 'arrive']))
            expect(store.getOpenPartialCount()).toBe(0)
            expect(publishedMessages(ctx.messageBus).map((m) => m.message)).toEqual([
                ['Alice has left.'],
                ['Alice has arrived.'],
            ])
        })
    })

    describe('duplicate-leg rejection', () => {
        it('rejects a second bundle-declare for the same bundleId without re-registering slots', async () => {
            const store = createMessageOrchestrationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(declareLeg(['leave']))
            await store.route(declareLeg(['leave', 'arrive']))
            await store.route(reportLeg('leave', 'Alice has left.'))

            expect(store.getOpenPartialCount()).toBe(0)
            expect(publishedMessages(ctx.messageBus).map((m) => m.message)).toEqual([['Alice has left.']])
        })
    })

    describe('deferral / settle path', () => {
        it('publishes the resolved subset in declared order, skipping a slot that never reports', async () => {
            const store = createMessageOrchestrationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(declareLeg(['leave', 'header', 'arrive']))
            await store.route(reportLeg('arrive', 'Alice has arrived.'))
            expect(store.getOpenPartialCount()).toBe(1)

            await store.settleDeferrals()
            expect(store.getOpenPartialCount()).toBe(0)
            expect(publishedMessages(ctx.messageBus).map((m) => m.message)).toEqual([['Alice has arrived.']])
        })

        it('publishes nothing at settle when only reports arrived and no declare ever landed', async () => {
            const store = createMessageOrchestrationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(reportLeg('leave', 'Alice has left.'))
            expect(store.getOpenPartialCount()).toBe(1)

            await store.settleDeferrals()
            expect(store.getOpenPartialCount()).toBe(0)
            expect(publishedMessages(ctx.messageBus)).toHaveLength(0)
        })

        it('runs deferral via registerDeferral after flushAndSettle', async () => {
            const bus = new InternalMessageBus<string>()
            const store = createMessageOrchestrationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)
            store.registerDeferral(bus, 'fanIn-mtw.ephemera.messageOrchestration')

            await store.route(declareLeg(['leave', 'arrive']))
            await store.route(reportLeg('leave', 'Alice has left.'))
            await bus.flushAndSettle()

            expect(publishedMessages(ctx.messageBus).map((m) => m.message)).toEqual([['Alice has left.']])
        })
    })
})
