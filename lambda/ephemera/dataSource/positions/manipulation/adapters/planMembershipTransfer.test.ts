import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { computeMembershipDiff } from './computeEndStateRoomDiff'
import { computeDropDiff } from '../adapters/computeDropDiff'
import { computeTakeHoldDiff } from '../adapters/computeTakeHoldDiff'
import { planMembershipTransfer } from './planMembershipTransfer'
import { planObjectDropTransfer } from './planObjectDropTransfer'
import { planObjectTakeHoldTransfer } from './planObjectTakeHoldTransfer'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const OBJECT_ID = 'OBJECT#Broom' as EphemeraObjectId
const ROOM_A = 'ROOM#VORTEX' as EphemeraRoomId
const ROOM_B = 'ROOM#TestTwo' as EphemeraRoomId
const ROOM_C = 'ROOM#TestThree' as EphemeraRoomId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID_TAKE_HOLD = 'CHARACTER#Alpha' as EphemeraCharacterId
const OTHER_CHARACTER = 'CHARACTER#Beta' as EphemeraCharacterId

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

describe('planObjectTakeHoldTransfer', () => {
    it('detects pick-up from room to character', () => {
        const { diff } = computeTakeHoldDiff({
            priorContainers: [ROOM_ID],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
        })

        const plan = planObjectTakeHoldTransfer({
            objectId: OBJECT_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
            priorContainers: [ROOM_ID],
        })

        expect(plan.projection).toEqual(diff)
        expect(plan.hostEffects).toEqual([
            { hostId: ROOM_ID, identityId: OBJECT_ID, op: 'remove' },
            { hostId: CHARACTER_ID_TAKE_HOLD, identityId: OBJECT_ID, op: 'add' },
        ])
    })

    it('is idempotent when object is already solely on target character', () => {
        const { diff } = computeTakeHoldDiff({
            priorContainers: [CHARACTER_ID_TAKE_HOLD],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
        })

        const plan = planObjectTakeHoldTransfer({
            objectId: OBJECT_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
            priorContainers: [CHARACTER_ID_TAKE_HOLD],
        })

        expect(plan.projection).toEqual(diff)
        expect(plan.hostEffects).toEqual([])
    })

    it('removes from room when object is on target character and source room (drift)', () => {
        const { diff } = computeTakeHoldDiff({
            priorContainers: [ROOM_ID, CHARACTER_ID_TAKE_HOLD],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
        })

        const plan = planObjectTakeHoldTransfer({
            objectId: OBJECT_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
            priorContainers: [ROOM_ID, CHARACTER_ID_TAKE_HOLD],
        })

        expect(plan.projection).toEqual(diff)
        expect(plan.hostEffects).toEqual([
            { hostId: ROOM_ID, identityId: OBJECT_ID, op: 'remove' },
        ])
    })

    it('moves object between character hosts when also in source room', () => {
        const { diff, characterDiff } = computeTakeHoldDiff({
            priorContainers: [ROOM_ID, OTHER_CHARACTER],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
        })

        const plan = planObjectTakeHoldTransfer({
            objectId: OBJECT_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
            priorContainers: [ROOM_ID, OTHER_CHARACTER],
        })

        expect(plan.projection).toEqual(diff)
        expect(characterDiff.changed).toBe(true)
        expect(plan.hostEffects).toEqual([
            { hostId: ROOM_ID, identityId: OBJECT_ID, op: 'remove' },
            { hostId: OTHER_CHARACTER, identityId: OBJECT_ID, op: 'remove' },
            { hostId: CHARACTER_ID_TAKE_HOLD, identityId: OBJECT_ID, op: 'add' },
        ])
    })
})

describe('planObjectDropTransfer', () => {
    it('detects drop from character to room', () => {
        const { diff } = computeDropDiff({
            priorContainers: [CHARACTER_ID_TAKE_HOLD],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
        })

        const plan = planObjectDropTransfer({
            objectId: OBJECT_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
            priorContainers: [CHARACTER_ID_TAKE_HOLD],
        })

        expect(plan.projection).toEqual(diff)
        expect(plan.hostEffects).toEqual([
            { hostId: CHARACTER_ID_TAKE_HOLD, identityId: OBJECT_ID, op: 'remove' },
            { hostId: ROOM_ID, identityId: OBJECT_ID, op: 'add' },
        ])
    })

    it('is idempotent when object is already solely in destination room', () => {
        const { diff } = computeDropDiff({
            priorContainers: [ROOM_ID],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
        })

        const plan = planObjectDropTransfer({
            objectId: OBJECT_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
            priorContainers: [ROOM_ID],
        })

        expect(plan.projection).toEqual(diff)
        expect(plan.hostEffects).toEqual([])
    })

    it('removes from character when object is on source character and destination room (drift)', () => {
        const { diff } = computeDropDiff({
            priorContainers: [ROOM_ID, CHARACTER_ID_TAKE_HOLD],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
        })

        const plan = planObjectDropTransfer({
            objectId: OBJECT_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
            priorContainers: [ROOM_ID, CHARACTER_ID_TAKE_HOLD],
        })

        expect(plan.projection).toEqual(diff)
        expect(plan.hostEffects).toEqual([
            { hostId: CHARACTER_ID_TAKE_HOLD, identityId: OBJECT_ID, op: 'remove' },
        ])
    })

    it('is unchanged when object is on another character in destination room', () => {
        const { diff } = computeDropDiff({
            priorContainers: [ROOM_ID, OTHER_CHARACTER],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
        })

        const plan = planObjectDropTransfer({
            objectId: OBJECT_ID,
            roomId: ROOM_ID,
            characterId: CHARACTER_ID_TAKE_HOLD,
            priorContainers: [ROOM_ID, OTHER_CHARACTER],
        })

        expect(plan.projection).toEqual(diff)
        expect(plan.hostEffects).toEqual([])
    })
})
