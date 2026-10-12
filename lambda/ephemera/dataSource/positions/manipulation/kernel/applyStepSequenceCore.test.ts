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

describe('applyStepSequenceCore', () => {
    it('explicit dissolveRelation before transferMembership composes correctly', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [
                { tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' },
            ],
        })
        const destGraph = testLudicGraph(characterId, { nodes: [] })
        const steps: MutationKernelStep[] = [
            { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, hostId: roomId, relationKind: 'Custom', relationLabel: 'tied to' },
            { kind: 'transferMembership', entityId: trayId, fromHostIds: new Set([roomId]), toHostId: characterId },
        ]

        const outcome = applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        const nextSource = outcome.graphs.get(roomId)!
        const nextDest = outcome.graphs.get(characterId)!
        expect(nextSource.objectIds.has(tableId)).toBe(true)
        expect(nextSource.relationalEdges).toEqual([])
        expect(nextDest.objectIds.has(trayId)).toBe(true)
        expect(nextDest.relationalEdges).toEqual([])
    })

    it('transferMembership before establishRelation lands the relation on the shared destination host', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const destGraph = testLudicGraph(characterId, { nodes: [{ tag: 'Object', universalKey: glassId }] })
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityId: trayId, fromHostIds: new Set([roomId]), toHostId: characterId },
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
            { kind: 'transferMembership', entityId: trayId, fromHostIds: new Set([roomId]), toHostId: tableId },
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
            { kind: 'transferMembership', entityId: trayId, fromHostIds: new Set([roomId]), toHostId: characterId },
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph]))).toEqual({
            verdict: 'stale',
            reasonCode: 'hostNotInFootprint',
        })
    })

    it('illegal (staleTransferCandidate, object): object absent from source host', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [] })
        const destGraph = testLudicGraph(characterId, { nodes: [] })
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityId: trayId, fromHostIds: new Set([roomId]), toHostId: characterId },
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph]))).toEqual({
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
        const destGraph = testLudicGraph(characterId, { nodes: [] })
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityId: trayId, fromHostIds: new Set([roomId]), toHostId: characterId },
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph]))).toEqual({
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
        const destGraph = testLudicGraph(characterId, { nodes: [] })
        // Bug-injection: no paired dissolveRelation step for the tray-table edge.
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityId: trayId, fromHostIds: new Set([roomId]), toHostId: characterId },
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph]))).toEqual({
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

    describe('BD-36 entity-kind split', () => {
        it('character-only transferMembership: legal via addCharacter/removeCharacter, no boundary-edge involvement', () => {
            const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
            const destGraph = testLudicGraph(otherRoomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityId: characterId, fromHostIds: new Set([roomId]), toHostId: otherRoomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [otherRoomId, destGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.characterIds.has(characterId)).toBe(false)
            expect(outcome.graphs.get(otherRoomId)!.characterIds.has(characterId)).toBe(true)
        })

        it('stale character candidate: character absent from source host', () => {
            const sourceGraph = testLudicGraph(roomId, { nodes: [] })
            const destGraph = testLudicGraph(otherRoomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityId: characterId, fromHostIds: new Set([roomId]), toHostId: otherRoomId },
            ]
            expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [otherRoomId, destGraph]))).toEqual({
                verdict: 'stale',
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
                { kind: 'transferMembership', entityId: characterId, fromHostIds: new Set([roomId]), toHostId: otherRoomId },
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
                    entityId: characterId,
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
                { kind: 'transferMembership', entityId: characterId, fromHostIds: new Set(), toHostId: roomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.characterIds.has(characterId)).toBe(true)
        })

        it('character-only pure remove: illegal (staleTransferCandidate) when the character is already absent from a fromHostIds member', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityId: characterId, fromHostIds: new Set([roomId]), toHostId: null },
            ]
            expect(applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))).toEqual({
                verdict: 'stale',
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
                    entityId: trayId,
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
                { kind: 'transferMembership', entityId: trayId, fromHostIds: new Set([roomId]), toHostId: null },
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
                { kind: 'transferMembership', entityId: trayId, fromHostIds: new Set([roomId]), toHostId: null },
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
                { kind: 'transferMembership', entityId: trayId, fromHostIds: new Set(), toHostId: roomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(true)
        })

        it('pure remove: illegal (staleTransferCandidate) when the object is already absent from a fromHostIds member', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityId: trayId, fromHostIds: new Set([roomId]), toHostId: null },
            ]
            expect(applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))).toEqual({
                verdict: 'stale',
                reasonCode: 'staleTransferCandidate',
            })
        })
    })

    describe('Room/Feature entityId in transferMembership (pure-add only)', () => {
        it('pure add (fromHostIds empty): adds a Room to an Area host, mirroring the object/character pure-add shape', () => {
            const areaGraph = testLudicGraph(areaId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityId: roomId, fromHostIds: new Set(), toHostId: areaId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([areaId, areaGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(areaId)!.roomIds.has(roomId)).toBe(true)
        })

        it('pure add (fromHostIds empty): adds a Feature to a Room host', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityId: featureId, fromHostIds: new Set(), toHostId: roomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.featureIds.has(featureId)).toBe(true)
        })

        it('pure add: illegal (staleTransferCandidate) when the Room is already a node of toHostId', () => {
            const areaGraph = testLudicGraph(areaId, { nodes: [{ tag: 'Room', universalKey: roomId }] })
            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityId: roomId, fromHostIds: new Set(), toHostId: areaId },
            ]
            expect(applyStepSequenceCore(steps, graphsMap([areaId, areaGraph]))).toEqual({
                verdict: 'stale',
                reasonCode: 'staleTransferCandidate',
            })
        })

        it('real transfer (fromHostIds length 1, toHostId non-null): throws for a Room --- stays Object/Character-only', () => {
            const areaGraph = testLudicGraph(areaId, { nodes: [{ tag: 'Room', universalKey: roomId }] })
            const otherAreaGraph = testLudicGraph('AREA#Elsewhere' as EphemeraAreaId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                {
                    kind: 'transferMembership',
                    entityId: roomId,
                    fromHostIds: new Set([areaId]),
                    toHostId: 'AREA#Elsewhere' as EphemeraAreaId,
                },
            ]
            // A caller bug, so a throw rather than a verdict (2026-09-08) --- same side of the
            // Throw-vs-verdict split as the BD-33 host mismatch, which this file's own comment
            // always said it belonged on.
            expect(() => applyStepSequenceCore(steps, graphsMap([areaId, areaGraph], ['AREA#Elsewhere' as EphemeraAreaId, otherAreaGraph])))
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
        it('a capture before a mutation step snapshots the entity as still present', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
            const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'capture', hostId: roomId, captureId: 'before' },
                { kind: 'transferMembership', entityId: characterId, fromHostIds: new Set([roomId]), toHostId: otherRoomId },
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
                { kind: 'transferMembership', entityId: characterId, fromHostIds: new Set([roomId]), toHostId: otherRoomId },
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
                verdict: 'stale',
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

        it('after a move to nowhere, the same sequence destroys the host; the room no longer holds it', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }, presenceBindingNode(parentRemainderKey(roomId))] })
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('p1', roomId)] })
            const steps: MutationKernelStep[] = [
                ...compilePositionKernelOp({ kind: 'move', moved: trayId, froms: [roomId], to: null, header: null, presenceMoves: [] })
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

    describe('presence binding steps (addPresenceBinding/movePresenceBinding/releasePresenceBindings)', () => {
        // presenceNodes Slice 7a (PN-23): these steps mint/remove the presence NODE directly ---
        // there is no port record any more, so `.ports` is untouched by any of this and only
        // `.presenceNodes`/`.toStored().nodes` reflects the binding.
        it('addPresenceBinding mints a presence node carrying the parent pointer, sole remainder by default', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: { host: roomId }, presenceUuid: 'p1' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.toStored().nodes).toEqual(
                expect.arrayContaining([{
                    tag: 'Presence',
                    universalKey: 'PRESENCE#p1',
                    fromHostPresence: { host: roomId },
                    cover: { members: [{ tag: 'Remainder' }] },
                }])
            )
        })

        const moveStep = (
            hostId: EphemeraMembershipHostId,
            presence: string,
            from: { host: EphemeraMembershipHostId; presence?: string } | null,
            to: { host: EphemeraMembershipHostId; presence: string }
        ): MutationKernelStep => ({ kind: 'movePresenceBinding', hostId, presence, from, to } as MutationKernelStep)

        it('a move re-points the named binding in place: same id and cover, pointer at the destination\'s binding', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('p1', roomId)] })
            const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [presenceBindingNode(parentRemainderKey(otherRoomId))] })
            const steps = [
                moveStep(trayId, 'PRESENCE#p1', { host: roomId, presence: parentRemainderKey(roomId) }, { host: otherRoomId, presence: parentRemainderKey(otherRoomId) }),
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [otherRoomId, otherRoomGraph]))

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

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [characterId, characterGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('a', roomId), presenceBindingNode('b', characterId)])
        })

        it('a move between two bindings of one parent changes the pointer and nothing else', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('p1', { host: tableId, presence: 'PRESENCE#left' as any })] })
            const tableGraph = testLudicGraph(tableId, { nodes: [presenceBindingNode('left', roomId), presenceBindingNode('right', roomId)] })
            const steps = [moveStep(trayId, 'PRESENCE#p1', { host: tableId, presence: 'PRESENCE#left' }, { host: tableId, presence: 'PRESENCE#right' })]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [tableId, tableGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('p1', { host: tableId, presence: 'PRESENCE#right' as any })])
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
            const characterGraph = testLudicGraph(characterId, { nodes: [presenceBindingNode('p1', roomId)] })
            const steps: MutationKernelStep[] = [{ kind: 'releasePresenceBindings', hostId: characterId }]

            const outcome = applyStepSequenceCore(steps, graphsMap([characterId, characterGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(characterId)!.presenceNodes).toEqual([presenceBindingNode('p1')])
        })

        it('a release removes every placed binding when a hostless one remains', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('root'), presenceBindingNode('a', roomId), presenceBindingNode('b', otherRoomId)] })
            const steps: MutationKernelStep[] = [{ kind: 'releasePresenceBindings', hostId: trayId }]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('root')])
        })

        it('a release of several placed bindings keeps the first, hostless, and removes the rest', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('a', roomId), presenceBindingNode('b', otherRoomId)] })
            const steps: MutationKernelStep[] = [{ kind: 'releasePresenceBindings', hostId: trayId }]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([presenceBindingNode('a')])
        })

        it('a release of a whole with no binding at all changes nothing', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [] })
            const steps: MutationKernelStep[] = [{ kind: 'releasePresenceBindings', hostId: trayId }]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual([])
        })

        it('a release whose whole is outside the footprint is stale', () => {
            const steps: MutationKernelStep[] = [{ kind: 'releasePresenceBindings', hostId: trayId }]

            expect(applyStepSequenceCore(steps, graphsMap())).toEqual({ verdict: 'stale', reasonCode: 'hostNotInFootprint' })
        })

        it('a join is a stub: it changes nothing, so a multi-binding move leaves its bindings side by side', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('a', roomId), presenceBindingNode('b', roomId)] })
            const steps: MutationKernelStep[] = [{ kind: 'joinPresenceBindings', hostId: trayId, survivor: 'PRESENCE#a' as any, absorbed: 'PRESENCE#b' as any }]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toEqual(trayGraph.presenceNodes)
        })

        it('a split is a stub: stale with notImplemented', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('a', roomId)] })
            const steps: MutationKernelStep[] = [{ kind: 'splitPresenceBinding', hostId: trayId, presence: 'PRESENCE#a' as any, results: [] }]

            expect(applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))).toEqual({ verdict: 'stale', reasonCode: 'notImplemented' })
        })

        it('throws when a sequence would leave a character with two presence bindings --- characters are single-hosted', () => {
            const characterGraph = testLudicGraph(characterId, {
                nodes: [{ tag: 'Presence', universalKey: 'PRESENCE#p1', fromHostPresence: { host: roomId }, cover: { members: [{ tag: 'Remainder' }] } }],
            })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: characterId, fromHostPresence: { host: otherRoomId }, presenceUuid: 'p2' },
            ]

            expect(() => applyStepSequenceCore(steps, graphsMap([characterId, characterGraph]))).toThrow(/AGENT\.contract\.md/)
        })

        it('does not throw when an object carries two presence bindings --- multi-presence is the point for objects', () => {
            const trayGraph = testLudicGraph(trayId, {
                nodes: [{ tag: 'Presence', universalKey: 'PRESENCE#p1', fromHostPresence: { host: roomId }, cover: { members: [{ tag: 'Remainder' }] } }],
            })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: { host: otherRoomId }, presenceUuid: 'p2' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes).toHaveLength(2)
        })

        it('addPresenceBinding fills in the parent binding from the destination graph in the footprint', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [presenceBindingNode('room-remainder')] })
            const trayGraph = testLudicGraph(trayId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: { host: roomId }, presenceUuid: 'p1' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes[0].fromHostPresence).toEqual({
                host: roomId,
                presence: presenceBindingNode('room-remainder').universalKey,
            })
        })

        it('addPresenceBinding never guesses between two destination bindings: the pointer keeps the host alone', () => {
            const lampGraph = testLudicGraph(featureId, { nodes: [presenceBindingNode('a', roomId), presenceBindingNode('b', otherRoomId)] })
            const trayGraph = testLudicGraph(trayId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: trayId, fromHostPresence: { host: featureId }, presenceUuid: 'p1' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph], [featureId, lampGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(trayId)!.presenceNodes[0].fromHostPresence).toEqual({ host: featureId })
        })

        it('addPresenceBinding takes an explicit cover (a room\'s Area carve-out has no members)', () => {
            const roomGraph = testLudicGraph(roomId, { nodes: [] })
            const steps: MutationKernelStep[] = [
                { kind: 'addPresenceBinding', hostId: roomId, fromHostPresence: { host: areaId }, cover: { members: [] }, presenceUuid: 'p1' },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))

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
        const hostOnly = presenceBindingNode('p1', { host: roomId })

        it('rewrites pointer and cover in place, keeping the binding id and its position', () => {
            const trayGraph = testLudicGraph(trayId, { nodes: [presenceBindingNode('first', otherRoomId), hostOnly] })
            const steps: MutationKernelStep[] = [{
                kind: 'repairPresenceBinding',
                hostId: trayId,
                presenceId: hostOnly.universalKey,
                fromHostPresence: { host: roomId, presence: 'PRESENCE#room-remainder' },
                cover: { members: [] },
            }]

            const outcome = applyStepSequenceCore(steps, graphsMap([trayId, trayGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            const nodes = outcome.graphs.get(trayId)!.presenceNodes
            expect(nodes.map(({ universalKey }) => universalKey)).toEqual([presenceBindingNode('first').universalKey, hostOnly.universalKey])
            expect(nodes[1]).toEqual({
                tag: 'Presence',
                universalKey: hostOnly.universalKey,
                fromHostPresence: { host: roomId, presence: 'PRESENCE#room-remainder' },
                cover: { members: [] },
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
