import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { planCharacterMoveTransfer } from './planCharacterMoveTransfer'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId

/**
 * Character-route sibling of `planObjectMoveTransfer.test.ts` (3e, MS-2): pins the compiled plan a
 * character move builds exactly once, before commit. No commit happens inside this function ---
 * `getMembershipContainers` is the only I/O seam, so no `internalCache`/`transactWrite` mocking is
 * needed; `orchestrateCharacterRoomMembership.test.ts` covers the commit composition.
 */
describe('planCharacterMoveTransfer', () => {
    it('returns changed:false with no plan when the target room is already a container', async () => {
        const result = await planCharacterMoveTransfer({
            characterId: CHARACTER_ID,
            characterName: 'Test',
            targetRoomId: FROM_ROOM,
            bundleId: 'BUNDLE#test',
            intentKind: 'navigate',
            getMembershipContainers: async () => [FROM_ROOM],
        })

        expect(result).toEqual({ ok: true, changed: false, froms: [], to: FROM_ROOM })
        expect('plan' in result).toBe(false)
    })

    it('builds and compiles the op once when the move is a real transfer, filtered to mutation steps once committed', async () => {
        const result = await planCharacterMoveTransfer({
            characterId: CHARACTER_ID,
            characterName: 'Test',
            targetRoomId: TO_ROOM,
            bundleId: 'BUNDLE#test',
            intentKind: 'navigate',
            intentFromRoomId: FROM_ROOM,
            getMembershipContainers: async () => [FROM_ROOM],
        })

        expect(result.ok).toBe(true)
        if (!result.ok || !result.changed) { throw new Error('expected a changed plan') }
        expect(result.froms).toEqual([FROM_ROOM])
        expect(result.to).toEqual(TO_ROOM)
        expect(result.plan.steps.map((step) => step.kind)).toEqual([
            'capture', 'transferMembership', 'removePresencePort', 'addPresencePort', 'capture', 'narrate', 'narrate',
        ])
    })

    it('resolves the header slot only once the move is confirmed changed and has a real destination', async () => {
        const resolveHeaderSlot = jest.fn().mockResolvedValue(null)

        await planCharacterMoveTransfer({
            characterId: CHARACTER_ID,
            characterName: 'Test',
            targetRoomId: FROM_ROOM,
            bundleId: 'BUNDLE#test',
            intentKind: 'navigate',
            resolveHeaderSlot,
            getMembershipContainers: async () => [FROM_ROOM],
        })

        expect(resolveHeaderSlot).not.toHaveBeenCalled()
    })

    it('bakes a resolved header slot into the compiled plan', async () => {
        const headerSlot = {
            slotId: 'SLOT#header',
            expectedPublishType: 'PerceptionMessage' as const,
            componentId: TO_ROOM,
            perspectiveKey: 'pk',
            targets: [CHARACTER_ID],
            contentStream: 'render' as const,
            format: 'header' as const,
        }
        const resolveHeaderSlot = jest.fn().mockResolvedValue(headerSlot)

        const result = await planCharacterMoveTransfer({
            characterId: CHARACTER_ID,
            characterName: 'Test',
            targetRoomId: TO_ROOM,
            bundleId: 'BUNDLE#test',
            intentKind: 'connect',
            resolveHeaderSlot,
            getMembershipContainers: async () => [FROM_ROOM],
        })

        expect(resolveHeaderSlot).toHaveBeenCalledWith(TO_ROOM)
        if (!result.ok || !result.changed) { throw new Error('expected a changed plan') }
        expect(result.plan.slots).toEqual(expect.arrayContaining([headerSlot]))
    })

    it('disconnect (target null) never resolves a header slot even if one is supplied', async () => {
        const resolveHeaderSlot = jest.fn().mockResolvedValue(null)

        const result = await planCharacterMoveTransfer({
            characterId: CHARACTER_ID,
            characterName: 'Test',
            targetRoomId: null,
            bundleId: 'BUNDLE#test',
            intentKind: 'disconnect',
            resolveHeaderSlot,
            getMembershipContainers: async () => [FROM_ROOM],
        })

        expect(resolveHeaderSlot).not.toHaveBeenCalled()
        if (!result.ok || !result.changed) { throw new Error('expected a changed plan') }
        expect(result.plan.slots.some((slot) => slot.expectedPublishType === 'PerceptionMessage')).toBe(false)
    })
})
