import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { computeMembershipDiff } from './computeEndStateRoomDiff'
import { planMembershipTransfer } from './planMembershipTransfer'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const OBJECT_ID = 'OBJECT#Broom' as EphemeraObjectId
const ROOM_A = 'ROOM#VORTEX' as EphemeraRoomId
const ROOM_B = 'ROOM#TestTwo' as EphemeraRoomId
const ROOM_C = 'ROOM#TestThree' as EphemeraRoomId

describe('planMembershipTransfer (end-state)', () => {
    it('detects no change when already at target', () => {
        const expected = computeMembershipDiff([ROOM_A], ROOM_A)
        const plan = planMembershipTransfer({
            entityId: CHARACTER_ID,
            entityKind: 'character',
            applyMode: 'end-state',
            target: ROOM_A,
            priorContainers: [ROOM_A],
        })

        expect(plan.projection).toEqual(expected)
        expect(plan.hostEffects).toEqual([])
    })

    it('detects no change when out of play and target null', () => {
        const expected = computeMembershipDiff([], null)
        const plan = planMembershipTransfer({
            entityId: CHARACTER_ID,
            entityKind: 'character',
            applyMode: 'end-state',
            target: null,
            priorContainers: [],
        })

        expect(plan.projection).toEqual(expected)
        expect(plan.hostEffects).toEqual([])
    })

    it('produces plural froms on drift scrub', () => {
        const expected = computeMembershipDiff([ROOM_A, ROOM_C], ROOM_B)
        const plan = planMembershipTransfer({
            entityId: OBJECT_ID,
            entityKind: 'object',
            applyMode: 'end-state',
            target: ROOM_B,
            priorContainers: [ROOM_A, ROOM_C],
        })

        expect(plan.projection).toEqual(expected)
        expect(plan.hostEffects).toEqual([
            { hostId: ROOM_A, identityId: OBJECT_ID, op: 'remove' },
            { hostId: ROOM_C, identityId: OBJECT_ID, op: 'remove' },
            { hostId: ROOM_B, identityId: OBJECT_ID, op: 'add' },
        ])
    })
})

describe('planMembershipTransfer (bounded)', () => {
    it('scrubs only bounded ingress room when object is present', () => {
        const plan = planMembershipTransfer({
            entityId: OBJECT_ID,
            entityKind: 'object',
            applyMode: 'bounded',
            target: null,
            boundedHostIds: [ROOM_A],
            priorContainers: [ROOM_A, ROOM_C],
        })

        expect(plan.projection).toEqual({
            froms: [ROOM_A],
            to: null,
            changed: true,
        })
        expect(plan.hostEffects).toEqual([
            { hostId: ROOM_A, identityId: OBJECT_ID, op: 'remove' },
        ])
    })

    it('does not scrub unbounded room hosts', () => {
        const plan = planMembershipTransfer({
            entityId: OBJECT_ID,
            entityKind: 'object',
            applyMode: 'bounded',
            target: null,
            boundedHostIds: [ROOM_A],
            priorContainers: [ROOM_C],
        })

        expect(plan.projection.changed).toBe(false)
        expect(plan.hostEffects).toEqual([])
    })
})
