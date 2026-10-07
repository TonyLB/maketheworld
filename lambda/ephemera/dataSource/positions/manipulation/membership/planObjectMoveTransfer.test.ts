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

const narration = { actorName: 'Alice', labels: { [TRAY_ID]: 'tray' } }

/**
 * Take/drop/give's `planObjectMoveTransfer`: the containment-cycle refusal, and the move's own
 * compiled plan (transfer, own containment strip, establish into a new host). It neither
 * dry-runs nor derives a boundary-edge dissolve --- `commitAttempt.test.ts` covers the dry run
 * over the whole attempt, and `commitStepSequence`/`applyStepSequenceCore`'s own suites cover
 * commit mechanics. `getGraph` is the only I/O seam, so no `internalCache`/`transactWrite`
 * mocking is needed.
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
            // Captures are still built for the `template` family; narrate steps are not (slice 3
            // moved them to `commitAttempt.ts`'s post-commit bridge-unit sweep).
            expect(result.plan.steps.map((step) => step.kind)).toEqual([
                'capture', 'transferMembership', 'removePresenceBinding', 'addPresenceBinding', 'capture',
            ])
            expect(result.fromHostId).toBe(ROOM_ID)
        })

        it('builds no boundary-edge dissolve and does not dry-run: those belong to the attempt and commitAttempt', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Object', universalKey: TRAY_ID },
                    { tag: 'Object', universalKey: TABLE_ID },
                    { tag: 'Object', universalKey: CHANDELIER_ID },
                ],
                edges: [
                    { tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'Custom', relationLabel: 'against' },
                    { tag: 'Relational', from: TRAY_ID, to: CHANDELIER_ID, kind: 'Custom', relationLabel: 'under' },
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
            if (!result.ok) { throw new Error('expected a plan') }
            expect(result.plan.steps.some((step) => step.kind === 'dissolveRelation')).toBe(false)
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
})
