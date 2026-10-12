import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { classifyPresenceCoverDrift } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { PresenceGraphView } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { applyStepSequenceCore } from '../kernel/applyStepSequenceCore'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import { movedFactsFor } from '../kernel/factsForStep'
import { membershipChangesOf } from '../kernel/membershipChanges'
import { isKernelMutationStep } from '../kernel/kernelStep'
import type { KernelStep, MutationKernelStep } from '../kernel/kernelStep'
import { planObjectMoveTransfer } from './planObjectMoveTransfer'
import { resolvePresenceMoves } from './resolvePresenceMoves'

/**
 * presenceMoves Slice 2's payoffs: membership counts bindings. A mover's node is a member of a host
 * while some binding of it points there, so a move changes a host's membership only for the first
 * binding to arrive and the last to leave. Run through the real planner, compiler and kernel apply.
 */

const roomA = 'ROOM#Bridge' as EphemeraRoomId
const roomB = 'ROOM#Galley' as EphemeraRoomId
const roomC = 'ROOM#Deck' as EphemeraRoomId
const plank = 'OBJECT#Plank' as EphemeraObjectId
const table = 'OBJECT#Table' as EphemeraObjectId
const presence = (name: string) => `PRESENCE#${name}` as EphemeraPresenceNodeId

const viewOf = (graph: EphemeraLudicGraph): PresenceGraphView => ({
    hostId: graph.hostId,
    nodeIds: [...graph.nodeIds],
    presenceNodes: graph.presenceNodes,
})

const worldOf = (graphs: Record<string, EphemeraLudicGraph>) => async (hostId: string): Promise<EphemeraLudicGraph> => (
    graphs[hostId] ?? testLudicGraph(hostId as EphemeraMembershipHostId)
)

const room = (id: EphemeraRoomId, held: EphemeraObjectId[] = []) => testLudicGraph(id, {
    nodes: [...held.map((universalKey) => ({ tag: 'Object' as const, universalKey })), presenceBindingNode(parentRemainderKey(id))],
})

const apply = (steps: readonly KernelStep[], graphs: Record<string, EphemeraLudicGraph>) => {
    const outcome = applyStepSequenceCore(steps.filter(isKernelMutationStep), new Map(Object.entries(graphs) as [EphemeraMembershipHostId, EphemeraLudicGraph][]))
    if (outcome.verdict !== 'legal') {
        throw new Error(`expected a legal outcome, got ${JSON.stringify(outcome)}`)
    }
    return outcome.graphs
}

const moveOf = async (froms: EphemeraMembershipHostId[], to: EphemeraMembershipHostId | null, graphs: Record<string, EphemeraLudicGraph>, moverGroundedPresence?: Parameters<typeof resolvePresenceMoves>[0]['moverGroundedPresence']) => {
    const resolved = await resolvePresenceMoves({ moved: plank, froms, to, getGraph: worldOf(graphs), ...(moverGroundedPresence ? { moverGroundedPresence } : {}) })
    if (!resolved.ok) { throw new Error(`expected moves, got ${resolved.errorCode}`) }
    return compilePositionKernelOp({ kind: 'move', moved: plank, froms, to, header: null, presenceMoves: resolved.presenceMoves }).steps
}

const heldIn = (graphs: ReadonlyMap<string, EphemeraLudicGraph>, host: string) => graphs.get(host)!.nodeIds.has(plank)

describe('a move changes a host\'s membership only with the mover\'s first or last binding there', () => {
    // A plank laid across two rooms: one binding in each.
    const twoRooms = () => ({
        [roomA]: room(roomA, [plank]),
        [roomB]: room(roomB, [plank]),
        [roomC]: room(roomC),
        [plank]: testLudicGraph(plank, { nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode('plank-a', roomA), presenceBindingNode('plank-b', roomB)] }),
    })

    it('moving one binding to a new host leaves the host of its other binding untouched', async () => {
        const world = twoRooms()
        const steps = await moveOf([roomA], roomC, world, [roomA])
        const after = apply(steps, world)

        expect(heldIn(after, roomA)).toBe(false)
        expect(heldIn(after, roomC)).toBe(true)
        expect(heldIn(after, roomB)).toBe(true)
        expect(after.get(plank)!.presenceNodes.map(({ universalKey, fromHostPresence }) => [universalKey, fromHostPresence?.host])).toEqual([
            [presence('plank-a'), roomC],
            [presence('plank-b'), roomB],
        ])
    })

    it('arriving at a host where the mover already has a binding adds nothing and is not refused', async () => {
        const world = { ...twoRooms(), [roomC]: room(roomC, [plank]) }
        world[plank] = testLudicGraph(plank, { nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode('plank-a', roomA), presenceBindingNode('plank-c', roomC)] })
        const steps = await moveOf([roomA], roomC, world)
        const after = apply(steps, world)

        expect(heldIn(after, roomA)).toBe(false)
        expect(heldIn(after, roomC)).toBe(true)
        expect([...after.get(roomC)!.nodeIds].filter((id) => id === plank)).toHaveLength(1)
    })

    it('a departure that is the mover\'s last binding at the host removes its node', async () => {
        const world = twoRooms()
        const after = apply(await moveOf([roomA, roomB], roomC, world), world)

        expect(heldIn(after, roomA)).toBe(false)
        expect(heldIn(after, roomB)).toBe(false)
        expect(heldIn(after, roomC)).toBe(true)
    })

    it('a departure to no host removes the node from every host it was in', async () => {
        const world = twoRooms()
        const after = apply(await moveOf([roomA, roomB], null, world), world)

        expect(heldIn(after, roomA)).toBe(false)
        expect(heldIn(after, roomB)).toBe(false)
        expect(after.get(plank)!.presenceNodes.every((node) => !node.fromHostPresence)).toBe(true)
    })
})

describe('two bindings of one mover under one host', () => {
    // A plank across two tables is the same table-host with two bindings (`table-1`, `table-2`), and the
    // plank sits under each: the mover's pointers share a host but name different bindings of it.
    const acrossTwoBindings = () => ({
        [roomA]: room(roomA, [table]),
        [roomC]: room(roomC),
        [table]: testLudicGraph(table, {
            nodes: [
                { tag: 'Object', universalKey: table },
                { tag: 'Object', universalKey: plank },
                presenceBindingNode('table-1', roomA),
                presenceBindingNode('table-2', roomA),
            ],
        }),
        [plank]: testLudicGraph(plank, {
            nodes: [
                { tag: 'Object', universalKey: plank },
                presenceBindingNode('plank-on-1', { host: table, presence: presence('table-1') }),
                presenceBindingNode('plank-on-2', { host: table, presence: presence('table-2') }),
            ],
        }),
    })

    it('the mover\'s own groundedPresence names the binding that moves, where the host alone could not', async () => {
        const world = acrossTwoBindings()
        const refused = await planObjectMoveTransfer({ entityId: plank, fromHostId: table, toHostId: roomC, getGraph: worldOf(world) })
        expect(refused).toEqual({ ok: false, errorCode: 'moverBindingAmbiguous' })

        const planned = await planObjectMoveTransfer({
            entityId: plank,
            fromHostId: table,
            toHostId: roomC,
            moverGroundedPresence: [{ host: table, presence: presence('table-2') }],
            getGraph: worldOf(world),
        })
        if (!planned.ok) { throw new Error(`expected a plan, got ${planned.errorCode}`) }
        const after = apply(planned.plan.steps, world)

        // The binding on table-2 moved; the one on table-1 stayed, so the table still holds the plank.
        expect(after.get(plank)!.presenceNodes.map(({ universalKey, fromHostPresence }) => [universalKey, fromHostPresence?.host])).toEqual([
            [presence('plank-on-1'), table],
            [presence('plank-on-2'), roomC],
        ])
        expect(heldIn(after, table)).toBe(true)
        expect(heldIn(after, roomC)).toBe(true)
    })

    it('a move between two bindings of one host compiles to its presence write alone and changes no membership', () => {
        const world = acrossTwoBindings()
        const { steps } = compilePositionKernelOp({
            kind: 'move',
            moved: plank,
            froms: [table],
            to: table,
            header: null,
            presenceMoves: [{
                presence: presence('plank-on-1'),
                from: { host: table, presence: presence('table-1') },
                to: { host: table, presence: presence('table-2') },
            }],
        })

        expect(steps.map((step) => step.kind)).toEqual(['movePresenceBinding'])
        const after = apply(steps, world)
        expect(heldIn(after, table)).toBe(true)
        expect(after.get(plank)!.presenceNodes.map(({ universalKey, fromHostPresence }) => [universalKey, fromHostPresence?.presence])).toEqual([
            [presence('plank-on-1'), presence('table-2')],
            [presence('plank-on-2'), presence('table-2')],
        ])
    })

    it('the classifier reads clean after a binding leaves one of the table\'s bindings', async () => {
        const world = acrossTwoBindings()
        const planned = await planObjectMoveTransfer({
            entityId: plank,
            fromHostId: table,
            toHostId: roomC,
            moverGroundedPresence: [{ host: table, presence: presence('table-2') }],
            getGraph: worldOf(world),
        })
        if (!planned.ok) { throw new Error(`expected a plan, got ${planned.errorCode}`) }
        const after = apply(planned.plan.steps, world)

        const verdict = classifyPresenceCoverDrift(viewOf(after.get(plank)!), (id) => after.has(id as EphemeraMembershipHostId) ? viewOf(after.get(id as EphemeraMembershipHostId)!) : undefined)
        expect(verdict.findings).toEqual([])
    })
})

describe('the moved fact reports only the hosts whose membership changed', () => {
    const before = () => ({
        [roomA]: room(roomA, [plank]),
        [roomB]: room(roomB, [plank]),
        [roomC]: room(roomC),
        [plank]: testLudicGraph(plank, { nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode('plank-a', roomA), presenceBindingNode('plank-b', roomB)] }),
    })

    it('names every host left with the last binding, and the host arrived at', async () => {
        const world = before()
        const steps = (await moveOf([roomA, roomB], roomC, world)).filter(isKernelMutationStep)
        const prior = new Map(Object.entries(world) as [EphemeraMembershipHostId, EphemeraLudicGraph][])
        const final = apply(steps, world)

        const changes = membershipChangesOf(steps, prior, final)
        expect(changes).toEqual([expect.objectContaining({ entityId: plank, left: [roomA, roomB], arrived: [roomC] })])
        expect(movedFactsFor(changes[0], 1)).toEqual([expect.objectContaining({ type: 'Object Moved', froms: [roomA, roomB], to: roomC })])
    })

    it('omits a host the mover still holds a binding at', async () => {
        const world = before()
        const steps = (await moveOf([roomA], roomC, world, [roomA])).filter(isKernelMutationStep)
        const prior = new Map(Object.entries(world) as [EphemeraMembershipHostId, EphemeraLudicGraph][])

        const [change] = membershipChangesOf(steps, prior, apply(steps, world))
        expect(change).toEqual(expect.objectContaining({ left: [roomA], arrived: [roomC] }))
    })

    it('streams no fact for a move between two bindings of one host', () => {
        const prior = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, room(roomA, [plank])],
            [plank, testLudicGraph(plank, { nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode('plank-a', roomA), presenceBindingNode('plank-a2', roomA)] })],
        ])
        const sameHost: MutationKernelStep = {
            kind: 'movePresenceBinding',
            hostId: plank,
            presence: presence('plank-a'),
            from: { host: roomA, presence: parentRemainderKey(roomA) },
            to: { host: roomA, presence: parentRemainderKey(roomA) },
        }
        const final = apply([sameHost], Object.fromEntries(prior))

        expect(membershipChangesOf([sameHost], prior, final)).toEqual([])
    })
})
