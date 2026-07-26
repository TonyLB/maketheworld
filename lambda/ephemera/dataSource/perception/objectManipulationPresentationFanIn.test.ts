import type { MessageBus } from '../../messageBus/baseClasses'
import {
    buildObjectManipulationEmissionPlan,
    buildObjectRelationalEmissionPlan,
    createObjectManipulationFanInHandlerContext,
    createObjectManipulationPresentationFanInStore,
    objectManipulationClusterIdentity,
    objectRelationalClusterIdentity,
    type ObjectManipulationFactLeg,
    type ObjectManipulationIntentLeg,
    type ObjectRelationalFactLeg,
    type ObjectRelationalIntentLeg,
} from './objectManipulationPresentationFanIn'

jest.mock('./resolveTakeHoldPresentationLabels', () => ({
    resolveTakeHoldPresentationLabels: jest.fn().mockResolvedValue({
        characterName: 'Alice',
        objectShortName: 'broom',
    }),
}))

jest.mock('./resolveRelationalPresentationLabels', () => ({
    resolveRelationalPresentationLabels: jest.fn().mockResolvedValue({
        characterName: 'Alice',
        subjectShortName: 'broom',
        targetShortName: 'table',
    }),
}))

const CHARACTER = 'CHARACTER#Alice' as const
const OBJECT = 'OBJECT#Broom' as const
const TRAY = 'OBJECT#Tray' as const
const GLASS = 'OBJECT#Glass' as const
const ROOM = 'ROOM#Cafe' as const
const ANCHOR_TIME = 1_700_000_000_000

const takeHoldIntent = (overrides: Partial<ObjectManipulationIntentLeg> = {}): ObjectManipulationIntentLeg => ({
    kind: 'intent',
    operation: 'takeHold',
    characterId: CHARACTER,
    objectId: OBJECT,
    objectIds: [OBJECT],
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

const dropIntent = (overrides: Partial<ObjectManipulationIntentLeg> = {}): ObjectManipulationIntentLeg => ({
    kind: 'intent',
    operation: 'drop',
    characterId: CHARACTER,
    objectId: OBJECT,
    objectIds: [OBJECT],
    roomId: ROOM,
    ...overrides,
})

const dropFact = (overrides: Partial<ObjectManipulationFactLeg> = {}): ObjectManipulationFactLeg => ({
    kind: 'fact',
    objectId: OBJECT,
    froms: [CHARACTER],
    to: ROOM,
    beatAnchorTime: ANCHOR_TIME,
    ...overrides,
})

const TARGET = 'OBJECT#Table' as const

const establishIntent = (overrides: Partial<ObjectRelationalIntentLeg> = {}): ObjectRelationalIntentLeg => ({
    kind: 'relationalIntent',
    operation: 'establishRelation',
    characterId: CHARACTER,
    subjectId: OBJECT,
    targetId: TARGET,
    roomId: ROOM,
    relationKind: 'On',
    ...overrides,
})

const establishFact = (overrides: Partial<ObjectRelationalFactLeg> = {}): ObjectRelationalFactLeg => ({
    kind: 'relationalFact',
    subjectId: OBJECT,
    targetId: TARGET,
    hostRoomId: ROOM,
    relationKind: 'On',
    operation: 'establish',
    beatAnchorTime: ANCHOR_TIME,
    ...overrides,
})

const dissolveIntent = (overrides: Partial<ObjectRelationalIntentLeg> = {}): ObjectRelationalIntentLeg => ({
    kind: 'relationalIntent',
    operation: 'dissolveRelation',
    characterId: CHARACTER,
    subjectId: OBJECT,
    targetId: TARGET,
    roomId: ROOM,
    relationKind: 'On',
    ...overrides,
})

const dissolveFact = (overrides: Partial<ObjectRelationalFactLeg> = {}): ObjectRelationalFactLeg => ({
    kind: 'relationalFact',
    subjectId: OBJECT,
    targetId: TARGET,
    hostRoomId: ROOM,
    relationKind: 'On',
    operation: 'dissolve',
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
        describe('takeHold', () => {
            it('returns structural plan when intent and fact are present', () => {
                const plan = buildObjectManipulationEmissionPlan([
                    takeHoldIntent(),
                    takeHoldFact(),
                ], { deferralExecution: false })

                expect(plan).toEqual({
                    operation: 'takeHold',
                    characterId: CHARACTER,
                    objectId: OBJECT,
                    roomId: ROOM,
                    carriedObjectCount: 1,
                    beatAnchorTime: ANCHOR_TIME,
                })
            })

            it('derives actor and room from fact at deferral when intent is absent', () => {
                const plan = buildObjectManipulationEmissionPlan([takeHoldFact()], { deferralExecution: true })

                expect(plan).toEqual({
                    operation: 'takeHold',
                    characterId: CHARACTER,
                    objectId: OBJECT,
                    roomId: ROOM,
                    carriedObjectCount: 1,
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

        describe('drop', () => {
            it('returns structural plan when intent and fact are present', () => {
                const plan = buildObjectManipulationEmissionPlan([
                    dropIntent(),
                    dropFact(),
                ], { deferralExecution: false })

                expect(plan).toEqual({
                    operation: 'drop',
                    characterId: CHARACTER,
                    objectId: OBJECT,
                    roomId: ROOM,
                    carriedObjectCount: 1,
                    beatAnchorTime: ANCHOR_TIME,
                })
            })

            it('derives actor and room from fact at deferral when intent is absent', () => {
                const plan = buildObjectManipulationEmissionPlan([dropFact()], { deferralExecution: true })

                expect(plan).toEqual({
                    operation: 'drop',
                    characterId: CHARACTER,
                    objectId: OBJECT,
                    roomId: ROOM,
                    carriedObjectCount: 1,
                    beatAnchorTime: ANCHOR_TIME,
                })
            })

            it('returns null at deferral when fact has no room to host', () => {
                expect(buildObjectManipulationEmissionPlan([
                    dropFact({ to: null }),
                ], { deferralExecution: true })).toBeNull()
            })
        })

        describe('carry (BD-13)', () => {
            it("builds a plan (with carriedObjectCount > 1) for the primary object's cluster", () => {
                const plan = buildObjectManipulationEmissionPlan([
                    takeHoldIntent({ objectId: TRAY, objectIds: [TRAY, GLASS] }),
                    takeHoldFact({ objectId: TRAY }),
                ], { deferralExecution: false })

                expect(plan).toEqual({
                    operation: 'takeHold',
                    characterId: CHARACTER,
                    objectId: TRAY,
                    roomId: ROOM,
                    carriedObjectCount: 2,
                    beatAnchorTime: ANCHOR_TIME,
                })
            })

            it("returns null for a non-primary object's cluster, even with a matched intent+fact pair", () => {
                const plan = buildObjectManipulationEmissionPlan([
                    takeHoldIntent({ objectId: GLASS, objectIds: [TRAY, GLASS] }),
                    takeHoldFact({ objectId: GLASS }),
                ], { deferralExecution: false })

                expect(plan).toBeNull()
            })
        })
    })

    describe('objectRelationalClusterIdentity', () => {
        it('encodes character, subject, target, and beat anchor time', () => {
            expect(objectRelationalClusterIdentity(CHARACTER, OBJECT, TARGET, ANCHOR_TIME))
                .toBe(`${CHARACTER}:${OBJECT}:${TARGET}:${ANCHOR_TIME}`)
        })
    })

    describe('buildObjectRelationalEmissionPlan', () => {
        it('returns structural plan when intent and fact are present', () => {
            const plan = buildObjectRelationalEmissionPlan([
                establishIntent(),
                establishFact(),
            ])

            expect(plan).toEqual({
                operation: 'establishRelation',
                characterId: CHARACTER,
                subjectId: OBJECT,
                targetId: TARGET,
                roomId: ROOM,
                relationKind: 'On',
                beatAnchorTime: ANCHOR_TIME,
            })
        })

        it('returns null when intent is absent', () => {
            expect(buildObjectRelationalEmissionPlan([establishFact()])).toBeNull()
        })

        it('returns null when fact is absent', () => {
            expect(buildObjectRelationalEmissionPlan([establishIntent()])).toBeNull()
        })

        it('includes Custom relationLabel from fact', () => {
            const plan = buildObjectRelationalEmissionPlan([
                establishIntent({ relationKind: 'Custom', relationLabel: 'tied around' }),
                establishFact({ relationKind: 'Custom', relationLabel: 'tied around' }),
            ])

            expect(plan).toEqual({
                operation: 'establishRelation',
                characterId: CHARACTER,
                subjectId: OBJECT,
                targetId: TARGET,
                roomId: ROOM,
                relationKind: 'Custom',
                relationLabel: 'tied around',
                beatAnchorTime: ANCHOR_TIME,
            })
        })
    })

    describe('FanInClusterStore integration', () => {
        const makeCtx = () => createObjectManipulationFanInHandlerContext({ publish: jest.fn() } as any)

        const worldPublishes = (messageBus: { publish: jest.Mock | MessageBus['publish'] }) => (
            (messageBus.publish as jest.Mock).mock.calls
                .map((call) => call[0])
                .filter((message) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')
        )

        describe('takeHold', () => {
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

            it("BD-13 carry: publishes exactly one WorldMessage (with the carry suffix), not one per object, even after settleDeferrals", async () => {
                const store = createObjectManipulationPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                // One intent leg per object (as the adapter now fans out), each carrying the full set.
                await store.route(takeHoldIntent({ objectId: TRAY, objectIds: [TRAY, GLASS] }))
                await store.route(takeHoldIntent({ objectId: GLASS, objectIds: [TRAY, GLASS] }))
                // One fact leg per object (as the kernel already streams).
                await store.route(takeHoldFact({ objectId: TRAY }))
                await store.route(takeHoldFact({ objectId: GLASS }))

                // Both per-object clusters complete (intent+fact matched), but only the primary's fires.
                expect(store.getOpenPartialCount()).toBe(0)
                await store.settleDeferrals()
                expect(worldPublishes(ctx.messageBus)).toHaveLength(1)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    message: ['Alice picks up broom and everything on it'],
                })
            })
        })

        describe('drop', () => {
            it('completes when intent arrives before fact', async () => {
                const store = createObjectManipulationPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(dropIntent())
                expect(store.getOpenPartialCount()).toBe(1)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(0)

                await store.route(dropFact())
                expect(store.getOpenPartialCount()).toBe(0)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(1)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    message: ['Alice drops broom'],
                    createdTime: ANCHOR_TIME,
                    targets: [ROOM, CHARACTER],
                })
            })

            it('completes when fact arrives before intent', async () => {
                const store = createObjectManipulationPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(dropFact())
                expect(store.getOpenPartialCount()).toBe(1)

                await store.route(dropIntent())
                expect(store.getOpenPartialCount()).toBe(0)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(1)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    message: ['Alice drops broom'],
                })
            })

            it('keeps endpoint mismatch as separate partials', async () => {
                const store = createObjectManipulationPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(dropIntent({ roomId: 'ROOM#Other' as typeof ROOM }))
                await store.route(dropFact())
                expect(store.getOpenPartialCount()).toBe(2)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(0)
            })

            it('publishes at deferral settle when only fact remains', async () => {
                const store = createObjectManipulationPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(dropFact())
                expect(store.getOpenPartialCount()).toBe(1)

                await store.settleDeferrals()
                expect(store.getOpenPartialCount()).toBe(0)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(1)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    message: ['Alice drops broom'],
                    createdTime: ANCHOR_TIME,
                })
            })
        })

        describe('establishRelation', () => {
            it('completes when intent arrives before fact', async () => {
                const store = createObjectManipulationPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(establishIntent())
                expect(store.getOpenPartialCount()).toBe(1)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(0)

                await store.route(establishFact())
                expect(store.getOpenPartialCount()).toBe(0)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(1)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    message: ['Alice puts broom on table'],
                    createdTime: ANCHOR_TIME,
                    targets: [ROOM, CHARACTER],
                })
            })

            it('completes when fact arrives before intent', async () => {
                const store = createObjectManipulationPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(establishFact())
                expect(store.getOpenPartialCount()).toBe(1)

                await store.route(establishIntent())
                expect(store.getOpenPartialCount()).toBe(0)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(1)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    message: ['Alice puts broom on table'],
                })
            })

            it('keeps endpoint mismatch as separate partials', async () => {
                const store = createObjectManipulationPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(establishIntent({ roomId: 'ROOM#Other' as typeof ROOM }))
                await store.route(establishFact())
                expect(store.getOpenPartialCount()).toBe(2)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(0)
            })

            it('does not publish at deferral settle when only fact remains', async () => {
                const store = createObjectManipulationPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(establishFact())
                expect(store.getOpenPartialCount()).toBe(1)

                await store.settleDeferrals()
                expect(store.getOpenPartialCount()).toBe(0)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(0)
            })
        })

        describe('dissolveRelation', () => {
            it('completes when intent and fact are correlated', async () => {
                const store = createObjectManipulationPresentationFanInStore()
                const ctx = makeCtx()
                store.setHandlerContext(ctx)

                await store.route(dissolveIntent())
                await store.route(dissolveFact())
                expect(store.getOpenPartialCount()).toBe(0)
                expect(worldPublishes(ctx.messageBus)).toHaveLength(1)
                expect(worldPublishes(ctx.messageBus)[0]).toMatchObject({
                    message: ['Alice takes broom off table'],
                })
            })
        })
    })
})
