import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { edgesMatch } from '../../ludicGraph/baseClasses'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { applyStepSequenceCore } from '../kernel/applyStepSequenceCore'
import { computeStepSequenceFootprint } from '../kernel/computeStepSequenceFootprint'
import type { MutationKernelStep } from '../kernel/kernelStep'
import { extendSteps, withExtendedBinding } from './extendSteps'

const roomA = 'ROOM#Bridge' as EphemeraRoomId
const roomB = 'ROOM#Galley' as EphemeraRoomId
const rope = 'OBJECT#Rope' as EphemeraObjectId
const presence = (name: string) => `PRESENCE#${name}` as EphemeraPresenceNodeId

const room = (id: EphemeraRoomId, held: EphemeraObjectId[] = []) => testLudicGraph(id, {
    nodes: [...held.map((universalKey) => ({ tag: 'Object' as const, universalKey })), presenceBindingNode(parentRemainderKey(id))],
})
const world = (): Record<string, EphemeraLudicGraph> => ({
    [rope]: testLudicGraph(rope, { nodes: [{ tag: 'Object', universalKey: rope }, presenceBindingNode('pA', roomA)] }),
    [roomA]: room(roomA, [rope]),
    [roomB]: room(roomB),
})
const graphsOf = (graphs: Record<string, EphemeraLudicGraph>) => new Map(Object.entries(graphs) as [EphemeraMembershipHostId, EphemeraLudicGraph][])
const extend = (graphs = world()) => extendSteps({ hostId: rope, binding: graphs[rope].presenceNodes[0], presenceUuid: 'pB' })
const moveNewBinding: MutationKernelStep = {
    kind: 'reparentPresenceBinding',
    hostId: rope,
    presence: presence('pB'),
    lose: [{ host: roomA, presence: parentRemainderKey(roomA) }],
    gain: [{ host: roomB, presence: parentRemainderKey(roomB) }],
}

describe('extendSteps', () => {
    it('is a split in place followed by a ConnectedTo between the two bindings', () => {
        expect(extend()).toEqual([
            {
                kind: 'splitPresenceBinding',
                hostId: rope,
                presence: presence('pA'),
                pieces: [
                    { presence: presence('pA'), parents: [{ host: roomA, presence: parentRemainderKey(roomA) }], cover: { members: [] } },
                    { presenceUuid: 'pB', parents: [{ host: roomA, presence: parentRemainderKey(roomA) }], cover: { members: [] } },
                ],
            },
            {
                kind: 'establishRelation',
                hostId: rope,
                subjectId: { owner: rope, port: presence('pA') },
                targetId: { owner: rope, port: presence('pB') },
                relationKind: 'ConnectedTo',
            },
        ])
    })

    it('extend alone leaves two bindings under one parent, which the kernel refuses', () => {
        expect(() => applyStepSequenceCore(extend(), graphsOf(world()))).toThrow(/a join was missing/)
    })

    describe('with a move of the new binding to the next room', () => {
        const steps = () => [...extend(), moveNewBinding]

        it('commits one rope present in both rooms, its bindings connected', () => {
            const outcome = applyStepSequenceCore(steps(), graphsOf(world()))
            if (outcome.verdict !== 'legal') { throw new Error(`expected legal, got ${JSON.stringify(outcome)}`) }

            const ropeGraph = outcome.graphs.get(rope)!
            expect(ropeGraph.presenceNodes.map(({ universalKey, fromHostPresences }) => [universalKey, fromHostPresences.map(({ host, presence: parent }) => `${host}|${parent}`)])).toEqual([
                [presence('pA'), [`${roomA}|${parentRemainderKey(roomA)}`]],
                [presence('pB'), [`${roomB}|${parentRemainderKey(roomB)}`]],
            ])
            expect(ropeGraph.relationalEdges).toHaveLength(1)
            const [edge] = ropeGraph.relationalEdges
            expect(edge.kind).toBe('ConnectedTo')
            expect(edgesMatch(edge, { from: { owner: rope, port: presence('pB') }, to: { owner: rope, port: presence('pA') }, kind: 'ConnectedTo' })).toBe(true)
            expect(outcome.graphs.get(roomA)!.nodeIds.has(rope)).toBe(true)
            expect(outcome.graphs.get(roomB)!.nodeIds.has(rope)).toBe(true)
        })

        it('refuses the whole sequence when the binding to split is gone, leaving no orphan edge', () => {
            const stale = { ...world(), [rope]: testLudicGraph(rope, { nodes: [{ tag: 'Object', universalKey: rope }, presenceBindingNode('other', roomA)] }) }

            const outcome = applyStepSequenceCore([...extendSteps({ hostId: rope, binding: world()[rope].presenceNodes[0], presenceUuid: 'pB' }), moveNewBinding], graphsOf(stale))

            expect(outcome).toEqual({ verdict: 'stale', reasonCode: 'presenceBindingMissing' })
            expect(outcome).not.toHaveProperty('graphs')
        })

        it('locks the rope and both rooms', () => {
            const footprint = computeStepSequenceFootprint(steps(), () => undefined)

            expect([...footprint].sort()).toEqual([rope, roomA, roomB].sort())
        })
    })

    describe('the kernel\'s end-of-run check reads the contraction rule (CT-C1, CT-C2)', () => {
        const carried = () => {
            const outcome = applyStepSequenceCore([...extend(), moveNewBinding], graphsOf(world()))
            if (outcome.verdict !== 'legal') { throw new Error(`expected legal, got ${JSON.stringify(outcome)}`) }
            return outcome.graphs
        }
        const backToA = (binding: string): MutationKernelStep => ({
            kind: 'reparentPresenceBinding',
            hostId: rope,
            presence: presence(binding),
            lose: [{ host: roomB, presence: parentRemainderKey(roomB) }],
            gain: [{ host: roomA, presence: parentRemainderKey(roomA) }],
        })

        it('refuses an end carried home and left beside its neighbor uncontracted', () => {
            expect(() => applyStepSequenceCore([backToA('pB')], carried())).toThrow(/a join was missing/)
        })

        it('commits a rope carried on from the far room back into the first: two stretches in one room, joined only through the other', () => {
            const graphs = carried()
            const outcome = applyStepSequenceCore([
                ...extendSteps({ hostId: rope, binding: graphs.get(rope)!.presenceNodes[1], presenceUuid: 'pC' }),
                {
                    kind: 'reparentPresenceBinding',
                    hostId: rope,
                    presence: presence('pC'),
                    lose: [{ host: roomB, presence: parentRemainderKey(roomB) }],
                    gain: [{ host: roomA, presence: parentRemainderKey(roomA) }],
                },
            ], graphs)
            if (outcome.verdict !== 'legal') { throw new Error(`expected legal, got ${JSON.stringify(outcome)}`) }

            expect(outcome.graphs.get(rope)!.presenceNodes.filter(({ fromHostPresences }) => fromHostPresences.some(({ host }) => host === roomA)).map(({ universalKey }) => universalKey))
                .toEqual([presence('pA'), presence('pC')])
        })
    })
})

describe('withExtendedBinding', () => {
    it('adds the fresh binding under the original\'s parents with an empty cover, as the committed extend would', () => {
        const graph = world()[rope]
        const extended = withExtendedBinding(graph, graph.presenceNodes[0], 'pB')

        expect(extended.presenceNodes.map(({ universalKey }) => universalKey)).toEqual([presence('pA'), presence('pB')])
        expect(extended.presenceNodes[1]).toEqual({
            tag: 'Presence',
            universalKey: presence('pB'),
            fromHostPresences: [{ host: roomA, presence: parentRemainderKey(roomA) }],
            cover: { members: [] },
        })
        expect(graph.presenceNodes).toHaveLength(1)
    })

    it('overlays the ConnectedTo between the original and the fresh binding, so a planner reads them as neighbors', () => {
        const graph = world()[rope]
        const extended = withExtendedBinding(graph, graph.presenceNodes[0], 'pB')

        expect(extended.relationalEdges).toEqual([{ from: { owner: rope, port: presence('pA') }, to: { owner: rope, port: presence('pB') }, kind: 'ConnectedTo' }])
        expect(graph.relationalEdges).toEqual([])
    })
})
