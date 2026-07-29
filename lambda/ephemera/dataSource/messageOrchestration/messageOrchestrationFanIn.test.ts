import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import type { MessageBus, PublishWorldMessage } from '../../messageBus/baseClasses'
import {
    createMessageOrchestrationFanInHandlerContext,
    createMessageOrchestrationFanInStore,
    type MessageOrchestrationBundleDeclareLeg,
    type MessageOrchestrationSlotReportLeg,
} from './messageOrchestrationFanIn'
import { DeliveredSlotIndex } from './deliveredSlotIndex'

const BUNDLE_A = 'bundle-a'

const worldMessage = (text: string): PublishWorldMessage => ({
    type: 'PublishMessage',
    targets: ['ROOM#a'],
    displayProtocol: 'WorldMessage',
    message: [text],
})

const worldMessageWithId = (text: string, targets: string[], messageId: string): PublishWorldMessage => ({
    type: 'PublishMessage',
    targets: targets as PublishWorldMessage['targets'],
    displayProtocol: 'WorldMessage',
    message: [text],
    messageId,
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
    const makeCtx = () => createMessageOrchestrationFanInHandlerContext({ publish: jest.fn() } as any, new DeliveredSlotIndex())

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

    describe('deliveredSlotIndex snapshot at flush (MO-10 seam)', () => {
        it('records targets/messageId for every slot that actually resolved by flush time', async () => {
            const store = createMessageOrchestrationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(declareLeg(['leave', 'arrive']))
            await store.route({
                kind: 'slot-report',
                bundleId: BUNDLE_A,
                slotId: 'leave',
                message: worldMessageWithId('Alice has left.', ['ROOM#a'], 'MESSAGE#leave'),
            })
            await store.route({
                kind: 'slot-report',
                bundleId: BUNDLE_A,
                slotId: 'arrive',
                message: worldMessageWithId('Alice has arrived.', ['ROOM#b'], 'MESSAGE#arrive'),
            })

            const leaveRecord = ctx.deliveredSlotIndex.find(BUNDLE_A, 'leave')
            const arriveRecord = ctx.deliveredSlotIndex.find(BUNDLE_A, 'arrive')
            expect(leaveRecord).toEqual({ targets: ['ROOM#a'], messageId: 'MESSAGE#leave', createdTime: expect.any(Number) })
            expect(arriveRecord).toEqual({ targets: ['ROOM#b'], messageId: 'MESSAGE#arrive', createdTime: expect.any(Number) })
            // Declared order is [leave, arrive]; the bundle assigns sequential CreatedTime values
            // 1ms apart, and the snapshot must carry the same value the flush actually published.
            expect(arriveRecord!.createdTime).toBe(leaveRecord!.createdTime + 1)
        })

        it('does not record a slot that was declared but never reported (tolerantly failed --- nothing to standalone against)', async () => {
            const store = createMessageOrchestrationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(declareLeg(['leave', 'header', 'arrive']))
            await store.route(reportLeg('leave', 'Alice has left.'))
            await store.route(reportLeg('arrive', 'Alice has arrived.'))
            expect(store.getOpenPartialCount()).toBe(1)

            await store.settleDeferrals()

            expect(ctx.deliveredSlotIndex.find(BUNDLE_A, 'leave')).toBeDefined()
            expect(ctx.deliveredSlotIndex.find(BUNDLE_A, 'arrive')).toBeDefined()
            expect(ctx.deliveredSlotIndex.find(BUNDLE_A, 'header')).toBeUndefined()
        })
    })

    describe('messageId mint-and-carry-forward in registerLeg (MO-10)', () => {
        it('mints a stable messageId on a slot\'s first report and carries it forward across a later overwriting report for the same slot, neither supplying its own', async () => {
            const store = createMessageOrchestrationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            // Two slots so the bundle stays open across both 'header' reports (a one-slot bundle
            // would complete and flush --- evicting the cluster --- on the first report).
            await store.route(declareLeg(['header', 'other']))
            await store.route(reportLeg('header', 'Generating...'))
            await store.route(reportLeg('header', 'Real content.'))
            await store.route(reportLeg('other', 'Unrelated.'))

            const published = publishedMessages(ctx.messageBus)
            const header = published.find((m) => (m.message as string[])[0] === 'Real content.')
            expect(header).toBeDefined()
            expect((header as { messageId?: string }).messageId).toMatch(/^MESSAGE#/)
        })

        it('an explicitly-supplied messageId on a later report for the same slot wins over a previously-minted one', async () => {
            const store = createMessageOrchestrationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(declareLeg(['header', 'other']))
            await store.route(reportLeg('header', 'Generating...'))
            await store.route({
                kind: 'slot-report',
                bundleId: BUNDLE_A,
                slotId: 'header',
                message: worldMessageWithId('Real content.', ['ROOM#a'], 'MESSAGE#explicit'),
            })
            await store.route(reportLeg('other', 'Unrelated.'))

            const published = publishedMessages(ctx.messageBus)
            const header = published.find((m) => (m.message as string[])[0] === 'Real content.')
            expect((header as { messageId?: string }).messageId).toBe('MESSAGE#explicit')
        })
    })
})
