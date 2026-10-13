import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { classifyPresenceCoverDrift, coverRebuildsFor } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { PresenceGraphView } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { applyStepSequenceCore } from '../kernel/applyStepSequenceCore'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import { presenceBindingStepsForSplit } from '../kernel/compile/presenceBindingStepsForSplit'
import { isKernelMutationStep } from '../kernel/kernelStep'
import { planObjectMoveTransfer } from './planObjectMoveTransfer'
import { resolvePresenceMoves } from './resolvePresenceMoves'
import { resolvePresenceSplit } from './resolvePresenceSplit'

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

describe('a multi-from scrub moves each binding and joins them into one', () => {
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

    it('compiles to one move per binding followed by a join, and one binding ends under the destination', async () => {
        const { steps, after } = await scrub(roomsAndPlank())

        expect(steps.map((step) => step.kind)).toEqual(['movePresenceBinding', 'movePresenceBinding', 'joinPresenceBindings'])
        expect(after.get(plank)!.presenceNodes.map(({ universalKey, fromHostPresence }) => [universalKey, fromHostPresence])).toEqual([
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
            ...roomsAndPlank([{ tag: 'Object', universalKey: ball }]),
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

    it('refuses to plan a scrub whose children would collide under the survivor (a child listed under both bindings)', async () => {
        const cover = (presenceId: string) => ({ members: [{ host: ball, presence: presence(presenceId) }] })
        const world = {
            ...roomsAndPlank(),
            [plank]: testLudicGraph(plank, {
                nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode('plank-a', roomA, cover('ball-a')), presenceBindingNode('plank-b', roomB, cover('ball-b'))],
            }),
        }

        expect(await resolvePresenceMoves({ moved: plank, froms: [roomA, roomB], to: roomC, getGraph: worldOf(world) })).toEqual({ ok: false, errorCode: 'joinChildrenCollide' })
    })
})

describe('a split leaves the cover consistent with every child\'s pointer', () => {
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
                presenceBindingNode(B, roomA, { members: [{ host: cup, presence: presence('cup1') }, { host: book, presence: presence('book1') }, { tag: 'Remainder' }] }),
            ],
        }),
        [cup]: testLudicGraph(cup, { nodes: [presenceBindingNode('cup1', under)] }),
        [book]: testLudicGraph(book, { nodes: [presenceBindingNode('book1', under)] }),
        // never listed by a binding, so it belongs to the Remainder, which stays on the original
        [ball]: testLudicGraph(ball, { nodes: [presenceBindingNode('ball1', under)] }),
    })
    const verdictOf = (after: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>) => {
        const memberOf = (id: string) => after.has(id as EphemeraMembershipHostId) ? viewOf(after.get(id as EphemeraMembershipHostId)!) : undefined
        return {
            findings: classifyPresenceCoverDrift(viewOf(after.get(plank)!), memberOf).findings,
            rebuilds: coverRebuildsFor(viewOf(after.get(plank)!), (id) => memberOf(id)!),
        }
    }
    const planSplit = async (graphs: Record<string, EphemeraLudicGraph>) => {
        const planned = await resolvePresenceSplit({ whole: plank, presence: B, moveOut: [[book]], getGraph: worldOf(graphs) })
        if (!planned.ok) { throw new Error(`expected a split, got ${planned.errorCode}`) }
        return planned.op
    }

    it('reads clean before (the fixture is sound), and after the split', async () => {
        const graphs = world()
        expect(verdictOf(new Map(Object.entries(graphs)) as any)).toEqual({ findings: [], rebuilds: [] })

        const op = await planSplit(graphs)
        // a split's new bindings share the original's parent, which a run may not leave behind: a move follows
        const moveNew = { kind: 'movePresenceBinding' as const, hostId: plank, presence: op.splitInto[1].presence, from: { host: roomA, presence: parentRemainderKey(roomA) }, to: { host: table, presence: presence('table-top') } }
        const after = applyPlanned([...presenceBindingStepsForSplit(op), moveNew], graphs)

        expect(verdictOf(after)).toEqual({ findings: [], rebuilds: [] })
        expect(after.get(plank)!.presenceNodes.map(({ universalKey }) => universalKey)).toEqual([B, op.splitInto[1].presence])
        expect(after.get(book)!.presenceNodes[0].fromHostPresence).toEqual({ host: plank, presence: op.splitInto[1].presence })
        expect(after.get(cup)!.presenceNodes[0].fromHostPresence).toEqual(under)
        expect(after.get(ball)!.presenceNodes[0].fromHostPresence).toEqual(under)
    })

    it('split then join round-trips to the original cover, reading clean before and after', async () => {
        const graphs = world()
        const original = graphs[plank].presenceNodes[0].cover
        const op = await planSplit(graphs)
        const [, added] = op.splitInto
        const split = presenceBindingStepsForSplit(op)
        const join = { kind: 'joinPresenceBindings' as const, hostId: plank, survivor: B, absorbed: added.presence, absorbedCover: added.cover }

        // the middle state (split, not yet joined) is not observable: a run may not end with it, so clean is checked before and after
        expect(verdictOf(new Map(Object.entries(graphs)) as any)).toEqual({ findings: [], rebuilds: [] })
        const after = applyPlanned([...split, join], graphs)

        expect(verdictOf(after)).toEqual({ findings: [], rebuilds: [] })
        expect(after.get(plank)!.presenceNodes.map(({ universalKey }) => universalKey)).toEqual([B])
        expect(new Set(after.get(plank)!.presenceNodes[0].cover.members.map((member) => JSON.stringify(member)))).toEqual(new Set(original.members.map((member) => JSON.stringify(member))))
        expect(after.get(book)!.presenceNodes[0].fromHostPresence).toEqual(under)
    })

    it('reads clean when a move of the new binding to another parent follows in the same run (the minted id is nameable)', async () => {
        const graphs = world()
        const op = await planSplit(graphs)
        const newId = op.splitInto[1].presence
        const steps = [
            ...presenceBindingStepsForSplit(op),
            { kind: 'movePresenceBinding' as const, hostId: plank, presence: newId, from: { host: roomA, presence: parentRemainderKey(roomA) }, to: { host: table, presence: presence('table-top') } },
        ]

        const after = applyPlanned(steps, graphs)

        expect(after.get(plank)!.presenceNodes.map(({ universalKey, fromHostPresence }) => [universalKey, fromHostPresence?.host])).toEqual([[B, roomA], [newId, table]])
        expect(verdictOf(after)).toEqual({ findings: [], rebuilds: [] })
    })
})
