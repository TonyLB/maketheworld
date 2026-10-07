import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { compilePositionKernelOp } from './compilePositionKernelOp'
import { isNarrateStep } from '../kernelStep'
import type { MembershipNarrationSpec, PresentationKernelNarrateStep } from '../kernelStep'
import type { PositionKernelMoveOp } from './positionKernelOp'
import { NAVIGATE_HEADER_SLOT_ID } from '../../../navigate/navigateBundleSlotIds'
import { moveLeaveSlotId, MOVE_ARRIVE_SLOT_ID } from './moveBundleSlotIds'

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

const baseOp = (overrides: Partial<PositionKernelMoveOp> = {}): PositionKernelMoveOp => ({
    kind: 'move',
    moved: CHARACTER_ID,
    froms: [FROM_ROOM],
    to: TO_ROOM,
    bundleId: 'BUNDLE#test',
    headerSlot: null,
    narration: {
        kind: 'membershipMove',
        characterName: 'Tess',
        leaveCopyKind: () => 'genericNavigate',
        arriveCopyKind: 'genericNavigate',
    },
    ...overrides,
})

describe('compilePositionKernelOp', () => {
    it('orders steps as [capture(from), transfer, presence(remove/add), capture(to), narrate(leave), narrate(arrive)] for a full move', () => {
        const plan = compilePositionKernelOp(baseOp())

        expect(plan.steps.map((step) => step.kind)).toEqual([
            'capture',
            'transferMembership',
            'removePresenceBinding',
            'addPresenceBinding',
            'capture',
            'narrate',
            'narrate',
        ])
        const narrateSteps = plan.steps.filter(isNarrateStep)
        expect(narrateSteps.map((step) => membershipNarration(step).direction)).toEqual(['leave', 'arrive'])
    })

    it('declares slots in delivery order [leave, header, arrive]', () => {
        const headerSlot = {
            slotId: NAVIGATE_HEADER_SLOT_ID,
            expectedPublishType: 'PerceptionMessage' as const,
            componentId: TO_ROOM,
            perspectiveKey: 'perspective-key',
            targets: [CHARACTER_ID],
            contentStream: 'render' as const,
            format: 'header' as const,
        }
        const plan = compilePositionKernelOp(baseOp({ headerSlot }))

        expect(plan.slots).toEqual([
            { slotId: moveLeaveSlotId(FROM_ROOM), expectedPublishType: 'WorldMessage' },
            headerSlot,
            { slotId: MOVE_ARRIVE_SLOT_ID, expectedPublishType: 'WorldMessage' },
        ])
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
        expect(plan.slots.some((slot) => slot.slotId.startsWith('leave:'))).toBe(false)
    })

    it('produces no arrive step/slot/capture-to when to is null (disconnect shape)', () => {
        const plan = compilePositionKernelOp(baseOp({ to: null }))

        expect(plan.steps.filter(isNarrateStep).some((step) => membershipNarration(step).direction === 'arrive')).toBe(false)
        expect(plan.steps.filter((step) => step.kind === 'capture')).toHaveLength(1)
        expect(plan.slots.some((slot) => slot.slotId === MOVE_ARRIVE_SLOT_ID)).toBe(false)
    })

    it('emits the transfer plus presence steps when narration is absent (object-lifecycle moves)', () => {
        const plan = compilePositionKernelOp(baseOp({ narration: undefined }))

        expect(plan.steps).toEqual([
            {
                kind: 'transferMembership',
                entityIds: new Set([CHARACTER_ID]),
                fromHostIds: new Set([FROM_ROOM]),
                toHostId: TO_ROOM,
            },
            {
                kind: 'removePresenceBinding',
                hostId: CHARACTER_ID,
                fromHostId: FROM_ROOM,
            },
            {
                kind: 'addPresenceBinding',
                hostId: CHARACTER_ID,
                fromHostId: TO_ROOM,
                presenceUuid: expect.any(String),
            },
        ])
        expect(plan.slots).toEqual([])
    })

    it('still declares the header slot when narration is absent (connect/disconnect header render)', () => {
        const headerSlot = {
            slotId: NAVIGATE_HEADER_SLOT_ID,
            expectedPublishType: 'PerceptionMessage' as const,
            componentId: TO_ROOM,
            perspectiveKey: 'perspective-key',
            targets: [CHARACTER_ID],
            contentStream: 'render' as const,
            format: 'header' as const,
        }
        const plan = compilePositionKernelOp(baseOp({ narration: undefined, headerSlot }))

        expect(plan.slots).toEqual([headerSlot])
    })
})

/**
 * Phase 4: take/drop/give compile through this same `Move` case --- no sibling `Take`/`Drop` op, no
 * structural branch. **Slice 3 of `AGENT.attemptNarration.planning.md` moved the `template`
 * family's narrate steps out of this compiler** (to `commitAttempt.ts`'s post-commit bridge-unit
 * sweep), so this compiler now only builds the `template` family's *captures* --- the verb
 * derivation and template-content assertions that used to live here moved with the narrate
 * steps; see `commitAttempt.test.ts` for the observable (published-message) regression pin.
 */
describe('compilePositionKernelOp --- object moves', () => {
    const TRAY = 'OBJECT#Tray' as EphemeraObjectId

    const objectOp = (overrides: Partial<PositionKernelMoveOp> = {}): PositionKernelMoveOp => ({
        kind: 'move',
        moved: TRAY,
        froms: [FROM_ROOM],
        to: CHARACTER_ID,
        bundleId: 'BUNDLE#test',
        headerSlot: null,
        dissolvedEdges: [],
        narration: {
            kind: 'template',
            actorName: 'Tess',
            labels: { [TRAY]: 'tray' },
        },
        ...overrides,
    })

    it('builds captures for both bracket sides, but no narrate steps or slots, for the template family', () => {
        const plan = compilePositionKernelOp(objectOp())

        // The character-inventory side's capture still snapshots an empty roster --- captures
        // stay built for both sides regardless of narration family, since a later audience
        // (the bridge unit) still needs a roster to read. No narrate step/slot exists any more
        // for this family: delivery is `commitAttempt.ts`'s job now.
        expect(plan.steps.map((step) => step.kind)).toEqual([
            'capture', 'transferMembership', 'removePresenceBinding', 'addPresenceBinding', 'capture',
        ])
        expect(plan.steps.filter(isNarrateStep)).toHaveLength(0)
        expect(plan.slots).toEqual([])
    })

    it('renders severed boundary edges as dissolveRelation steps ahead of the transfer (BD-28)', () => {
        const plan = compilePositionKernelOp(objectOp({
            dissolvedEdges: [{ from: TRAY, to: 'OBJECT#Table' as EphemeraObjectId, kind: 'On' }],
        }))

        const kinds = plan.steps.map((step) => step.kind)
        // factsForStep streams in step order, so a severed relation's fact must precede the move's.
        expect(kinds.indexOf('dissolveRelation')).toBeLessThan(kinds.indexOf('transferMembership'))
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

    it('still emits dissolves for a non-narrating move, but no captures', () => {
        const plan = compilePositionKernelOp(objectOp({
            narration: undefined,
            dissolvedEdges: [{ from: TRAY, to: 'OBJECT#Table' as EphemeraObjectId, kind: 'On' }],
        }))

        expect(plan.steps.map((step) => step.kind)).toEqual(['dissolveRelation', 'transferMembership', 'removePresenceBinding', 'addPresenceBinding'])
        expect(plan.slots).toEqual([])
    })

    describe('containment and presence binding', () => {
        it('emits an establishRelation step after the transfer when containment is set', () => {
            const plan = compilePositionKernelOp(objectOp({ containment: 'On' }))

            const kinds = plan.steps.map((step) => step.kind)
            expect(kinds.indexOf('transferMembership')).toBeLessThan(kinds.indexOf('establishRelation'))
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

        it('mints a presence binding naming the destination on every object rehost, containment or not', () => {
            const plan = compilePositionKernelOp(objectOp())
            const removeStep = plan.steps.find((step) => step.kind === 'removePresenceBinding')
            expect(removeStep).toEqual({
                kind: 'removePresenceBinding',
                hostId: TRAY,
                fromHostId: FROM_ROOM,
            })
            const addStep = plan.steps.find((step) => step.kind === 'addPresenceBinding')
            expect(addStep).toMatchObject({
                kind: 'addPresenceBinding',
                hostId: TRAY,
                fromHostId: CHARACTER_ID,
            })
        })

        it('mints a presence binding for a character-only move too --- binding minting is not gated on host kind', () => {
            const plan = compilePositionKernelOp({
                kind: 'move',
                moved: CHARACTER_ID,
                froms: [FROM_ROOM],
                to: TO_ROOM,
                bundleId: 'BUNDLE#test',
                headerSlot: null,
            })
            expect(plan.steps.find((step) => step.kind === 'removePresenceBinding')).toEqual({
                kind: 'removePresenceBinding',
                hostId: CHARACTER_ID,
                fromHostId: FROM_ROOM,
            })
            expect(plan.steps.find((step) => step.kind === 'addPresenceBinding')).toMatchObject({
                kind: 'addPresenceBinding',
                hostId: CHARACTER_ID,
                fromHostId: TO_ROOM,
            })
        })

        it('throws when containment is set with no destination', () => {
            expect(() => compilePositionKernelOp(objectOp({ containment: 'On', to: null }))).toThrow()
        })
    })
})
