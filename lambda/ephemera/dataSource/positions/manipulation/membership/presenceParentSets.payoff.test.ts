import type { EphemeraCharacterId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { classifyPresenceCoverDrift, coverRebuildsFor } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { roomsForPresenceNode } from '../../ludicGraph/presenceRooms'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { presenceGraphViewOf } from '../../ludicGraph/presenceParent'
import { applyStepSequenceCore } from '../kernel/applyStepSequenceCore'
import { isKernelMutationStep } from '../kernel/kernelStep'
import { destinationBindingOf } from './resolvePresenceMoves'
import { planObjectMoveTransfer } from './planObjectMoveTransfer'

/**
 * PR-C5 beats 2 and 3 (parent sets: one shared binding), through the real planner, compiler
 * and kernel apply, judged by the classifier the deployed `PresenceCoverDriftSweep` uses.
 *
 * The backgammon set holds ONE binding under BOTH of the steamer chest's bindings (the chest's two
 * covers overlap on it). No play path writes a share between two bindings of one host, so the set is
 * a fixture. The point is what follows from it: a write to the set lands once and shows from both
 * chest bindings, and a die leaves the set in one move.
 */

const attic = 'ROOM#Attic' as EphemeraRoomId
const chest = 'OBJECT#SteamerChest' as EphemeraObjectId
const set = 'OBJECT#Backgammon' as EphemeraObjectId
const otherGame = 'OBJECT#Chess' as EphemeraObjectId
const die = 'OBJECT#Die' as EphemeraObjectId
const spareDie = 'OBJECT#SpareDie' as EphemeraObjectId
const tess = 'CHARACTER#Tess' as EphemeraCharacterId
const presence = (name: string) => `PRESENCE#${name}` as EphemeraPresenceNodeId
const obj = (universalKey: EphemeraObjectId) => ({ tag: 'Object' as const, universalKey })

const chestA = { host: chest, presence: presence('chestA') }
const chestB = { host: chest, presence: presence('chestB') }
const bgUnder = { host: set, presence: presence('bg') }
const tessBase = { host: tess, presence: presence('Base') }

const viewOf = presenceGraphViewOf

const world = (): Record<string, EphemeraLudicGraph> => ({
    [attic]: testLudicGraph(attic, { nodes: [obj(chest), presenceBindingNode(parentRemainderKey(attic))] }),
    // two bindings of the chest, both in the attic; their covers overlap on Backgammon
    [chest]: testLudicGraph(chest, { nodes: [
        obj(chest), obj(set), obj(otherGame),
        presenceBindingNode('chestA', attic, { members: [{ host: set, presence: presence('bg') }] }),
        presenceBindingNode('chestB', attic, { members: [{ host: set, presence: presence('bg') }, { host: otherGame, presence: presence('chess') }] }),
    ] }),
    // ONE binding of the set, with both chest bindings as parents
    [set]: testLudicGraph(set, { nodes: [
        obj(set), obj(die),
        presenceBindingNode('bg', [chestA, chestB], { members: [{ host: die, presence: presence('die') }] }),
    ] }),
    [otherGame]: testLudicGraph(otherGame, { nodes: [presenceBindingNode('chess', chestB)] }),
    [die]: testLudicGraph(die, { nodes: [presenceBindingNode('die', bgUnder)] }),
    [spareDie]: testLudicGraph(spareDie, { nodes: [presenceBindingNode('spare', tessBase)] }),
    [tess]: testLudicGraph(tess, { nodes: [
        { tag: 'Character' as const, universalKey: tess }, obj(spareDie),
        presenceBindingNode('Base', undefined, { members: [{ host: spareDie, presence: presence('spare') }] }),
    ] }),
})

const getGraphOf = (graphs: Record<string, EphemeraLudicGraph> | ReadonlyMap<string, EphemeraLudicGraph>) => async (hostId: string): Promise<EphemeraLudicGraph> => (
    (graphs instanceof Map ? graphs.get(hostId) : (graphs as Record<string, EphemeraLudicGraph>)[hostId]) ?? testLudicGraph(hostId as EphemeraMembershipHostId)
)

const applyPlanned = (plan: { steps: readonly Parameters<typeof isKernelMutationStep>[0][] }, graphs: Record<string, EphemeraLudicGraph>) => {
    const outcome = applyStepSequenceCore(plan.steps.filter(isKernelMutationStep), new Map(Object.entries(graphs) as [EphemeraMembershipHostId, EphemeraLudicGraph][]))
    if (outcome.verdict !== 'legal') {
        throw new Error(`expected a legal outcome, got ${JSON.stringify(outcome)}`)
    }
    return outcome.graphs
}

/** Every finding and rebuild the sweep would report, across the chest, the set, and the dice. */
const sweepOf = (graphs: ReadonlyMap<string, EphemeraLudicGraph>, hosts: string[]) => {
    const viewFor = (id: string) => graphs.has(id) ? viewOf(graphs.get(id)!) : undefined
    return hosts.map((host) => ({
        host,
        findings: classifyPresenceCoverDrift(viewOf(graphs.get(host)!), viewFor).findings,
        rebuilds: coverRebuildsFor(viewOf(graphs.get(host)!), (id) => viewFor(id)!),
    }))
}
const clean = (hosts: string[]) => hosts.map((host) => ({ host, findings: [], rebuilds: [] }))
const swept = [chest, set, die]

describe('the backgammon set shared under both chest bindings (PR-C5 beats 2 and 3)', () => {
    it('the fixture is sound: one binding of the set, two parents, listed once by each chest binding', () => {
        const graphs = new Map(Object.entries(world()))

        expect(sweepOf(graphs, swept)).toEqual(clean(swept))
        expect(graphs.get(set)!.presenceNodes.filter(({ universalKey }) => universalKey === presence('bg'))).toHaveLength(1)
        expect(graphs.get(set)!.presenceNodes[0].fromHostPresences).toEqual([chestA, chestB])
        graphs.get(chest)!.presenceNodes.forEach(({ cover }) => {
            expect(cover.members.filter(({ host }) => host === set)).toHaveLength(1)
        })
    })

    describe('beat 2: an add to the set lands once and is seen from both', () => {
        // a die in Tess's hand is put into the set, which is one binding seen through both chest bindings
        const put = () => planObjectMoveTransfer({
            entityId: spareDie,
            fromHostId: tess,
            toHostId: set,
            getGraph: getGraphOf(world()),
        })

        it('resolves the one shared binding, whichever chest binding the set is seen through', async () => {
            const found = destinationBindingOf((await getGraphOf(world())(set)) as EphemeraLudicGraph)

            expect(found).toEqual({ presence: presence('bg') })
        })

        it('writes one reparent', async () => {
            const planned = await put()
            if (!planned.ok) { throw new Error(planned.errorCode) }

            expect(planned.plan.steps.filter((step) => step.kind === 'reparentPresenceBinding')).toEqual([expect.objectContaining({
                hostId: spareDie,
                presence: presence('spare'),
                lose: [tessBase],
                gain: [bgUnder],
            })])
        })

        it('leaves the die with one parent, listed once by the set, and the sweep clean', async () => {
            const planned = await put()
            if (!planned.ok) { throw new Error(planned.errorCode) }

            const after = applyPlanned(planned.plan, world())

            expect(after.get(spareDie)!.presenceNodes.map(({ fromHostPresences }) => fromHostPresences)).toEqual([[bgUnder]])
            expect(after.get(set)!.presenceNodes).toHaveLength(1)
            expect(after.get(set)!.presenceNodes[0].cover.members.filter(({ host }) => host === spareDie)).toHaveLength(1)
            expect(sweepOf(after, [chest, set, die, spareDie, tess])).toEqual(clean([chest, set, die, spareDie, tess]))
        })

        it('is seen from the attic once, through both chest bindings', async () => {
            const planned = await put()
            if (!planned.ok) { throw new Error(planned.errorCode) }
            const after = applyPlanned(planned.plan, world())

            const rooms = await roomsForPresenceNode(spareDie, presence('spare'), getGraphOf(after))

            expect([...rooms]).toEqual([attic])
        })
    })

    describe('beat 3: a die leaves the set in one move', () => {
        const take = () => planObjectMoveTransfer({
            entityId: die,
            fromHostId: set,
            toHostId: tess,
            getGraph: getGraphOf(world()),
        })

        it('is one reparent that loses the set\'s binding, not refused as ambiguous and not two moves', async () => {
            const planned = await take()
            if (!planned.ok) { throw new Error(planned.errorCode) }

            expect(planned.plan.steps.filter((step) => step.kind === 'reparentPresenceBinding')).toEqual([expect.objectContaining({
                hostId: die,
                presence: presence('die'),
                lose: [bgUnder],
                gain: [tessBase],
            })])
        })

        it('leaves the die in the hand only, out of the set, with the sweep clean', async () => {
            const planned = await take()
            if (!planned.ok) { throw new Error(planned.errorCode) }

            const after = applyPlanned(planned.plan, world())

            expect(after.get(die)!.presenceNodes.map(({ fromHostPresences }) => fromHostPresences)).toEqual([[tessBase]])
            expect(after.get(set)!.presenceNodes[0].cover.members).toEqual([])
            expect(sweepOf(after, [chest, set, die, tess])).toEqual(clean([chest, set, die, tess]))
        })

        it('is no longer in the attic through the chest', async () => {
            const planned = await take()
            if (!planned.ok) { throw new Error(planned.errorCode) }
            const after = applyPlanned(planned.plan, world())

            // the hand is not in the attic in this fixture, so the die reaches no room
            const rooms = await roomsForPresenceNode(die, presence('die'), getGraphOf(after))

            expect([...rooms]).toEqual([])
        })
    })
})
