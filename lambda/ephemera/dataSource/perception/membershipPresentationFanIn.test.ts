import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import type { MessageBus } from '../../messageBus/baseClasses'
import {
    buildMembershipEmissionPlan,
    createMembershipFanInHandlerContext,
    createMembershipPresentationFanInStore,
    inferMembershipEmissionShape,
    membershipClusterIdentity,
    type MembershipFactLeg,
    type MembershipIntentLeg,
} from './membershipPresentationFanIn'

const CHARACTER = 'CHARACTER#Alice' as const
const ROOM_A = 'ROOM#a' as const
const ROOM_B = 'ROOM#b' as const
const ROOM_C = 'ROOM#c' as const
const ANCHOR_TIME = 1_700_000_000_000

const navigateIntent = (overrides: Partial<MembershipIntentLeg> = {}): MembershipIntentLeg => ({
    kind: 'intent',
    characterId: CHARACTER,
    intentKind: 'navigate',
    fromRoomId: ROOM_A,
    toRoomId: ROOM_B,
    ...overrides,
})

const connectIntent = (overrides: Partial<MembershipIntentLeg> = {}): MembershipIntentLeg => ({
    kind: 'intent',
    characterId: CHARACTER,
    intentKind: 'connect',
    ...overrides,
})

const disconnectIntent = (overrides: Partial<MembershipIntentLeg> = {}): MembershipIntentLeg => ({
    kind: 'intent',
    characterId: CHARACTER,
    intentKind: 'disconnect',
    ...overrides,
})

const homeIntent = (overrides: Partial<MembershipIntentLeg> = {}): MembershipIntentLeg => ({
    kind: 'intent',
    characterId: CHARACTER,
    intentKind: 'home',
    ...overrides,
})

const crossRoomFact = (overrides: Partial<MembershipFactLeg> = {}): MembershipFactLeg => ({
    kind: 'fact',
    characterId: CHARACTER,
    froms: [ROOM_A],
    to: ROOM_B,
    beatAnchorTime: ANCHOR_TIME,
    characterName: 'Alice',
    ...overrides,
})

describe('membershipPresentationFanIn', () => {
    describe('inferMembershipEmissionShape', () => {
        it('returns leaveAndArrive for cross-room in-play moves', () => {
            expect(inferMembershipEmissionShape([ROOM_A], ROOM_B)).toBe('leaveAndArrive')
        })

        it('returns leaveAndArrive for multi-from drift scrub', () => {
            expect(inferMembershipEmissionShape([ROOM_A, ROOM_C], ROOM_B)).toBe('leaveAndArrive')
        })

        it('returns arriveOnly for connect', () => {
            expect(inferMembershipEmissionShape([], ROOM_B)).toBe('arriveOnly')
        })

        it('returns leaveOnly for disconnect', () => {
            expect(inferMembershipEmissionShape([ROOM_A], null)).toBe('leaveOnly')
        })

        it('returns none for same-room', () => {
            expect(inferMembershipEmissionShape([ROOM_A], ROOM_A)).toBe('none')
        })
    })

    describe('membershipClusterIdentity', () => {
        it('encodes empty froms and null to as out', () => {
            expect(membershipClusterIdentity(CHARACTER, [], ROOM_B)).toBe(`${CHARACTER}:out->${ROOM_B}`)
            expect(membershipClusterIdentity(CHARACTER, [ROOM_A], null)).toBe(`${CHARACTER}:${ROOM_A}->out`)
        })

        it('uses canonical sorted froms regardless of input order', () => {
            expect(membershipClusterIdentity(CHARACTER, [ROOM_C, ROOM_A], ROOM_B))
                .toBe(membershipClusterIdentity(CHARACTER, [ROOM_A, ROOM_C], ROOM_B))
        })
    })

    describe('buildMembershipEmissionPlan', () => {
        it('returns exit-aware copy when navigate intent has exitName', () => {
            const plan = buildMembershipEmissionPlan([
                navigateIntent({ exitName: 'north' }),
                crossRoomFact(),
            ], { deferralExecution: false })

            expect(plan).toMatchObject({
                shape: 'leaveAndArrive',
                copyKind: 'exitAware',
                exitName: 'north',
                beatAnchorTime: ANCHOR_TIME,
                intentFromRoomId: ROOM_A,
            })
        })

        it('returns genericNavigate when navigate has no exitName', () => {
            const plan = buildMembershipEmissionPlan([
                navigateIntent(),
                crossRoomFact(),
            ], { deferralExecution: false })

            expect(plan).toMatchObject({
                shape: 'leaveAndArrive',
                copyKind: 'genericNavigate',
            })
        })

        it('returns connect copy for connect intent', () => {
            const plan = buildMembershipEmissionPlan([
                connectIntent(),
                crossRoomFact({ froms: [], to: ROOM_B }),
            ], { deferralExecution: false })

            expect(plan).toMatchObject({
                shape: 'arriveOnly',
                copyKind: 'connect',
            })
        })

        it('returns disconnect copy for disconnect intent', () => {
            const plan = buildMembershipEmissionPlan([
                disconnectIntent(),
                crossRoomFact({ froms: [ROOM_A], to: null }),
            ], { deferralExecution: false })

            expect(plan).toMatchObject({
                shape: 'leaveOnly',
                copyKind: 'disconnect',
            })
        })

        it('returns home copy for home intent', () => {
            const plan = buildMembershipEmissionPlan([
                homeIntent(),
                crossRoomFact(),
            ], { deferralExecution: false })

            expect(plan).toMatchObject({
                shape: 'leaveAndArrive',
                copyKind: 'home',
            })
        })

        it('returns genericFactOnly at deferral', () => {
            const plan = buildMembershipEmissionPlan([crossRoomFact()], { deferralExecution: true })

            expect(plan).toMatchObject({
                shape: 'leaveAndArrive',
                copyKind: 'genericFactOnly',
            })
        })

        it('returns arriveOnly genericFactOnly for connect fact at deferral', () => {
            const plan = buildMembershipEmissionPlan([
                crossRoomFact({ froms: [], to: ROOM_B }),
            ], { deferralExecution: true })

            expect(plan).toMatchObject({
                shape: 'arriveOnly',
                copyKind: 'genericFactOnly',
            })
        })
    })

    describe('FanInClusterStore integration', () => {
        const makeCtx = () => createMembershipFanInHandlerContext({ publish: jest.fn() } as any)

        const worldPublishes = (messageBus: { publish: jest.Mock | MessageBus['publish'] }) => (
            (messageBus.publish as jest.Mock).mock.calls
                .map((call) => call[0])
                .filter((message) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')
        )

        describe('leg order independence', () => {
            it('completes when intent arrives before fact', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(navigateIntent())
                expect(store.getOpenPartialCount()).toBe(1)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(0)

                await store.route(crossRoomFact())
                expect(store.getOpenPartialCount()).toBe(0)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(2)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    message: ['Alice has left.'],
                    createdTime: ANCHOR_TIME - 1,
                })
                expect(worldPublishes(ctx.messageBus)[1]).toMatchObject({
                    message: ['Alice has arrived.'],
                    createdTime: ANCHOR_TIME + 1,
                })
            })

            it('completes when fact arrives before intent', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(crossRoomFact())
                expect(store.getOpenPartialCount()).toBe(1)

                await store.route(navigateIntent({ exitName: 'north' }))
                expect(store.getOpenPartialCount()).toBe(0)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    message: ['Alice left by north exit.'],
                })
            })
        })

        describe('provisional intent partial + fact unify', () => {
            it('unifies connect intent with connect fact', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(connectIntent())
                await store.route(crossRoomFact({ froms: [], to: ROOM_B }))

                expect(store.getOpenPartialCount()).toBe(0)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(1)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    message: ['Alice has connected.'],
                })
            })

            it('unifies disconnect intent with disconnect fact', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(disconnectIntent())
                await store.route(crossRoomFact({ froms: [ROOM_A], to: null }))

                expect(store.getOpenPartialCount()).toBe(0)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(1)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    message: ['Alice has disconnected.'],
                })
            })

            it('unifies navigate intent with full endpoints and fact', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(navigateIntent({ fromRoomId: ROOM_A, toRoomId: ROOM_B }))
                await store.route(crossRoomFact())

                expect(store.getOpenPartialCount()).toBe(0)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(2)
            })

            it('correlates intent when fromRoomId is in fact.froms', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(navigateIntent({ fromRoomId: ROOM_A, toRoomId: ROOM_B, exitName: 'north' }))
                await store.route(crossRoomFact({ froms: [ROOM_A, ROOM_C], to: ROOM_B }))

                expect(store.getOpenPartialCount()).toBe(0)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(3)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    targets: [ROOM_A, CHARACTER],
                    message: ['Alice left by north exit.'],
                })
                expect(worldPublishes(ctx.messageBus)[1]).toMatchObject({
                    targets: [ROOM_C, CHARACTER],
                    message: ['Alice has left.'],
                })
            })
        })

        describe('duplicate-leg rejection', () => {
            it('rejects a second intent without firing handler again', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(navigateIntent())
                await store.route(connectIntent())

                expect(store.getOpenPartialCount()).toBe(1)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(0)
            })

            it('rejects a duplicate fact without firing handler again', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(crossRoomFact())
                await store.route(crossRoomFact())

                expect(store.getOpenPartialCount()).toBe(1)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(0)
            })
        })

        describe('endpoint contradiction rejection', () => {
            it('does not correlate intent whose toRoomId contradicts fact', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(crossRoomFact())
                await store.route(navigateIntent({ toRoomId: 'ROOM#other' as const }))

                expect(store.getOpenPartialCount()).toBe(2)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(0)
            })

            it('does not correlate intent whose fromRoomId is not in fact.froms', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(crossRoomFact({ froms: [ROOM_C], to: ROOM_B }))
                await store.route(navigateIntent({ fromRoomId: ROOM_A, toRoomId: ROOM_B }))

                expect(store.getOpenPartialCount()).toBe(2)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(0)
            })
        })

        describe('deferral path', () => {
            it('fires handler with deferralExecution true at settle for incomplete partials', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(crossRoomFact())
                expect(worldPublishes(ctx.messageBus)).toHaveLength(0)

                await store.settleDeferrals()
                expect(worldPublishes(ctx.messageBus)).toHaveLength(2)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    message: ['Alice has left.'],
                    createdTime: ANCHOR_TIME - 1,
                })
                expect(store.getOpenPartialCount()).toBe(0)
            })

            it('publishes generic leave at stale from on race intent A->B fact [C]->B', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(navigateIntent({ fromRoomId: ROOM_A, toRoomId: ROOM_B, exitName: 'north' }))
                await store.route(crossRoomFact({ froms: [ROOM_C], to: ROOM_B }))

                expect(store.getOpenPartialCount()).toBe(2)

                await store.settleDeferrals()
                expect(worldPublishes(ctx.messageBus)).toHaveLength(2)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    targets: [ROOM_C, CHARACTER],
                    message: ['Alice has left.'],
                })
                expect(worldPublishes(ctx.messageBus)[1]).toMatchObject({
                    targets: [ROOM_B, CHARACTER],
                    message: ['Alice has arrived.'],
                })
            })

            it('runs deferral via registerDeferral after flushAndSettle', async () => {
                const bus = new InternalMessageBus<string>()
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)
                store.registerDeferral(bus, 'membershipPresentationFanIn')

                await store.route(crossRoomFact({ froms: [], to: ROOM_B }))
                await bus.flushAndSettle()

                expect(worldPublishes(ctx.messageBus)).toHaveLength(1)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    message: ['Alice has arrived.'],
                    createdTime: ANCHOR_TIME + 1,
                })
            })
        })

        describe('no double handler', () => {
            it('does not invoke handler again after completion', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(navigateIntent())
                await store.route(crossRoomFact())
                await store.route(connectIntent())

                expect(worldPublishes(ctx.messageBus)).toHaveLength(2)
            })
        })
    })
})
