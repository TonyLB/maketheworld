import { InternalMessageBus } from '../messageBus'
import { FanInCluster, FanInHandlerOptions } from './fanInCluster'
import { FanInClusterStore } from './fanInClusterStore'

type TestLegKind = 'intent' | 'fact' | 'leaveIntent' | 'arriveIntent'

type TestLeg = {
    kind: TestLegKind
    characterId: string
    from?: string
    to?: string
}

type TestCtx = {
    handlerCalls: Array<{ identity: string | null; deferralExecution: boolean; legs: TestLegKind[] }>
}

const factIdentity = (leg: TestLeg): string | null => {
    if (leg.from === undefined || leg.to === undefined) {
        return null
    }
    return `${leg.characterId}:${leg.from}->${leg.to}`
}

class TwoLegAndCluster extends FanInCluster<TestLeg, TestCtx> {
    readonly characterId: string
    readonly legs: TestLeg[] = []

    constructor(characterId: string) {
        super()
        this.characterId = characterId
    }

    canAcceptLeg(leg: TestLeg): boolean {
        if (leg.characterId !== this.characterId) {
            return false
        }
        if (leg.kind !== 'intent' && leg.kind !== 'fact') {
            return false
        }
        if (this.legs.some((existing) => existing.kind === leg.kind)) {
            return false
        }
        const factLeg = leg.kind === 'fact' ? leg : this.legs.find((existing) => existing.kind === 'fact')
        if (factLeg?.from !== undefined && leg.from !== undefined && leg.from !== factLeg.from) {
            return false
        }
        if (factLeg?.to !== undefined && leg.to !== undefined && leg.to !== factLeg.to) {
            return false
        }
        return true
    }

    canUnifyWith(other: FanInCluster<TestLeg, TestCtx>): boolean {
        if (!(other instanceof TwoLegAndCluster)) {
            return false
        }
        if (other.characterId !== this.characterId) {
            return false
        }
        const myFact = this.legs.find((leg) => leg.kind === 'fact')
        const otherFact = other.legs.find((leg) => leg.kind === 'fact')
        if (myFact && otherFact) {
            return myFact.from === otherFact.from && myFact.to === otherFact.to
        }
        if (myFact?.from !== undefined && other.legs.some((leg) => leg.from !== undefined && leg.from !== myFact.from)) {
            return false
        }
        if (myFact?.to !== undefined && other.legs.some((leg) => leg.to !== undefined && leg.to !== myFact.to)) {
            return false
        }
        if (otherFact?.from !== undefined && this.legs.some((leg) => leg.from !== undefined && leg.from !== otherFact.from)) {
            return false
        }
        if (otherFact?.to !== undefined && this.legs.some((leg) => leg.to !== undefined && leg.to !== otherFact.to)) {
            return false
        }
        return true
    }

    unifyWith(other: FanInCluster<TestLeg, TestCtx>): void {
        if (!(other instanceof TwoLegAndCluster)) {
            return
        }
        for (const leg of other.legs) {
            if (!this.legs.some((existing) => existing.kind === leg.kind)) {
                this.legs.push(leg)
            }
        }
    }

    registerLeg(leg: TestLeg): void {
        this.legs.push(leg)
    }

    clusterIdentity(): string | null {
        const factLeg = this.legs.find((leg) => leg.kind === 'fact')
        return factLeg ? factIdentity(factLeg) : null
    }

    get completed(): boolean {
        return this.legs.some((leg) => leg.kind === 'intent') && this.legs.some((leg) => leg.kind === 'fact')
    }

    async handler(ctx: TestCtx, options: FanInHandlerOptions): Promise<void> {
        ctx.handlerCalls.push({
            identity: this.clusterIdentity(),
            deferralExecution: options.deferralExecution,
            legs: this.legs.map((leg) => leg.kind),
        })
    }
}

class LeaveIntentSlotCluster extends FanInCluster<TestLeg, TestCtx> {
    readonly characterId: string
    readonly legs: TestLeg[] = []

    constructor(characterId: string) {
        super()
        this.characterId = characterId
    }

    canAcceptLeg(leg: TestLeg): boolean {
        if (leg.characterId !== this.characterId) {
            return false
        }
        if (leg.kind !== 'leaveIntent' && leg.kind !== 'fact') {
            return false
        }
        return !this.legs.some((existing) => existing.kind === leg.kind)
    }

    canUnifyWith(other: FanInCluster<TestLeg, TestCtx>): boolean {
        if (!(other instanceof LeaveIntentSlotCluster || other instanceof ArriveIntentSlotCluster)) {
            return false
        }
        if (other.characterId !== this.characterId) {
            return false
        }
        const myFact = this.legs.find((leg) => leg.kind === 'fact')
        const otherFact = other.legs.find((leg) => leg.kind === 'fact')
        if (!myFact && !otherFact) {
            return false
        }
        if (myFact && otherFact) {
            return myFact.from === otherFact.from && myFact.to === otherFact.to
        }
        return true
    }

    unifyWith(other: FanInCluster<TestLeg, TestCtx>): void {
        if (!(other instanceof LeaveIntentSlotCluster || other instanceof ArriveIntentSlotCluster)) {
            return
        }
        for (const leg of other.legs) {
            if (!this.legs.some((existing) => existing.kind === leg.kind)) {
                this.legs.push(leg)
            }
        }
    }

    registerLeg(leg: TestLeg): void {
        this.legs.push(leg)
    }

    clusterIdentity(): string | null {
        const factLeg = this.legs.find((leg) => leg.kind === 'fact')
        return factLeg ? factIdentity(factLeg) : null
    }

    get completed(): boolean {
        return this.legs.some((leg) => leg.kind === 'leaveIntent')
            && this.legs.some((leg) => leg.kind === 'arriveIntent')
            && this.legs.some((leg) => leg.kind === 'fact')
    }

    async handler(ctx: TestCtx, options: FanInHandlerOptions): Promise<void> {
        ctx.handlerCalls.push({
            identity: this.clusterIdentity(),
            deferralExecution: options.deferralExecution,
            legs: this.legs.map((leg) => leg.kind),
        })
    }
}

class ArriveIntentSlotCluster extends LeaveIntentSlotCluster {
    override canAcceptLeg(leg: TestLeg): boolean {
        if (leg.characterId !== this.characterId) {
            return false
        }
        if (leg.kind !== 'arriveIntent' && leg.kind !== 'fact') {
            return false
        }
        return !this.legs.some((existing) => existing.kind === leg.kind)
    }
}

const createMultiIntentStore = () => new FanInClusterStore<
    TestLeg,
    TestCtx,
    LeaveIntentSlotCluster | ArriveIntentSlotCluster
>([
    (leg) => {
        if (leg.kind === 'leaveIntent' || leg.kind === 'fact') {
            return new LeaveIntentSlotCluster(leg.characterId)
        }
        if (leg.kind === 'arriveIntent') {
            return new ArriveIntentSlotCluster(leg.characterId)
        }
        return null
    },
])
const createTwoLegStore = () => new FanInClusterStore<TestLeg, TestCtx, TwoLegAndCluster>([
    (leg) => {
        if (leg.kind === 'intent' || leg.kind === 'fact') {
            return new TwoLegAndCluster(leg.characterId)
        }
        return null
    },
])

const makeCtx = (): TestCtx => ({ handlerCalls: [] })

describe('FanInClusterStore', () => {
    describe('leg order independence', () => {
        it('completes when intent arrives before fact', async () => {
            const store = createTwoLegStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route({ kind: 'intent', characterId: 'CHARACTER#Alice' })
            expect(store.getOpenPartialCount()).toBe(1)
            expect(ctx.handlerCalls).toHaveLength(0)

            await store.route({ kind: 'fact', characterId: 'CHARACTER#Alice', from: 'ROOM#a', to: 'ROOM#b' })
            expect(store.getOpenPartialCount()).toBe(0)
            expect(ctx.handlerCalls).toEqual([{
                identity: 'CHARACTER#Alice:ROOM#a->ROOM#b',
                deferralExecution: false,
                legs: ['intent', 'fact'],
            }])
        })

        it('completes when fact arrives before intent', async () => {
            const store = createTwoLegStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route({ kind: 'fact', characterId: 'CHARACTER#Alice', from: 'ROOM#a', to: 'ROOM#b' })
            expect(store.getOpenPartialCount()).toBe(1)

            await store.route({ kind: 'intent', characterId: 'CHARACTER#Alice' })
            expect(store.getOpenPartialCount()).toBe(0)
            expect(ctx.handlerCalls).toEqual([{
                identity: 'CHARACTER#Alice:ROOM#a->ROOM#b',
                deferralExecution: false,
                legs: ['fact', 'intent'],
            }])
        })
    })

    describe('provisional intent partial + fact unify', () => {
        it('unifies separate intent and fact partials when fact proves same transition', async () => {
            const store = createTwoLegStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route({ kind: 'intent', characterId: 'CHARACTER#Alice' })
            await store.route({ kind: 'fact', characterId: 'CHARACTER#Alice', from: 'ROOM#a', to: 'ROOM#b' })

            expect(store.getOpenPartialCount()).toBe(0)
            expect(ctx.handlerCalls).toHaveLength(1)
            expect(ctx.handlerCalls[0].identity).toBe('CHARACTER#Alice:ROOM#a->ROOM#b')
        })
    })

    describe('duplicate-leg rejection', () => {
        it('rejects a second leg of the same kind without firing handler again', async () => {
            const store = createTwoLegStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route({ kind: 'intent', characterId: 'CHARACTER#Alice' })
            await store.route({ kind: 'intent', characterId: 'CHARACTER#Alice' })

            expect(store.getOpenPartialCount()).toBe(1)
            expect(ctx.handlerCalls).toHaveLength(0)
        })
    })

    describe('deferral path', () => {
        it('fires handler with deferralExecution true at settle for incomplete partials', async () => {
            const store = createTwoLegStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route({ kind: 'fact', characterId: 'CHARACTER#Alice', from: 'ROOM#a', to: 'ROOM#b' })
            expect(ctx.handlerCalls).toHaveLength(0)

            await store.settleDeferrals()
            expect(ctx.handlerCalls).toEqual([{
                identity: 'CHARACTER#Alice:ROOM#a->ROOM#b',
                deferralExecution: true,
                legs: ['fact'],
            }])
            expect(store.getOpenPartialCount()).toBe(0)
        })

        it('runs deferral via registerDeferral after flushAndSettle', async () => {
            const bus = new InternalMessageBus<string>()
            const store = createTwoLegStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)
            store.registerDeferral(bus, 'testFanIn')

            await store.route({ kind: 'fact', characterId: 'CHARACTER#Alice', from: 'ROOM#a', to: 'ROOM#b' })
            await bus.flushAndSettle()

            expect(ctx.handlerCalls).toEqual([{
                identity: 'CHARACTER#Alice:ROOM#a->ROOM#b',
                deferralExecution: true,
                legs: ['fact'],
            }])
        })
    })

    describe('no double handler', () => {
        it('does not invoke handler again after completion', async () => {
            const store = createTwoLegStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route({ kind: 'intent', characterId: 'CHARACTER#Alice' })
            await store.route({ kind: 'fact', characterId: 'CHARACTER#Alice', from: 'ROOM#a', to: 'ROOM#b' })
            await store.route({ kind: 'intent', characterId: 'CHARACTER#Alice' })

            expect(ctx.handlerCalls).toHaveLength(1)
        })
    })

    describe('multi-partial unify', () => {
        it('unifies leave-intent and arrive-intent partials with a cross-room fact', async () => {
            const store = createMultiIntentStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route({ kind: 'leaveIntent', characterId: 'CHARACTER#Alice' })
            await store.route({ kind: 'arriveIntent', characterId: 'CHARACTER#Alice' })
            expect(store.getOpenPartialCount()).toBe(2)

            await store.route({
                kind: 'fact',
                characterId: 'CHARACTER#Alice',
                from: 'ROOM#a',
                to: 'ROOM#b',
            })

            expect(store.getOpenPartialCount()).toBe(0)
            expect(ctx.handlerCalls).toHaveLength(1)
            expect(ctx.handlerCalls[0]).toMatchObject({
                identity: 'CHARACTER#Alice:ROOM#a->ROOM#b',
                deferralExecution: false,
            })
            expect(ctx.handlerCalls[0].legs).toEqual(expect.arrayContaining(['leaveIntent', 'arriveIntent', 'fact']))
            expect(ctx.handlerCalls[0].legs).toHaveLength(3)
        })
    })

    describe('unify guardrails', () => {
        it('rejects contradictory endpoint unification', async () => {
            const store = createTwoLegStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route({ kind: 'fact', characterId: 'CHARACTER#Alice', from: 'ROOM#a', to: 'ROOM#b' })
            await store.route({ kind: 'fact', characterId: 'CHARACTER#Alice', from: 'ROOM#x', to: 'ROOM#y' })

            expect(store.getOpenPartialCount()).toBe(2)
            expect(ctx.handlerCalls).toHaveLength(0)
        })
    })

    describe('registerDeferral', () => {
        it('onClear drops open partials without calling handler', async () => {
            const bus = new InternalMessageBus<string>()
            const store = createTwoLegStore()
            store.setHandlerContext(makeCtx())
            store.registerDeferral(bus, 'testFanInClear')

            await store.route({ kind: 'intent', characterId: 'CHARACTER#Alice' })
            expect(store.getOpenPartialCount()).toBe(1)

            bus.clear()
            expect(store.getOpenPartialCount()).toBe(0)
        })

        it('throws on duplicate deferral tag', () => {
            const bus = new InternalMessageBus<string>()
            const store = createTwoLegStore()
            store.registerDeferral(bus, 'dupFanIn')
            expect(() => store.registerDeferral(bus, 'dupFanIn')).toThrow(/already registered/)
        })
    })

    describe('handler context', () => {
        it('throws when route is called without setHandlerContext', async () => {
            const store = createTwoLegStore()
            await expect(store.route({ kind: 'intent', characterId: 'CHARACTER#Alice' }))
                .rejects
                .toThrow(/handler context is not set/)
        })

        it('throws when settleDeferrals is called without setHandlerContext', async () => {
            const store = createTwoLegStore()
            await expect(store.settleDeferrals())
                .rejects
                .toThrow(/handler context is not set/)
        })
    })
})

type SyntheticEnvelope =
    | { kind: 'fanInIntent'; characterId: string }
    | { kind: 'fanInFact'; characterId: string; from: string; to: string }
    | { kind: 'roomUpdate'; roomId: string }
    | { kind: 'settingsChanged'; playerId: string }

const toFanInLeg = (envelope: SyntheticEnvelope): TestLeg | undefined => {
    if (envelope.kind === 'fanInIntent') {
        return { kind: 'intent', characterId: envelope.characterId }
    }
    if (envelope.kind === 'fanInFact') {
        return {
            kind: 'fact',
            characterId: envelope.characterId,
            from: envelope.from,
            to: envelope.to,
        }
    }
    return undefined
}

const processReceiveEventsBatch = async (
    events: SyntheticEnvelope[],
    {
        fanInStore,
        ctx,
        handleNonFanIn,
    }: {
        fanInStore: FanInClusterStore<TestLeg, TestCtx, TwoLegAndCluster>
        ctx: TestCtx
        handleNonFanIn: (envelope: SyntheticEnvelope) => Promise<void>
    }
): Promise<void> => {
    fanInStore.setHandlerContext(ctx)
    for (const envelope of events) {
        const leg = toFanInLeg(envelope)
        if (leg) {
            await fanInStore.route(leg)
        } else {
            await handleNonFanIn(envelope)
        }
    }
}

describe('mixed fan-in and non-fan-in receiveEvents batch', () => {
    it('handles non-fan-in envelopes independently while fan-in legs complete', async () => {
        const store = createTwoLegStore()
        const ctx = makeCtx()
        const nonFanInHandled: SyntheticEnvelope[] = []

        await processReceiveEventsBatch([
            { kind: 'fanInIntent', characterId: 'CHARACTER#Alice' },
            { kind: 'roomUpdate', roomId: 'ROOM#a' },
            { kind: 'fanInFact', characterId: 'CHARACTER#Alice', from: 'ROOM#a', to: 'ROOM#b' },
            { kind: 'settingsChanged', playerId: 'PLAYER#1' },
        ], {
            fanInStore: store,
            ctx,
            handleNonFanIn: async (envelope) => {
                nonFanInHandled.push(envelope)
            },
        })

        expect(nonFanInHandled).toEqual([
            { kind: 'roomUpdate', roomId: 'ROOM#a' },
            { kind: 'settingsChanged', playerId: 'PLAYER#1' },
        ])
        expect(ctx.handlerCalls).toEqual([{
            identity: 'CHARACTER#Alice:ROOM#a->ROOM#b',
            deferralExecution: false,
            legs: ['intent', 'fact'],
        }])
    })

    it('does not mutate fan-in partials when processing non-fan-in envelopes', async () => {
        const store = createTwoLegStore()
        const ctx = makeCtx()

        await processReceiveEventsBatch([
            { kind: 'fanInIntent', characterId: 'CHARACTER#Alice' },
            { kind: 'roomUpdate', roomId: 'ROOM#a' },
        ], {
            fanInStore: store,
            ctx,
            handleNonFanIn: async () => {},
        })

        expect(store.getOpenPartialCount()).toBe(1)
        expect(ctx.handlerCalls).toHaveLength(0)
    })

    it('records non-fan-in work before deferral settle on mixed incomplete batch', async () => {
        const bus = new InternalMessageBus<string>()
        const store = createTwoLegStore()
        const ctx = makeCtx()
        const nonFanInHandled: SyntheticEnvelope[] = []
        store.registerDeferral(bus, 'mixedBatchFanIn')

        await processReceiveEventsBatch([
            { kind: 'fanInFact', characterId: 'CHARACTER#Alice', from: 'ROOM#a', to: 'ROOM#b' },
            { kind: 'roomUpdate', roomId: 'ROOM#a' },
        ], {
            fanInStore: store,
            ctx,
            handleNonFanIn: async (envelope) => {
                nonFanInHandled.push(envelope)
            },
        })

        expect(nonFanInHandled).toEqual([{ kind: 'roomUpdate', roomId: 'ROOM#a' }])
        expect(ctx.handlerCalls).toHaveLength(0)

        await bus.flushAndSettle()

        expect(ctx.handlerCalls).toEqual([{
            identity: 'CHARACTER#Alice:ROOM#a->ROOM#b',
            deferralExecution: true,
            legs: ['fact'],
        }])
    })
})
