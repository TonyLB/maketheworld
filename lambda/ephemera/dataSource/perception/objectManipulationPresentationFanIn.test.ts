import type { MessageBus } from '../../messageBus/baseClasses'
import {
    buildObjectManipulationEmissionPlan,
    createObjectManipulationFanInHandlerContext,
    createObjectManipulationPresentationFanInStore,
    objectManipulationClusterIdentity,
    type ObjectManipulationFactLeg,
    type ObjectManipulationIntentLeg,
} from './objectManipulationPresentationFanIn'

jest.mock('./resolveTakeHoldPresentationLabels', () => ({
    resolveTakeHoldPresentationLabels: jest.fn().mockResolvedValue({
        characterName: 'Alice',
        objectShortName: 'broom',
    }),
}))

const CHARACTER = 'CHARACTER#Alice' as const
const OBJECT = 'OBJECT#Broom' as const
const ROOM = 'ROOM#Cafe' as const
const ANCHOR_TIME = 1_700_000_000_000

const takeHoldIntent = (overrides: Partial<ObjectManipulationIntentLeg> = {}): ObjectManipulationIntentLeg => ({
    kind: 'intent',
    characterId: CHARACTER,
    objectId: OBJECT,
    roomId: ROOM,
    ...overrides,
})

const takeHoldFact = (overrides: Partial<ObjectManipulationFactLeg> = {}): ObjectManipulationFactLeg => ({
    kind: 'fact',
    objectId: OBJECT,
    froms: [ROOM],
    to: CHARACTER,
    beatAnchorTime: ANCHOR_TIME,
    ...overrides,
})

describe('objectManipulationPresentationFanIn', () => {
    describe('objectManipulationClusterIdentity', () => {
        it('encodes character, object, and beat anchor time', () => {
            expect(objectManipulationClusterIdentity(CHARACTER, OBJECT, ANCHOR_TIME))
                .toBe(`${CHARACTER}:${OBJECT}:${ANCHOR_TIME}`)
        })
    })

    describe('buildObjectManipulationEmissionPlan', () => {
        it('returns structural plan when intent and fact are present', () => {
            const plan = buildObjectManipulationEmissionPlan([
                takeHoldIntent(),
                takeHoldFact(),
            ], { deferralExecution: false })

            expect(plan).toEqual({
                characterId: CHARACTER,
                objectId: OBJECT,
                roomId: ROOM,
                beatAnchorTime: ANCHOR_TIME,
            })
        })

        it('derives actor and room from fact at deferral when intent is absent', () => {
            const plan = buildObjectManipulationEmissionPlan([takeHoldFact()], { deferralExecution: true })

            expect(plan).toEqual({
                characterId: CHARACTER,
                objectId: OBJECT,
                roomId: ROOM,
                beatAnchorTime: ANCHOR_TIME,
            })
        })

        it('returns null when fact is absent', () => {
            expect(buildObjectManipulationEmissionPlan([takeHoldIntent()], { deferralExecution: false }))
                .toBeNull()
        })

        it('returns null at deferral when fact has no character to host', () => {
            expect(buildObjectManipulationEmissionPlan([
                takeHoldFact({ to: null }),
            ], { deferralExecution: true })).toBeNull()
        })
    })

    describe('FanInClusterStore integration', () => {
        const makeCtx = () => createObjectManipulationFanInHandlerContext({ publish: jest.fn() } as any)

        const worldPublishes = (messageBus: { publish: jest.Mock | MessageBus['publish'] }) => (
            (messageBus.publish as jest.Mock).mock.calls
                .map((call) => call[0])
                .filter((message) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')
        )

        it('completes when intent arrives before fact', async () => {
            const store = createObjectManipulationPresentationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(takeHoldIntent())
            expect(store.getOpenPartialCount()).toBe(1)
            expect(worldPublishes(ctx.messageBus)).toHaveLength(0)

            await store.route(takeHoldFact())
            expect(store.getOpenPartialCount()).toBe(0)
            expect(worldPublishes(ctx.messageBus)).toHaveLength(1)
            expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                message: ['Alice picks up broom'],
                createdTime: ANCHOR_TIME,
                targets: [ROOM, CHARACTER],
                deliveryMode: 'deferred',
            })
        })

        it('completes when fact arrives before intent', async () => {
            const store = createObjectManipulationPresentationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(takeHoldFact())
            expect(store.getOpenPartialCount()).toBe(1)

            await store.route(takeHoldIntent())
            expect(store.getOpenPartialCount()).toBe(0)
            expect(worldPublishes(ctx.messageBus)).toHaveLength(1)
            expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                message: ['Alice picks up broom'],
            })
        })

        it('keeps endpoint mismatch as separate partials', async () => {
            const store = createObjectManipulationPresentationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(takeHoldIntent({ roomId: 'ROOM#Other' as typeof ROOM }))
            await store.route(takeHoldFact())
            expect(store.getOpenPartialCount()).toBe(2)
            expect(worldPublishes(ctx.messageBus)).toHaveLength(0)
        })

        it('publishes at deferral settle when only fact remains', async () => {
            const store = createObjectManipulationPresentationFanInStore()
            const ctx = makeCtx()
            store.setHandlerContext(ctx)

            await store.route(takeHoldFact())
            expect(store.getOpenPartialCount()).toBe(1)

            await store.settleDeferrals()
            expect(store.getOpenPartialCount()).toBe(0)
            expect(worldPublishes(ctx.messageBus)).toHaveLength(1)
            expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                message: ['Alice picks up broom'],
                createdTime: ANCHOR_TIME,
            })
        })
    })
})
