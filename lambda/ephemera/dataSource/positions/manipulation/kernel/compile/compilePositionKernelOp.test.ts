import type { EphemeraCharacterId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { compilePositionKernelOp } from './compilePositionKernelOp'
import { isNarrateStep } from '../kernelStep'
import type { MembershipNarrationSpec, PresentationKernelNarrateStep, PresenceBindingRef } from '../kernelStep'
import type { PositionKernelMoveOp } from './positionKernelOp'

/** Narrows a compiled narrate step to the membership family these cases all exercise. */
const membershipNarration = (step: PresentationKernelNarrateStep): MembershipNarrationSpec => {
    if (step.narration.kind !== 'membershipMove') {
        throw new Error(`Expected a membershipMove narration, got ${step.narration.kind}`)
    }
    return step.narration
}

const CHARACTER_ID = 'CHARACTER#Tess' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#Departure' as EphemeraRoomId
const TO_ROOM = 'ROOM#Arrival' as EphemeraRoomId

const TO_BINDING = { host: TO_ROOM, presence: 'PRESENCE#arrival-remainder' as EphemeraPresenceNodeId }
const presenceMovesFrom = (presence: string, from: { host: EphemeraRoomId | EphemeraCharacterId | EphemeraObjectId; presence?: string } | null, to: PresenceBindingRef = TO_BINDING) => [
    { presence: `PRESENCE#${presence}` as EphemeraPresenceNodeId, from: from as any, to },
]

const baseOp = (overrides: Partial<PositionKernelMoveOp> = {}): PositionKernelMoveOp => ({
    kind: 'move',
    moved: CHARACTER_ID,
    froms: [FROM_ROOM],
    to: TO_ROOM,
    header: null,
    presenceMoves: presenceMovesFrom('mover', { host: FROM_ROOM }),
    narration: {
        kind: 'membershipMove',
        characterName: 'Tess',
        leaveCopyKind: () => 'genericNavigate',
        arriveCopyKind: 'genericNavigate',
    },
    ...overrides,
})

describe('compilePositionKernelOp', () => {
    it('orders steps as [capture(from), presence(move), capture(to), narrate(leave), narrate(arrive)] for a full move', () => {
        const plan = compilePositionKernelOp(baseOp())

        expect(plan.steps.map((step) => step.kind)).toEqual([
            'capture',
            'movePresenceBinding',
            'capture',
            'narrate',
            'narrate',
        ])
        const narrateSteps = plan.steps.filter(isNarrateStep)
        expect(narrateSteps.map((step) => membershipNarration(step).direction)).toEqual(['leave', 'arrive'])
    })

    it('places the header describe between the leave and arrive narrations', () => {
        const header = { perspectiveKey: 'perspective-key', assets: ['primitives'] }
        const plan = compilePositionKernelOp(baseOp({ header }))

        const presentation = plan.steps.filter((step) => step.kind === 'narrate' || step.kind === 'describe')
        expect(presentation.map((step) => step.kind === 'narrate' ? membershipNarration(step).direction : 'header')).toEqual(['leave', 'header', 'arrive'])
        expect(presentation[1]).toEqual({ kind: 'describe', referentId: TO_ROOM, referentKind: 'room', header })
    })

    it('narration steps carry ingredients (characterName/copyKind/exitName), not a built message', () => {
        const plan = compilePositionKernelOp(baseOp({
            narration: {
                kind: 'membershipMove',
                characterName: 'Tess',
                leaveCopyKind: () => 'exitAware',
                arriveCopyKind: 'genericNavigate',
                exitName: 'north',
            },
        }))

        const leaveStep = plan.steps.filter(isNarrateStep).find((step) => membershipNarration(step).direction === 'leave')
        expect(leaveStep?.narration).toMatchObject({
            characterName: 'Tess',
            copyKind: 'exitAware',
            exitName: 'north',
        })
        expect((leaveStep as any).message).toBeUndefined()
    })

    it('produces no leave step/slot when froms is empty (connect shape)', () => {
        const plan = compilePositionKernelOp(baseOp({ froms: [] }))

        expect(plan.steps.filter(isNarrateStep).some((step) => membershipNarration(step).direction === 'leave')).toBe(false)
    })

    it('produces no arrive step/slot/capture-to when to is null (disconnect shape)', () => {
        const plan = compilePositionKernelOp(baseOp({ to: null }))

        expect(plan.steps.filter(isNarrateStep).some((step) => membershipNarration(step).direction === 'arrive')).toBe(false)
        expect(plan.steps.filter((step) => step.kind === 'capture')).toHaveLength(1)
    })

    it('emits the presence steps alone when narration is absent (object-lifecycle moves): membership is theirs', () => {
        const plan = compilePositionKernelOp(baseOp({ narration: undefined }))

        expect(plan.steps).toEqual([
            {
                kind: 'movePresenceBinding',
                hostId: CHARACTER_ID,
                presence: 'PRESENCE#mover',
                from: { host: FROM_ROOM },
                to: TO_BINDING,
            },
        ])
        expect(plan.steps.some((step) => step.kind === 'describe')).toBe(false)
    })

    it('still compiles the header describe when narration is absent (connect/disconnect header render)', () => {
        const header = { perspectiveKey: 'perspective-key', assets: [] as string[] }
        const plan = compilePositionKernelOp(baseOp({ narration: undefined, header }))

        expect(plan.steps).toContainEqual({ kind: 'describe', referentId: TO_ROOM, referentKind: 'room', header })
        expect(plan.steps.some((step) => step.kind === 'narrate')).toBe(false)
    })
})

/**
 * Take/drop/give compile through this same `Move` case --- no sibling `Take`/`Drop` op, no
 * structural branch. An object move carries no narration: its lines are its attempt's authored
 * narration units, whose audiences `commitAttempt.ts` resolves and captures itself, so this compiler
 * builds no captures, narrate or describe steps for it; see `commitAttempt.test.ts` for the observable
 * (published-message) regression pin.
 */
describe('compilePositionKernelOp --- object moves', () => {
    const TRAY = 'OBJECT#Tray' as EphemeraObjectId

    const objectOp = (overrides: Partial<PositionKernelMoveOp> = {}): PositionKernelMoveOp => ({
        kind: 'move',
        moved: TRAY,
        froms: [FROM_ROOM],
        to: CHARACTER_ID,
        header: null,
        presenceMoves: presenceMovesFrom('tray', { host: FROM_ROOM }, { host: CHARACTER_ID, presence: 'PRESENCE#character-root' as EphemeraPresenceNodeId }),
        dissolvedEdges: [],
        ...overrides,
    })

    it('compiles an object move to mutation steps only: no captures, narrate or describe steps', () => {
        const plan = compilePositionKernelOp(objectOp())

        expect(plan.steps.map((step) => step.kind)).toEqual(['movePresenceBinding'])
        expect(plan.steps.some((step) => step.kind === 'describe')).toBe(false)
    })

    it('renders severed boundary edges as dissolveRelation steps ahead of the presence steps (BD-28)', () => {
        const plan = compilePositionKernelOp(objectOp({
            dissolvedEdges: [{ from: TRAY, to: 'OBJECT#Table' as EphemeraObjectId, kind: 'On' }],
        }))

        const kinds = plan.steps.map((step) => step.kind)
        // factsForStep streams in step order, so a severed relation's fact must precede the move's.
        expect(kinds.indexOf('dissolveRelation')).toBeLessThan(kinds.indexOf('movePresenceBinding'))
        expect(plan.steps.find((step) => step.kind === 'dissolveRelation')).toEqual({
            kind: 'dissolveRelation',
            subjectId: TRAY,
            targetId: 'OBJECT#Table',
            hostId: FROM_ROOM,
            relationKind: 'On',
        })
    })

    it('renders a dissolveRelation step for a non-Object (Character) dissolved-edge endpoint, no throw', () => {
        const plan = compilePositionKernelOp(objectOp({
            dissolvedEdges: [{ from: CHARACTER_ID, to: TRAY, kind: 'On' }],
        }))

        expect(plan.steps.find((step) => step.kind === 'dissolveRelation')).toEqual({
            kind: 'dissolveRelation',
            subjectId: CHARACTER_ID,
            targetId: TRAY,
            hostId: FROM_ROOM,
            relationKind: 'On',
        })
    })

    it('emits the dissolves and the presence re-point, and nothing else', () => {
        const plan = compilePositionKernelOp(objectOp({
            dissolvedEdges: [{ from: TRAY, to: 'OBJECT#Table' as EphemeraObjectId, kind: 'On' }],
        }))

        expect(plan.steps.map((step) => step.kind)).toEqual(['dissolveRelation', 'movePresenceBinding'])
        expect(plan.steps.some((step) => step.kind === 'describe')).toBe(false)
    })

    describe('containment and presence binding', () => {
        it('emits an establishRelation step after the presence steps when containment is set', () => {
            const plan = compilePositionKernelOp(objectOp({ containment: 'On' }))

            const kinds = plan.steps.map((step) => step.kind)
            expect(kinds.indexOf('movePresenceBinding')).toBeLessThan(kinds.indexOf('establishRelation'))
            expect(plan.steps.find((step) => step.kind === 'establishRelation')).toEqual({
                kind: 'establishRelation',
                subjectId: TRAY,
                targetId: CHARACTER_ID,
                hostId: CHARACTER_ID,
                relationKind: 'On',
            })
        })

        it('emits no establishRelation step when containment is absent (plain take-hold)', () => {
            const plan = compilePositionKernelOp(objectOp())
            expect(plan.steps.some((step) => step.kind === 'establishRelation')).toBe(false)
        })

        it('re-points the presence binding at the destination on every object rehost, containment or not', () => {
            const plan = compilePositionKernelOp(objectOp())
            expect(plan.steps.filter((step) => step.kind === 'movePresenceBinding')).toEqual([{
                kind: 'movePresenceBinding',
                hostId: TRAY,
                presence: 'PRESENCE#tray',
                from: { host: FROM_ROOM },
                to: { host: CHARACTER_ID, presence: 'PRESENCE#character-root' },
            }])
            expect(plan.steps.some((step) => step.kind === 'addPresenceBinding')).toBe(false)
        })

        it('re-points a presence binding for a character-only move too --- the binding write is not gated on host kind', () => {
            const plan = compilePositionKernelOp({
                kind: 'move',
                moved: CHARACTER_ID,
                froms: [FROM_ROOM],
                to: TO_ROOM,
                header: null,
                presenceMoves: presenceMovesFrom('mover', { host: FROM_ROOM }),
            })
            expect(plan.steps.find((step) => step.kind === 'movePresenceBinding')).toEqual({
                kind: 'movePresenceBinding',
                hostId: CHARACTER_ID,
                presence: 'PRESENCE#mover',
                from: { host: FROM_ROOM },
                to: TO_BINDING,
            })
        })

        it('compiles each departing binding to a release, and a multi-binding move to one move per binding', () => {
            const departing = compilePositionKernelOp(objectOp({
                to: null,
                presenceMoves: [{ presence: 'PRESENCE#tray' as EphemeraPresenceNodeId, from: { host: FROM_ROOM, presence: 'PRESENCE#room-root' as EphemeraPresenceNodeId }, to: null }],
            }))
            expect(departing.steps).toEqual([{
                kind: 'movePresenceBinding', to: null,
                hostId: TRAY,
                presence: 'PRESENCE#tray',
                from: { host: FROM_ROOM, presence: 'PRESENCE#room-root' },
            }])

            const scrub = compilePositionKernelOp(objectOp({
                froms: [FROM_ROOM, 'ROOM#Third' as EphemeraRoomId],
                presenceMoves: [
                    ...presenceMovesFrom('a', { host: FROM_ROOM }),
                    ...presenceMovesFrom('b', { host: 'ROOM#Third' as EphemeraRoomId }),
                ],
            }))
            expect(scrub.steps.map((step) => step.kind)).toEqual(['movePresenceBinding', 'movePresenceBinding'])
        })

        it('throws when containment is set with no destination', () => {
            expect(() => compilePositionKernelOp(objectOp({ containment: 'On', to: null }))).toThrow()
        })
    })
})
