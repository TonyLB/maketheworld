import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import type { MessageBus, PublishWorldMessage } from '../../messageBus/baseClasses'
import {
    createMessageOrchestrationFanInHandlerContext,
    createMessageOrchestrationFanInStore,
    type MessageOrchestrationBundleDeclareLeg,
    type MessageOrchestrationSlotReportLeg,
} from './messageOrchestrationFanIn'

const BUNDLE_A = 'bundle-a'

const worldMessage = (text: string): PublishWorldMessage => ({
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

    describe('CreatedTime assignment at flush', () => {
        it('assigns sequential CreatedTime, 1ms apart, in declared order --- overwriting whatever CreatedTime each slot arrived with', async () => {
            const store = createMessageOrchestrationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(declareLeg(['leave', 'header', 'arrive']))
            // Reports arrive out of order and with wildly inconsistent CreatedTime values of their
            // own (e.g. a stale beat anchor for leave/arrive, real wall-clock "now" for header) ---
            // the bundle must not trust any of that; it assigns its own sequence at flush.
            await store.route({
                kind: 'slot-report',
                bundleId: BUNDLE_A,
                slotId: 'arrive',
                message: { ...worldMessage('Alice has arrived.'), createdTime: 1_700_000_000_001 },
            })
            await store.route({
                kind: 'slot-report',
                bundleId: BUNDLE_A,
                slotId: 'header',
                message: { ...worldMessage('Room Header'), createdTime: 9_999_999_999_999 },
            })
            await store.route({
                kind: 'slot-report',
                bundleId: BUNDLE_A,
                slotId: 'leave',
                message: { ...worldMessage('Alice has left.'), createdTime: 1_700_000_000_000 },
            })

            const published = publishedMessages(ctx.messageBus)
            expect(published.map((m) => m.message)).toEqual([
                ['Alice has left.'],
                ['Room Header'],
                ['Alice has arrived.'],
            ])
            const times = published.map((m) => m.createdTime as number)
            expect(times[1]).toBe(times[0] + 1)
            expect(times[2]).toBe(times[1] + 1)
        })

        it('skips an unresolved slot without leaving a gap in the assigned sequence', async () => {
            const store = createMessageOrchestrationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(declareLeg(['leave', 'header', 'arrive']))
            await store.route(reportLeg('leave', 'Alice has left.'))
            await store.route(reportLeg('arrive', 'Alice has arrived.'))
            expect(store.getOpenPartialCount()).toBe(1)

            await store.settleDeferrals()

            const published = publishedMessages(ctx.messageBus)
            expect(published.map((m) => m.message)).toEqual([['Alice has left.'], ['Alice has arrived.']])
            const times = published.map((m) => m.createdTime as number)
            expect(times[1]).toBe(times[0] + 1)
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
