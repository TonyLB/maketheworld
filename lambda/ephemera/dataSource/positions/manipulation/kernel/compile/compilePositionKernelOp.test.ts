import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { compilePositionKernelOp } from './compilePositionKernelOp'
import { isNarrateStep } from '../kernelStep'
import type { MembershipNarrationSpec, ObjectMoveNarrationSpec, PresentationKernelNarrateStep } from '../kernelStep'
import { EphemeraLudicGraph, objectNode } from '../../../ludicGraph'
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

/**
 * Phase 4: take/drop/give compile through this same `Move` case --- no sibling `Take`/`Drop` op, no
 * structural branch, only a second narration family. These cases pin the two things that could
 * quietly regress back into a special case: that both bracket sides are emitted even when one host
 * is a character with no roster, and that the verb comes from the delta rather than from a caller.
 */
describe('compilePositionKernelOp --- object moves', () => {
    const TRAY = 'OBJECT#Tray' as EphemeraObjectId
    const GLASS = 'OBJECT#Glass' as EphemeraObjectId

    // LP4a: a carry closure is an EphemeraLudicGraph, hosted and rooted at the moved object.
    const fragment = (members: EphemeraObjectId[] = [TRAY]): EphemeraLudicGraph =>
        EphemeraLudicGraph.fromJSON({ hostId: TRAY, rootId: TRAY, ports: [], nodes: members.map(objectNode), edges: [] })

    const objectOp = (overrides: Partial<PositionKernelMoveOp> = {}): PositionKernelMoveOp => ({
        kind: 'move',
        moved: { kind: 'closure', fragment: fragment() },
        froms: [FROM_ROOM],
        to: CHARACTER_ID,
        bundleId: 'BUNDLE#test',
        headerSlot: null,
        dissolvedEdges: [],
        narration: {
            kind: 'objectMove',
            characterName: 'Tess',
            objectShortName: 'tray',
            carriedCount: 1,
        },
        ...overrides,
    })

    const objectNarration = (step: PresentationKernelNarrateStep): ObjectMoveNarrationSpec => {
        if (step.narration.kind !== 'objectMove') {
            throw new Error(`Expected an objectMove narration, got ${step.narration.kind}`)
        }
        return step.narration
    }

    it('derives takeHold when the move leaves a room, and drop when it arrives at one', () => {
        const takeHold = compilePositionKernelOp(objectOp())
        expect(objectNarration(takeHold.steps.filter(isNarrateStep)[0]).verb).toEqual('takeHold')

        const drop = compilePositionKernelOp(objectOp({ froms: [CHARACTER_ID], to: FROM_ROOM }))
        expect(objectNarration(drop.steps.filter(isNarrateStep)[0]).verb).toEqual('drop')
    })

    it('derives give when neither side is a room --- no new discriminant needed', () => {
        const give = compilePositionKernelOp(objectOp({
            froms: [CHARACTER_ID],
            to: 'CHARACTER#Other' as EphemeraCharacterId,
        }))
        expect(objectNarration(give.steps.filter(isNarrateStep)[0]).verb).toEqual('give')
    })

    it('emits both bracket sides for a character host rather than suppressing the empty one', () => {
        const plan = compilePositionKernelOp(objectOp())

        // The character-inventory side's capture snapshots an empty roster and its narrate step
        // publishes to nobody. That is the correct output of a uniform rule (PB-M), and suppressing
        // it here is how the host-changelog frame gets lost at the next caller.
        expect(plan.steps.map((step) => step.kind)).toEqual([
            'capture', 'transferMembership', 'setPresencePort', 'capture', 'narrate', 'narrate',
        ])
        expect(plan.slots.map((slot) => slot.slotId)).toEqual([
            moveLeaveSlotId(FROM_ROOM),
            MOVE_ARRIVE_SLOT_ID,
        ])
    })

    it('transfers the whole carry closure, not just its root', () => {
        const plan = compilePositionKernelOp(objectOp({
            moved: { kind: 'closure', fragment: fragment([TRAY, GLASS]) },
        }))

        expect(plan.steps.find((step) => step.kind === 'transferMembership')).toMatchObject({
            entityIds: new Set([TRAY, GLASS]),
            fromHostIds: new Set([FROM_ROOM]),
            toHostId: CHARACTER_ID,
        })
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
            relationKind: 'On',
        })
    })

    it('LP4g: renders a dissolveRelation step for a non-Object (Character) dissolved-edge endpoint, no throw', () => {
        const plan = compilePositionKernelOp(objectOp({
            dissolvedEdges: [{ from: CHARACTER_ID, to: TRAY, kind: 'On' }],
        }))

        expect(plan.steps.find((step) => step.kind === 'dissolveRelation')).toEqual({
            kind: 'dissolveRelation',
            subjectId: CHARACTER_ID,
            targetId: TRAY,
            relationKind: 'On',
        })
    })

    it('still emits dissolves for a non-narrating move, but no captures', () => {
        const plan = compilePositionKernelOp(objectOp({
            narration: undefined,
            dissolvedEdges: [{ from: TRAY, to: 'OBJECT#Table' as EphemeraObjectId, kind: 'On' }],
        }))

        expect(plan.steps.map((step) => step.kind)).toEqual(['dissolveRelation', 'transferMembership', 'setPresencePort'])
        expect(plan.slots).toEqual([])
    })

    describe('PV1-2: containment and presence port', () => {
        it('emits an establishRelation step after the transfer when containment is set', () => {
            const plan = compilePositionKernelOp(objectOp({ containment: 'On' }))

            const kinds = plan.steps.map((step) => step.kind)
            expect(kinds.indexOf('transferMembership')).toBeLessThan(kinds.indexOf('establishRelation'))
            expect(plan.steps.find((step) => step.kind === 'establishRelation')).toEqual({
                kind: 'establishRelation',
                subjectId: TRAY,
                targetId: CHARACTER_ID,
                relationKind: 'On',
            })
        })

        it('emits no establishRelation step when containment is absent (plain take-hold)', () => {
            const plan = compilePositionKernelOp(objectOp())
            expect(plan.steps.some((step) => step.kind === 'establishRelation')).toBe(false)
        })

        it('mints a presence port naming the destination on every object rehost, containment or not', () => {
            const plan = compilePositionKernelOp(objectOp())
            const portStep = plan.steps.find((step) => step.kind === 'setPresencePort')
            expect(portStep).toMatchObject({
                kind: 'setPresencePort',
                hostId: TRAY,
                port: { fromHostId: CHARACTER_ID, kind: 'Present' },
            })
        })

        it('mints no presence port for a character-only move (entity-kind moved set)', () => {
            const plan = compilePositionKernelOp({
                kind: 'move',
                moved: { kind: 'entity', entityId: CHARACTER_ID },
                froms: [FROM_ROOM],
                to: TO_ROOM,
                bundleId: 'BUNDLE#test',
                headerSlot: null,
            })
            expect(plan.steps.some((step) => step.kind === 'setPresencePort')).toBe(false)
        })

        it('throws when containment is set with no destination', () => {
            expect(() => compilePositionKernelOp(objectOp({ containment: 'On', to: null }))).toThrow()
        })
    })
})
