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
import { partMoveSteps, resolvePresenceMoves } from './resolvePresenceMoves'

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
    // A plank laid across two places in the room: two bindings of one host under the room's remainder.
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

    it('refuses a destination whose two bindings none names (the planner will not guess)', async () => {
        const planned = await planObjectMoveTransfer({
            entityId: cup,
            fromHostId: roomA,
            toHostId: plank,
            getGraph: worldOf(graphs()),
        })

        // Both plank bindings sit under the room's remainder and no view names one. That state is
        // transient by design (it must not outlive a kernel run), so reaching it here means stale data,
        // and the planner refuses rather than guess.
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
            toBinding: presence('plank-right'),
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

describe('a multi-from scrub moves each binding, and they converge to one', () => {
    const scrub = async (graphs: Record<string, EphemeraLudicGraph>) => {
        const resolved = await resolvePresenceMoves({ moved: plank, froms: [roomA, roomB], to: roomC, getGraph: worldOf(graphs) })
        if (!resolved.ok) { throw new Error(`expected moves, got ${resolved.errorCode}`) }
        const { steps } = compilePositionKernelOp({ kind: 'move', moved: plank, froms: [roomA, roomB], to: roomC, header: null, presenceSteps: resolved.steps })
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

    it('compiles to a reparent per binding and a join, and one binding ends under the destination', async () => {
        const { steps, after } = await scrub(roomsAndPlank())

        expect(steps.map((step) => step.kind)).toEqual(['reparentPresenceBinding', 'reparentPresenceBinding', 'joinPresenceBindings'])
        expect(after.get(plank)!.presenceNodes.map(({ universalKey, fromHostPresences }) => [universalKey, fromHostPresences[0]])).toEqual([
            [presence('plank-a'), { host: roomC, presence: parentRemainderKey(roomC) }],
        ])
    })

    it('a leaf object reads clean after the scrub', async () => {
        const { after } = await scrub(roomsAndPlank())

        const verdict = classifyPresenceCoverDrift(viewOf(after.get(plank)!), () => undefined)
        expect(verdict.findings).toEqual([])
    })

    it('an object with contents converges to one binding and reads clean after the scrub', async () => {
        const world = {
            ...roomsAndPlank(),
            [plank]: testLudicGraph(plank, {
                nodes: [
                    { tag: 'Object', universalKey: plank },
                    { tag: 'Object', universalKey: ball },
                    presenceBindingNode('plank-a', roomA, { members: [{ host: ball, presence: presence('ball-on-plank') }] }),
                    presenceBindingNode('plank-b', roomB),
                ],
            }),
            [ball]: testLudicGraph(ball, { nodes: [presenceBindingNode('ball-on-plank', { host: plank, presence: presence('plank-a') })] }),
        }
        const memberGraph = (graphs: ReadonlyMap<string, EphemeraLudicGraph> | Record<string, EphemeraLudicGraph>) => (id: string) => {
            const graph = graphs instanceof Map ? graphs.get(id) : (graphs as Record<string, EphemeraLudicGraph>)[id]
            return graph ? viewOf(graph) : undefined
        }

        const { after } = await scrub(world)

        expect(after.get(plank)!.presenceNodes.map(({ universalKey }) => universalKey)).toEqual([presence('plank-a')])
        expect(classifyPresenceCoverDrift(viewOf(after.get(plank)!), memberGraph(after)).findings).toEqual([])
    })

    it('plans a scrub whose child is listed under both bindings, and the child ends holding one binding under the survivor', async () => {
        const cover = (presenceId: string) => ({ members: [{ host: ball, presence: presence(presenceId) }] })
        const world = {
            ...roomsAndPlank(),
            [plank]: testLudicGraph(plank, {
                nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode('plank-a', roomA, cover('ball-a')), presenceBindingNode('plank-b', roomB, cover('ball-b'))],
            }),
            [ball]: testLudicGraph(ball, {
                nodes: [
                    presenceBindingNode('ball-a', { host: plank, presence: presence('plank-a') }),
                    presenceBindingNode('ball-b', { host: plank, presence: presence('plank-b') }),
                ],
            }),
        }

        const { resolved, after } = await scrub(world)

        expect(resolved.steps.map((step) => step.kind)).toEqual(['reparentPresenceBinding', 'reparentPresenceBinding', 'joinPresenceBindings', 'joinPresenceBindings'])
        expect(after.get(plank)!.presenceNodes.map(({ universalKey }) => universalKey)).toEqual([presence('plank-a')])
        expect(after.get(ball)!.presenceNodes.map(({ universalKey, fromHostPresences }) => [universalKey, fromHostPresences[0]])).toEqual([
            [presence('ball-a'), { host: plank, presence: presence('plank-a') }],
        ])
    })
})

describe('a scrub names the hosts a collision cascades into', () => {
    it('joins the colliding child one level down, and names the hosts of the grandchildren it re-points', async () => {
        const world = {
            [plank]: testLudicGraph(plank, {
                nodes: [
                    { tag: 'Object', universalKey: plank },
                    presenceBindingNode('plank-a', roomA, { members: [{ host: ball, presence: presence('ball-a') }] }),
                    presenceBindingNode('plank-b', roomB, { members: [{ host: ball, presence: presence('ball-b') }] }),
                ],
            }),
            [ball]: testLudicGraph(ball, {
                nodes: [
                    presenceBindingNode('ball-a', { host: plank, presence: presence('plank-a') }, { members: [{ host: cup, presence: presence('cup-a') }] }),
                    presenceBindingNode('ball-b', { host: plank, presence: presence('plank-b') }, { members: [{ host: cup, presence: presence('cup-b') }] }),
                ],
            }),
            [roomC]: testLudicGraph(roomC, { nodes: [presenceBindingNode(parentRemainderKey(roomC))] }),
        }

        const resolved = await resolvePresenceMoves({ moved: plank, froms: [roomA, roomB], to: roomC, getGraph: worldOf(world) })

        const joins = resolved.ok ? resolved.steps.filter((step) => step.kind === 'joinPresenceBindings') : []
        expect(joins.map((step) => step.hostId)).toEqual([plank, ball])
        expect(joins.map((step) => step.kind === 'joinPresenceBindings' && step.cascadeHosts?.includes(cup))).toEqual([false, true])
    })

    it('writes no join below when no child is listed under two of the bindings', async () => {
        const world = {
            [plank]: testLudicGraph(plank, {
                nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode('plank-a', roomA), presenceBindingNode('plank-b', roomB)],
            }),
            [roomC]: testLudicGraph(roomC, { nodes: [presenceBindingNode(parentRemainderKey(roomC))] }),
        }

        const resolved = await resolvePresenceMoves({ moved: plank, froms: [roomA, roomB], to: roomC, getGraph: worldOf(world) })

        const joins = resolved.ok ? resolved.steps.filter((step) => step.kind === 'joinPresenceBindings') : []
        expect(joins.map((step) => step.hostId)).toEqual([plank])
    })
})

describe('moving part of a cover leaves it consistent with every child\'s pointer', () => {
    const table = 'OBJECT#Table' as EphemeraObjectId
    const book = 'OBJECT#Book' as EphemeraObjectId
    const B = presence('plank-B')
    const under = { host: plank, presence: B }
    const world = () => ({
        [roomA]: testLudicGraph(roomA, { nodes: [{ tag: 'Object', universalKey: plank }, { tag: 'Object', universalKey: table }, presenceBindingNode(parentRemainderKey(roomA))] }),
        [table]: testLudicGraph(table, { nodes: [{ tag: 'Object', universalKey: table }, presenceBindingNode('table-top', roomA)] }),
        [plank]: testLudicGraph(plank, {
            nodes: [
                { tag: 'Object', universalKey: plank },
                { tag: 'Object', universalKey: cup },
                { tag: 'Object', universalKey: book },
                { tag: 'Object', universalKey: ball },
                presenceBindingNode(B, roomA, { members: [{ host: cup, presence: presence('cup1') }, { host: book, presence: presence('book1') }, { host: ball, presence: presence('ball1') }] }),
            ],
        }),
        [cup]: testLudicGraph(cup, { nodes: [presenceBindingNode('cup1', under)] }),
        [book]: testLudicGraph(book, { nodes: [presenceBindingNode('book1', under)] }),
        // listed by B but outside the part that moves, so it stays on the original
        [ball]: testLudicGraph(ball, { nodes: [presenceBindingNode('ball1', under)] }),
    })
    const verdictOf = (after: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>) => {
        const memberOf = (id: string) => after.has(id as EphemeraMembershipHostId) ? viewOf(after.get(id as EphemeraMembershipHostId)!) : undefined
        return {
            findings: classifyPresenceCoverDrift(viewOf(after.get(plank)!), memberOf).findings,
            rebuilds: coverRebuildsFor(viewOf(after.get(plank)!), (id) => memberOf(id)!),
        }
    }
    // moving `book` (a part of B's cover) onto the table's top mints a binding there; B stays under the room
    const partMove = () => partMoveSteps({
        hostId: plank,
        binding: world()[plank].presenceNodes.find(({ universalKey }) => universalKey === B)!,
        part: [{ host: book, presence: presence('book1') }],
        presenceUuid: 'plank-B2',
        lose: [{ host: roomA, presence: parentRemainderKey(roomA) }],
        gain: [{ host: table, presence: presence('table-top') }],
    })

    it('reads clean before (the fixture is sound), and after moving part of the cover', () => {
        const graphs = world()
        expect(verdictOf(new Map(Object.entries(graphs)) as any)).toEqual({ findings: [], rebuilds: [] })

        const after = applyPlanned(partMove(), graphs)

        expect(verdictOf(after)).toEqual({ findings: [], rebuilds: [] })
        expect(after.get(plank)!.presenceNodes.map(({ universalKey, fromHostPresences }) => [universalKey, fromHostPresences[0]?.host])).toEqual([[B, roomA], [presence('plank-B2'), table]])
        expect(after.get(book)!.presenceNodes[0].fromHostPresences).toEqual([{ host: plank, presence: presence('plank-B2') }])
        expect(after.get(cup)!.presenceNodes[0].fromHostPresences).toEqual([under])
        expect(after.get(ball)!.presenceNodes[0].fromHostPresences).toEqual([under])
    })
})
