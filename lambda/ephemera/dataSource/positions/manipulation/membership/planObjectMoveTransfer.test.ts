import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import { planObjectMoveTransfer } from './planObjectMoveTransfer'
import { testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TRAY2_ID = 'OBJECT#Tray2' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const CHANDELIER_ID = 'OBJECT#Chandelier' as EphemeraObjectId
const ROOM_ID = 'ROOM#TownSquare' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#alpha' as EphemeraCharacterId

const narration = { characterName: 'Alice', objectShortName: 'tray' }

/**
 * Take/drop/give's `planObjectMoveTransfer` (3d, 2026-09-08): replaces
 * `executeMembershipTransfer`'s retired `honorDefer` mode. Every case here pins the single-hop,
 * defer-aware boundary check `buildObjectMoveOp` + `dryRunStepSequence` now perform, and the
 * `repairMechanicalDissolve` policy's refusal-on-anything-but-mechanical behavior. No commit
 * happens inside this function --- `getGraph` is the only I/O seam, so no `internalCache`/
 * `transactWrite` mocking is needed; `orchestrateObjectMove.test.ts` covers the commit+present
 * composition, and `commitStepSequence`/`applyStepSequenceCore`'s own suites cover commit mechanics.
 */
describe('planObjectMoveTransfer', () => {
    describe('room -> character (take-hold)', () => {
        it('returns a legal plan with the default step shape', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
            const emptyCharacterGraph = testLudicGraph(CHARACTER_ID, { nodes: [], edges: [] })
            const getGraph = async (hostId: string): Promise<EphemeraLudicGraph> => (hostId === ROOM_ID ? roomGraph : emptyCharacterGraph)

            const result = await planObjectMoveTransfer({
                entityId: TRAY_ID,
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
                bundleId: 'BUNDLE#test',
                narration,
                getGraph,
            })

            expect(result.ok).toBe(true)
            if (!result.ok) { throw new Error('expected a legal plan') }
            expect(result.plan.steps.map((step) => step.kind)).toEqual([
                'capture', 'transferMembership', 'removePresenceBinding', 'addPresenceBinding', 'capture', 'narrate', 'narrate',
            ])
            expect(result.fromHostId).toBe(ROOM_ID)
        })

        it('BD-28: a subject-move Against boundary edge is pre-resolved into an explicit dissolveRelation step (no repair round-trip needed)', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Object', universalKey: TRAY_ID },
                    { tag: 'Object', universalKey: CUP_ID },
                    { tag: 'Object', universalKey: TABLE_ID },
                    { tag: 'Object', universalKey: CHANDELIER_ID },
                ],
                edges: [
                    { tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'Against' },
                    { tag: 'Relational', from: CUP_ID, to: CHANDELIER_ID, kind: 'Under' },
                ],
            })
            const emptyCharacterGraph = testLudicGraph(CHARACTER_ID, { nodes: [], edges: [] })
            const getGraph = async (hostId: string): Promise<EphemeraLudicGraph> => (hostId === ROOM_ID ? roomGraph : emptyCharacterGraph)

            const result = await planObjectMoveTransfer({
                entityId: TRAY_ID,
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
                bundleId: 'BUNDLE#test',
                narration,
                getGraph,
            })

            expect(result.ok).toBe(true)
            if (!result.ok) { throw new Error('expected a legal plan') }
            const dissolveStep = result.plan.steps.find((step) => step.kind === 'dissolveRelation')
            expect(dissolveStep).toEqual(expect.objectContaining({ subjectId: TRAY_ID, targetId: TABLE_ID }))
            // cup-chandelier (Under, defer) is untouched --- cup was never in the transfer set,
            // and this edge doesn't classify against the tray at all.
            expect(result.plan.steps.some((step) => step.kind === 'dissolveRelation' && step.subjectId === CUP_ID)).toBe(false)
        })

        it('refuses (ok: false, real reason code) when the snapshot is stale (entity absent from the fetched fromGraph)', async () => {
            // See AGENT.contract.md's "Current limitations": no re-fetch loop exists yet. A stale
            // snapshot is refused today, exactly as it was before 3d (the old hand-rolled check
            // couldn't detect this at all).
            const staleRoomGraph = testLudicGraph(ROOM_ID, { nodes: [], edges: [] })
            const emptyCharacterGraph = testLudicGraph(CHARACTER_ID, { nodes: [], edges: [] })
            const getGraph = async (hostId: string): Promise<EphemeraLudicGraph> => (hostId === ROOM_ID ? staleRoomGraph : emptyCharacterGraph)

            const result = await planObjectMoveTransfer({
                entityId: TRAY_ID,
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
                bundleId: 'BUNDLE#test',
                narration,
                getGraph,
            })

            expect(result).toEqual({ ok: false, errorCode: 'staleTransferCandidate' })
        })

        it('refuses (ok: false, real reason code) when a boundary edge defers (Under, subject-move)', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Object', universalKey: TRAY_ID },
                    { tag: 'Object', universalKey: CHANDELIER_ID },
                ],
                edges: [{ tag: 'Relational', from: TRAY_ID, to: CHANDELIER_ID, kind: 'Under' }],
            })
            const emptyCharacterGraph = testLudicGraph(CHARACTER_ID, { nodes: [], edges: [] })
            const getGraph = async (hostId: string): Promise<EphemeraLudicGraph> => (hostId === ROOM_ID ? roomGraph : emptyCharacterGraph)

            const result = await planObjectMoveTransfer({
                entityId: TRAY_ID,
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
                bundleId: 'BUNDLE#test',
                narration,
                getGraph,
            })

            // `honorDefer` used to discard the reason code entirely (`{ ok: false }`) --- this is
            // new coverage the retired mode never had.
            expect(result).toEqual({ ok: false, errorCode: 'transferInteractionDefer' })
        })
    })

    /**
     * `On` nests end to end, as a rehost carrying a containment argument. Asserts the compiled
     * plan directly rather than a committed graph --- commit mechanics are `commitStepSequence`'s
     * and `applyStepSequenceCore`'s own suites' job.
     */
    describe('On rehost', () => {
        it('put on an empty tray: transferMembership then an establishRelation edge into the tray', async () => {
            const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: CUP_ID }], edges: [] })
            const trayGraph = testLudicGraph(TRAY_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
            const getGraph = async (hostId: string): Promise<EphemeraLudicGraph> => (hostId === CHARACTER_ID ? characterGraph : trayGraph)

            const result = await planObjectMoveTransfer({
                entityId: CUP_ID,
                fromHostId: CHARACTER_ID,
                toHostId: TRAY_ID,
                bundleId: 'BUNDLE#test',
                narration,
                containment: 'On',
                getGraph,
            })

            expect(result.ok).toBe(true)
            if (!result.ok) { throw new Error('expected a legal plan') }
            const establishStep = result.plan.steps.find((step) => step.kind === 'establishRelation')
            expect(establishStep).toEqual(expect.objectContaining({ subjectId: CUP_ID, targetId: TRAY_ID, hostId: TRAY_ID, relationKind: 'On' }))
        })

        it('moved tray-to-tray: the old containment edge dissolves with no throw, a new one establishes at the destination', async () => {
            const tray1Graph = testLudicGraph(TRAY_ID, {
                nodes: [{ tag: 'Object', universalKey: TRAY_ID }, { tag: 'Object', universalKey: CUP_ID }],
                edges: [{ tag: 'Relational', from: CUP_ID, to: TRAY_ID, kind: 'On' }],
            })
            const tray2Graph = testLudicGraph(TRAY2_ID, { nodes: [{ tag: 'Object', universalKey: TRAY2_ID }], edges: [] })
            const getGraph = async (hostId: string): Promise<EphemeraLudicGraph> => (hostId === TRAY_ID ? tray1Graph : tray2Graph)

            const result = await planObjectMoveTransfer({
                entityId: CUP_ID,
                fromHostId: TRAY_ID,
                toHostId: TRAY2_ID,
                bundleId: 'BUNDLE#test',
                narration,
                containment: 'On',
                getGraph,
            })

            expect(result.ok).toBe(true)
            if (!result.ok) { throw new Error('expected a legal plan') }
            const dissolveStep = result.plan.steps.find((step) => step.kind === 'dissolveRelation')
            expect(dissolveStep).toEqual(expect.objectContaining({ subjectId: CUP_ID, targetId: TRAY_ID }))
            const establishStep = result.plan.steps.find((step) => step.kind === 'establishRelation')
            expect(establishStep).toEqual(expect.objectContaining({ subjectId: CUP_ID, targetId: TRAY2_ID, relationKind: 'On' }))
        })

        it('taken off with no containment: the old edge dissolves, no establishRelation step', async () => {
            const trayGraph = testLudicGraph(TRAY_ID, {
                nodes: [{ tag: 'Object', universalKey: TRAY_ID }, { tag: 'Object', universalKey: CUP_ID }],
                edges: [{ tag: 'Relational', from: CUP_ID, to: TRAY_ID, kind: 'On' }],
            })
            const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [], edges: [] })
            const getGraph = async (hostId: string): Promise<EphemeraLudicGraph> => (hostId === TRAY_ID ? trayGraph : characterGraph)

            const result = await planObjectMoveTransfer({
                entityId: CUP_ID,
                fromHostId: TRAY_ID,
                toHostId: CHARACTER_ID,
                bundleId: 'BUNDLE#test',
                narration,
                getGraph,
            })

            expect(result.ok).toBe(true)
            if (!result.ok) { throw new Error('expected a legal plan') }
            expect(result.plan.steps.some((step) => step.kind === 'establishRelation')).toBe(false)
            const dissolveStep = result.plan.steps.find((step) => step.kind === 'dissolveRelation')
            expect(dissolveStep).toEqual(expect.objectContaining({ subjectId: CUP_ID, targetId: TRAY_ID }))
        })
    })

    describe('containment cycle (AB-63)', () => {
        it('refuses putting the tray on a cup that is already on the tray, before reading any departure graph', async () => {
            const cupGraph = testLudicGraph(CUP_ID, {
                nodes: [
                    { tag: 'Object', universalKey: CUP_ID },
                    { tag: 'Presence', universalKey: PresenceKey('cup-on-tray'), fromHostId: TRAY_ID, cover: { tag: 'Full' } },
                ],
            })
            const getGraph = jest.fn(async (hostId: string): Promise<EphemeraLudicGraph> => (
                hostId === CUP_ID ? cupGraph : testLudicGraph(hostId as EphemeraObjectId)
            ))

            const result = await planObjectMoveTransfer({
                entityId: TRAY_ID,
                fromHostId: ROOM_ID,
                toHostId: CUP_ID,
                bundleId: 'BUNDLE#test',
                narration,
                containment: 'On',
                getGraph,
            })

            expect(result).toEqual({ ok: false, errorCode: 'containmentCycle' })
            expect(getGraph).not.toHaveBeenCalledWith(ROOM_ID)
        })

        it('refuses putting the tray on itself', async () => {
            const getGraph = jest.fn(async (hostId: string): Promise<EphemeraLudicGraph> => testLudicGraph(hostId as EphemeraObjectId))

            const result = await planObjectMoveTransfer({
                entityId: TRAY_ID,
                fromHostId: ROOM_ID,
                toHostId: TRAY_ID,
                bundleId: 'BUNDLE#test',
                narration,
                containment: 'On',
                getGraph,
            })

            expect(result).toEqual({ ok: false, errorCode: 'containmentCycle' })
        })
    })

    describe('character -> room (drop)', () => {
        it('BD-28: dropping the tray severs tray-table as an explicit dissolveRelation step', async () => {
            const emptyRoomGraph = testLudicGraph(ROOM_ID, { nodes: [], edges: [] })
            const characterGraph = testLudicGraph(CHARACTER_ID, {
                nodes: [
                    { tag: 'Object', universalKey: TRAY_ID },
                    { tag: 'Object', universalKey: TABLE_ID },
                ],
                edges: [{ tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'Against' }],
            })
            const getGraph = async (hostId: string): Promise<EphemeraLudicGraph> => (hostId === ROOM_ID ? emptyRoomGraph : characterGraph)

            const result = await planObjectMoveTransfer({
                entityId: TRAY_ID,
                fromHostId: CHARACTER_ID,
                toHostId: ROOM_ID,
                bundleId: 'BUNDLE#test',
                narration,
                getGraph,
            })

            expect(result.ok).toBe(true)
            if (!result.ok) { throw new Error('expected a legal plan') }
            const dissolveStep = result.plan.steps.find((step) => step.kind === 'dissolveRelation')
            expect(dissolveStep).toEqual(expect.objectContaining({ subjectId: TRAY_ID, targetId: TABLE_ID }))
        })
    })
})
