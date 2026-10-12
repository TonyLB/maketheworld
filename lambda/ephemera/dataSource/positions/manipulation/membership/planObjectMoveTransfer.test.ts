import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import { planObjectMoveTransfer } from './planObjectMoveTransfer'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TRAY2_ID = 'OBJECT#Tray2' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const CHANDELIER_ID = 'OBJECT#Chandelier' as EphemeraObjectId
const ROOM_ID = 'ROOM#TownSquare' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#alpha' as EphemeraCharacterId

/** A graph per host; any other host reads empty. */
const worldOf = (graphs: Record<string, EphemeraLudicGraph>) => async (hostId: string): Promise<EphemeraLudicGraph> => (
    graphs[hostId] ?? testLudicGraph(hostId as EphemeraObjectId)
)
const trayBinding = (name: string, parent: string) => presenceBindingNode(name, parent as any)

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
            const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [presenceBindingNode('character-root')], edges: [] })
            const trayGraph = testLudicGraph(TRAY_ID, { nodes: [trayBinding('tray-in-room', ROOM_ID)] })
            const getGraph = worldOf({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: characterGraph, [TRAY_ID]: trayGraph })

            const result = await planObjectMoveTransfer({
                entityId: TRAY_ID,
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
                getGraph,
            })

            expect(result.ok).toBe(true)
            if (!result.ok) { throw new Error('expected a legal plan') }
            // Mutation steps only: the move's audiences are `commitAttempt.ts`'s to resolve and capture.
            expect(result.plan.steps.map((step) => step.kind)).toEqual([
                'transferMembership', 'movePresenceBinding',
            ])
            expect(result.plan.steps[1]).toEqual({
                kind: 'movePresenceBinding',
                hostId: TRAY_ID,
                presence: 'PRESENCE#tray-in-room',
                from: { host: ROOM_ID, presence: parentRemainderKey(ROOM_ID) },
                to: { host: CHARACTER_ID, presence: 'PRESENCE#character-root' },
            })
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
            const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [presenceBindingNode('character-root')], edges: [] })
            const trayGraph = testLudicGraph(TRAY_ID, { nodes: [trayBinding('tray-in-room', ROOM_ID)] })
            const getGraph = worldOf({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: characterGraph, [TRAY_ID]: trayGraph })

            const result = await planObjectMoveTransfer({
                entityId: TRAY_ID,
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
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
            const trayGraph = testLudicGraph(TRAY_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }, presenceBindingNode('tray-root')], edges: [] })
            const cupGraph = testLudicGraph(CUP_ID, { nodes: [trayBinding('cup-held', CHARACTER_ID)] })
            const getGraph = worldOf({ [CHARACTER_ID]: characterGraph, [TRAY_ID]: trayGraph, [CUP_ID]: cupGraph })

            const result = await planObjectMoveTransfer({
                entityId: CUP_ID,
                fromHostId: CHARACTER_ID,
                toHostId: TRAY_ID,
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
            const tray2Graph = testLudicGraph(TRAY2_ID, { nodes: [{ tag: 'Object', universalKey: TRAY2_ID }, presenceBindingNode('tray2-root')], edges: [] })
            const cupGraph = testLudicGraph(CUP_ID, { nodes: [trayBinding('cup-on-tray', TRAY_ID)] })
            const getGraph = worldOf({ [TRAY_ID]: tray1Graph, [TRAY2_ID]: tray2Graph, [CUP_ID]: cupGraph })

            const result = await planObjectMoveTransfer({
                entityId: CUP_ID,
                fromHostId: TRAY_ID,
                toHostId: TRAY2_ID,
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
            const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [presenceBindingNode('character-root')], edges: [] })
            const cupGraph = testLudicGraph(CUP_ID, { nodes: [trayBinding('cup-on-tray', TRAY_ID)] })
            const getGraph = worldOf({ [TRAY_ID]: trayGraph, [CHARACTER_ID]: characterGraph, [CUP_ID]: cupGraph })

            const result = await planObjectMoveTransfer({
                entityId: CUP_ID,
                fromHostId: TRAY_ID,
                toHostId: CHARACTER_ID,
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
                    { tag: 'Presence', universalKey: PresenceKey('cup-on-tray'), fromHostPresence: { host: TRAY_ID }, cover: { members: [{ tag: 'Remainder' }] } },
                ],
            })
            const getGraph = jest.fn(async (hostId: string): Promise<EphemeraLudicGraph> => (
                hostId === CUP_ID ? cupGraph : testLudicGraph(hostId as EphemeraObjectId)
            ))

            const result = await planObjectMoveTransfer({
                entityId: TRAY_ID,
                fromHostId: ROOM_ID,
                toHostId: CUP_ID,
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
                containment: 'On',
                getGraph,
            })

            expect(result).toEqual({ ok: false, errorCode: 'containmentCycle' })
        })
    })

    describe('binding-addressed destination', () => {
        const tableBindings = [
            presenceBindingNode('table-left', { host: ROOM_ID, presence: parentRemainderKey(ROOM_ID) }),
            presenceBindingNode('table-right', { host: ROOM_ID, presence: PresenceKey('room-other') as any }),
        ]
        const world = () => worldOf({
            [ROOM_ID]: testLudicGraph(ROOM_ID, { nodes: [presenceBindingNode(parentRemainderKey(ROOM_ID))] }),
            [TABLE_ID]: testLudicGraph(TABLE_ID, { nodes: [{ tag: 'Object', universalKey: TABLE_ID }, ...tableBindings] }),
            [CUP_ID]: testLudicGraph(CUP_ID, { nodes: [trayBinding('cup-in-room', ROOM_ID)] }),
        })

        it('lands under the destination binding whose pointer names the bucket where the destination is seen', async () => {
            const result = await planObjectMoveTransfer({
                entityId: CUP_ID,
                fromHostId: ROOM_ID,
                toHostId: TABLE_ID,
                toGroundedPresence: [{ host: ROOM_ID, presence: PresenceKey('room-other') as any }],
                getGraph: world(),
            })

            if (!result.ok) { throw new Error('expected a plan') }
            expect(result.plan.steps.find((step) => step.kind === 'movePresenceBinding')).toEqual(expect.objectContaining({
                to: { host: TABLE_ID, presence: 'PRESENCE#table-right' },
            }))
        })

        it('refuses a destination with several bindings that nothing narrows (never a guess)', async () => {
            const result = await planObjectMoveTransfer({ entityId: CUP_ID, fromHostId: ROOM_ID, toHostId: TABLE_ID, getGraph: world() })

            expect(result).toEqual({ ok: false, errorCode: 'destinationBindingAmbiguous' })
        })

        it('refuses a destination where two bindings sit under the one seen bucket', async () => {
            const twinned = worldOf({
                [TABLE_ID]: testLudicGraph(TABLE_ID, { nodes: [
                    presenceBindingNode('twin-a', { host: ROOM_ID, presence: parentRemainderKey(ROOM_ID) }),
                    presenceBindingNode('twin-b', { host: ROOM_ID, presence: parentRemainderKey(ROOM_ID) }),
                ] }),
                [CUP_ID]: testLudicGraph(CUP_ID, { nodes: [trayBinding('cup-in-room', ROOM_ID)] }),
            })

            const result = await planObjectMoveTransfer({
                entityId: CUP_ID,
                fromHostId: ROOM_ID,
                toHostId: TABLE_ID,
                toGroundedPresence: [{ host: ROOM_ID, presence: parentRemainderKey(ROOM_ID) }],
                getGraph: twinned,
            })

            expect(result).toEqual({ ok: false, errorCode: 'destinationBindingAmbiguous' })
        })

        it('refuses a mover with two bindings under the departure host (cannot be told apart by host)', async () => {
            const result = await planObjectMoveTransfer({
                entityId: CUP_ID,
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
                getGraph: worldOf({
                    [CHARACTER_ID]: testLudicGraph(CHARACTER_ID, { nodes: [presenceBindingNode('character-root')] }),
                    [CUP_ID]: testLudicGraph(CUP_ID, { nodes: [trayBinding('cup-a', ROOM_ID), trayBinding('cup-b', ROOM_ID)] }),
                }),
            })

            expect(result).toEqual({ ok: false, errorCode: 'moverBindingAmbiguous' })
        })

        it('refuses a destination holding no binding at all', async () => {
            const result = await planObjectMoveTransfer({ entityId: CUP_ID, fromHostId: ROOM_ID, toHostId: CHARACTER_ID, getGraph: world() })

            expect(result).toEqual({ ok: false, errorCode: 'destinationBindingMissing' })
        })
    })
})
