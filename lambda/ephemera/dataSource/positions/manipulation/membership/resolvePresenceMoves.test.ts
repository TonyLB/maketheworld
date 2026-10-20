import type { EphemeraCharacterId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { applyStepSequenceCore } from '../kernel/applyStepSequenceCore'
import { computeStepSequenceFootprint } from '../kernel/computeStepSequenceFootprint'
import { partMoveSteps, resolvePresenceMoves } from './resolvePresenceMoves'

/**
 * The planner's step output (Framework F), run through the real kernel. The corpus cases (M-numbers)
 * are in `AGENT.presenceParentSets.corpus.planning.md`.
 */

const roomA = 'ROOM#Bridge' as EphemeraRoomId
const roomB = 'ROOM#Galley' as EphemeraRoomId
const hand = 'CHARACTER#Tess' as EphemeraCharacterId
const set = 'OBJECT#Backgammon' as EphemeraObjectId
const die = 'OBJECT#Die' as EphemeraObjectId
const apple = 'OBJECT#Apple' as EphemeraObjectId
const presence = (name: string) => `PRESENCE#${name}` as EphemeraPresenceNodeId

const graphsOf = (graphs: Record<string, EphemeraLudicGraph>) => new Map(Object.entries(graphs) as [EphemeraMembershipHostId, EphemeraLudicGraph][])
const getGraphOf = (graphs: Record<string, EphemeraLudicGraph>) => async (hostId: string) => graphs[hostId] ?? testLudicGraph(hostId as EphemeraMembershipHostId)
const room = (id: EphemeraRoomId, held: EphemeraObjectId[] = []) => testLudicGraph(id, {
    nodes: [...held.map((universalKey) => ({ tag: 'Object' as const, universalKey })), presenceBindingNode(parentRemainderKey(id))],
})
const handGraph = testLudicGraph(hand, { nodes: [{ tag: 'Character' as const, universalKey: hand }, presenceBindingNode('Base')] })
const apply = (steps: Parameters<typeof applyStepSequenceCore>[0], graphs: Record<string, EphemeraLudicGraph>) => {
    const outcome = applyStepSequenceCore(steps, graphsOf(graphs))
    if (outcome.verdict !== 'legal') {
        throw new Error(`expected a legal outcome, got ${JSON.stringify(outcome)}`)
    }
    return outcome.graphs
}
const bindingsOf = (graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>, host: string) => (
    graphs.get(host as EphemeraMembershipHostId)!.presenceNodes.map(({ universalKey, fromHostPresences }) => [universalKey, fromHostPresences.map(({ host: parent, presence: parentPresence }) => `${parent}|${parentPresence}`)])
)

describe('resolvePresenceMoves', () => {
    describe('a shared binding (M7)', () => {
        // the die holds one binding under both bindings of the Backgammon set
        const world = () => ({
            [set]: testLudicGraph(set, { nodes: [
                { tag: 'Object', universalKey: set },
                { tag: 'Object', universalKey: die },
                presenceBindingNode('chestA-set', roomA, { members: [{ host: die, presence: presence('die') }] }),
                presenceBindingNode('chestB-set', roomB, { members: [{ host: die, presence: presence('die') }] }),
            ] }),
            [die]: testLudicGraph(die, { nodes: [
                { tag: 'Object', universalKey: die },
                presenceBindingNode('die', [{ host: set, presence: presence('chestA-set') }, { host: set, presence: presence('chestB-set') }]),
            ] }),
            [hand]: handGraph,
            [roomA]: room(roomA, [set]),
            [roomB]: room(roomB, [set]),
        })

        it('moves once: one reparent that loses every parent on the host, with no ambiguity', async () => {
            const resolved = await resolvePresenceMoves({ moved: die, froms: [set], to: hand, getGraph: getGraphOf(world()) })

            expect(resolved).toEqual({ ok: true, steps: [{
                kind: 'reparentPresenceBinding',
                hostId: die,
                presence: presence('die'),
                lose: [{ host: set, presence: presence('chestA-set') }, { host: set, presence: presence('chestB-set') }],
                gain: [{ host: hand, presence: presence('Base') }],
            }] })
        })

        it('leaves the die in the hand only, and out of both bindings of the set', async () => {
            const resolved = await resolvePresenceMoves({ moved: die, froms: [set], to: hand, getGraph: getGraphOf(world()) })
            if (!resolved.ok) { throw new Error(resolved.errorCode) }

            const after = apply(resolved.steps, world())

            expect(bindingsOf(after, die)).toEqual([[presence('die'), [`${hand}|${presence('Base')}`]]])
            expect(after.get(set)!.presenceNodes.map(({ cover }) => cover.members)).toEqual([[], []])
        })

        it('a departure loses only the parents on the from host: the die stays where it is otherwise placed', async () => {
            const placed = world()
            placed[die] = testLudicGraph(die, { nodes: [
                { tag: 'Object', universalKey: die },
                presenceBindingNode('die', [{ host: set, presence: presence('chestA-set') }, { host: roomB, presence: parentRemainderKey(roomB) }]),
            ] })

            const resolved = await resolvePresenceMoves({ moved: die, froms: [set], to: null, getGraph: getGraphOf(placed) })

            expect(resolved).toEqual({ ok: true, steps: [expect.objectContaining({
                kind: 'reparentPresenceBinding',
                presence: presence('die'),
                lose: [{ host: set, presence: presence('chestA-set') }],
            })] })
        })
    })

    describe('convergence', () => {
        it('a mover already holding a binding under the destination: reparent, then join into that binding (M2 to M4)', async () => {
            const world = {
                [die]: testLudicGraph(die, { nodes: [{ tag: 'Object', universalKey: die }, presenceBindingNode('on-a', roomA), presenceBindingNode('on-b', roomB)] }),
                [roomA]: room(roomA, [die]),
                [roomB]: room(roomB, [die]),
            }

            const resolved = await resolvePresenceMoves({ moved: die, froms: [roomA], to: roomB, getGraph: getGraphOf(world) })
            if (!resolved.ok) { throw new Error(resolved.errorCode) }

            expect(resolved.steps.map((step) => step.kind)).toEqual(['reparentPresenceBinding', 'joinPresenceBindings'])
            expect(resolved.steps[1]).toMatchObject({ into: presence('on-b'), toJoin: [presence('on-a')] })
            expect(bindingsOf(apply(resolved.steps, world), die)).toEqual([[presence('on-b'), [`${roomB}|${parentRemainderKey(roomB)}`]]])
        })

        it('a hostless Base placed where the mover already holds a binding is the survivor: Base is never dispensed with', async () => {
            const world = {
                [die]: testLudicGraph(die, { nodes: [{ tag: 'Object', universalKey: die }, presenceBindingNode('Base'), presenceBindingNode('on-b', roomB)] }),
                [roomB]: room(roomB, [die]),
            }

            const resolved = await resolvePresenceMoves({ moved: die, froms: [], to: roomB, getGraph: getGraphOf(world) })
            if (!resolved.ok) { throw new Error(resolved.errorCode) }

            expect(resolved.steps[resolved.steps.length - 1]).toMatchObject({ kind: 'joinPresenceBindings', into: presence('Base'), toJoin: [presence('on-b')] })
            expect(bindingsOf(apply(resolved.steps, world), die)).toEqual([[presence('Base'), [`${roomB}|${parentRemainderKey(roomB)}`]]])
        })

        it('joins a child that is listed under two of the scrubbed bindings, one level down (M18)', async () => {
            const world = {
                [set]: testLudicGraph(set, { nodes: [
                    { tag: 'Object', universalKey: set },
                    presenceBindingNode('a', roomA, { members: [{ host: apple, presence: presence('apple-a') }] }),
                    presenceBindingNode('b', roomB, { members: [{ host: apple, presence: presence('apple-b') }] }),
                ] }),
                [apple]: testLudicGraph(apple, { nodes: [
                    presenceBindingNode('apple-a', { host: set, presence: presence('a') }),
                    presenceBindingNode('apple-b', { host: set, presence: presence('b') }),
                ] }),
                [hand]: handGraph,
                [roomA]: room(roomA, [set]),
                [roomB]: room(roomB, [set]),
            }

            const resolved = await resolvePresenceMoves({ moved: set, froms: [roomA, roomB], to: hand, getGraph: getGraphOf(world) })
            if (!resolved.ok) { throw new Error(resolved.errorCode) }

            expect(resolved.steps.map((step) => [step.kind, step.hostId])).toEqual([
                ['reparentPresenceBinding', set],
                ['reparentPresenceBinding', set],
                ['joinPresenceBindings', set],
                ['joinPresenceBindings', apple],
            ])
            // every host the steps write is one the footprint locks
            expect(computeStepSequenceFootprint(resolved.steps, () => undefined)).toEqual(new Set([set, apple, roomA, roomB, hand]))
            const after = apply(resolved.steps, world)
            expect(bindingsOf(after, set)).toEqual([[presence('a'), [`${hand}|${presence('Base')}`]]])
            expect(bindingsOf(after, apple)).toEqual([[presence('apple-a'), [`${set}|${presence('a')}`]]])
        })
    })

    describe('a mover with no binding under a from host', () => {
        it('gains the destination for its hostless binding, losing nothing', async () => {
            const world = {
                [die]: testLudicGraph(die, { nodes: [{ tag: 'Object', universalKey: die }, presenceBindingNode('Base')] }),
                [roomA]: room(roomA),
            }

            const resolved = await resolvePresenceMoves({ moved: die, froms: [], to: roomA, getGraph: getGraphOf(world) })

            expect(resolved).toEqual({ ok: true, steps: [{
                kind: 'reparentPresenceBinding',
                hostId: die,
                presence: presence('Base'),
                gain: [{ host: roomA, presence: parentRemainderKey(roomA) }],
            }] })
        })

        it('mints a Base ahead of the reparent when it holds no binding at all', async () => {
            const world = { [die]: testLudicGraph(die, { nodes: [{ tag: 'Object', universalKey: die }] }), [roomA]: room(roomA) }

            const resolved = await resolvePresenceMoves({ moved: die, froms: [], to: roomA, getGraph: getGraphOf(world) })
            if (!resolved.ok) { throw new Error(resolved.errorCode) }

            expect(resolved.steps).toEqual([
                { kind: 'addPresenceBinding', hostId: die, fromHostPresences: [], presenceUuid: 'Base' },
                expect.objectContaining({ kind: 'reparentPresenceBinding', presence: presence('Base'), gain: [{ host: roomA, presence: parentRemainderKey(roomA) }] }),
            ])
            expect(bindingsOf(apply(resolved.steps, world), die)).toEqual([[presence('Base'), [`${roomA}|${parentRemainderKey(roomA)}`]]])
        })
    })

    describe('a departure', () => {
        it('names no step for a mover with no binding under the from hosts', async () => {
            const world = { [die]: testLudicGraph(die, { nodes: [{ tag: 'Object', universalKey: die }, presenceBindingNode('Base')] }) }

            expect(await resolvePresenceMoves({ moved: die, froms: [roomA], to: null, getGraph: getGraphOf(world) })).toEqual({ ok: true, steps: [] })
        })

        it('a binding that loses its last parent is removed at the run\'s end, and its child falls to Unplaced (M10)', async () => {
            const world = {
                [set]: testLudicGraph(set, { nodes: [
                    { tag: 'Object', universalKey: set },
                    presenceBindingNode('Base', undefined, { members: [] }),
                    presenceBindingNode('on-a', roomA, { members: [{ host: apple, presence: presence('apple') }] }),
                ] }),
                [apple]: testLudicGraph(apple, { nodes: [presenceBindingNode('apple', { host: set, presence: presence('on-a') })] }),
                [roomA]: room(roomA, [set]),
            }

            const resolved = await resolvePresenceMoves({ moved: set, froms: [roomA], to: null, getGraph: getGraphOf(world) })
            if (!resolved.ok) { throw new Error(resolved.errorCode) }
            const after = apply(resolved.steps, world)

            expect(after.get(set)!.presenceNodes.map(({ universalKey }) => universalKey)).toEqual([presence('Base'), presence('Unplaced')])
            expect(after.get(apple)!.presenceNodes[0].fromHostPresences).toEqual([{ host: set, presence: presence('Unplaced') }])
        })
    })

    describe('refusals', () => {
        it('still refuses several distinct bindings under one from host that nothing narrows', async () => {
            const world = {
                [die]: testLudicGraph(die, { nodes: [{ tag: 'Object', universalKey: die }, presenceBindingNode('x', roomA), presenceBindingNode('y', roomA)] }),
                [roomB]: room(roomB),
            }

            expect(await resolvePresenceMoves({ moved: die, froms: [roomA], to: roomB, getGraph: getGraphOf(world) })).toEqual({ ok: false, errorCode: 'moverBindingAmbiguous' })
        })
    })
})

describe('partMoveSteps', () => {
    const table = 'OBJECT#Table' as EphemeraObjectId
    const book = 'OBJECT#Book' as EphemeraObjectId
    const entry = (host: EphemeraObjectId, name: string) => ({ host, presence: presence(name) })

    it('M9: part of a hostless Base is placed, and Base\'s own parents do not change', () => {
        const world = {
            [table]: testLudicGraph(table, { nodes: [
                { tag: 'Object', universalKey: table },
                presenceBindingNode('Base', undefined, { members: [entry(book, 'book-base')] }),
            ] }),
            [book]: testLudicGraph(book, { nodes: [presenceBindingNode('book-base', { host: table, presence: presence('Base') })] }),
            [roomA]: room(roomA),
        }

        const after = apply(partMoveSteps({
            hostId: table,
            binding: world[table].presenceNodes[0],
            part: [entry(book, 'book-base')],
            presenceUuid: 'N',
            gain: [{ host: roomA, presence: parentRemainderKey(roomA) }],
        }), world)

        expect(after.get(table)!.presenceNodes.map(({ universalKey, fromHostPresences }) => [universalKey, fromHostPresences.length])).toEqual([[presence('Base'), 0], [presence('N'), 1]])
    })

    it('M9a: part of a placed Base is placed elsewhere, and Base keeps its parent and the rest of its cover', () => {
        const world = {
            [table]: testLudicGraph(table, { nodes: [
                { tag: 'Object', universalKey: table },
                presenceBindingNode('Base', roomA, { members: [entry(book, 'book-base'), entry(die, 'die-base')] }),
            ] }),
            [book]: testLudicGraph(book, { nodes: [presenceBindingNode('book-base', { host: table, presence: presence('Base') })] }),
            [die]: testLudicGraph(die, { nodes: [presenceBindingNode('die-base', { host: table, presence: presence('Base') })] }),
            [roomA]: room(roomA, [table]),
            [roomB]: room(roomB),
        }

        const after = apply(partMoveSteps({
            hostId: table,
            binding: world[table].presenceNodes[0],
            part: [entry(book, 'book-base')],
            presenceUuid: 'N',
            lose: [{ host: roomA, presence: parentRemainderKey(roomA) }],
            gain: [{ host: roomB, presence: parentRemainderKey(roomB) }],
        }), world)

        expect(bindingsOf(after, table)).toEqual([
            [presence('Base'), [`${roomA}|${parentRemainderKey(roomA)}`]],
            [presence('N'), [`${roomB}|${parentRemainderKey(roomB)}`]],
        ])
        expect(after.get(table)!.presenceNodes.map(({ cover }) => cover.members)).toEqual([[entry(die, 'die-base')], [entry(book, 'book-base')]])
    })
})
