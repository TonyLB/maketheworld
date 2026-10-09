import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { planCharacterMoveTransfer } from './planCharacterMoveTransfer'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId

/**
 * Character-route sibling of `planObjectMoveTransfer.test.ts` (3e): pins the compiled plan a
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
            intentKind: 'navigate',
            intentFromRoomId: FROM_ROOM,
            getMembershipContainers: async () => [FROM_ROOM],
        })

        expect(result.ok).toBe(true)
        if (!result.ok || !result.changed) { throw new Error('expected a changed plan') }
        expect(result.froms).toEqual([FROM_ROOM])
        expect(result.to).toEqual(TO_ROOM)
        expect(result.plan.steps.map((step) => step.kind)).toEqual([
            'capture', 'transferMembership', 'removePresenceBinding', 'addPresenceBinding', 'capture', 'narrate', 'narrate',
        ])
    })

    it('resolves the header slot only once the move is confirmed changed and has a real destination', async () => {
        const resolveHeader = jest.fn().mockResolvedValue(null)

        await planCharacterMoveTransfer({
            characterId: CHARACTER_ID,
            characterName: 'Test',
            targetRoomId: FROM_ROOM,
            intentKind: 'navigate',
            resolveHeader,
            getMembershipContainers: async () => [FROM_ROOM],
        })

        expect(resolveHeader).not.toHaveBeenCalled()
    })

    it('compiles a resolved header into a describe step', async () => {
        const header = { perspectiveKey: 'pk', assets: [] as string[] }
        const resolveHeader = jest.fn().mockResolvedValue(header)

        const result = await planCharacterMoveTransfer({
            characterId: CHARACTER_ID,
            characterName: 'Test',
            targetRoomId: TO_ROOM,
            intentKind: 'connect',
            resolveHeader,
            getMembershipContainers: async () => [FROM_ROOM],
        })

        expect(resolveHeader).toHaveBeenCalledWith(TO_ROOM)
        if (!result.ok || !result.changed) { throw new Error('expected a changed plan') }
        expect(result.plan.steps).toContainEqual({ kind: 'describe', referentId: TO_ROOM, referentKind: 'room', header })
    })

    it('disconnect (target null) never resolves a header even if one is supplied', async () => {
        const resolveHeader = jest.fn().mockResolvedValue(null)

        const result = await planCharacterMoveTransfer({
            characterId: CHARACTER_ID,
            characterName: 'Test',
            targetRoomId: null,
            intentKind: 'disconnect',
            resolveHeader,
            getMembershipContainers: async () => [FROM_ROOM],
        })

        expect(resolveHeader).not.toHaveBeenCalled()
        if (!result.ok || !result.changed) { throw new Error('expected a changed plan') }
        expect(result.plan.steps.some((step) => step.kind === 'describe')).toBe(false)
    })
})
