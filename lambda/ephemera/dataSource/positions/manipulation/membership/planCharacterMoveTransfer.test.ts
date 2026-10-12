import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { planCharacterMoveTransfer } from './planCharacterMoveTransfer'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId

/** Each room holds its remainder; the character holds one binding under FROM_ROOM's. */
const getGraph = async (hostId: EphemeraMembershipHostId) => (
    hostId === CHARACTER_ID
        ? testLudicGraph(CHARACTER_ID, { nodes: [presenceBindingNode('in-vortex', FROM_ROOM)] })
        : testLudicGraph(hostId, { nodes: [presenceBindingNode(parentRemainderKey(hostId))] })
)

/**
 * Character-route sibling of `planObjectMoveTransfer.test.ts` (3e): pins the compiled plan a
 * character move builds exactly once, before commit. No commit happens inside this function ---
 * `getMembershipContainers` is the only I/O seam, so no `internalCache`/`transactWrite` mocking is
 * needed; `orchestrateCharacterMove.test.ts` covers the commit composition.
 */
describe('planCharacterMoveTransfer', () => {
    it('returns changed:false with no plan when the target room is already a container', async () => {
        const result = await planCharacterMoveTransfer({
            characterId: CHARACTER_ID,
            characterName: 'Test',
            targetRoomId: FROM_ROOM,
            intentKind: 'navigate',
            getMembershipContainers: async () => [FROM_ROOM],
            getGraph,
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
            getGraph,
        })

        expect(result.ok).toBe(true)
        if (!result.ok || !result.changed) { throw new Error('expected a changed plan') }
        expect(result.froms).toEqual([FROM_ROOM])
        expect(result.to).toEqual(TO_ROOM)
        expect(result.plan.steps.map((step) => step.kind)).toEqual([
            'capture', 'movePresenceBinding', 'capture', 'narrate', 'narrate',
        ])
        expect(result.plan.steps.find((step) => step.kind === 'movePresenceBinding')).toEqual({
            kind: 'movePresenceBinding',
            hostId: CHARACTER_ID,
            presence: 'PRESENCE#in-vortex',
            from: { host: FROM_ROOM, presence: parentRemainderKey(FROM_ROOM) },
            to: { host: TO_ROOM, presence: parentRemainderKey(TO_ROOM) },
        })
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
            getGraph,
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
            getGraph,
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
            getGraph,
        })

        expect(resolveHeader).not.toHaveBeenCalled()
        if (!result.ok || !result.changed) { throw new Error('expected a changed plan') }
        expect(result.plan.steps.some((step) => step.kind === 'describe')).toBe(false)
    })

    it('a disconnect compiles to a release of each binding: there is no destination binding to name', async () => {
        const result = await planCharacterMoveTransfer({
            characterId: CHARACTER_ID,
            characterName: 'Test',
            targetRoomId: null,
            intentKind: 'disconnect',
            getMembershipContainers: async () => [FROM_ROOM],
            getGraph,
        })

        if (!result.ok || !result.changed) { throw new Error('expected a changed plan') }
        expect(result.plan.steps).toContainEqual({
            kind: 'releasePresenceBinding',
            hostId: CHARACTER_ID,
            presence: 'PRESENCE#in-vortex',
            from: { host: FROM_ROOM, presence: parentRemainderKey(FROM_ROOM) },
        })
    })

    it('refuses, with no plan, when the destination room holds no remainder to land under', async () => {
        const result = await planCharacterMoveTransfer({
            characterId: CHARACTER_ID,
            characterName: 'Test',
            targetRoomId: TO_ROOM,
            intentKind: 'navigate',
            getMembershipContainers: async () => [FROM_ROOM],
            getGraph: async (hostId) => hostId === TO_ROOM ? testLudicGraph(TO_ROOM, { nodes: [] }) : getGraph(hostId),
        })

        expect(result).toEqual({ ok: false, errorCode: 'destinationBindingMissing' })
    })

    it('a character holding no binding at all (before its first connect) gets a root minted ahead of the move', async () => {
        const result = await planCharacterMoveTransfer({
            characterId: CHARACTER_ID,
            characterName: 'Test',
            targetRoomId: TO_ROOM,
            intentKind: 'connect',
            getMembershipContainers: async () => [],
            getGraph: async (hostId) => hostId === CHARACTER_ID ? testLudicGraph(CHARACTER_ID, { nodes: [] }) : getGraph(hostId),
        })

        if (!result.ok || !result.changed) { throw new Error('expected a changed plan') }
        const kinds = result.plan.steps.map((step) => step.kind)
        expect(kinds.indexOf('addPresenceBinding')).toBeLessThan(kinds.indexOf('movePresenceBinding'))
        const mint = result.plan.steps.find((step) => step.kind === 'addPresenceBinding') as { presenceUuid: string }
        expect(result.plan.steps.find((step) => step.kind === 'movePresenceBinding')).toEqual(expect.objectContaining({
            presence: `PRESENCE#${mint.presenceUuid}`,
            from: null,
        }))
    })

    it('a connect re-points the hostless binding a disconnect left behind', async () => {
        const result = await planCharacterMoveTransfer({
            characterId: CHARACTER_ID,
            characterName: 'Test',
            targetRoomId: TO_ROOM,
            intentKind: 'connect',
            getMembershipContainers: async () => [],
            getGraph: async (hostId) => hostId === CHARACTER_ID ? testLudicGraph(CHARACTER_ID, { nodes: [presenceBindingNode('kept')] }) : getGraph(hostId),
        })

        if (!result.ok || !result.changed) { throw new Error('expected a changed plan') }
        expect(result.plan.steps.some((step) => step.kind === 'addPresenceBinding')).toBe(false)
        expect(result.plan.steps.find((step) => step.kind === 'movePresenceBinding')).toEqual(expect.objectContaining({ presence: 'PRESENCE#kept', from: null }))
    })
})
