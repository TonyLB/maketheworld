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

    it('BD-16 repaired: transferMembership before establishRelation lands the relation on the shared destination host', () => {
        const sourceGraph = testPositionGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const destGraph = testPositionGraph(characterId, { nodes: [{ tag: 'Object', universalKey: glassId }] })
        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
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
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
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
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
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

    it('defer propagation: an underlying applyTransferSet defer (Custom boundary edge) surfaces unchanged', () => {
        const sourceGraph = testPositionGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' }],
        })
        const destGraph = testPositionGraph(characterId, { nodes: [] })
        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
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
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
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
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostIds: new Set([roomId]), toHostId: otherRoomId },
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
            const sourceGraph = testPositionGraph(roomId, { nodes: [] })
            const destGraph = testPositionGraph(otherRoomId, { nodes: [] })
            const steps: KernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostIds: new Set([roomId]), toHostId: otherRoomId },
            ]
            expect(applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [otherRoomId, destGraph]))).toEqual({
                verdict: 'illegal',
                reasonCode: 'staleTransferCandidate',
            })
        })

        it("removeCharacter's vacuous assert never spuriously fires on an unrelated object-object edge", () => {
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
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostIds: new Set([roomId]), toHostId: otherRoomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, sourceGraph], [otherRoomId, destGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.relationalEdges).toEqual([{ from: trayId, to: tableId, kind: 'On' }])
            expect(outcome.graphs.get(otherRoomId)!.characterIds.has(characterId)).toBe(true)
        })

        it('character-only pure remove (toHostId null, disconnect-shaped): removes the character from every fromHostIds member', () => {
            const roomGraph = testPositionGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
            const otherRoomGraph = testPositionGraph(otherRoomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
            const steps: KernelStep[] = [
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
            const roomGraph = testPositionGraph(roomId, { nodes: [] })
            const steps: KernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([characterId]), fromHostIds: new Set(), toHostId: roomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.characterIds.has(characterId)).toBe(true)
        })

        it('character-only pure remove: illegal (staleTransferCandidate) when the character is already absent from a fromHostIds member', () => {
            const roomGraph = testPositionGraph(roomId, { nodes: [] })
            const steps: KernelStep[] = [
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
            const roomGraph = testPositionGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
            const otherRoomGraph = testPositionGraph(otherRoomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
            const steps: KernelStep[] = [
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
            const roomGraph = testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: tableId },
                ],
                edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'On' }],
            })
            // Bug-injection: no paired dissolveRelation step for the tray-table edge.
            const steps: KernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: null },
            ]

            expect(() => applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))).toThrow(
                /still has a relational edge/
            )
        })

        it('pure remove preceded by an explicit dissolveRelation succeeds (destroy-shaped sequence)', () => {
            const roomGraph = testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: tableId },
                ],
                edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'On' }],
            })
            const steps: KernelStep[] = [
                { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, relationKind: 'On' },
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
            const roomGraph = testPositionGraph(roomId, { nodes: [] })
            const steps: KernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set(), toHostId: roomId },
            ]

            const outcome = applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))

            expect(outcome.verdict).toBe('legal')
            if (outcome.verdict !== 'legal') return
            expect(outcome.graphs.get(roomId)!.objectIds.has(trayId)).toBe(true)
        })

        it('pure remove: illegal (staleTransferCandidate) when the object is already absent from a fromHostIds member', () => {
            const roomGraph = testPositionGraph(roomId, { nodes: [] })
            const steps: KernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: null },
            ]
            expect(applyStepSequenceCore(steps, graphsMap([roomId, roomGraph]))).toEqual({
                verdict: 'illegal',
                reasonCode: 'staleTransferCandidate',
            })
        })
    })
})
