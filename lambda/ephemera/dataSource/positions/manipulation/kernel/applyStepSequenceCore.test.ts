import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { applyStepSequenceCore } from './applyStepSequenceCore'
import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { MutationKernelStep } from './kernelStep'
import { isKernelMutationStep } from './kernelStep'
import { compilePositionKernelOp } from './compile/compilePositionKernelOp'
import { parentsOfBinding } from '../../ludicGraph/presenceParent'
import { roomsForPresenceNode } from '../../ludicGraph/presenceRooms'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId
const areaId = 'AREA#Overworld' as EphemeraAreaId
const featureId = 'FEATURE#Sign' as EphemeraFeatureId

const graphsMap = (
    ...entries: [EphemeraMembershipHostId, EphemeraLudicGraph][]
): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => new Map(entries)

/** A host graph holding `held` plus its conventional remainder binding. */
const hostHolding = (hostId: EphemeraMembershipHostId, ...held: ({ tag: 'Object'; universalKey: EphemeraObjectId } | { tag: 'Character'; universalKey: EphemeraCharacterId })[]) => (
    testLudicGraph(hostId, { nodes: [...held, presenceBindingNode(parentRemainderKey(hostId))] })
)
const object = (universalKey: EphemeraObjectId) => ({ tag: 'Object' as const, universalKey })
const character = (universalKey: EphemeraCharacterId) => ({ tag: 'Character' as const, universalKey })

/** The mover's own graph: one binding, `p1`, sitting under the host's remainder. */
const moverAt = (moverId: EphemeraMembershipHostId, host: EphemeraMembershipHostId, name = 'Base') => (
    testLudicGraph(moverId, { nodes: [presenceBindingNode(name, host)] })
)
const remainderOf = (host: EphemeraMembershipHostId) => ({ host, presence: parentRemainderKey(host) })

const moveStep = (
    hostId: EphemeraMembershipHostId,
    presence: string,
    from: { host: EphemeraMembershipHostId; presence?: string } | null,
    to: { host: EphemeraMembershipHostId; presence: string }
): MutationKernelStep => ({ kind: 'movePresenceBinding', hostId, presence, from, to } as MutationKernelStep)

const releaseStep = (
    hostId: EphemeraMembershipHostId,
    presence: string,
    from: { host: EphemeraMembershipHostId; presence?: string }
): MutationKernelStep => ({ kind: 'movePresenceBinding', to: null, hostId, presence, from } as MutationKernelStep)

describe('applyStepSequenceCore', () => {
    it('explicit dissolveRelation before a move composes correctly', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
                presenceBindingNode(parentRemainderKey(roomId)),
            ],
            edges: [
                { tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' },
            ],
        })
        const destGraph = hostHolding(characterId)
        const steps: MutationKernelStep[] = [
            { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, hostId: roomId, relationKind: 'Custom', relationLabel: 'tied to' },
            moveStep(trayId, 'PRESENCE#Base', remainderOf(roomId), remainderOf(characterId)),
        ]

        const outcome = applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph], [trayId, moverAt(trayId, roomId)]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        const nextSource = outcome.graphs.get(roomId)!
        const nextDest = outcome.graphs.get(characterId)!
        expect(nextSource.objectIds.has(tableId)).toBe(true)
        expect(nextSource.objectIds.has(trayId)).toBe(false)
        expect(nextSource.relationalEdges).toEqual([])
        expect(nextDest.objectIds.has(trayId)).toBe(true)
        expect(nextDest.relationalEdges).toEqual([])
    })

    it('a move before establishRelation lands the relation on the shared destination host', () => {
        const sourceGraph = hostHolding(roomId, object(trayId))
        const destGraph = testLudicGraph(characterId, { nodes: [{ tag: 'Object', universalKey: glassId }, presenceBindingNode(parentRemainderKey(characterId))] })
        const steps: MutationKernelStep[] = [
            moveStep(trayId, 'PRESENCE#Base', remainderOf(roomId), remainderOf(characterId)),
            { kind: 'establishRelation', subjectId: trayId, targetId: glassId, hostId: characterId, relationKind: 'On' },
        ]

        const outcome = applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph], [trayId, moverAt(trayId, roomId)]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        const nextDest = outcome.graphs.get(characterId)!
        expect(nextDest.objectIds.has(trayId)).toBe(true)
        expect(nextDest.relationalEdges).toEqual([{ from: trayId, to: glassId, kind: 'On' }])
    })

    it('BD-28 alone: a bare dissolveRelation step actually removes the edge, no membership change', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
                presenceBindingNode(parentRemainderKey(roomId)),
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'On' }],
        })
        const steps: MutationKernelStep[] = [{ kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, hostId: roomId, relationKind: 'On' }]

        const outcome = applyStepSequenceCore(steps, graphsMap([roomId, graph]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        const nextGraph = outcome.graphs.get(roomId)!
        expect(nextGraph.relationalEdges).toEqual([])
        expect(nextGraph.objectIds).toEqual(new Set([trayId, tableId]))
    })

    it('BD-33 structural throw: a carried hostId that neither endpoint actually shares throws (not a verdict)', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }, presenceBindingNode(parentRemainderKey(roomId))] })
        const otherGraph = testLudicGraph(otherRoomId, { nodes: [{ tag: 'Object', universalKey: glassId }, presenceBindingNode(parentRemainderKey(otherRoomId))] })
        // hostId is now carried, not resolved --- roomId is trayId's real host but not
        // glassId's, so `confirmCarriedHost` catches the mismatch and throws (Expansion computed
        // the wrong host, a structural bug, not a stale candidate --- both endpoints still exist
        // somewhere in the footprint).
        const steps: MutationKernelStep[] = [{ kind: 'establishRelation', subjectId: trayId, targetId: glassId, hostId: roomId, relationKind: 'On' }]

        expect(() => applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [otherRoomId, otherGraph]))).toThrow(
            /do not share host/
        )
    })

    it('establishRelation with a non-Object (Character) subject commits, hostGraph resolves via nodeIds', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Character', universalKey: characterId },
                { tag: 'Object', universalKey: tableId },
                presenceBindingNode(parentRemainderKey(roomId)),
            ],
        })
        const steps: MutationKernelStep[] = [
            { kind: 'establishRelation', subjectId: characterId, targetId: tableId, hostId: roomId, relationKind: 'On' },
        ]

        const outcome = applyStepSequenceCore(steps, graphsMap([roomId, graph]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        const nextGraph = outcome.graphs.get(roomId)!
        expect(nextGraph.relationalEdges).toEqual([{ from: characterId, to: tableId, kind: 'On' }])
    })

    it('AB-54 hosting kinds: establishRelation carries the correct host explicitly, not resolved by intersection (put cup on table)', () => {
        // `tableId` is simultaneously an ordinary member of the room's graph (it sits there) *and*
        // the self-referencing root of its own shard graph (a hosting kind puts the moved object
        // there, AB-54) --- both graphs are locked in the same footprint. Previously, an
        // intersection-based resolver had to disambiguate this at commit time (the historical bug:
        // a first-match-per-side scan could pick the room for `tableId` while `trayId`, just
        // moved, only resolves in the table's own shard, spuriously throwing "do not share a
        // host" for a perfectly legal move). Now, Expansion already carries `hostId:
        // tableId` on the step, so `confirmCarriedHost` only needs to confirm it, not resolve it.
        const roomGraph = hostHolding(roomId, object(trayId), object(tableId))
        const tableGraph = testLudicGraph(tableId, { nodes: [{ tag: 'Object', universalKey: tableId }, presenceBindingNode('table-root')] })
        const steps: MutationKernelStep[] = [
            moveStep(trayId, 'PRESENCE#Base', remainderOf(roomId), { host: tableId, presence: 'PRESENCE#table-root' }),
            { kind: 'establishRelation', subjectId: trayId, targetId: tableId, hostId: tableId, relationKind: 'On' },
        ]

        const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph], [tableId, tableGraph], [trayId, moverAt(trayId, roomId)]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        const nextRoom = outcome.graphs.get(roomId)!
        const nextTableShard = outcome.graphs.get(tableId)!
        expect(nextRoom.objectIds.has(trayId)).toBe(false)
        expect(nextRoom.objectIds.has(tableId)).toBe(true)
        expect(nextTableShard.objectIds.has(trayId)).toBe(true)
        expect(nextTableShard.relationalEdges).toEqual([{ from: trayId, to: tableId, kind: 'On' }])
    })

    it('stale (hostNotInFootprint): a move whose departure host is absent from the graphs map', () => {
        const steps: MutationKernelStep[] = [
            moveStep(trayId, 'PRESENCE#Base', remainderOf(roomId), remainderOf(characterId)),
        ]
        expect(applyStepSequenceCore(steps, graphsMap([characterId, hostHolding(characterId)], [trayId, moverAt(trayId, roomId)]))).toEqual({
            verdict: 'stale',
            reasonCode: 'hostNotInFootprint',
        })
    })

    it('stale (staleTransferCandidate, object): object absent from the host the move leaves', () => {
        const steps: MutationKernelStep[] = [
            moveStep(trayId, 'PRESENCE#Base', remainderOf(roomId), remainderOf(characterId)),
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, hostHolding(roomId)], [characterId, hostHolding(characterId)], [trayId, moverAt(trayId, roomId)]))).toEqual({
            verdict: 'stale',
            reasonCode: 'staleTransferCandidate',
        })
    })

    it('illegal (staleRelationalCandidate): a relational step endpoint unresolvable across the footprint graphs', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }, presenceBindingNode(parentRemainderKey(roomId))] })
        const steps: MutationKernelStep[] = [{ kind: 'establishRelation', subjectId: trayId, targetId: glassId, hostId: roomId, relationKind: 'On' }]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph]))).toEqual({
            verdict: 'stale',
            reasonCode: 'staleRelationalCandidate',
        })
    })

    it('repairable propagation: a Custom boundary edge names the classification it needs, not a severing it cannot vouch for', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
                presenceBindingNode(parentRemainderKey(roomId)),
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' }],
        })
        const steps: MutationKernelStep[] = [
            moveStep(trayId, 'PRESENCE#Base', remainderOf(roomId), remainderOf(characterId)),
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, hostHolding(characterId)], [trayId, moverAt(trayId, roomId)]))).toEqual({
            verdict: 'repairable',
            reasonCode: 'undecidableInteractionEdge',
            authority: 'worldChanging',
            // The claim this change rests on: the repair kind is `classifyCustomRelation`, NOT
            // `dissolveRelationalEdge`. Asserting merely that "some repair came back" would pass
            // just as well if the kernel had defaulted to severing an edge it cannot judge.
            repair: {
                kind: 'classifyCustomRelation',
                hostId: roomId,
                edge: { from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' },
            },
        })
    })

    it('undecidableInteractionEdge propagation: a sequence that moves a subject past a Custom edge it does not classify', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
                presenceBindingNode(parentRemainderKey(roomId)),
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'against' }],
        })
        // Bug-injection: no paired dissolveRelation step for the tray-table edge.
        const steps: MutationKernelStep[] = [
            moveStep(trayId, 'PRESENCE#Base', remainderOf(roomId), remainderOf(characterId)),
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, hostHolding(characterId)], [trayId, moverAt(trayId, roomId)]))).toEqual({
            verdict: 'repairable',
            reasonCode: 'undecidableInteractionEdge',
            authority: 'worldChanging',
            // The repair is carried as a value, and names the *source* host --- this is the fact a
            // re-proposing caller needs and could not previously get from a reason code alone.
            repair: {
                kind: 'classifyCustomRelation',
                hostId: roomId,
                edge: { from: trayId, to: tableId, kind: 'Custom', relationLabel: 'against' },
            },
        })
    })

    describe('bystanders (a character at a Room)', () => {
        it('a character move writes the mover only: neither room graph changes, and neither need be in the footprint', () => {
            const steps: MutationKernelStep[] = [
                moveStep(characterId, 'PRESENCE#Base', remainderOf(roomId), remainderOf(otherRoomId)),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, roomId)]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect([...outcome.graphs.keys()]).toEqual([characterId])
            expect(outcome.graphs.get(characterId)!.presenceNodes).toEqual([presenceBindingNode('Base', otherRoomId)])
        })

        it('a character move does not confirm the destination binding (pointers govern)', () => {
            const steps: MutationKernelStep[] = [
                moveStep(characterId, 'PRESENCE#Base', remainderOf(roomId), remainderOf(otherRoomId)),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, roomId)], [otherRoomId, testLudicGraph(otherRoomId, { nodes: [] })]))

            expect(outcome.verdict).toBe('legal')
        })

        it("the mover's own binding check still gates a move: a binding that no longer sits under `from` is stale", () => {
            const steps: MutationKernelStep[] = [
                moveStep(characterId, 'PRESENCE#Base', remainderOf(roomId), remainderOf(otherRoomId)),
            ]

            expect(applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, otherRoomId)]))).toEqual({
                verdict: 'stale',
                reasonCode: 'presenceBindingMoved',
            })
        })

        it('a character release (disconnect-shaped) keeps its binding hostless and writes no room graph', () => {
            const steps: MutationKernelStep[] = [releaseStep(characterId, 'PRESENCE#Base', remainderOf(roomId))]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, roomId)]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(characterId)!.presenceNodes).toEqual([presenceBindingNode('Base')])
        })

        it('a first placement (from: null, connect-shaped) writes the mover only', () => {
            const steps: MutationKernelStep[] = [moveStep(characterId, 'PRESENCE#Base', null, remainderOf(roomId))]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, testLudicGraph(characterId, { nodes: [presenceBindingNode('Base')] })]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect([...outcome.graphs.keys()]).toEqual([characterId])
            expect(outcome.graphs.get(characterId)!.presenceNodes).toEqual([presenceBindingNode('Base', roomId)])
        })

        it('a character release is stale (presenceBindingMoved) when the binding no longer sits under the room', () => {
            const steps: MutationKernelStep[] = [releaseStep(characterId, 'PRESENCE#Base', remainderOf(roomId))]
            expect(applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, otherRoomId)]))).toEqual({
                verdict: 'stale',
                reasonCode: 'presenceBindingMoved',
            })
        })
    })

    describe('object-lifecycle Migrate row: release / first placement / several bindings', () => {
        const twoRooms = () => graphsMap(
            [roomId, hostHolding(roomId, object(trayId))],
            [otherRoomId, hostHolding(otherRoomId, object(trayId))],
            [trayId, testLudicGraph(trayId, { nodes: [presenceBindingNode(BASE_PRESENCE_ID), presenceBindingNode('a', roomId), presenceBindingNode('b', otherRoomId)] })]
        )

        it('releasing every binding removes the object from every host it was in', () => {
            const steps: MutationKernelStep[] = [
                releaseStep(trayId, 'PRESENCE#a', remainderOf(roomId)),
                releaseStep(trayId, 'PRESENCE#b', remainderOf(otherRoomId)),
            ]

            const outcome = applyStepSequenceCore(steps, twoRooms())

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(false)
            expect(outcome.graphs.get(otherRoomId)!.objectIds.has(trayId)).toBe(false)
        })

        it('releasing one of two bindings leaves the host of the other untouched', () => {
            const outcome = applyStepSequenceCore([releaseStep(trayId, 'PRESENCE#a', remainderOf(roomId))], twoRooms())

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(false)
            expect(outcome.graphs.get(otherRoomId)!.objectIds.has(trayId)).toBe(true)
        })

        it('a release with a residual boundary edge is repairable, not a silent strip or a throw', () => {
            const roomGraph = testLudicGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: tableId },
                    presenceBindingNode(parentRemainderKey(roomId)),
                ],
                edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' }],
            })
            // Bug-injection: no paired dissolveRelation step for the tray-table edge.
            const steps: MutationKernelStep[] = [releaseStep(trayId, 'PRESENCE#Base', remainderOf(roomId))]

            expect(applyStepSequenceCore(steps, graphsMap([roomId, roomGraph], [trayId, moverAt(trayId, roomId)]))).toMatchObject({
                verdict: 'repairable',
                reasonCode: 'undecidableInteractionEdge',
                repair: { hostId: roomId },
            })
        })

        it('a release preceded by an explicit dissolveRelation succeeds (destroy-shaped sequence)', () => {
            const roomGraph = testLudicGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: tableId },
                    presenceBindingNode(parentRemainderKey(roomId)),
                ],
                edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'On' }],
            })
            const steps: MutationKernelStep[] = [
                { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, hostId: roomId, relationKind: 'On' },
                releaseStep(trayId, 'PRESENCE#Base', remainderOf(roomId)),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph], [trayId, moverAt(trayId, roomId)]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            const nextRoom = outcome.graphs.get(roomId)!
            expect(nextRoom.objectIds.has(trayId)).toBe(false)
            expect(nextRoom.objectIds.has(tableId)).toBe(true)
            expect(nextRoom.relationalEdges).toEqual([])
        })

        it('a first placement (from: null) adds the object to the destination only, no source graph needed', () => {
            const steps: MutationKernelStep[] = [moveStep(trayId, 'PRESENCE#root', null, remainderOf(roomId))]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, hostHolding(roomId)], [trayId, testLudicGraph(trayId, { nodes: [presenceBindingNode('root')] })]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(true)
        })

        it('arriving where the mover already holds a node is harmless: nothing is added twice', () => {
            // 'b' already sits under the destination, so the move joins 'a' into it (MC-3)
            const steps: MutationKernelStep[] = [moveStep(trayId, 'PRESENCE#a', remainderOf(roomId), remainderOf(otherRoomId))]

            const outcome = applyStepSequenceCore(steps, twoRooms())

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(false)
            expect(outcome.graphs.get(otherRoomId)!.objectIds.has(trayId)).toBe(true)
        })

        it('a release is stale (staleTransferCandidate) when the object is already absent from the host', () => {
            const steps: MutationKernelStep[] = [releaseStep(trayId, 'PRESENCE#Base', remainderOf(roomId))]
            expect(applyStepSequenceCore(steps, graphsMap([roomId, hostHolding(roomId)], [trayId, moverAt(trayId, roomId)]))).toEqual({
                verdict: 'stale',
                reasonCode: 'staleTransferCandidate',
            })
        })

        it('a node held in a host that no binding points at is drift: a release of another binding leaves it alone', () => {
            const graphs = graphsMap(
                [roomId, hostHolding(roomId, object(trayId))],
                [otherRoomId, hostHolding(otherRoomId, object(trayId))],
                [trayId, moverAt(trayId, roomId)]
            )

            const outcome = applyStepSequenceCore([releaseStep(trayId, 'PRESENCE#Base', remainderOf(roomId))], graphs)

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(otherRoomId)!.objectIds.has(trayId)).toBe(true)
        })
    })

    describe('Room/Feature membership comes with the binding step that points at the parent', () => {
        it('addPresenceBinding with a pointer adds a Room to an Area host', () => {
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: roomId, fromHostPresence: { host: areaId, presence: parentRemainderKey(areaId) }, cover: { members: [] }, presenceUuid: 'Base' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([areaId, hostHolding(areaId)], [roomId, testLudicGraph(roomId, { nodes: [] })]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(areaId)!.roomIds.has(roomId)).toBe(true)
        })

        it('addPresenceBinding with a pointer adds a Feature to a Room host', () => {
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: featureId, fromHostPresence: { host: roomId, presence: parentRemainderKey(roomId) }, presenceUuid: 'Base' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, hostHolding(roomId)], [featureId, testLudicGraph(featureId, { nodes: [] })]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.featureIds.has(featureId)).toBe(true)
        })

        it('replaying a population step is harmless: a Room already a node of its Area stays one node', () => {
            const areaGraph = testLudicGraph(areaId, { nodes: [{ tag: 'Room', universalKey: roomId }, presenceBindingNode(parentRemainderKey(areaId))] })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: roomId, fromHostPresence: { host: areaId, presence: parentRemainderKey(areaId) }, cover: { members: [] }, presenceUuid: 'Base' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([areaId, areaGraph], [roomId, testLudicGraph(roomId, { nodes: [] })]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect([...outcome.graphs.get(areaId)!.roomIds]).toEqual([roomId])
        })

        it('a Room never relocates: releasing its binding at an Area is a caller bug and throws', () => {
            const areaGraph = testLudicGraph(areaId, { nodes: [{ tag: 'Room', universalKey: roomId }, presenceBindingNode(parentRemainderKey(areaId))] })
            const roomGraph = testLudicGraph(roomId, { nodes: [presenceBindingNode('Base', areaId)] })
            const steps: MutationKernelStep[] = [releaseStep(roomId, 'PRESENCE#Base', remainderOf(areaId))]

            expect(() => applyStepSequenceCore(steps, graphsMap([areaId, areaGraph], [roomId, roomGraph])))
                .toThrow('structural invariant violated')
        })
    })

    describe('crossing legs and crossing-port steps', () => {
        it('a leg whose target is a port address carries its host from the primitive subject alone (readout\'s room-side leg: string -> port(owner=Table))', () => {
            const stringId = 'OBJECT#String' as EphemeraObjectId
            const roomGraph = testLudicGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: stringId },
                    { tag: 'Object', universalKey: tableId },
                    presenceBindingNode(parentRemainderKey(roomId)),
                ],
            })
            const tableGraph = testLudicGraph(tableId, {
                nodes: [
                    { tag: 'Object', universalKey: tableId },
                    { tag: 'Object', universalKey: glassId },
                    presenceBindingNode(parentRemainderKey(tableId)),
                ],
                ports: [{ portId: 'crossing-1', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'to' }],
            })
            const steps: MutationKernelStep[] = [
                {
                    kind: 'establishRelation',
                    subjectId: stringId,
                    targetId: { owner: tableId, port: 'crossing-1' },
                    hostId: roomId,
                    relationKind: 'Custom',
                    relationLabel: 'to',
                },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph], [tableId, tableGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.relationalEdges).toEqual([
                { from: stringId, to: { owner: tableId, port: 'crossing-1' }, kind: 'Custom', relationLabel: 'to' },
            ])
        })

        it('a leg whose subject is a port address carries its host from the primitive target alone (readout\'s table-side leg: port(owner=Table) -> cup)', () => {
            const tableGraph = testLudicGraph(tableId, {
                nodes: [
                    { tag: 'Object', universalKey: tableId },
                    { tag: 'Object', universalKey: glassId },
                    presenceBindingNode(parentRemainderKey(tableId)),
                ],
                ports: [{ portId: 'crossing-1', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'to' }],
            })
            const steps: MutationKernelStep[] = [
                {
                    kind: 'establishRelation',
                    subjectId: { owner: tableId, port: 'crossing-1' },
                    targetId: glassId,
                    hostId: tableId,
                    relationKind: 'Custom',
                    relationLabel: 'to',
                },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([tableId, tableGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(tableId)!.relationalEdges).toEqual([
                { from: { owner: tableId, port: 'crossing-1' }, to: glassId, kind: 'Custom', relationLabel: 'to' },
            ])
        })

        it('addCrossingPort adds a fresh port without disturbing an existing one (crossing ports are not at-most-one)', () => {
            const tableGraph = testLudicGraph(tableId, {
                nodes: [],
                ports: [{ portId: 'existing', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'under' }],
            })
            const steps: MutationKernelStep[] = [
                {
                    kind: 'addCrossingPort',
                    hostId: tableId,
                    port: { portId: 'new', fromHostId: otherRoomId, kind: 'Custom', exteriorRelationLabel: 'to' },
                },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([tableId, tableGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(tableId)!.ports).toEqual([
                { portId: 'existing', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'under' },
                { portId: 'new', fromHostId: otherRoomId, kind: 'Custom', exteriorRelationLabel: 'to' },
            ])
        })

        it('removeCrossingPort removes only the named port, by portId', () => {
            const tableGraph = testLudicGraph(tableId, {
                nodes: [],
                ports: [
                    { portId: 'keep', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'under' },
                    { portId: 'gone', fromHostId: otherRoomId, kind: 'Custom', exteriorRelationLabel: 'to' },
                ],
            })
            const steps: MutationKernelStep[] = [{ kind: 'removeCrossingPort', hostId: tableId, portId: 'gone' }]

            const outcome = applyStepSequenceCore(steps, graphsMap([tableId, tableGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(tableId)!.ports).toEqual([{ portId: 'keep', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'under' }])
        })

        it('addCrossingPort against a host absent from the footprint is illegal (hostNotInFootprint)', () => {
            const steps: MutationKernelStep[] = [
                { kind: 'addCrossingPort', hostId: tableId, port: { portId: 'new', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'to' } },
            ]

            expect(applyStepSequenceCore(steps, graphsMap([roomId, testLudicGraph(roomId, { nodes: [] })]))).toEqual({
                verdict: 'stale',
                reasonCode: 'hostNotInFootprint',
            })
        })
    })

    describe('capture step', () => {
        const occupantsOf = (...entries: [EphemeraMembershipHostId, EphemeraCharacterId[]][]) => new Map(entries)

        it('a capture before a mutation step snapshots the entity as still present', () => {
            const steps: MutationKernelStep[] = [
                { kind: 'capture', hostId: roomId, captureId: 'before' },
                moveStep(characterId, 'PRESENCE#Base', remainderOf(roomId), remainderOf(otherRoomId)),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, roomId)]), occupantsOf([roomId, [characterId]], [otherRoomId, []]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.captures.get('before')).toEqual([characterId])
        })

        it('the same capture placed after the mutation does not see the entity, and the destination does', () => {
            const steps: MutationKernelStep[] = [
                moveStep(characterId, 'PRESENCE#Base', remainderOf(roomId), remainderOf(otherRoomId)),
                { kind: 'capture', hostId: roomId, captureId: 'after' },
                { kind: 'capture', hostId: otherRoomId, captureId: 'arrived' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, roomId)]), occupantsOf([roomId, [characterId]], [otherRoomId, []]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.captures.get('after')).toEqual([])
            expect(outcome.captures.get('arrived')).toEqual([characterId])
        })

        it('a capture naming a host with no resolved occupants is illegal (hostNotInFootprint)', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [] })
            const steps: MutationKernelStep[] = [{ kind: 'capture', hostId: otherRoomId, captureId: 'missing' }]

            expect(applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]), occupantsOf([roomId, []]))).toEqual({
                verdict: 'stale',
                reasonCode: 'hostNotInFootprint',
            })
        })

        it('a capture step never contributes to the returned graphs map', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }, presenceBindingNode(parentRemainderKey(roomId))] })
            const steps: MutationKernelStep[] = [{ kind: 'capture', hostId: roomId, captureId: 'only' }]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]), occupantsOf([roomId, []]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)).toBe(roomGraph)
        })
    })

    describe('createComponent', () => {
        const createTray: MutationKernelStep = {
            kind: 'createComponent',
            hostId: trayId,
            meta: { EphemeraId: trayId, DataCategory: 'Meta::Object', stableKey: 'tray' },
        }

        it('creates the host holding exactly one hostless Base, with an empty cover', () => {
            const outcome = applyStepSequenceCore([createTray], new Map())

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('Base', undefined, { members: [] })])
        })

        it('the born binding has the fixed id PRESENCE#Base, and a second mint of it throws rather than no-oping', () => {
            const outcome = applyStepSequenceCore([createTray], new Map())
            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes.map((node) => node.universalKey)).toEqual(['PRESENCE#Base'])

            expect(() => applyStepSequenceCore(
                [{ kind: 'addPresenceBinding', hostId: trayId, presenceUuid: 'Base' }],
                graphsMap([trayId, outcome.graphs.get(trayId)!])
            )).toThrow(/already holds PRESENCE#Base/)
        })

        it('a placement later in the same sequence re-points that remainder, keeping its id', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [presenceBindingNode(parentRemainderKey(roomId))] })
            const steps: MutationKernelStep[] = [
                createTray,
                ...compilePositionKernelOp({ kind: 'move', moved: trayId, froms: [], to: roomId, header: null, presenceMoves: [{ presence: 'PRESENCE#Base' as any, from: null, to: { host: roomId, presence: parentRemainderKey(roomId) } }] })
                    .steps.filter(isKernelMutationStep),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('Base', roomId, { members: [] })])
            expect(outcome.graphs.get(roomId)!.nodeIds.has(trayId)).toBe(true)
        })

        it('throws when the host is already in the footprint', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [] })

            expect(() => applyStepSequenceCore([createTray], graphsMap([trayId, trayGraph]))).toThrow(/already in the footprint/)
            expect(() => applyStepSequenceCore([createTray, createTray], new Map())).toThrow(/already in the footprint/)
        })
    })

    describe('destroyComponent', () => {
        const destroyTray: MutationKernelStep = { kind: 'destroyComponent', hostId: trayId }

        it('drops an empty host (root and own bindings only) from the outcome', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('Base')] })

            const outcome = applyStepSequenceCore([destroyTray], graphsMap([trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.has(trayId)).toBe(false)
        })

        it('after a release, the same sequence destroys the host; the room no longer holds it', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }, presenceBindingNode(parentRemainderKey(roomId))] })
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('Base', roomId)] })
            const steps: MutationKernelStep[] = [
                ...compilePositionKernelOp({ kind: 'move', moved: trayId, froms: [roomId], to: null, header: null, presenceMoves: [{ presence: 'PRESENCE#Base' as any, from: { host: roomId, presence: parentRemainderKey(roomId) }, to: null }] })
                    .steps.filter(isKernelMutationStep),
                destroyTray,
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph], [trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.has(trayId)).toBe(false)
            expect(outcome.graphs.get(roomId)!.nodeIds.has(trayId)).toBe(false)
        })

        it('throws while the host still holds another component', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [{ tag: 'Object', universalKey: tableId }, presenceBindingNode(parentRemainderKey(trayId))] })

            expect(() => applyStepSequenceCore([destroyTray], graphsMap([trayId, trayGraph]))).toThrow(/still holds 1 hosted node/)
        })

        it('throws while the host still holds a relational edge', () => {
            const trayGraph = testLudicGraph(trayId, {
                nodes: [],
                edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'against' }],
            })

            expect(() => applyStepSequenceCore([destroyTray], graphsMap([trayId, trayGraph]))).toThrow(/relational edge/)
        })

        it('is stale when the host is not in the footprint, and a later step on a destroyed host is stale too', () => {
            expect(applyStepSequenceCore([destroyTray], new Map())).toEqual({ verdict: 'stale', reasonCode: 'hostNotInFootprint' })

            const trayGraph = testLudicGraph(trayId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                destroyTray,
                { kind: 'addPresenceBinding', hostId: trayId, presenceUuid: 'late' },
            ]
            expect(applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))).toEqual({ verdict: 'stale', reasonCode: 'hostNotInFootprint' })
        })
    })

    describe('presence binding steps (addPresenceBinding/movePresenceBinding)', () => {
        // presenceNodes Slice 7a (PN-23): these steps mint/remove the presence NODE directly ---
        // there is no port record any more, so `.ports` is untouched by any of this and only
        // `.presenceNodes`/`.toStored().nodes` reflects the binding.
        it('addPresenceBinding mints a presence node carrying the parent pointer, empty cover by default, and the parent cover lists it', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: { host: roomId, presence: parentRemainderKey(roomId) }, presenceUuid: 'Base' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, hostHolding(roomId)]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(true)
            expect(outcome.graphs.get(trayId)!.toStored().nodes).toEqual(
                expect.arrayContaining([{
                    tag: 'Presence',
                    universalKey: 'PRESENCE#Base',
                    fromHostPresences: [{ host: roomId, presence: parentRemainderKey(roomId) }],
                    cover: { members: [] },
                }])
            )
            expect(outcome.graphs.get(roomId)!.presenceNodes.find((node) => node.universalKey === parentRemainderKey(roomId))!.cover.members)
                .toContainEqual({ host: trayId, presence: 'PRESENCE#Base' })
        })

        it('a move re-points the named binding in place: same id and cover, pointer at the destination\'s binding', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('Base', roomId)] })
            const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [presenceBindingNode(parentRemainderKey(otherRoomId))] })
            const steps = [
                moveStep(trayId, 'PRESENCE#Base', { host: roomId, presence: parentRemainderKey(roomId) }, { host: otherRoomId, presence: parentRemainderKey(otherRoomId) }),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, hostHolding(roomId, object(trayId))], [otherRoomId, otherRoomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('Base', otherRoomId)])
        })

        it('a first placement (from: null) re-points a hostless remainder rather than minting beside it', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('root')] })
            const roomGraph = testLudicGraph(roomId, { nodes: [presenceBindingNode(parentRemainderKey(roomId))] })
            const steps = [moveStep(trayId, 'PRESENCE#root', null, { host: roomId, presence: parentRemainderKey(roomId) })]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('root', roomId)])
        })

        it('a reconnect re-points that same hostless binding, and the character still carries exactly one', () => {
            const characterGraph = testLudicGraph(characterId, { nodes: [presenceBindingNode('Base')] })
            const roomGraph = testLudicGraph(roomId, { nodes: [presenceBindingNode(parentRemainderKey(roomId))] })
            const steps = [moveStep(characterId, 'PRESENCE#Base', null, { host: roomId, presence: parentRemainderKey(roomId) })]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, characterGraph], [roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(characterId)!.presenceNodes).toEqual([presenceBindingNode('Base', roomId)])
        })

        it('a move names one of several bindings and leaves the others alone', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('a', roomId), presenceBindingNode('b', otherRoomId)] })
            const characterGraph = testLudicGraph(characterId, { nodes: [presenceBindingNode(parentRemainderKey(characterId))] })
            const steps = [moveStep(trayId, 'PRESENCE#b', { host: otherRoomId, presence: parentRemainderKey(otherRoomId) }, { host: characterId, presence: parentRemainderKey(characterId) })]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [characterId, characterGraph], [otherRoomId, hostHolding(otherRoomId, object(trayId))]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('a', roomId), presenceBindingNode('b', characterId)])
            expect(outcome.graphs.get(otherRoomId)!.objectIds.has(trayId)).toBe(false)
        })

        it('a move between two bindings of one parent changes the pointer and nothing else', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('Base', { host: tableId, presence: 'PRESENCE#left' as any })] })
            const trayEntry = { host: trayId, presence: 'PRESENCE#Base' as any }
            const tableGraph = testLudicGraph(tableId, { nodes: [{ tag: 'Object', universalKey: trayId }, presenceBindingNode('left', roomId, { members: [trayEntry] }), presenceBindingNode('right', otherRoomId, { members: [] })] })
            const steps = [moveStep(trayId, 'PRESENCE#Base', { host: tableId, presence: 'PRESENCE#left' }, { host: tableId, presence: 'PRESENCE#right' })]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [tableId, tableGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('Base', { host: tableId, presence: 'PRESENCE#right' as any })])
            // the cover index follows: the entry leaves `left`'s cover and arrives in `right`'s
            expect(outcome.graphs.get(tableId)!.presenceNodes).toEqual([
                presenceBindingNode('left', roomId, { members: [] }),
                presenceBindingNode('right', otherRoomId, { members: [trayEntry] }),
            ])
        })

        it.each([
            ['the named binding is gone', 'PRESENCE#gone', { host: roomId, presence: parentRemainderKey(roomId) }, parentRemainderKey(otherRoomId), 'presenceBindingMissing'],
            ['the binding no longer sits under `from`', 'PRESENCE#Base', { host: otherRoomId, presence: parentRemainderKey(otherRoomId) }, parentRemainderKey(otherRoomId), 'presenceBindingMoved'],
            ['`from: null` but the binding is placed', 'PRESENCE#Base', null, parentRemainderKey(otherRoomId), 'presenceBindingMoved'],
            ['the destination binding is gone', 'PRESENCE#Base', { host: roomId, presence: parentRemainderKey(roomId) }, 'PRESENCE#gone', 'destinationBindingMissing'],
        ])('a move is stale when %s', (_label, presence, from, toPresence, reasonCode) => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('Base', roomId)] })
            const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [presenceBindingNode(parentRemainderKey(otherRoomId))] })
            const steps = [moveStep(trayId, presence, from, { host: otherRoomId, presence: toPresence })]

            expect(applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [otherRoomId, otherRoomGraph]))).toEqual({ verdict: 'stale', reasonCode })
        })

        it('a move whose destination host is outside the footprint is stale', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('Base', roomId)] })
            const steps = [moveStep(trayId, 'PRESENCE#Base', { host: roomId, presence: parentRemainderKey(roomId) }, { host: otherRoomId, presence: parentRemainderKey(otherRoomId) })]

            expect(applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))).toEqual({ verdict: 'stale', reasonCode: 'hostNotInFootprint' })
        })

        it('a release keeps the last binding, hostless, instead of deleting it', () => {
            const steps: MutationKernelStep[] = [releaseStep(characterId, 'PRESENCE#Base', remainderOf(roomId))]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, roomId)], [roomId, hostHolding(roomId, character(characterId))]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(characterId)!.presenceNodes).toEqual([presenceBindingNode('Base')])
        })

        it('a release folds the binding into a hostless Base, and leaves the Base id', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode(BASE_PRESENCE_ID), presenceBindingNode('a', roomId)] })
            const steps: MutationKernelStep[] = [releaseStep(trayId, 'PRESENCE#a', remainderOf(roomId))]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, hostHolding(roomId, object(trayId))]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes.map(({ universalKey, fromHostPresences }) => [universalKey, fromHostPresences[0]])).toEqual([[BASE_PRESENCE_ID, undefined]])
        })

        it('releasing several placed bindings one by one folds them all into the hostless Base', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode(BASE_PRESENCE_ID), presenceBindingNode('a', roomId), presenceBindingNode('b', otherRoomId)] })
            const steps: MutationKernelStep[] = [
                releaseStep(trayId, 'PRESENCE#a', remainderOf(roomId)),
                releaseStep(trayId, 'PRESENCE#b', remainderOf(otherRoomId)),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, hostHolding(roomId, object(trayId))], [otherRoomId, hostHolding(otherRoomId, object(trayId))]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes.map(({ universalKey, fromHostPresences }) => [universalKey, fromHostPresences[0]])).toEqual([[BASE_PRESENCE_ID, undefined]])
        })

        it('a release keeps the host while another binding of the mover still points there', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('Base', roomId), presenceBindingNode('a2', { host: roomId, presence: 'PRESENCE#second' as any })] })
            const roomGraph = testLudicGraph(roomId, { nodes: [
                object(trayId),
                presenceBindingNode(parentRemainderKey(roomId), undefined, { members: [{ host: trayId, presence: 'PRESENCE#Base' as any }] }),
                presenceBindingNode('second', roomId, { members: [{ host: trayId, presence: 'PRESENCE#a2' as any }] }),
            ] })
            const steps: MutationKernelStep[] = [releaseStep(trayId, 'PRESENCE#Base', remainderOf(roomId))]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(true)
        })

        it.each([
            ['the binding is gone', 'PRESENCE#gone', remainderOf(roomId), 'presenceBindingMissing'],
            ['the binding no longer sits under `from`', 'PRESENCE#Base', remainderOf(otherRoomId), 'presenceBindingMoved'],
        ])('a release is stale when %s', (_label, presence, from, reasonCode) => {
            const steps: MutationKernelStep[] = [releaseStep(trayId, presence, from)]

            expect(applyStepSequenceCore(steps, graphsMap([trayId, moverAt(trayId, roomId)], [roomId, hostHolding(roomId, object(trayId))], [otherRoomId, hostHolding(otherRoomId)]))).toEqual({ verdict: 'stale', reasonCode })
        })

        it('a release whose whole is outside the footprint is stale', () => {
            const steps: MutationKernelStep[] = [releaseStep(trayId, 'PRESENCE#Base', remainderOf(roomId))]

            expect(applyStepSequenceCore(steps, graphsMap())).toEqual({ verdict: 'stale', reasonCode: 'hostNotInFootprint' })
        })

        describe('the end-of-run duplicate validator', () => {
            const parent = remainderOf(roomId)
            const twoUnderOneParent = () => testLudicGraph(trayId, { nodes: [presenceBindingNode('a', parent), presenceBindingNode('b', parent)] })

            it('throws when a run leaves two bindings of one host under the same parent binding', () => {
                // a move into a parent where the mover already holds a binding joins (MC-3), so the way left to
                // leave two is a mint under that parent
                const addB: MutationKernelStep = { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: parent, presenceUuid: 'b' } as MutationKernelStep
                const world = graphsMap(
                    [trayId, testLudicGraph(trayId, { nodes: [presenceBindingNode('a', parent)] })],
                    [roomId, hostHolding(roomId, object(trayId))]
                )

                expect(() => applyStepSequenceCore([addB], world)).toThrow(/under the same parent binding/)
            })

            it('leaves alone a graph the run did not write, even if storage already held the duplicate', () => {
                const world = graphsMap([trayId, twoUnderOneParent()], [roomId, hostHolding(roomId, object(trayId))])

                expect(applyStepSequenceCore([{ kind: 'capture', hostId: roomId, captureId: 'c' } as MutationKernelStep], world, new Map([[roomId, []]])).verdict).toBe('legal')
            })
        })

        describe('the end-of-run coverage validator', () => {
            const addHostless = (presenceUuid: string): MutationKernelStep => ({ kind: 'addPresenceBinding', hostId: trayId, presenceUuid } as MutationKernelStep)

            it('throws when a run leaves a component node covered by none of the whole\'s bindings', () => {
                const bareRoom = testLudicGraph(roomId, { nodes: [presenceBindingNode(parentRemainderKey(roomId), undefined, { members: [] })] })
                // A pointer naming a binding the parent lacks has no cover to index, so the node stays uncovered.
                const step = { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: { host: roomId, presence: 'PRESENCE#gone' }, presenceUuid: 'Base' } as MutationKernelStep

                expect(() => applyStepSequenceCore([step], graphsMap([roomId, bareRoom], [trayId, testLudicGraph(trayId, { nodes: [] })]))).toThrow(/covered by none/)
            })

            it('counts a Remainder as covering every unlisted member', () => {
                const step = { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: remainderOf(roomId), presenceUuid: 'Base' } as MutationKernelStep

                expect(applyStepSequenceCore([step], graphsMap([roomId, hostHolding(roomId)], [trayId, testLudicGraph(trayId, { nodes: [] })])).verdict).toBe('legal')
            })

            it('throws when a run leaves a whole with two hostless bindings', () => {
                const world = graphsMap([trayId, testLudicGraph(trayId, { nodes: [presenceBindingNode('Base')] })])

                expect(() => applyStepSequenceCore([addHostless('p2')], world)).toThrow(/at most one binding with no parent/)
            })

            it('allows two hostless bindings inside a run, when a later step places one', () => {
                const world = graphsMap([trayId, testLudicGraph(trayId, { nodes: [presenceBindingNode('Base')] })], [roomId, hostHolding(roomId)])
                const place = moveStep(trayId, 'PRESENCE#p2', null, remainderOf(roomId))

                expect(applyStepSequenceCore([addHostless('p2'), place], world).verdict).toBe('legal')
            })

            it('leaves alone a graph the run did not write, even if storage already held two hostless bindings', () => {
                const twoHostless = testLudicGraph(trayId, { nodes: [presenceBindingNode('a'), presenceBindingNode('b')] })
                const world = graphsMap([trayId, twoHostless], [roomId, hostHolding(roomId, object(trayId))])

                expect(applyStepSequenceCore([{ kind: 'capture', hostId: roomId, captureId: 'c' } as MutationKernelStep], world, new Map([[roomId, []]])).verdict).toBe('legal')
            })
        })

        it('throws when a sequence would leave a character with two presence bindings --- characters are single-hosted', () => {
            const characterGraph = testLudicGraph(characterId, {
                nodes: [{ tag: 'Presence', universalKey: 'PRESENCE#Base', fromHostPresences: [{ host: roomId, presence: parentRemainderKey(roomId) }], cover: { members: [] } }],
            })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: characterId, fromHostPresence: { host: otherRoomId, presence: parentRemainderKey(otherRoomId) }, presenceUuid: 'p2' },
            ]

            expect(() => applyStepSequenceCore(steps, graphsMap([characterId, characterGraph], [otherRoomId, hostHolding(otherRoomId)]))).toThrow(/AGENT\.contract\.md/)
        })

        it('does not throw when an object carries two presence bindings --- multi-presence is the point for objects', () => {
            const trayGraph = testLudicGraph(trayId, {
                nodes: [{ tag: 'Presence', universalKey: 'PRESENCE#Base', fromHostPresences: [{ host: roomId, presence: parentRemainderKey(roomId) }], cover: { members: [] } }],
            })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: { host: otherRoomId, presence: parentRemainderKey(otherRoomId) }, presenceUuid: 'p2' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [otherRoomId, hostHolding(otherRoomId)]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toHaveLength(2)
        })

        it('addPresenceBinding writes the parent binding the step names, with nothing resolved in the lock', () => {
            const featureGraph = testLudicGraph(featureId, { nodes: [presenceBindingNode('a', roomId), presenceBindingNode('b', otherRoomId)] })
            const trayGraph = testLudicGraph(trayId, { nodes: [] })
            const named = presenceBindingNode('b', otherRoomId).universalKey
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: { host: featureId, presence: named }, presenceUuid: 'Base' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [featureId, featureGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes[0].fromHostPresences).toEqual([{ host: featureId, presence: named }])
        })

        it('addPresenceBinding takes an explicit cover (a room\'s Area carve-out has no members)', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: roomId, fromHostPresence: { host: areaId, presence: parentRemainderKey(areaId) }, cover: { members: [] }, presenceUuid: 'Base' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph], [areaId, hostHolding(areaId)]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.presenceNodes[0].cover).toEqual({ members: [] })
        })
    })

    describe('a move keeps the mover\'s binding id, so its contents\' pointers survive (PR-21(e))', () => {
        // Compiled through the real move compiler, so it fails
        // under the retired remove-then-add, which re-minted the character's binding on every move.
        const cupId = 'OBJECT#Cup' as EphemeraObjectId
        const characterBinding = presenceBindingNode('alpha', roomId)
        const cupGraph = testLudicGraph(cupId, {
            nodes: [presenceBindingNode('cup', { host: characterId, presence: characterBinding.universalKey })],
        })

        it('a character holding a cup navigates: the cup still names a live binding of the character, now under the new room', async () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }, presenceBindingNode(parentRemainderKey(roomId))] })
            const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [presenceBindingNode(parentRemainderKey(otherRoomId))] })
            const characterGraph = testLudicGraph(characterId, { nodes: [characterBinding, { tag: 'Object', universalKey: cupId }] })
            const { steps } = compilePositionKernelOp({ kind: 'move', moved: characterId, froms: [roomId], to: otherRoomId, header: null, presenceMoves: [{ presence: characterBinding.universalKey, from: { host: roomId, presence: parentRemainderKey(roomId) }, to: { host: otherRoomId, presence: parentRemainderKey(otherRoomId) } }] })

            const outcome = applyStepSequenceCore(
                steps.filter(isKernelMutationStep),
                graphsMap([roomId, roomGraph], [otherRoomId, otherRoomGraph], [characterId, characterGraph], [cupId, cupGraph])
            )

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            const getGraph = async (hostId: EphemeraMembershipHostId) => outcome.graphs.get(hostId)!
            const cupPointer = outcome.graphs.get(cupId)!.presenceNodes[0].fromHostPresences[0]
            expect(await parentsOfBinding(characterId, cupPointer.presence!, getGraph)).toEqual([{
                host: otherRoomId,
                presence: parentRemainderKey(otherRoomId),
            }])
            expect(await roomsForPresenceNode(cupId, outcome.graphs.get(cupId)!.presenceNodes[0].universalKey, getGraph)).toEqual(new Set([otherRoomId]))
        })
    })

    describe('repairPresenceBinding', () => {
        const hostOnly = presenceBindingNode('Base', roomId)

        it('moves the cover entry from the old parent binding to the new one', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('first', undefined, { members: [] }), hostOnly] })
            const entry = { host: trayId, presence: hostOnly.universalKey }
            const oldRoom = testLudicGraph(roomId, { nodes: [object(trayId), presenceBindingNode(parentRemainderKey(roomId), undefined, { members: [entry] })] })
            const steps: MutationKernelStep[] = [{
                kind: 'repairPresenceBinding',
                hostId: trayId,
                presenceId: hostOnly.universalKey,
                fromHostPresence: remainderOf(otherRoomId),
                previousParent: remainderOf(roomId),
                cover: { members: [] },
            }]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, oldRoom], [otherRoomId, testLudicGraph(otherRoomId, { nodes: [presenceBindingNode(parentRemainderKey(otherRoomId), undefined, { members: [] })] })]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.presenceNodes[0].cover.members).toEqual([])
            expect(outcome.graphs.get(otherRoomId)!.presenceNodes[0].cover.members).toEqual([entry])
        })

        it('rewrites pointer and cover in place, keeping the binding id and its position', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('first', otherRoomId), hostOnly] })
            const steps: MutationKernelStep[] = [{
                kind: 'repairPresenceBinding',
                hostId: trayId,
                presenceId: hostOnly.universalKey,
                fromHostPresence: { host: roomId, presence: parentRemainderKey(roomId) },
                cover: { members: [] },
            }]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, hostHolding(roomId)]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            // The pointer names the host the mover now sits in, so the node is added there (and only if absent).
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(true)
            const nodes = outcome.graphs.get(trayId)!.presenceNodes
            expect(nodes.map(({ universalKey }) => universalKey)).toEqual([presenceBindingNode('first').universalKey, hostOnly.universalKey])
            expect(nodes[1]).toEqual({
                tag: 'Presence',
                universalKey: hostOnly.universalKey,
                fromHostPresences: [{ host: roomId, presence: parentRemainderKey(roomId) }],
                cover: { members: [] },
            })
        })

        it('adds the node to the pointer\'s host when a correct binding\'s parent lacks it, and a replay changes nothing more', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [hostOnly] })
            const step: MutationKernelStep = {
                kind: 'repairPresenceBinding',
                hostId: trayId,
                presenceId: hostOnly.universalKey,
                fromHostPresence: { host: roomId, presence: parentRemainderKey(roomId) },
                cover: hostOnly.cover,
            }

            const once = applyStepSequenceCore([step], graphsMap([trayId, trayGraph], [roomId, hostHolding(roomId)]))
            expect(once.verdict).toBe('legal')
            if (once.verdict !== 'legal') return
            expect(once.graphs.get(roomId)!.objectIds.has(trayId)).toBe(true)

            const twice = applyStepSequenceCore([step], once.graphs)
            expect(twice.verdict).toBe('legal')
            if (twice.verdict !== 'legal') return
            expect([...twice.graphs.get(roomId)!.objectIds]).toEqual([trayId])
        })

        it('is stale when the pointer\'s host is outside the footprint', () => {
            const steps: MutationKernelStep[] = [{
                kind: 'repairPresenceBinding',
                hostId: trayId,
                presenceId: hostOnly.universalKey,
                fromHostPresence: { host: roomId, presence: parentRemainderKey(roomId) },
                cover: hostOnly.cover,
            }]

            expect(applyStepSequenceCore(steps, graphsMap([trayId, testLudicGraph(trayId, { nodes: [hostOnly] })]))).toEqual({
                verdict: 'stale',
                reasonCode: 'hostNotInFootprint',
            })
        })

        it('is stale when the binding is missing: a repair never creates one', () => {
            const steps: MutationKernelStep[] = [{
                kind: 'repairPresenceBinding',
                hostId: trayId,
                presenceId: hostOnly.universalKey,
                cover: { members: [] },
            }]

            expect(applyStepSequenceCore(steps, graphsMap([trayId, testLudicGraph(trayId, { nodes: [] })]))).toEqual({
                verdict: 'stale',
                reasonCode: 'presenceBindingMissing',
            })
        })

        it('is stale when the host is outside the footprint', () => {
            const steps: MutationKernelStep[] = [{
                kind: 'repairPresenceBinding',
                hostId: trayId,
                presenceId: hostOnly.universalKey,
                cover: { members: [] },
            }]

            expect(applyStepSequenceCore(steps, graphsMap())).toEqual({ verdict: 'stale', reasonCode: 'hostNotInFootprint' })
        })
    })
})
