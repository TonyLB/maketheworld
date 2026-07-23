import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { applyStepSequenceCore } from './applyStepSequenceCore'
import type { KernelStep } from './kernelStep'
import { testPositionGraph } from '../../positionGraph/testFixtures'
import type { EphemeraPositionGraph } from '../../positionGraph'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

const graphsMap = (
    ...entries: [EphemeraMembershipHostId, EphemeraPositionGraph][]
): Map<EphemeraMembershipHostId, EphemeraPositionGraph> => new Map(entries)

describe('applyStepSequenceCore', () => {
    it('BD-13 carry: explicit dissolveRelation before transferMembership composes correctly', () => {
        const sourceGraph = testPositionGraph(roomId, {
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
        const destGraph = testPositionGraph(characterId, { nodes: [] })
        const steps: KernelStep[] = [
            { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, relationKind: 'On' },
            { kind: 'transferMembership', entityIds: new Set([trayId, glassId]), fromHostId: roomId, toHostId: characterId },
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

    it('BD-16 repaired: transferMembership before establishRelation lands the relation on the shared destination host', () => {
        const sourceGraph = testPositionGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const destGraph = testPositionGraph(characterId, { nodes: [{ tag: 'Object', universalKey: glassId }] })
        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostId: roomId, toHostId: characterId },
            { kind: 'establishRelation', subjectId: trayId, targetId: glassId, relationKind: 'On' },
        ]

        const outcome = applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        const nextDest = outcome.graphs.get(characterId)!
        expect(nextDest.objectIds.has(trayId)).toBe(true)
        expect(nextDest.relationalEdges).toEqual([{ from: trayId, to: glassId, kind: 'On' }])
    })

    it('BD-28 alone: a bare dissolveRelation step actually removes the edge, no membership change', () => {
        const graph = testPositionGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'On' }],
        })
        const steps: KernelStep[] = [{ kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, relationKind: 'On' }]

        const outcome = applyStepSequenceCore(steps, graphsMap([roomId, graph]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        const nextGraph = outcome.graphs.get(roomId)!
        expect(nextGraph.relationalEdges).toEqual([])
        expect(nextGraph.objectIds).toEqual(new Set([trayId, tableId]))
    })

    it('BD-33 structural throw: relational step whose endpoints resolve to different hosts throws (not a verdict)', () => {
        const sourceGraph = testPositionGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const otherGraph = testPositionGraph(otherRoomId, { nodes: [{ tag: 'Object', universalKey: glassId }] })
        const steps: KernelStep[] = [{ kind: 'establishRelation', subjectId: trayId, targetId: glassId, relationKind: 'On' }]

        expect(() => applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [otherRoomId, otherGraph]))).toThrow(
            /do not share a host/
        )
    })

    it('illegal (hostNotInFootprint): transferMembership referencing a host absent from the graphs map', () => {
        const sourceGraph = testPositionGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostId: roomId, toHostId: characterId },
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph]))).toEqual({
            verdict: 'illegal',
            reasonCode: 'hostNotInFootprint',
        })
    })

    it('illegal (staleTransferCandidate, object): object absent from source host', () => {
        const sourceGraph = testPositionGraph(roomId, { nodes: [] })
        const destGraph = testPositionGraph(characterId, { nodes: [] })
        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostId: roomId, toHostId: characterId },
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph]))).toEqual({
            verdict: 'illegal',
            reasonCode: 'staleTransferCandidate',
        })
    })

    it('illegal (staleRelationalCandidate): a relational step endpoint unresolvable across the footprint graphs', () => {
        const sourceGraph = testPositionGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const steps: KernelStep[] = [{ kind: 'establishRelation', subjectId: trayId, targetId: glassId, relationKind: 'On' }]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph]))).toEqual({
            verdict: 'illegal',
            reasonCode: 'staleRelationalCandidate',
        })
    })

    it('defer propagation: an underlying applyTransferSetAsserted defer (Custom boundary edge) surfaces unchanged', () => {
        const sourceGraph = testPositionGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' }],
        })
        const destGraph = testPositionGraph(characterId, { nodes: [] })
        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostId: roomId, toHostId: characterId },
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph]))).toEqual({
            verdict: 'defer',
            decidable: false,
            reasonCode: 'transferInteractionDefer',
        })
    })

    it('unresolvedDissolveEdge propagation: a sequence that omits a needed dissolveRelation before its transferMembership', () => {
        const sourceGraph = testPositionGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'On' }],
        })
        const destGraph = testPositionGraph(characterId, { nodes: [] })
        // Bug-injection: no paired dissolveRelation step for the tray-table edge.
        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostId: roomId, toHostId: characterId },
        ]
        expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [characterId, destGraph]))).toEqual({
            verdict: 'illegal',
            reasonCode: 'unresolvedDissolveEdge',
        })
    })

    describe('BD-36 entity-kind split', () => {
        it('character-only transferMembership: legal via addCharacter/removeCharacter, no boundary-edge involvement', () => {
            const sourceGraph = testPositionGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
            const destGraph = testPositionGraph(otherRoomId, { nodes: [] })
            const steps: KernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostId: roomId, toHostId: otherRoomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [otherRoomId, destGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.characterIds.has(characterId)).toBe(false)
            expect(outcome.graphs.get(otherRoomId)!.characterIds.has(characterId)).toBe(true)
        })

        it('mixed entityIds (object + character) in one step: both land correctly under a single verdict', () => {
            const sourceGraph = testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Character', universalKey: characterId },
                ],
            })
            const destGraph = testPositionGraph(otherRoomId, { nodes: [] })
            const steps: KernelStep[] = [
                {
                    kind: 'transferMembership',
                    entityIds: new Set<EphemeraObjectId | EphemeraCharacterId>([trayId, characterId]),
                    fromHostId: roomId,
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
            const sourceGraph = testPositionGraph(roomId, { nodes: [] })
            const destGraph = testPositionGraph(otherRoomId, { nodes: [] })
            const steps: KernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostId: roomId, toHostId: otherRoomId },
            ]
            expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [otherRoomId, destGraph]))).toEqual({
                verdict: 'illegal',
                reasonCode: 'staleTransferCandidate',
            })
        })

        it("removeCharacterAsserted's vacuous assert never spuriously fires on an unrelated object-object edge", () => {
            const sourceGraph = testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Character', universalKey: characterId },
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: tableId },
                ],
                edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'On' }],
            })
            const destGraph = testPositionGraph(otherRoomId, { nodes: [] })
            const steps: KernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostId: roomId, toHostId: otherRoomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [otherRoomId, destGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.relationalEdges).toEqual([{ from: trayId, to: tableId, kind: 'On' }])
            expect(outcome.graphs.get(otherRoomId)!.characterIds.has(characterId)).toBe(true)
        })
    })
})
