import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { classifyPresenceCoverDrift, coverRebuildsFor } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { PresenceGraphView } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { applyStepSequenceCore } from '../kernel/applyStepSequenceCore'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import { isKernelMutationStep } from '../kernel/kernelStep'
import { planObjectMoveTransfer } from './planObjectMoveTransfer'
import { resolvePresenceMoves } from './resolvePresenceMoves'

/**
 * presenceMoves Slice 1's payoffs, run through the real planner and compiler and the real kernel
 * apply, then judged by the same classifier the deployed `PresenceCoverDriftSweep` uses.
 */

const roomA = 'ROOM#Bridge' as EphemeraRoomId
const roomB = 'ROOM#Galley' as EphemeraRoomId
const roomC = 'ROOM#Deck' as EphemeraRoomId
const plank = 'OBJECT#Plank' as EphemeraObjectId
const cup = 'OBJECT#Cup' as EphemeraObjectId
const ball = 'OBJECT#Ball' as EphemeraObjectId
const presence = (name: string) => `PRESENCE#${name}` as EphemeraPresenceNodeId

const viewOf = (graph: EphemeraLudicGraph): PresenceGraphView => ({
    hostId: graph.hostId,
    nodeIds: [...graph.nodeIds],
    presenceNodes: graph.presenceNodes,
})

const worldOf = (graphs: Record<string, EphemeraLudicGraph>) => async (hostId: string): Promise<EphemeraLudicGraph> => (
    graphs[hostId] ?? testLudicGraph(hostId as EphemeraMembershipHostId)
)

/** Plans, compiles and applies a move over `graphs`; returns the resulting graphs. */
const applyPlanned = (steps: ReturnType<typeof compilePositionKernelOp>['steps'], graphs: Record<string, EphemeraLudicGraph>) => {
    const outcome = applyStepSequenceCore(steps.filter(isKernelMutationStep), new Map(Object.entries(graphs) as [EphemeraMembershipHostId, EphemeraLudicGraph][]))
    if (outcome.verdict !== 'legal') {
        throw new Error(`expected a legal outcome, got ${JSON.stringify(outcome)}`)
    }
    return outcome.graphs
}

describe('a move lands under the destination binding it names', () => {
    // A plank laid across two places in the room: two bindings of one whole under the room's remainder.
    // `right` lists the cup's binding explicitly (cover distribution is the later split slice's work);
    // `left` holds the remainder.
    const plankGraph = () => testLudicGraph(plank, {
        nodes: [
            { tag: 'Object', universalKey: plank },
            presenceBindingNode('plank-left', roomA),
            presenceBindingNode('plank-right', roomA, { members: [{ host: cup, presence: presence('cup-on-plank') }] }),
        ],
    })
    const graphs = () => ({
        [roomA]: testLudicGraph(roomA, { nodes: [{ tag: 'Object', universalKey: plank }, { tag: 'Object', universalKey: cup }, presenceBindingNode(parentRemainderKey(roomA))] }),
        [plank]: plankGraph(),
        [cup]: testLudicGraph(cup, { nodes: [presenceBindingNode('cup-on-plank', roomA)] }),
    })

    it('refuses stale data where two bindings of the destination sit under the one bucket it is seen in (the planner will not guess)', async () => {
        const planned = await planObjectMoveTransfer({
            entityId: cup,
            fromHostId: roomA,
            toHostId: plank,
            toGroundedPresence: [{ host: roomA, presence: parentRemainderKey(roomA) }],
            getGraph: worldOf(graphs()),
        })

        // Both plank bindings sit under the room's remainder, so the seen bucket cannot tell them
        // apart. That state is transient by design (it must not outlive a kernel run), so reaching it
        // here means stale data, and the planner refuses rather than guess.
        expect(planned).toEqual({ ok: false, errorCode: 'destinationBindingAmbiguous' })
    })

    it('lands under the named binding when the destination can be told apart, and the classifier reads clean', async () => {
        const world = graphs()
        world[plank] = testLudicGraph(plank, {
            nodes: [
                { tag: 'Object', universalKey: plank },
                presenceBindingNode('plank-left', roomA),
                presenceBindingNode('plank-right', roomB, { members: [{ host: cup, presence: presence('cup-on-plank') }] }),
            ],
        })
        world[roomB] = testLudicGraph(roomB, { nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode(parentRemainderKey(roomB))] })
        world[roomA] = testLudicGraph(roomA, { nodes: [{ tag: 'Object', universalKey: cup }, presenceBindingNode(parentRemainderKey(roomA))] })

        const planned = await planObjectMoveTransfer({
            entityId: cup,
            fromHostId: roomA,
            toHostId: plank,
            toGroundedPresence: [{ host: roomB, presence: parentRemainderKey(roomB) }],
            getGraph: worldOf(world),
        })
        if (!planned.ok) { throw new Error(`expected a plan, got ${planned.errorCode}`) }

        const after = applyPlanned(planned.plan.steps, { ...world, [plank]: world[plank], [cup]: world[cup] })
        expect(after.get(cup)!.presenceNodes).toEqual([
            presenceBindingNode('cup-on-plank', { host: plank, presence: presence('plank-right') }),
        ])
        const verdict = classifyPresenceCoverDrift(viewOf(after.get(plank)!), (id) => after.has(id as EphemeraMembershipHostId) ? viewOf(after.get(id as EphemeraMembershipHostId)!) : undefined)
        expect(verdict.findings).toEqual([])
        expect(coverRebuildsFor(viewOf(after.get(plank)!), (id) => viewOf(after.get(id as EphemeraMembershipHostId)!))).toEqual([])
    })
})

describe('the bridge: a multi-from scrub moves each binding and leaves the join a stub (until presenceMoves Slice 4)', () => {
    const scrub = async (graphs: Record<string, EphemeraLudicGraph>) => {
        const resolved = await resolvePresenceMoves({ moved: plank, froms: [roomA, roomB], to: roomC, getGraph: worldOf(graphs) })
        if (!resolved.ok) { throw new Error(`expected moves, got ${resolved.errorCode}`) }
        const { steps } = compilePositionKernelOp({ kind: 'move', moved: plank, froms: [roomA, roomB], to: roomC, header: null, presenceMoves: resolved.presenceMoves })
        return { resolved, steps, after: applyPlanned(steps, graphs) }
    }
    const roomsAndPlank = (extra: any[] = []) => ({
        [roomA]: testLudicGraph(roomA, { nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode(parentRemainderKey(roomA))] }),
        [roomB]: testLudicGraph(roomB, { nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode(parentRemainderKey(roomB))] }),
        [roomC]: testLudicGraph(roomC, { nodes: [presenceBindingNode(parentRemainderKey(roomC))] }),
        [plank]: testLudicGraph(plank, {
            nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode('plank-a', roomA), presenceBindingNode('plank-b', roomB), ...extra],
        }),
    })

    it('compiles to one move per binding followed by a join, and both bindings end under the destination', async () => {
        const { steps, after } = await scrub(roomsAndPlank())

        expect(steps.map((step) => step.kind)).toEqual(['movePresenceBinding', 'movePresenceBinding', 'joinPresenceBindings'])
        expect(after.get(plank)!.presenceNodes.map(({ universalKey, fromHostPresence }) => [universalKey, fromHostPresence])).toEqual([
            [presence('plank-a'), { host: roomC, presence: parentRemainderKey(roomC) }],
            [presence('plank-b'), { host: roomC, presence: parentRemainderKey(roomC) }],
        ])
    })

    it('a leaf object reads clean after the scrub', async () => {
        const { after } = await scrub(roomsAndPlank())

        const verdict = classifyPresenceCoverDrift(viewOf(after.get(plank)!), () => undefined)
        expect(verdict.findings).toEqual([])
    })

    it('an object with contents reads as drift after the scrub: the same finding the two-room anomaly already carried', async () => {
        const world = {
            ...roomsAndPlank([{ tag: 'Object', universalKey: ball }]),
            [ball]: testLudicGraph(ball, { nodes: [presenceBindingNode('ball-on-plank', { host: plank, presence: presence('plank-a') })] }),
        }
        const memberGraph = (graphs: ReadonlyMap<string, EphemeraLudicGraph> | Record<string, EphemeraLudicGraph>) => (id: string) => {
            const graph = graphs instanceof Map ? graphs.get(id) : (graphs as Record<string, EphemeraLudicGraph>)[id]
            return graph ? viewOf(graph) : undefined
        }
        const finding = { kind: 'Stale', member: ball, presence: presence('plank-b') }

        expect(classifyPresenceCoverDrift(viewOf(world[plank]), memberGraph(world)).findings).toEqual([finding])
        const { after } = await scrub(world)
        expect(classifyPresenceCoverDrift(viewOf(after.get(plank)!), memberGraph(after)).findings).toEqual([finding])
    })
})
