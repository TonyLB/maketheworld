import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { applyStepSequenceCore } from './applyStepSequenceCore'
import type { MutationKernelStep } from './kernelStep'
import { isKernelMutationStep } from './kernelStep'
import { compilePositionKernelOp } from './compile/compilePositionKernelOp'
import { parentBinding } from '../../ludicGraph/presenceParent'
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
const moverAt = (moverId: EphemeraMembershipHostId, host: EphemeraMembershipHostId, name = 'p1') => (
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
): MutationKernelStep => ({ kind: 'releasePresenceBinding', hostId, presence, from } as MutationKernelStep)

describe('applyStepSequenceCore', () => {
    it('explicit dissolveRelation before a move composes correctly', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [
                { tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' },
            ],
        })
        const destGraph = hostHolding(characterId)
        const steps: MutationKernelStep[] = [
            { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, hostId: roomId, relationKind: 'Custom', relationLabel: 'tied to' },
            moveStep(trayId, 'PRESENCE#p1', remainderOf(roomId), remainderOf(characterId)),
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
            moveStep(trayId, 'PRESENCE#p1', remainderOf(roomId), remainderOf(characterId)),
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
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const otherGraph = testLudicGraph(otherRoomId, { nodes: [{ tag: 'Object', universalKey: glassId }] })
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
            moveStep(trayId, 'PRESENCE#p1', remainderOf(roomId), { host: tableId, presence: 'PRESENCE#table-root' }),
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
            moveStep(trayId, 'PRESENCE#p1', remainderOf(roomId), remainderOf(characterId)),
        ]
        expect(applyStepSequenceCore(steps, graphsMap([characterId, hostHolding(characterId)], [trayId, moverAt(trayId, roomId)]))).toEqual({
            verdict: 'stale',
            reasonCode: 'hostNotInFootprint',
        })
    })

    it('stale (staleTransferCandidate, object): object absent from the host the move leaves', () => {
        const steps: MutationKernelStep[] = [
            moveStep(trayId, 'PRESENCE#p1', remainderOf(roomId), remainderOf(characterId)),
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, hostHolding(roomId)], [characterId, hostHolding(characterId)], [trayId, moverAt(trayId, roomId)]))).toEqual({
            verdict: 'stale',
            reasonCode: 'staleTransferCandidate',
        })
    })

    it('illegal (staleRelationalCandidate): a relational step endpoint unresolvable across the footprint graphs', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
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
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' }],
        })
        const steps: MutationKernelStep[] = [
            moveStep(trayId, 'PRESENCE#p1', remainderOf(roomId), remainderOf(characterId)),
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
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'against' }],
        })
        // Bug-injection: no paired dissolveRelation step for the tray-table edge.
        const steps: MutationKernelStep[] = [
            moveStep(trayId, 'PRESENCE#p1', remainderOf(roomId), remainderOf(characterId)),
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
                moveStep(characterId, 'PRESENCE#p1', remainderOf(roomId), remainderOf(otherRoomId)),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, roomId)]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect([...outcome.graphs.keys()]).toEqual([characterId])
            expect(outcome.graphs.get(characterId)!.presenceNodes).toEqual([presenceBindingNode('p1', otherRoomId)])
        })

        it('a character move does not confirm the destination binding (pointers govern)', () => {
            const steps: MutationKernelStep[] = [
                moveStep(characterId, 'PRESENCE#p1', remainderOf(roomId), remainderOf(otherRoomId)),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, roomId)], [otherRoomId, testLudicGraph(otherRoomId, { nodes: [] })]))

            expect(outcome.verdict).toBe('legal')
        })

        it("the mover's own binding check still gates a move: a binding that no longer sits under `from` is stale", () => {
            const steps: MutationKernelStep[] = [
                moveStep(characterId, 'PRESENCE#p1', remainderOf(roomId), remainderOf(otherRoomId)),
            ]

            expect(applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, otherRoomId)]))).toEqual({
                verdict: 'stale',
                reasonCode: 'presenceBindingMoved',
            })
        })

        it('a character release (disconnect-shaped) keeps its binding hostless and writes no room graph', () => {
            const steps: MutationKernelStep[] = [releaseStep(characterId, 'PRESENCE#p1', remainderOf(roomId))]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, roomId)]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(characterId)!.presenceNodes).toEqual([presenceBindingNode('p1')])
        })

        it('a first placement (from: null, connect-shaped) writes the mover only', () => {
            const steps: MutationKernelStep[] = [moveStep(characterId, 'PRESENCE#p1', null, remainderOf(roomId))]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, testLudicGraph(characterId, { nodes: [presenceBindingNode('p1')] })]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect([...outcome.graphs.keys()]).toEqual([characterId])
            expect(outcome.graphs.get(characterId)!.presenceNodes).toEqual([presenceBindingNode('p1', roomId)])
        })

        it('a character release is stale (presenceBindingMoved) when the binding no longer sits under the room', () => {
            const steps: MutationKernelStep[] = [releaseStep(characterId, 'PRESENCE#p1', remainderOf(roomId))]
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
            [trayId, testLudicGraph(trayId, { nodes: [presenceBindingNode('a', roomId), presenceBindingNode('b', otherRoomId)] })]
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
                ],
                edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' }],
            })
            // Bug-injection: no paired dissolveRelation step for the tray-table edge.
            const steps: MutationKernelStep[] = [releaseStep(trayId, 'PRESENCE#p1', remainderOf(roomId))]

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
                ],
                edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'On' }],
            })
            const steps: MutationKernelStep[] = [
                { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, hostId: roomId, relationKind: 'On' },
                releaseStep(trayId, 'PRESENCE#p1', remainderOf(roomId)),
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
            const steps: MutationKernelStep[] = [
                moveStep(trayId, 'PRESENCE#a', remainderOf(roomId), remainderOf(otherRoomId)),
                { kind: 'joinPresenceBindings', hostId: trayId, survivor: 'PRESENCE#a' as any, absorbed: 'PRESENCE#b' as any, absorbedCover: { members: [{ tag: 'Remainder' }] } },
            ]

            const outcome = applyStepSequenceCore(steps, twoRooms())

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(false)
            expect(outcome.graphs.get(otherRoomId)!.objectIds.has(trayId)).toBe(true)
        })

        it('a release is stale (staleTransferCandidate) when the object is already absent from the host', () => {
            const steps: MutationKernelStep[] = [releaseStep(trayId, 'PRESENCE#p1', remainderOf(roomId))]
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

            const outcome = applyStepSequenceCore([releaseStep(trayId, 'PRESENCE#p1', remainderOf(roomId))], graphs)

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(otherRoomId)!.objectIds.has(trayId)).toBe(true)
        })
    })

    describe('Room/Feature membership comes with the binding step that points at the parent', () => {
        it('addPresenceBinding with a pointer adds a Room to an Area host', () => {
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: roomId, fromHostPresence: { host: areaId, presence: parentRemainderKey(areaId) }, cover: { members: [] }, presenceUuid: 'p1' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([areaId, testLudicGraph(areaId, { nodes: [] })], [roomId, testLudicGraph(roomId, { nodes: [] })]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(areaId)!.roomIds.has(roomId)).toBe(true)
        })

        it('addPresenceBinding with a pointer adds a Feature to a Room host', () => {
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: featureId, fromHostPresence: { host: roomId, presence: parentRemainderKey(roomId) }, presenceUuid: 'p1' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, testLudicGraph(roomId, { nodes: [] })], [featureId, testLudicGraph(featureId, { nodes: [] })]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.featureIds.has(featureId)).toBe(true)
        })

        it('replaying a population step is harmless: a Room already a node of its Area stays one node', () => {
            const areaGraph = testLudicGraph(areaId, { nodes: [{ tag: 'Room', universalKey: roomId }] })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: roomId, fromHostPresence: { host: areaId, presence: parentRemainderKey(areaId) }, cover: { members: [] }, presenceUuid: 'p1' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([areaId, areaGraph], [roomId, testLudicGraph(roomId, { nodes: [] })]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect([...outcome.graphs.get(areaId)!.roomIds]).toEqual([roomId])
        })

        it('a Room never relocates: releasing its binding at an Area is a caller bug and throws', () => {
            const areaGraph = testLudicGraph(areaId, { nodes: [{ tag: 'Room', universalKey: roomId }] })
            const roomGraph = testLudicGraph(roomId, { nodes: [presenceBindingNode('p1', areaId)] })
            const steps: MutationKernelStep[] = [releaseStep(roomId, 'PRESENCE#p1', remainderOf(areaId))]

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
                ],
            })
            const tableGraph = testLudicGraph(tableId, {
                nodes: [
                    { tag: 'Object', universalKey: tableId },
                    { tag: 'Object', universalKey: glassId },
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
                moveStep(characterId, 'PRESENCE#p1', remainderOf(roomId), remainderOf(otherRoomId)),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, roomId)]), occupantsOf([roomId, [characterId]], [otherRoomId, []]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.captures.get('before')).toEqual([characterId])
        })

        it('the same capture placed after the mutation does not see the entity, and the destination does', () => {
            const steps: MutationKernelStep[] = [
                moveStep(characterId, 'PRESENCE#p1', remainderOf(roomId), remainderOf(otherRoomId)),
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
            const roomGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
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
            presenceUuid: 'born',
            meta: { EphemeraId: trayId, DataCategory: 'Meta::Object', stableKey: 'tray' },
        }

        it('creates the host holding exactly one hostless remainder', () => {
            const outcome = applyStepSequenceCore([createTray], new Map())

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('born')])
        })

        it('a placement later in the same sequence re-points that remainder, keeping its id', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [presenceBindingNode(parentRemainderKey(roomId))] })
            const steps: MutationKernelStep[] = [
                createTray,
                ...compilePositionKernelOp({ kind: 'move', moved: trayId, froms: [], to: roomId, header: null, presenceMoves: [{ presence: 'PRESENCE#born' as any, from: null, to: { host: roomId, presence: parentRemainderKey(roomId) } }] })
                    .steps.filter(isKernelMutationStep),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('born', roomId)])
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
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('born')] })

            const outcome = applyStepSequenceCore([destroyTray], graphsMap([trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.has(trayId)).toBe(false)
        })

        it('after a release, the same sequence destroys the host; the room no longer holds it', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }, presenceBindingNode(parentRemainderKey(roomId))] })
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('p1', roomId)] })
            const steps: MutationKernelStep[] = [
                ...compilePositionKernelOp({ kind: 'move', moved: trayId, froms: [roomId], to: null, header: null, presenceMoves: [{ presence: 'PRESENCE#p1' as any, from: { host: roomId, presence: parentRemainderKey(roomId) }, to: null }] })
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
            const trayGraph = testLudicGraph(trayId, { nodes: [{ tag: 'Object', universalKey: tableId }] })

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

    describe('presence binding steps (addPresenceBinding/movePresenceBinding/releasePresenceBinding)', () => {
        // presenceNodes Slice 7a (PN-23): these steps mint/remove the presence NODE directly ---
        // there is no port record any more, so `.ports` is untouched by any of this and only
        // `.presenceNodes`/`.toStored().nodes` reflects the binding.
        it('addPresenceBinding mints a presence node carrying the parent pointer, sole remainder by default', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: { host: roomId, presence: parentRemainderKey(roomId) }, presenceUuid: 'p1' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, testLudicGraph(roomId, { nodes: [] })]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(true)
            expect(outcome.graphs.get(trayId)!.toStored().nodes).toEqual(
                expect.arrayContaining([{
                    tag: 'Presence',
                    universalKey: 'PRESENCE#p1',
                    fromHostPresence: { host: roomId, presence: parentRemainderKey(roomId) },
                    cover: { members: [{ tag: 'Remainder' }] },
                }])
            )
        })

        it('a move re-points the named binding in place: same id and cover, pointer at the destination\'s binding', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('p1', roomId)] })
            const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [presenceBindingNode(parentRemainderKey(otherRoomId))] })
            const steps = [
                moveStep(trayId, 'PRESENCE#p1', { host: roomId, presence: parentRemainderKey(roomId) }, { host: otherRoomId, presence: parentRemainderKey(otherRoomId) }),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, hostHolding(roomId, object(trayId))], [otherRoomId, otherRoomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('p1', otherRoomId)])
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
            const characterGraph = testLudicGraph(characterId, { nodes: [presenceBindingNode('p1')] })
            const roomGraph = testLudicGraph(roomId, { nodes: [presenceBindingNode(parentRemainderKey(roomId))] })
            const steps = [moveStep(characterId, 'PRESENCE#p1', null, { host: roomId, presence: parentRemainderKey(roomId) })]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, characterGraph], [roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(characterId)!.presenceNodes).toEqual([presenceBindingNode('p1', roomId)])
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
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('p1', { host: tableId, presence: 'PRESENCE#left' as any })] })
            const tableGraph = testLudicGraph(tableId, { nodes: [{ tag: 'Object', universalKey: trayId }, presenceBindingNode('left', roomId), presenceBindingNode('right', roomId)] })
            const steps = [moveStep(trayId, 'PRESENCE#p1', { host: tableId, presence: 'PRESENCE#left' }, { host: tableId, presence: 'PRESENCE#right' })]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [tableId, tableGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('p1', { host: tableId, presence: 'PRESENCE#right' as any })])
            expect(outcome.graphs.get(tableId)).toBe(tableGraph)
        })

        it.each([
            ['the named binding is gone', 'PRESENCE#gone', { host: roomId, presence: parentRemainderKey(roomId) }, parentRemainderKey(otherRoomId), 'presenceBindingMissing'],
            ['the binding no longer sits under `from`', 'PRESENCE#p1', { host: otherRoomId, presence: parentRemainderKey(otherRoomId) }, parentRemainderKey(otherRoomId), 'presenceBindingMoved'],
            ['`from: null` but the binding is placed', 'PRESENCE#p1', null, parentRemainderKey(otherRoomId), 'presenceBindingMoved'],
            ['the destination binding is gone', 'PRESENCE#p1', { host: roomId, presence: parentRemainderKey(roomId) }, 'PRESENCE#gone', 'destinationBindingMissing'],
        ])('a move is stale when %s', (_label, presence, from, toPresence, reasonCode) => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('p1', roomId)] })
            const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [presenceBindingNode(parentRemainderKey(otherRoomId))] })
            const steps = [moveStep(trayId, presence, from, { host: otherRoomId, presence: toPresence })]

            expect(applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [otherRoomId, otherRoomGraph]))).toEqual({ verdict: 'stale', reasonCode })
        })

        it('a move whose destination host is outside the footprint is stale', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('p1', roomId)] })
            const steps = [moveStep(trayId, 'PRESENCE#p1', { host: roomId, presence: parentRemainderKey(roomId) }, { host: otherRoomId, presence: parentRemainderKey(otherRoomId) })]

            expect(applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))).toEqual({ verdict: 'stale', reasonCode: 'hostNotInFootprint' })
        })

        it('a release keeps the last binding, hostless, instead of deleting it', () => {
            const steps: MutationKernelStep[] = [releaseStep(characterId, 'PRESENCE#p1', remainderOf(roomId))]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, moverAt(characterId, roomId)], [roomId, hostHolding(roomId, character(characterId))]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(characterId)!.presenceNodes).toEqual([presenceBindingNode('p1')])
        })

        it('a release removes the binding when another remains, and leaves the other untouched', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('root'), presenceBindingNode('a', roomId)] })
            const steps: MutationKernelStep[] = [releaseStep(trayId, 'PRESENCE#a', remainderOf(roomId))]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, hostHolding(roomId, object(trayId))]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('root')])
        })

        it('releasing several placed bindings one by one leaves the last, hostless', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('a', roomId), presenceBindingNode('b', otherRoomId)] })
            const steps: MutationKernelStep[] = [
                releaseStep(trayId, 'PRESENCE#a', remainderOf(roomId)),
                releaseStep(trayId, 'PRESENCE#b', remainderOf(otherRoomId)),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, hostHolding(roomId, object(trayId))], [otherRoomId, hostHolding(otherRoomId, object(trayId))]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('b')])
        })

        it('a release keeps the host while another binding of the mover still points there', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('a', roomId), presenceBindingNode('a2', roomId)] })
            const steps: MutationKernelStep[] = [releaseStep(trayId, 'PRESENCE#a', remainderOf(roomId))]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, hostHolding(roomId, object(trayId))]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(true)
        })

        it.each([
            ['the binding is gone', 'PRESENCE#gone', remainderOf(roomId), 'presenceBindingMissing'],
            ['the binding no longer sits under `from`', 'PRESENCE#p1', remainderOf(otherRoomId), 'presenceBindingMoved'],
        ])('a release is stale when %s', (_label, presence, from, reasonCode) => {
            const steps: MutationKernelStep[] = [releaseStep(trayId, presence, from)]

            expect(applyStepSequenceCore(steps, graphsMap([trayId, moverAt(trayId, roomId)], [roomId, hostHolding(roomId, object(trayId))], [otherRoomId, hostHolding(otherRoomId)]))).toEqual({ verdict: 'stale', reasonCode })
        })

        it('a release whose whole is outside the footprint is stale', () => {
            const steps: MutationKernelStep[] = [releaseStep(trayId, 'PRESENCE#p1', remainderOf(roomId))]

            expect(applyStepSequenceCore(steps, graphsMap())).toEqual({ verdict: 'stale', reasonCode: 'hostNotInFootprint' })
        })

        describe('a join', () => {
            const parent = remainderOf(roomId)
            const tableBinding = { host: tableId, presence: 'PRESENCE#B' as const }
            const glassEntry = { host: glassId, presence: 'PRESENCE#g1' }
            const trayEntry = { host: trayId, presence: 'PRESENCE#t1' }
            const withRemainder = (...entries: { host: string; presence: string }[]) => ({ members: [...entries, { tag: 'Remainder' as const }] })
            const onlyEntries = (...entries: { host: string; presence: string }[]) => ({ members: [...entries] })
            const stale = (reasonCode: string) => ({ verdict: 'stale', reasonCode })

            const worldOf = (survivorCover: { members: any[] }, absorbedCover: { members: any[] }, absorbedParent = parent) => graphsMap(
                [tableId, testLudicGraph(tableId, { nodes: [object(glassId), object(trayId), presenceBindingNode('B', parent, survivorCover as any), presenceBindingNode('B2', absorbedParent, absorbedCover as any)] })],
                [glassId, testLudicGraph(glassId, { nodes: [presenceBindingNode('g1', tableBinding)] })],
                [trayId, testLudicGraph(trayId, { nodes: [presenceBindingNode('t1', { host: tableId, presence: 'PRESENCE#B2' })] })]
            )
            const joinStep = (absorbedCover: { members: any[] }): MutationKernelStep => (
                { kind: 'joinPresenceBindings', hostId: tableId, survivor: 'PRESENCE#B', absorbed: 'PRESENCE#B2', absorbedCover } as MutationKernelStep
            )

            it('folds the absorbed binding into the survivor, merges the Remainder, and re-points the absorbed children', () => {
                const outcome = applyStepSequenceCore(
                    [joinStep(withRemainder(trayEntry))],
                    worldOf(onlyEntries(glassEntry), withRemainder(trayEntry))
                )

                expect(outcome.verdict).toBe('legal')
                if (outcome.verdict !== 'legal') return
                expect(outcome.graphs.get(tableId)!.presenceNodes).toEqual([
                    { tag: 'Presence', universalKey: 'PRESENCE#B', fromHostPresence: parent, cover: withRemainder(glassEntry, trayEntry) },
                ])
                expect(outcome.graphs.get(trayId)!.presenceNodes[0].fromHostPresence).toEqual(tableBinding)
                expect(outcome.graphs.get(glassId)!.presenceNodes[0].fromHostPresence).toEqual(tableBinding)
            })

            it('round-trips a split: split then join returns the original cover and pointers', () => {
                const original = withRemainder(glassEntry, trayEntry)
                const outcome = applyStepSequenceCore(
                    [
                        { kind: 'splitPresenceBinding', hostId: tableId, presence: 'PRESENCE#B', splitInto: [{ presence: 'PRESENCE#B', cover: withRemainder(glassEntry) }, { presence: 'PRESENCE#B2', cover: onlyEntries(trayEntry) }] } as MutationKernelStep,
                        joinStep(onlyEntries(trayEntry)),
                    ],
                    graphsMap(
                        [tableId, testLudicGraph(tableId, { nodes: [object(glassId), object(trayId), presenceBindingNode('B', parent, original as any)] })],
                        [glassId, testLudicGraph(glassId, { nodes: [presenceBindingNode('g1', tableBinding)] })],
                        [trayId, testLudicGraph(trayId, { nodes: [presenceBindingNode('t1', tableBinding)] })]
                    )
                )

                expect(outcome.verdict).toBe('legal')
                if (outcome.verdict !== 'legal') return
                expect(outcome.graphs.get(tableId)!.presenceNodes).toEqual([
                    { tag: 'Presence', universalKey: 'PRESENCE#B', fromHostPresence: parent, cover: original },
                ])
                expect(outcome.graphs.get(trayId)!.presenceNodes[0].fromHostPresence).toEqual(tableBinding)
            })

            it('is stale when the bindings sit under different parents', () => {
                expect(applyStepSequenceCore([joinStep(onlyEntries(trayEntry))], worldOf(onlyEntries(glassEntry), onlyEntries(trayEntry), remainderOf(otherRoomId)))).toEqual(stale('joinParentsDiffer'))
            })

            it('is stale when the absorbed cover is not the one the producer planned against', () => {
                expect(applyStepSequenceCore([joinStep(onlyEntries())], worldOf(onlyEntries(glassEntry), onlyEntries(trayEntry)))).toEqual(stale('joinCoverChanged'))
            })

            it('is stale when a binding is gone, the whole is outside the footprint, or a child has moved on', () => {
                const world = worldOf(onlyEntries(glassEntry), onlyEntries(trayEntry))
                const missing = { ...joinStep(onlyEntries(trayEntry)), absorbed: 'PRESENCE#nope' } as MutationKernelStep
                const noTray = new Map(world)
                noTray.delete(trayId)
                const movedChild = new Map(world).set(trayId, testLudicGraph(trayId, { nodes: [presenceBindingNode('t1', tableBinding)] }))

                expect(applyStepSequenceCore([missing], world)).toEqual(stale('presenceBindingMissing'))
                expect(applyStepSequenceCore([joinStep(onlyEntries(trayEntry))], new Map())).toEqual(stale('hostNotInFootprint'))
                expect(applyStepSequenceCore([joinStep(onlyEntries(trayEntry))], noTray)).toEqual(stale('hostNotInFootprint'))
                expect(applyStepSequenceCore([joinStep(onlyEntries(trayEntry))], movedChild)).toEqual(stale('presenceBindingMoved'))
            })

            it('throws when a child held a binding under each joined binding (the handler only re-points; PM-2)', () => {
                const world = graphsMap(
                    [tableId, testLudicGraph(tableId, { nodes: [object(trayId), presenceBindingNode('B', parent, onlyEntries(trayEntry) as any), presenceBindingNode('B2', parent, onlyEntries({ host: trayId, presence: 'PRESENCE#t2' }) as any)] })],
                    [trayId, testLudicGraph(trayId, { nodes: [presenceBindingNode('t1', tableBinding), presenceBindingNode('t2', { host: tableId, presence: 'PRESENCE#B2' })] })]
                )

                expect(() => applyStepSequenceCore([joinStep(onlyEntries({ host: trayId, presence: 'PRESENCE#t2' }))], world)).toThrow(/under the same parent binding/)
            })
        })

        describe('the end-of-run duplicate validator', () => {
            const parent = remainderOf(roomId)
            const twoUnderOneParent = () => testLudicGraph(trayId, { nodes: [presenceBindingNode('a', parent), presenceBindingNode('b', parent)] })

            it('throws when a run leaves two bindings of one whole under the same parent binding', () => {
                const moveB: MutationKernelStep = { kind: 'movePresenceBinding', hostId: trayId, presence: 'PRESENCE#b' as any, from: remainderOf(otherRoomId), to: parent as any }
                const world = graphsMap(
                    [trayId, testLudicGraph(trayId, { nodes: [presenceBindingNode('a', parent), presenceBindingNode('b', remainderOf(otherRoomId))] })],
                    [roomId, hostHolding(roomId, object(trayId))],
                    [otherRoomId, hostHolding(otherRoomId, object(trayId))]
                )

                expect(() => applyStepSequenceCore([moveB], world)).toThrow(/under the same parent binding/)
            })

            it('leaves alone a graph the run did not write, even if storage already held the duplicate', () => {
                const world = graphsMap([trayId, twoUnderOneParent()], [roomId, hostHolding(roomId, object(trayId))])

                expect(applyStepSequenceCore([{ kind: 'capture', hostId: roomId, captureId: 'c' } as MutationKernelStep], world, new Map([[roomId, []]])).verdict).toBe('legal')
            })
        })

        describe('a split', () => {
            const parent = remainderOf(roomId)
            const tableBinding = { host: tableId, presence: 'PRESENCE#B' as const }
            const glassEntry = { host: glassId, presence: 'PRESENCE#g1' }
            const trayEntry = { host: trayId, presence: 'PRESENCE#t1' }
            const withRemainder = (...entries: { host: string; presence: string }[]) => ({ members: [...entries, { tag: 'Remainder' as const }] })
            const onlyEntries = (...entries: { host: string; presence: string }[]) => ({ members: [...entries] })

            const worldOf = (cover: { members: any[] }) => graphsMap(
                [tableId, testLudicGraph(tableId, { nodes: [object(glassId), object(trayId), presenceBindingNode('B', parent, cover as any)] })],
                [glassId, testLudicGraph(glassId, { nodes: [presenceBindingNode('g1', tableBinding)] })],
                [trayId, testLudicGraph(trayId, { nodes: [presenceBindingNode('t1', tableBinding)] })],
                [roomId, hostHolding(roomId, object(tableId))],
                [otherRoomId, hostHolding(otherRoomId)]
            )
            // a split's new bindings share the original's parent, which may not outlive the run: move the new one away
            const moveAway: MutationKernelStep = { kind: 'movePresenceBinding', hostId: tableId, presence: 'PRESENCE#B2' as any, from: parent as any, to: remainderOf(otherRoomId) as any }
            const splitStep = (splitInto: { presence: string; cover: { members: any[] } }[]): MutationKernelStep => (
                { kind: 'splitPresenceBinding', hostId: tableId, presence: 'PRESENCE#B', splitInto } as MutationKernelStep
            )
            const stale = (reasonCode: string) => ({ verdict: 'stale', reasonCode })

            it('keeps the original binding (and the Remainder), adds a sibling under the same parent, and re-points only the moved child', () => {
                const outcome = applyStepSequenceCore(
                    [splitStep([{ presence: 'PRESENCE#B', cover: withRemainder(glassEntry) }, { presence: 'PRESENCE#B2', cover: onlyEntries(trayEntry) }]), moveAway],
                    worldOf(withRemainder(glassEntry, trayEntry))
                )

                expect(outcome.verdict).toBe('legal')
                if (outcome.verdict !== 'legal') return
                expect(outcome.graphs.get(tableId)!.presenceNodes).toEqual([
                    { tag: 'Presence', universalKey: 'PRESENCE#B', fromHostPresence: parent, cover: withRemainder(glassEntry) },
                    { tag: 'Presence', universalKey: 'PRESENCE#B2', fromHostPresence: remainderOf(otherRoomId), cover: onlyEntries(trayEntry) },
                ])
                expect(outcome.graphs.get(trayId)!.presenceNodes[0].fromHostPresence).toEqual({ host: tableId, presence: 'PRESENCE#B2' })
                expect(outcome.graphs.get(glassId)!.presenceNodes[0].fromHostPresence).toEqual(tableBinding)
            })

            it('splits a binding that held no Remainder without giving any result one', () => {
                const outcome = applyStepSequenceCore(
                    [splitStep([{ presence: 'PRESENCE#B', cover: onlyEntries(glassEntry) }, { presence: 'PRESENCE#B2', cover: onlyEntries(trayEntry) }]), moveAway],
                    worldOf(onlyEntries(glassEntry, trayEntry))
                )

                expect(outcome.verdict).toBe('legal')
            })

            it.each([
                ['a Remainder given to a new binding', [{ presence: 'PRESENCE#B', cover: withRemainder(glassEntry) }, { presence: 'PRESENCE#B2', cover: withRemainder(trayEntry) }], withRemainder(glassEntry, trayEntry), 'splitRemainderMoved'],
                ['a Remainder dropped from the original', [{ presence: 'PRESENCE#B', cover: onlyEntries(glassEntry) }, { presence: 'PRESENCE#B2', cover: onlyEntries(trayEntry) }], withRemainder(glassEntry, trayEntry), 'splitRemainderMoved'],
                ['a Remainder added where the original had none', [{ presence: 'PRESENCE#B', cover: withRemainder(glassEntry) }, { presence: 'PRESENCE#B2', cover: onlyEntries(trayEntry) }], onlyEntries(glassEntry, trayEntry), 'splitRemainderMoved'],
                ['a member in two results', [{ presence: 'PRESENCE#B', cover: onlyEntries(glassEntry, trayEntry) }, { presence: 'PRESENCE#B2', cover: onlyEntries(trayEntry) }], onlyEntries(glassEntry, trayEntry), 'splitNotDisjoint'],
                ['an entry the original did not cover', [{ presence: 'PRESENCE#B', cover: onlyEntries(glassEntry) }, { presence: 'PRESENCE#B2', cover: onlyEntries(trayEntry) }], onlyEntries(glassEntry), 'splitEntryNotCovered'],
                ['a member dropped from every result', [{ presence: 'PRESENCE#B', cover: onlyEntries(glassEntry) }, { presence: 'PRESENCE#B2', cover: onlyEntries() }], onlyEntries(glassEntry, trayEntry), 'splitMemberLost'],
                ['no result carrying the original id', [{ presence: 'PRESENCE#B2', cover: onlyEntries(glassEntry, trayEntry) }], onlyEntries(glassEntry, trayEntry), 'splitIdCollision'],
                ['a minted id the whole already holds', [{ presence: 'PRESENCE#B', cover: onlyEntries(glassEntry) }, { presence: 'PRESENCE#B', cover: onlyEntries(trayEntry) }], onlyEntries(glassEntry, trayEntry), 'splitIdCollision'],
            ])('refuses %s', (_label, splitInto, cover, reasonCode) => {
                expect(applyStepSequenceCore([splitStep(splitInto)], worldOf(cover))).toEqual(stale(reasonCode))
            })

            it('is stale when the binding is gone, the whole is outside the footprint, or a child is', () => {
                const splitInto = [{ presence: 'PRESENCE#B', cover: onlyEntries(glassEntry) }, { presence: 'PRESENCE#B2', cover: onlyEntries(trayEntry) }]
                const world = worldOf(onlyEntries(glassEntry, trayEntry))
                const missingBinding = { ...splitStep(splitInto), presence: 'PRESENCE#nope' } as MutationKernelStep
                const noTray = new Map(world)
                noTray.delete(trayId)

                expect(applyStepSequenceCore([missingBinding], world)).toEqual(stale('presenceBindingMissing'))
                expect(applyStepSequenceCore([splitStep(splitInto)], graphsMap())).toEqual(stale('hostNotInFootprint'))
                expect(applyStepSequenceCore([splitStep(splitInto)], noTray)).toEqual(stale('hostNotInFootprint'))
            })

            it('is stale when a moved child no longer sits under the split binding, or has lost its binding', () => {
                const splitInto = [{ presence: 'PRESENCE#B', cover: onlyEntries(glassEntry) }, { presence: 'PRESENCE#B2', cover: onlyEntries(trayEntry) }]
                const moved = worldOf(onlyEntries(glassEntry, trayEntry))
                moved.set(trayId, testLudicGraph(trayId, { nodes: [presenceBindingNode('t1', { host: tableId, presence: 'PRESENCE#other' })] }))
                const unbound = worldOf(onlyEntries(glassEntry, trayEntry))
                unbound.set(trayId, testLudicGraph(trayId, { nodes: [] }))

                expect(applyStepSequenceCore([splitStep(splitInto)], moved)).toEqual(stale('presenceBindingMoved'))
                expect(applyStepSequenceCore([splitStep(splitInto)], unbound)).toEqual(stale('presenceBindingMissing'))
            })

            it('leaves no host\'s membership changed', () => {
                const world = worldOf(withRemainder(glassEntry, trayEntry))
                const outcome = applyStepSequenceCore(
                    [splitStep([{ presence: 'PRESENCE#B', cover: withRemainder(glassEntry) }, { presence: 'PRESENCE#B2', cover: onlyEntries(trayEntry) }]), moveAway],
                    world
                )

                expect(outcome.verdict).toBe('legal')
                if (outcome.verdict !== 'legal') return
                expect([...outcome.graphs.get(tableId)!.objectIds]).toEqual([...world.get(tableId)!.objectIds])
            })
        })

        it('throws when a sequence would leave a character with two presence bindings --- characters are single-hosted', () => {
            const characterGraph = testLudicGraph(characterId, {
                nodes: [{ tag: 'Presence', universalKey: 'PRESENCE#p1', fromHostPresence: { host: roomId, presence: parentRemainderKey(roomId) }, cover: { members: [{ tag: 'Remainder' }] } }],
            })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: characterId, fromHostPresence: { host: otherRoomId, presence: parentRemainderKey(otherRoomId) }, presenceUuid: 'p2' },
            ]

            expect(() => applyStepSequenceCore(steps, graphsMap([characterId, characterGraph], [otherRoomId, hostHolding(otherRoomId)]))).toThrow(/AGENT\.contract\.md/)
        })

        it('does not throw when an object carries two presence bindings --- multi-presence is the point for objects', () => {
            const trayGraph = testLudicGraph(trayId, {
                nodes: [{ tag: 'Presence', universalKey: 'PRESENCE#p1', fromHostPresence: { host: roomId, presence: parentRemainderKey(roomId) }, cover: { members: [{ tag: 'Remainder' }] } }],
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
                { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: { host: featureId, presence: named }, presenceUuid: 'p1' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [featureId, featureGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes[0].fromHostPresence).toEqual({ host: featureId, presence: named })
        })

        it('addPresenceBinding takes an explicit cover (a room\'s Area carve-out has no members)', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: roomId, fromHostPresence: { host: areaId, presence: parentRemainderKey(areaId) }, cover: { members: [] }, presenceUuid: 'p1' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph], [areaId, testLudicGraph(areaId, { nodes: [] })]))

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
            const cupPointer = outcome.graphs.get(cupId)!.presenceNodes[0].fromHostPresence!
            expect(await parentBinding(characterId, cupPointer.presence!, getGraph)).toEqual({
                host: otherRoomId,
                presence: parentRemainderKey(otherRoomId),
            })
            expect(await roomsForPresenceNode(cupId, outcome.graphs.get(cupId)!.presenceNodes[0].universalKey, getGraph)).toEqual(new Set([otherRoomId]))
        })
    })

    describe('repairPresenceBinding', () => {
        const hostOnly = presenceBindingNode('p1', roomId)

        it('rewrites pointer and cover in place, keeping the binding id and its position', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('first', otherRoomId), hostOnly] })
            const steps: MutationKernelStep[] = [{
                kind: 'repairPresenceBinding',
                hostId: trayId,
                presenceId: hostOnly.universalKey,
                fromHostPresence: { host: roomId, presence: 'PRESENCE#room-remainder' },
                cover: { members: [] },
            }]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, testLudicGraph(roomId, { nodes: [] })]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            // The pointer names the host the mover now sits in, so the node is added there (and only if absent).
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(true)
            const nodes = outcome.graphs.get(trayId)!.presenceNodes
            expect(nodes.map(({ universalKey }) => universalKey)).toEqual([presenceBindingNode('first').universalKey, hostOnly.universalKey])
            expect(nodes[1]).toEqual({
                tag: 'Presence',
                universalKey: hostOnly.universalKey,
                fromHostPresence: { host: roomId, presence: 'PRESENCE#room-remainder' },
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

            const once = applyStepSequenceCore([step], graphsMap([trayId, trayGraph], [roomId, testLudicGraph(roomId, { nodes: [] })]))
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
