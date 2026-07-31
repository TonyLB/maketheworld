import type { MessageBus } from '../../messageBus/baseClasses'
import {
    buildObjectRelationalEmissionPlan,
    createObjectManipulationFanInHandlerContext,
    createObjectManipulationPresentationFanInStore,
    objectRelationalClusterIdentity,
    type ObjectRelationalFactLeg,
    type ObjectRelationalIntentLeg,
} from './objectManipulationPresentationFanIn'

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
                    targets: [ROOM],
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
