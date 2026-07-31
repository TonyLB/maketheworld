import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

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
    moved: { kind: 'entity', entityId: CHARACTER_ID },
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
    it('orders steps as [capture(from), transfer, capture(to), narrate(leave), narrate(arrive)] for a full move', () => {
        const plan = compilePositionKernelOp(baseOp())

        expect(plan.steps.map((step) => step.kind)).toEqual([
            'capture',
            'transferMembership',
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

    it('emits only the bare transfer step when narration is absent (object-lifecycle moves)', () => {
        const plan = compilePositionKernelOp(baseOp({ narration: undefined }))

        expect(plan.steps).toEqual([{
            kind: 'transferMembership',
            entityIds: new Set([CHARACTER_ID]),
            fromHostIds: new Set([FROM_ROOM]),
            toHostId: TO_ROOM,
        }])
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
