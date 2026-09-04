import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { applyStepSequenceCore } from './applyStepSequenceCore'
import type { MutationKernelStep } from './kernelStep'
import { testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

const graphsMap = (
    ...entries: [EphemeraMembershipHostId, EphemeraLudicGraph][]
): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => new Map(entries)

describe('applyStepSequenceCore', () => {
    it('BD-13 carry: explicit dissolveRelation before transferMembership composes correctly', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: glassId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [
                { tag: 'Relational', from: glassId, to: trayId, kind: 'On' },
                { tag: 'Relational', from: trayId, to: tableId, kind: 'On' },
            ],
        })
        const destGraph = testLudicGraph(characterId, { nodes: [] })
        const steps: MutationKernelStep[] = [
            { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, hostId: roomId, relationKind: 'On' },
            { kind: 'transferMembership', entityIds: new Set([trayId, glassId]), fromHostIds: new Set([roomId]), toHostId: characterId },
        ]

        const outcome = applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        const nextSource = outcome.graphs.get(roomId)!
        const nextDest = outcome.graphs.get(characterId)!
        expect(nextSource.objectIds.has(tableId)).toBe(true)
        expect(nextSource.relationalEdges).toEqual([])
        expect(nextDest.objectIds.has(trayId)).toBe(true)
        expect(nextDest.objectIds.has(glassId)).toBe(true)
        expect(nextDest.relationalEdges).toEqual([{ from: glassId, to: trayId, kind: 'On' }])
    })

    it('transferMembership before establishRelation lands the relation on the shared destination host', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const destGraph = testLudicGraph(characterId, { nodes: [{ tag: 'Object', universalKey: glassId }] })
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
            { kind: 'establishRelation', subjectId: trayId, targetId: glassId, hostId: characterId, relationKind: 'On' },
        ]

        const outcome = applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph]))

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

    it('LP4g payoff: establishRelation with a non-Object (Character) subject commits, hostGraph resolves via nodeIds', () => {
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
        // transferred, only resolves in the table's own shard, spuriously throwing "do not share a
        // host" for a perfectly legal move). Now, Expansion already carries `hostId:
        // tableId` on the step, so `confirmCarriedHost` only needs to confirm it, not resolve it.
        const roomGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
        })
        const tableGraph = testLudicGraph(tableId, { nodes: [{ tag: 'Object', universalKey: tableId }] })
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: tableId },
            { kind: 'establishRelation', subjectId: trayId, targetId: tableId, hostId: tableId, relationKind: 'On' },
        ]

        const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph], [tableId, tableGraph]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        const nextRoom = outcome.graphs.get(roomId)!
        const nextTableShard = outcome.graphs.get(tableId)!
        expect(nextRoom.objectIds.has(trayId)).toBe(false)
        expect(nextRoom.objectIds.has(tableId)).toBe(true)
        expect(nextTableShard.objectIds.has(trayId)).toBe(true)
        expect(nextTableShard.relationalEdges).toEqual([{ from: trayId, to: tableId, kind: 'On' }])
    })

    it('illegal (hostNotInFootprint): transferMembership referencing a host absent from the graphs map', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph]))).toEqual({
            verdict: 'illegal',
            reasonCode: 'hostNotInFootprint',
        })
    })

    it('illegal (staleTransferCandidate, object): object absent from source host', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [] })
        const destGraph = testLudicGraph(characterId, { nodes: [] })
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph]))).toEqual({
            verdict: 'illegal',
            reasonCode: 'staleTransferCandidate',
        })
    })

    it('illegal (staleRelationalCandidate): a relational step endpoint unresolvable across the footprint graphs', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const steps: MutationKernelStep[] = [{ kind: 'establishRelation', subjectId: trayId, targetId: glassId, hostId: roomId, relationKind: 'On' }]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph]))).toEqual({
            verdict: 'illegal',
            reasonCode: 'staleRelationalCandidate',
        })
    })

    it('defer propagation: an underlying applyTransferSet defer (Custom boundary edge) surfaces unchanged', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' }],
        })
        const destGraph = testLudicGraph(characterId, { nodes: [] })
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph]))).toEqual({
            verdict: 'defer',
            decidable: false,
            reasonCode: 'transferInteractionDefer',
        })
    })

    it('unresolvedDissolveEdge propagation: a sequence that omits a needed dissolveRelation before its transferMembership', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Against' }],
        })
        const destGraph = testLudicGraph(characterId, { nodes: [] })
        // Bug-injection: no paired dissolveRelation step for the tray-table edge.
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph]))).toEqual({
            verdict: 'illegal',
            reasonCode: 'unresolvedDissolveEdge',
        })
    })

    describe('BD-36 entity-kind split', () => {
        it('character-only transferMembership: legal via addCharacter/removeCharacter, no boundary-edge involvement', () => {
            const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
            const destGraph = testLudicGraph(otherRoomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostIds: new Set([roomId]), toHostId: otherRoomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [otherRoomId, destGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.characterIds.has(characterId)).toBe(false)
            expect(outcome.graphs.get(otherRoomId)!.characterIds.has(characterId)).toBe(true)
        })

        it('mixed entityIds (object + character) in one step: both land correctly under a single verdict', () => {
            const sourceGraph = testLudicGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Character', universalKey: characterId },
                ],
            })
            const destGraph = testLudicGraph(otherRoomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                {
                    kind: 'transferMembership',
                    entityIds: new Set<EphemeraObjectId | EphemeraCharacterId>([trayId, characterId]),
                    fromHostIds: new Set([roomId]),
                    toHostId: otherRoomId,
                },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [otherRoomId, destGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            const nextDest = outcome.graphs.get(otherRoomId)!
            expect(nextDest.objectIds.has(trayId)).toBe(true)
            expect(nextDest.characterIds.has(characterId)).toBe(true)
        })

        it('stale character candidate: character absent from source host', () => {
            const sourceGraph = testLudicGraph(roomId, { nodes: [] })
            const destGraph = testLudicGraph(otherRoomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostIds: new Set([roomId]), toHostId: otherRoomId },
            ]
            expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [otherRoomId, destGraph]))).toEqual({
                verdict: 'illegal',
                reasonCode: 'staleTransferCandidate',
            })
        })

        it("removeCharacter's vacuous assert never spuriously fires on an unrelated object-object edge", () => {
            const sourceGraph = testLudicGraph(roomId, {
                nodes: [
                    { tag: 'Character', universalKey: characterId },
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: tableId },
                ],
                edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'On' }],
            })
            const destGraph = testLudicGraph(otherRoomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostIds: new Set([roomId]), toHostId: otherRoomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [otherRoomId, destGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.relationalEdges).toEqual([{ from: trayId, to: tableId, kind: 'On' }])
            expect(outcome.graphs.get(otherRoomId)!.characterIds.has(characterId)).toBe(true)
        })

        it('character-only pure remove (toHostId null, disconnect-shaped): removes the character from every fromHostIds member', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
            const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
            const steps: MutationKernelStep[] = [
                {
                    kind: 'transferMembership',
                    entityIds: new Set([characterId]),
                    fromHostIds: new Set([roomId, otherRoomId]),
                    toHostId: null,
                },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph], [otherRoomId, otherRoomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.characterIds.has(characterId)).toBe(false)
            expect(outcome.graphs.get(otherRoomId)!.characterIds.has(characterId)).toBe(false)
        })

        it('character-only pure add (fromHostIds empty, connect-from-nowhere-shaped): adds the character to toHostId only', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostIds: new Set(), toHostId: roomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.characterIds.has(characterId)).toBe(true)
        })

        it('character-only pure remove: illegal (staleTransferCandidate) when the character is already absent from a fromHostIds member', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostIds: new Set([roomId]), toHostId: null },
            ]
            expect(applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))).toEqual({
                verdict: 'illegal',
                reasonCode: 'staleTransferCandidate',
            })
        })
    })

    describe('object-lifecycle Migrate row: pure remove / pure add / multi-from', () => {
        it('pure remove (toHostId null): removes the object from every fromHostIds member, no destination graph needed', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
            const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
            const steps: MutationKernelStep[] = [
                {
                    kind: 'transferMembership',
                    entityIds: new Set([trayId]),
                    fromHostIds: new Set([roomId, otherRoomId]),
                    toHostId: null,
                },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph], [otherRoomId, otherRoomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(false)
            expect(outcome.graphs.get(otherRoomId)!.objectIds.has(trayId)).toBe(false)
        })

        it('pure remove with a residual edge throws (removeObject), not a silent strip', () => {
            const roomGraph = testLudicGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: tableId },
                ],
                edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'On' }],
            })
            // Bug-injection: no paired dissolveRelation step for the tray-table edge.
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: null },
            ]

            expect(() => applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))).toThrow(
                /still has a relational edge/
            )
        })

        it('pure remove preceded by an explicit dissolveRelation succeeds (destroy-shaped sequence)', () => {
            const roomGraph = testLudicGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: tableId },
                ],
                edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'On' }],
            })
            const steps: MutationKernelStep[] = [
                { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, hostId: roomId, relationKind: 'On' },
                { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: null },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            const nextRoom = outcome.graphs.get(roomId)!
            expect(nextRoom.objectIds.has(trayId)).toBe(false)
            expect(nextRoom.objectIds.has(tableId)).toBe(true)
            expect(nextRoom.relationalEdges).toEqual([])
        })

        it('pure add (fromHostIds empty): adds the object to toHostId only, no source graph needed', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set(), toHostId: roomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(true)
        })

        it('pure remove: illegal (staleTransferCandidate) when the object is already absent from a fromHostIds member', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: null },
            ]
            expect(applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))).toEqual({
                verdict: 'illegal',
                reasonCode: 'staleTransferCandidate',
            })
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
                ports: [{ portId: 'existing', fromHostId: roomId, kind: 'Under' }],
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
                { portId: 'existing', fromHostId: roomId, kind: 'Under' },
                { portId: 'new', fromHostId: otherRoomId, kind: 'Custom', exteriorRelationLabel: 'to' },
            ])
        })

        it('removeCrossingPort removes only the named port, by portId', () => {
            const tableGraph = testLudicGraph(tableId, {
                nodes: [],
                ports: [
                    { portId: 'keep', fromHostId: roomId, kind: 'Under' },
                    { portId: 'gone', fromHostId: otherRoomId, kind: 'Custom', exteriorRelationLabel: 'to' },
                ],
            })
            const steps: MutationKernelStep[] = [{ kind: 'removeCrossingPort', hostId: tableId, portId: 'gone' }]

            const outcome = applyStepSequenceCore(steps, graphsMap([tableId, tableGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(tableId)!.ports).toEqual([{ portId: 'keep', fromHostId: roomId, kind: 'Under' }])
        })

        it('addCrossingPort against a host absent from the footprint is illegal (hostNotInFootprint)', () => {
            const steps: MutationKernelStep[] = [
                { kind: 'addCrossingPort', hostId: tableId, port: { portId: 'new', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'to' } },
            ]

            expect(applyStepSequenceCore(steps, graphsMap([roomId, testLudicGraph(roomId, { nodes: [] })]))).toEqual({
                verdict: 'illegal',
                reasonCode: 'hostNotInFootprint',
            })
        })
    })

    describe('capture step (PB-J)', () => {
        it('a capture before a mutation step snapshots the entity as still present', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
            const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'capture', hostId: roomId, captureId: 'before' },
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostIds: new Set([roomId]), toHostId: otherRoomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph], [otherRoomId, otherRoomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.captures.get('before')).toEqual([characterId])
        })

        it('the same capture placed after the mutation does not see the entity', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
            const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostIds: new Set([roomId]), toHostId: otherRoomId },
                { kind: 'capture', hostId: roomId, captureId: 'after' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph], [otherRoomId, otherRoomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.captures.get('after')).toEqual([])
        })

        it('a capture naming a host absent from the graphs map is illegal (hostNotInFootprint)', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [] })
            const steps: MutationKernelStep[] = [{ kind: 'capture', hostId: otherRoomId, captureId: 'missing' }]

            expect(applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))).toEqual({
                verdict: 'illegal',
                reasonCode: 'hostNotInFootprint',
            })
        })

        it('a capture step never contributes to the returned graphs map', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
            const steps: MutationKernelStep[] = [{ kind: 'capture', hostId: roomId, captureId: 'only' }]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)).toBe(roomGraph)
        })
    })

    describe('presence port steps (RD-2: addPresencePort/removePresencePort)', () => {
        it('addPresencePort adds a Present port naming fromHostId to the target graph', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresencePort', hostId: trayId, port: { portId: 'p1', fromHostId: roomId, kind: 'Present' } },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.ports).toEqual([{ portId: 'p1', fromHostId: roomId, kind: 'Present' }])
        })

        it('removePresencePort removes the matching binding by fromHostId', () => {
            const trayGraph = testLudicGraph(trayId, { ports: [{ portId: 'p1', fromHostId: roomId, kind: 'Present' }] })
            const steps: MutationKernelStep[] = [
                { kind: 'removePresencePort', hostId: trayId, fromHostId: roomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.ports).toEqual([])
        })

        it('removePresencePort against an absent binding is a silent no-op, not illegal', () => {
            const trayGraph = testLudicGraph(trayId, { ports: [{ portId: 'p1', fromHostId: roomId, kind: 'Present' }] })
            const steps: MutationKernelStep[] = [
                { kind: 'removePresencePort', hostId: trayId, fromHostId: otherRoomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.ports).toEqual([{ portId: 'p1', fromHostId: roomId, kind: 'Present' }])
        })

        it('a remove-then-add pair leaving one Present port on a character does not throw', () => {
            const characterGraph = testLudicGraph(characterId, { ports: [{ portId: 'p1', fromHostId: roomId, kind: 'Present' }] })
            const steps: MutationKernelStep[] = [
                { kind: 'removePresencePort', hostId: characterId, fromHostId: roomId },
                { kind: 'addPresencePort', hostId: characterId, port: { portId: 'p2', fromHostId: otherRoomId, kind: 'Present' } },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, characterGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(characterId)!.ports).toEqual([{ portId: 'p2', fromHostId: otherRoomId, kind: 'Present' }])
        })

        it('throws when a sequence would leave a character with two Present ports (RD-1 single-hosted restriction)', () => {
            const characterGraph = testLudicGraph(characterId, { ports: [{ portId: 'p1', fromHostId: roomId, kind: 'Present' }] })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresencePort', hostId: characterId, port: { portId: 'p2', fromHostId: otherRoomId, kind: 'Present' } },
            ]

            expect(() => applyStepSequenceCore(steps, graphsMap([characterId, characterGraph]))).toThrow(/AGENT\.contract\.md/)
        })

        it('does not throw when an object carries two Present ports --- multi-presence is the point for objects', () => {
            const trayGraph = testLudicGraph(trayId, { ports: [{ portId: 'p1', fromHostId: roomId, kind: 'Present' }] })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresencePort', hostId: trayId, port: { portId: 'p2', fromHostId: otherRoomId, kind: 'Present' } },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.ports).toHaveLength(2)
        })
    })
})
