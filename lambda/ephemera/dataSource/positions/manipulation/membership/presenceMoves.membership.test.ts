import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { classifyPresenceCoverDrift } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { presenceGraphViewOf } from '../../ludicGraph/presenceParent'
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

const viewOf = presenceGraphViewOf

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

const moveOf = async (froms: EphemeraMembershipHostId[], to: EphemeraMembershipHostId | null, graphs: Record<string, EphemeraLudicGraph>, moverBindings?: Parameters<typeof resolvePresenceMoves>[0]['moverBindings']) => {
    const resolved = await resolvePresenceMoves({ moved: plank, froms, to, getGraph: worldOf(graphs), ...(moverBindings ? { moverBindings } : {}) })
    if (!resolved.ok) { throw new Error(`expected moves, got ${resolved.errorCode}`) }
    return compilePositionKernelOp({ kind: 'move', moved: plank, froms, to, header: null, presenceSteps: resolved.steps }).steps
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
        const steps = await moveOf([roomA], roomC, world, [presence('plank-a')])
        const after = apply(steps, world)

        expect(heldIn(after, roomA)).toBe(false)
        expect(heldIn(after, roomC)).toBe(true)
        expect(heldIn(after, roomB)).toBe(true)
        expect(after.get(plank)!.presenceNodes.map(({ universalKey, fromHostPresences }) => [universalKey, fromHostPresences[0]?.host])).toEqual([
            [presence('plank-a'), roomC],
            [presence('plank-b'), roomB],
        ])
    })

    it('arriving at a host where the mover already has a binding adds nothing and is not refused', async () => {
        const world = { ...twoRooms(), [roomC]: room(roomC, [plank]) }
        world[plank] = testLudicGraph(plank, { nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode('plank-a', roomA), presenceBindingNode('plank-c', roomC)] })
        // the move finds the mover's binding already under roomC's one binding and joins it (MC-3)
        const after = apply(await moveOf([roomA], roomC, world), world)

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
        // a departure lands in the whole's Base, so the plank holds one
        world[plank] = testLudicGraph(plank, { nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode('Base', roomA), presenceBindingNode('plank-b', roomB)] })
        const after = apply(await moveOf([roomA, roomB], null, world), world)

        expect(heldIn(after, roomA)).toBe(false)
        expect(heldIn(after, roomB)).toBe(false)
        expect(after.get(plank)!.presenceNodes.every((node) => node.fromHostPresences.length === 0)).toBe(true)
    })
})

describe('two bindings of one mover under one host', () => {
    // A plank across two tables is the same table-host with two bindings (`table-1`, `table-2`), and the
    // plank sits under each: the mover's pointers share a host but name different bindings of it.
    const acrossTwoBindings = () => ({
        [roomA]: testLudicGraph(roomA, {
            nodes: [
                { tag: 'Object', universalKey: table },
                presenceBindingNode(parentRemainderKey(roomA), undefined, { members: [{ host: table, presence: presence('table-1') }] }),
                presenceBindingNode('roomA-second', roomC, { members: [{ host: table, presence: presence('table-2') }] }),
            ],
        }),
        [roomC]: room(roomC),
        [table]: testLudicGraph(table, {
            nodes: [
                { tag: 'Object', universalKey: table },
                { tag: 'Object', universalKey: plank },
                presenceBindingNode('table-1', roomA, { members: [{ host: plank, presence: presence('plank-on-1') }] }),
                presenceBindingNode('table-2', { host: roomA, presence: presence('roomA-second') }, { members: [{ host: plank, presence: presence('plank-on-2') }] }),
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

    it('the mover\'s view names the binding that moves, where the host alone could not', async () => {
        const world = acrossTwoBindings()
        const refused = await planObjectMoveTransfer({ entityId: plank, fromHostId: table, toHostId: roomC, getGraph: worldOf(world) })
        expect(refused).toEqual({ ok: false, errorCode: 'moverBindingAmbiguous' })

        const planned = await planObjectMoveTransfer({
            entityId: plank,
            fromHostId: table,
            toHostId: roomC,
            moverBindings: [presence('plank-on-2')],
            getGraph: worldOf(world),
        })
        if (!planned.ok) { throw new Error(`expected a plan, got ${planned.errorCode}`) }
        const after = apply(planned.plan.steps, world)

        // The binding on table-2 moved; the one on table-1 stayed, so the table still holds the plank.
        expect(after.get(plank)!.presenceNodes.map(({ universalKey, fromHostPresences }) => [universalKey, fromHostPresences[0]?.host])).toEqual([
            [presence('plank-on-1'), table],
            [presence('plank-on-2'), roomC],
        ])
        expect(heldIn(after, table)).toBe(true)
        expect(heldIn(after, roomC)).toBe(true)
    })

    it('a move between two bindings of one host is a reparent and a join, and changes no membership', () => {
        const world = acrossTwoBindings()
        const { steps } = compilePositionKernelOp({
            kind: 'move',
            moved: plank,
            froms: [table],
            to: table,
            header: null,
            presenceSteps: [
                {
                    kind: 'reparentPresenceBinding',
                    hostId: plank,
                    presence: presence('plank-on-1'),
                    lose: [{ host: table, presence: presence('table-1') }],
                    gain: [{ host: table, presence: presence('table-2') }],
                },
                // the plank already holds a binding under table-2, so the producer joins into it
                { kind: 'joinPresenceBindings', hostId: plank, into: presence('plank-on-2'), toJoin: [presence('plank-on-1')], cascadeHosts: [table] },
            ],
        })

        expect(steps.map((step) => step.kind)).toEqual(['reparentPresenceBinding', 'joinPresenceBindings'])
        const after = apply(steps, world)
        expect(heldIn(after, table)).toBe(true)
        expect(after.get(plank)!.presenceNodes.map(({ universalKey, fromHostPresences }) => [universalKey, fromHostPresences[0]?.presence])).toEqual([
            [presence('plank-on-2'), presence('table-2')],
        ])
    })

    it('the classifier reads clean after a binding leaves one of the table\'s bindings', async () => {
        const world = acrossTwoBindings()
        const planned = await planObjectMoveTransfer({
            entityId: plank,
            fromHostId: table,
            toHostId: roomC,
            moverBindings: [presence('plank-on-2')],
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
        const steps = (await moveOf([roomA], roomC, world, [presence('plank-a')])).filter(isKernelMutationStep)
        const prior = new Map(Object.entries(world) as [EphemeraMembershipHostId, EphemeraLudicGraph][])

        const [change] = membershipChangesOf(steps, prior, apply(steps, world))
        expect(change).toEqual(expect.objectContaining({ left: [roomA], arrived: [roomC] }))
    })

    it('streams no fact for a move between two bindings of one host', () => {
        const prior = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, testLudicGraph(roomA, { nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode(parentRemainderKey(roomA)), presenceBindingNode('roomA-other', roomB), presenceBindingNode('roomA-third', roomC)] })],
            [plank, testLudicGraph(plank, { nodes: [{ tag: 'Object', universalKey: plank }, presenceBindingNode('plank-a', roomA), presenceBindingNode('plank-a2', { host: roomA, presence: presence('roomA-other') })] })],
        ])
        const sameHost: MutationKernelStep = { kind: 'reparentPresenceBinding', hostId: plank, presence: presence('plank-a'), lose: [{ host: roomA, presence: parentRemainderKey(roomA) }], gain: [{ host: roomA, presence: presence('roomA-third') }] }
        const final = apply([sameHost], Object.fromEntries(prior))

        expect(membershipChangesOf([sameHost], prior, final)).toEqual([])
    })
})

describe('a move of one part leaves the mover a member of both hosts', () => {
    // A rug lies in the room as two parts (an extend), and the far part is laid onto the table that stands there.
    const rug = 'OBJECT#Rug' as EphemeraObjectId
    const world = () => ({
        [roomA]: testLudicGraph(roomA, { nodes: [
            { tag: 'Object', universalKey: rug },
            { tag: 'Object', universalKey: table },
            presenceBindingNode(parentRemainderKey(roomA), undefined, { members: [{ host: rug, presence: presence('rug') }, { host: rug, presence: presence('rug-far') }, { host: table, presence: presence('Base') }] }),
        ] }),
        [table]: testLudicGraph(table, { nodes: [{ tag: 'Object', universalKey: table }, presenceBindingNode('Base', roomA)] }),
        [rug]: testLudicGraph(rug, { nodes: [{ tag: 'Object', universalKey: rug }, presenceBindingNode('rug', roomA), presenceBindingNode('rug-far', roomA)] }),
    })

    it('holds the rug in the room and on the table, one part in each, with its On edge on the table', async () => {
        const before = world()
        const planned = await planObjectMoveTransfer({ entityId: rug, fromHostId: roomA, toHostId: table, moverBindings: [presence('rug-far')], containment: 'On', getGraph: worldOf(before) })
        if (!planned.ok) { throw new Error(`expected a plan, got ${planned.errorCode}`) }
        const steps = planned.plan.steps.filter(isKernelMutationStep)
        const prior = new Map(Object.entries(before) as [EphemeraMembershipHostId, EphemeraLudicGraph][])
        const after = apply(steps, before)

        expect(after.get(roomA)!.nodeIds.has(rug)).toBe(true)
        expect(after.get(table)!.nodeIds.has(rug)).toBe(true)
        expect(after.get(rug)!.presenceNodes.map(({ universalKey }) => universalKey)).toEqual([presence('rug'), presence('rug-far')])
        expect(after.get(table)!.relationalEdges).toEqual([expect.objectContaining({ from: rug, to: table, kind: 'On' })])

        const changes = membershipChangesOf(steps, prior, after)
        expect(changes).toEqual([expect.objectContaining({ entityId: rug, left: [], arrived: [table] })])
        expect(movedFactsFor(changes[0], 1)).toEqual([expect.objectContaining({ type: 'Object Moved', froms: [], to: table })])

        const verdict = classifyPresenceCoverDrift(viewOf(after.get(rug)!), (id) => after.has(id as EphemeraMembershipHostId) ? viewOf(after.get(id as EphemeraMembershipHostId)!) : undefined)
        expect(verdict.findings).toEqual([])
    })
})
