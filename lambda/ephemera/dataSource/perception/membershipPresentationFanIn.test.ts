import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
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
    from: ROOM_A,
    to: ROOM_B,
    beatAnchorTime: ANCHOR_TIME,
    characterName: 'Alice',
    ...overrides,
})

describe('membershipPresentationFanIn', () => {
    describe('inferMembershipEmissionShape', () => {
        it('returns leaveAndArrive for cross-room in-play moves', () => {
            expect(inferMembershipEmissionShape(ROOM_A, ROOM_B)).toBe('leaveAndArrive')
        })

        it('returns arriveOnly for connect', () => {
            expect(inferMembershipEmissionShape(null, ROOM_B)).toBe('arriveOnly')
        })

        it('returns leaveOnly for disconnect', () => {
            expect(inferMembershipEmissionShape(ROOM_A, null)).toBe('leaveOnly')
        })

        it('returns none for same-room', () => {
            expect(inferMembershipEmissionShape(ROOM_A, ROOM_A)).toBe('none')
        })
    })

    describe('membershipClusterIdentity', () => {
        it('encodes null endpoints as out', () => {
            expect(membershipClusterIdentity(CHARACTER, null, ROOM_B)).toBe(`${CHARACTER}:out->${ROOM_B}`)
            expect(membershipClusterIdentity(CHARACTER, ROOM_A, null)).toBe(`${CHARACTER}:${ROOM_A}->out`)
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
                crossRoomFact({ from: null, to: ROOM_B }),
            ], { deferralExecution: false })

            expect(plan).toMatchObject({
                shape: 'arriveOnly',
                copyKind: 'connect',
            })
        })

        it('returns disconnect copy for disconnect intent', () => {
            const plan = buildMembershipEmissionPlan([
                disconnectIntent(),
                crossRoomFact({ from: ROOM_A, to: null }),
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
                crossRoomFact({ from: null, to: ROOM_B }),
            ], { deferralExecution: true })

            expect(plan).toMatchObject({
                shape: 'arriveOnly',
                copyKind: 'genericFactOnly',
            })
        })
    })

    describe('FanInClusterStore integration', () => {
        const makeCtx = createMembershipFanInHandlerContext

        describe('leg order independence', () => {
            it('completes when intent arrives before fact', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(navigateIntent())
                expect(store.getOpenPartialCount()).toBe(1)
                expect(ctx.plans).toHaveLength(0)

                await store.route(crossRoomFact())
                expect(store.getOpenPartialCount()).toBe(0)
                expect(ctx.plans).toEqual([{
                    shape: 'leaveAndArrive',
                    copyKind: 'genericNavigate',
                    beatAnchorTime: ANCHOR_TIME,
                    characterId: CHARACTER,
                    from: ROOM_A,
                    to: ROOM_B,
                    characterName: 'Alice',
                    deferralExecution: false,
                }])
            })

            it('completes when fact arrives before intent', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(crossRoomFact())
                expect(store.getOpenPartialCount()).toBe(1)

                await store.route(navigateIntent({ exitName: 'north' }))
                expect(store.getOpenPartialCount()).toBe(0)
                expect(ctx.plans[0]).toMatchObject({
                    copyKind: 'exitAware',
                    exitName: 'north',
                    deferralExecution: false,
                })
            })
        })

        describe('provisional intent partial + fact unify', () => {
            it('unifies connect intent with connect fact', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(connectIntent())
                await store.route(crossRoomFact({ from: null, to: ROOM_B }))

                expect(store.getOpenPartialCount()).toBe(0)
                expect(ctx.plans[0]).toMatchObject({
                    shape: 'arriveOnly',
                    copyKind: 'connect',
                })
            })

            it('unifies disconnect intent with disconnect fact', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(disconnectIntent())
                await store.route(crossRoomFact({ from: ROOM_A, to: null }))

                expect(store.getOpenPartialCount()).toBe(0)
                expect(ctx.plans[0]).toMatchObject({
                    shape: 'leaveOnly',
                    copyKind: 'disconnect',
                })
            })

            it('unifies navigate intent with full endpoints and fact', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(navigateIntent({ fromRoomId: ROOM_A, toRoomId: ROOM_B }))
                await store.route(crossRoomFact())

                expect(store.getOpenPartialCount()).toBe(0)
                expect(ctx.plans).toHaveLength(1)
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
                expect(ctx.plans).toHaveLength(0)
            })

            it('rejects a duplicate fact without firing handler again', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(crossRoomFact())
                await store.route(crossRoomFact())

                expect(store.getOpenPartialCount()).toBe(1)
                expect(ctx.plans).toHaveLength(0)
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
                expect(ctx.plans).toHaveLength(0)
            })
        })

        describe('deferral path', () => {
            it('fires handler with deferralExecution true at settle for incomplete partials', async () => {
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(crossRoomFact())
                expect(ctx.plans).toHaveLength(0)

                await store.settleDeferrals()
                expect(ctx.plans).toEqual([{
                    shape: 'leaveAndArrive',
                    copyKind: 'genericFactOnly',
                    beatAnchorTime: ANCHOR_TIME,
                    characterId: CHARACTER,
                    from: ROOM_A,
                    to: ROOM_B,
                    characterName: 'Alice',
                    deferralExecution: true,
                }])
                expect(store.getOpenPartialCount()).toBe(0)
            })

            it('runs deferral via registerDeferral after flushAndSettle', async () => {
                const bus = new InternalMessageBus<string>()
                const store = createMembershipPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)
                store.registerDeferral(bus, 'membershipPresentationFanIn')

                await store.route(crossRoomFact({ from: null, to: ROOM_B }))
                await bus.flushAndSettle()

                expect(ctx.plans).toEqual([{
                    shape: 'arriveOnly',
                    copyKind: 'genericFactOnly',
                    beatAnchorTime: ANCHOR_TIME,
                    characterId: CHARACTER,
                    from: null,
                    to: ROOM_B,
                    characterName: 'Alice',
                    deferralExecution: true,
                }])
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

                expect(ctx.plans).toHaveLength(1)
            })
        })
    })
})
