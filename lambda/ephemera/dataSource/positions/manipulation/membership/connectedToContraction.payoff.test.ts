import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { classifyPresenceCoverDrift, coverRebuildsFor } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { parentsOf, presenceGraphViewOf } from '../../ludicGraph/presenceParent'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { applyStepSequenceCore } from '../kernel/applyStepSequenceCore'
import { isKernelMutationStep } from '../kernel/kernelStep'
import type { MutationKernelStep } from '../kernel/kernelStep'
import { extendSteps, withExtendedBinding } from './extendSteps'
import { resolvePresenceMoves } from './resolvePresenceMoves'

/**
 * The topology corpus's cases ([`AGENT.topology.corpus.md`](../../AGENT.topology.corpus.md)) through the
 * real planner and kernel, judged by the classifier the deployed `PresenceCoverDriftSweep` uses. Every
 * step is what a player's carry is: extend the binding in hand in place, then move the new binding
 * (planned against the graph as the extend leaves it, as `commitAttempt` plans it), or a move of one
 * binding (a view-move) on its own.
 */

const roomA = 'ROOM#Entry' as EphemeraRoomId
const roomB = 'ROOM#Intersection' as EphemeraRoomId
const roomC = 'ROOM#Chamber' as EphemeraRoomId
const roomD = 'ROOM#Staircase' as EphemeraRoomId
const thread = 'OBJECT#Thread' as EphemeraObjectId
const pulleyP = 'OBJECT#PulleyP' as EphemeraObjectId
const pulleyQ = 'OBJECT#PulleyQ' as EphemeraObjectId
const slime = 'OBJECT#Slime' as EphemeraObjectId
const key = (name: string) => PresenceKey(name) as EphemeraPresenceNodeId
const obj = (universalKey: EphemeraObjectId) => ({ tag: 'Object' as const, universalKey })

type Graphs = ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>

const room = (id: EphemeraRoomId, held: EphemeraObjectId[] = []) => testLudicGraph(id, {
    nodes: [...held.map(obj), presenceBindingNode(parentRemainderKey(id))],
})
const worldOf = (graphs: EphemeraLudicGraph[]): Graphs => new Map(graphs.map((graph) => [graph.hostId, graph]))
const lookup = (graphs: Graphs) => async (hostId: string) => graphs.get(hostId as EphemeraMembershipHostId) ?? testLudicGraph(hostId as EphemeraMembershipHostId)

const applied = (steps: readonly MutationKernelStep[], graphs: Graphs): Graphs => {
    const outcome = applyStepSequenceCore(steps.filter(isKernelMutationStep), graphs)
    if (outcome.verdict !== 'legal') {
        throw new Error(`expected a legal outcome, got ${JSON.stringify(outcome)}`)
    }
    return outcome.graphs
}

const bindingOf = (graphs: Graphs, whole: EphemeraObjectId, binding: string) => (
    graphs.get(whole)!.presenceNodes.find(({ universalKey }) => universalKey === key(binding))!
)

/** A view-move of one binding of `whole` to `to`'s binding; `getGraph` defaults to the stored graphs. */
const moveSteps = async (graphs: Graphs, whole: EphemeraObjectId, binding: string, to: EphemeraMembershipHostId, getGraph = lookup(graphs)) => {
    const resolved = await resolvePresenceMoves({
        moved: whole,
        froms: parentsOf(bindingOf(graphs, whole, binding)).map(({ host }) => host),
        to,
        moverBindings: [key(binding)],
        getGraph,
    })
    if (!resolved.ok) {
        throw new Error(resolved.errorCode)
    }
    return resolved.steps
}

/** Carry the end `binding` of `whole` to `to`: extend it in place as `fresh`, then move `fresh`, in one run. */
const carry = async (graphs: Graphs, whole: EphemeraObjectId, binding: string, fresh: string, to: EphemeraMembershipHostId): Promise<Graphs> => {
    const original = bindingOf(graphs, whole, binding)
    const extended = withExtendedBinding(graphs.get(whole)!, original, fresh)
    const move = await moveSteps(new Map([...graphs, [whole, extended]]), whole, fresh, to)
    return applied([...extendSteps({ hostId: whole, binding: original, presenceUuid: fresh }), ...move], graphs)
}

/** Move one binding of `whole` to `to`, in a run of its own. */
const move = async (graphs: Graphs, whole: EphemeraObjectId, binding: string, to: EphemeraMembershipHostId): Promise<Graphs> => (
    applied(await moveSteps(graphs, whole, binding, to), graphs)
)

/** Each binding of `whole` with the host it sits under, and its `ConnectedTo` edges as binding names. */
const topologyOf = (graphs: Graphs, whole: EphemeraObjectId) => {
    const graph = graphs.get(whole)!
    const name = (port: string) => port.replace(/^PRESENCE#/, '')
    return {
        bindings: graph.presenceNodes.map((node) => [name(node.universalKey), ...parentsOf(node).map(({ host }) => host)]),
        edges: graph.relationalEdges.map(({ from, to }) => [name((from as { port: string }).port), name((to as { port: string }).port)].sort()),
    }
}

/** Every finding and cover rebuild the sweep would report for `hosts`. */
const sweepOf = (graphs: Graphs, hosts: EphemeraMembershipHostId[]) => {
    const viewFor = (id: string) => graphs.has(id as EphemeraMembershipHostId) ? presenceGraphViewOf(graphs.get(id as EphemeraMembershipHostId)!) : undefined
    return hosts.map((host) => ({
        host,
        findings: classifyPresenceCoverDrift(viewFor(host)!, viewFor).findings,
        rebuilds: coverRebuildsFor(viewFor(host)!, (id) => viewFor(id)!),
    }))
}
const clean = (hosts: EphemeraMembershipHostId[]) => hosts.map((host) => ({ host, findings: [], rebuilds: [] }))

const threadWorld = (rooms: EphemeraRoomId[]) => worldOf([
    testLudicGraph(thread, { nodes: [obj(thread), presenceBindingNode('Base', rooms[0])] }),
    room(rooms[0], [thread]),
    ...rooms.slice(1).map((id) => room(id)),
])

describe('CT-C1: Theseus passes the intersection twice', () => {
    it('keeps both stretches in B, each connected the way the thread runs, with nothing dangling and no drift', async () => {
        const start = threadWorld([roomA, roomB, roomC, roomD])
        const toB = await carry(start, thread, 'Base', 't2', roomB)
        const toC = await carry(toB, thread, 't2', 't3', roomC)
        const backToB = await carry(toC, thread, 't3', 't4', roomB)
        const toD = await carry(backToB, thread, 't4', 't5', roomD)

        expect(topologyOf(toD, thread)).toEqual({
            bindings: [['Base', roomA], ['t2', roomB], ['t3', roomC], ['t4', roomB], ['t5', roomD]],
            edges: [['Base', 't2'], ['t2', 't3'], ['t3', 't4'], ['t4', 't5']],
        })
        expect(toD.get(roomB)!.presenceNodes[0].cover.members).toEqual([{ host: thread, presence: key('t2') }, { host: thread, presence: key('t4') }])
        expect(sweepOf(toD, [roomA, roomB, roomC, roomD, thread])).toEqual(clean([roomA, roomB, roomC, roomD, thread]))
    })

    it('the minimal variant: a rope carried into B and back into A without being reeled in holds both ends in A', async () => {
        const toB = await carry(threadWorld([roomA, roomB]), thread, 'Base', 'r2', roomB)
        const backToA = await carry(toB, thread, 'r2', 'r3', roomA)

        expect(topologyOf(backToA, thread)).toEqual({
            bindings: [['Base', roomA], ['r2', roomB], ['r3', roomA]],
            edges: [['Base', 'r2'], ['r2', 'r3']],
        })
        expect(sweepOf(backToA, [roomA, roomB, thread])).toEqual(clean([roomA, roomB, thread]))
    })
})

describe('CT-C2: coiling the rope back in', () => {
    it('(a) the far end hauled home leaves one rope in A, with nothing saying it reached B', async () => {
        const toB = await carry(threadWorld([roomA, roomB]), thread, 'Base', 'r2', roomB)
        const home = await move(toB, thread, 'r2', roomA)

        expect(topologyOf(home, thread)).toEqual({ bindings: [['Base', roomA]], edges: [] })
        expect(home.get(roomB)!.nodeIds.has(thread)).toBe(false)
        expect(sweepOf(home, [roomA, roomB, thread])).toEqual(clean([roomA, roomB, thread]))
    })

    it('(b) one room\'s worth hauled in leaves the rope running A to B, as if only ever carried that far', async () => {
        const toB = await carry(threadWorld([roomA, roomB, roomC]), thread, 'Base', 'r2', roomB)
        const toC = await carry(toB, thread, 'r2', 'r3', roomC)
        const hauled = await move(toC, thread, 'r3', roomB)

        expect(topologyOf(hauled, thread)).toEqual({ bindings: [['Base', roomA], ['r2', roomB]], edges: [['Base', 'r2']] })
        expect(sweepOf(hauled, [roomA, roomB, roomC, thread])).toEqual(clean([roomA, roomB, roomC, thread]))
    })
})

describe('CT-C3: the rope between two pulleys', () => {
    const pulleyWorld = () => worldOf([
        testLudicGraph(thread, { nodes: [obj(thread), presenceBindingNode('Base', roomB)] }),
        testLudicGraph(pulleyP, { nodes: [obj(pulleyP), presenceBindingNode('Base', roomB)] }),
        testLudicGraph(pulleyQ, { nodes: [obj(pulleyQ), presenceBindingNode('Base', roomB)] }),
        room(roomB, [thread, pulleyP, pulleyQ]),
    ])
    const threaded = async () => {
        const overP = await carry(pulleyWorld(), thread, 'Base', 'rp', pulleyP)
        const down = await carry(overP, thread, 'rp', 'r2', roomB)
        const overQ = await carry(down, thread, 'r2', 'rq', pulleyQ)
        return carry(overQ, thread, 'rq', 'r3', roomB)
    }
    const hosts = [roomB, pulleyP, pulleyQ, thread]

    it('threads over both pulleys: three hanging stretches in the room, none merged', async () => {
        const graphs = await threaded()

        expect(topologyOf(graphs, thread)).toEqual({
            bindings: [['Base', roomB], ['rp', pulleyP], ['r2', roomB], ['rq', pulleyQ], ['r3', roomB]],
            edges: [['Base', 'rp'], ['r2', 'rp'], ['r2', 'rq'], ['r3', 'rq']],
        })
        expect(sweepOf(graphs, hosts)).toEqual(clean(hosts))
    })

    it('pulled off P, the first two stretches become one, still running to Q, and the third stays apart', async () => {
        const pulledOff = await move(await threaded(), thread, 'rp', roomB)

        expect(topologyOf(pulledOff, thread)).toEqual({
            bindings: [['Base', roomB], ['rq', pulleyQ], ['r3', roomB]],
            edges: [['r3', 'rq'], ['Base', 'rq']],
        })
        expect(pulledOff.get(pulleyP)!.nodeIds.has(thread)).toBe(false)
        expect(sweepOf(pulledOff, hosts)).toEqual(clean(hosts))
    })
})

describe('CT-C8(b): a blob flows back into a slime with a tendril', () => {
    it('merges the bare blob into the main mass and leaves the tendril into B connected', async () => {
        const stretched = await carry(worldOf([
            testLudicGraph(slime, { nodes: [obj(slime), presenceBindingNode('Base', roomA)] }),
            room(roomA, [slime]),
            room(roomB),
        ]), slime, 'Base', 'tendril', roomB)
        // The blob cut off earlier is a fixture: nothing a player says cuts a slime yet (`partMoveSteps` has no caller).
        const withBlob = new Map([
            ...stretched,
            [slime, stretched.get(slime)!.addPresenceNode(presenceBindingNode('blob', roomB))],
            [roomB, stretched.get(roomB)!.replacePresenceNode({
                ...stretched.get(roomB)!.presenceNodes[0],
                cover: { members: [...stretched.get(roomB)!.presenceNodes[0].cover.members, { host: slime, presence: key('blob') }] },
            })],
        ]) as Graphs

        const flowedBack = await move(withBlob, slime, 'blob', roomA)

        expect(topologyOf(flowedBack, slime)).toEqual({ bindings: [['Base', roomA], ['tendril', roomB]], edges: [['Base', 'tendril']] })
        expect(sweepOf(flowedBack, [roomA, roomB, slime])).toEqual(clean([roomA, roomB, slime]))
    })
})
