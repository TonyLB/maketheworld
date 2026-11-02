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
 * Parent sets (PR-25: one shared binding), through the real planner, compiler and kernel apply,
 * judged by the classifier the deployed `PresenceCoverDriftSweep` uses.
 *
 * A tablecloth is spread over two pushed-together tables (one binding on each), and a fruit bowl
 * straddles the seam: ONE binding of the bowl, under BOTH cloth bindings (their covers overlap on it).
 * No play path writes this share yet, so the bowl is a fixture. The point is what follows from it: a
 * write to the bowl lands once and shows from both cloth bindings, and an apple leaves the bowl in one
 * move.
 */

const diningRoom = 'ROOM#DiningRoom' as EphemeraRoomId
const tableA = 'OBJECT#TableA' as EphemeraObjectId
const tableB = 'OBJECT#TableB' as EphemeraObjectId
const cloth = 'OBJECT#Tablecloth' as EphemeraObjectId
const bowl = 'OBJECT#FruitBowl' as EphemeraObjectId
const napkin = 'OBJECT#Napkin' as EphemeraObjectId
const apple = 'OBJECT#Apple' as EphemeraObjectId
const pear = 'OBJECT#Pear' as EphemeraObjectId
const tess = 'CHARACTER#Tess' as EphemeraCharacterId
const presence = (name: string) => `PRESENCE#${name}` as EphemeraPresenceNodeId
const obj = (universalKey: EphemeraObjectId) => ({ tag: 'Object' as const, universalKey })

const tableAInRoom = { host: tableA, presence: presence('inRoom') }
const tableBInRoom = { host: tableB, presence: presence('inRoom') }
const overA = { host: cloth, presence: presence('overA') }
const overB = { host: cloth, presence: presence('overB') }
const bowlUnder = { host: bowl, presence: presence('bowl') }
const tessBase = { host: tess, presence: presence('Base') }

const viewOf = presenceGraphViewOf

const world = (): Record<string, EphemeraLudicGraph> => ({
    [diningRoom]: testLudicGraph(diningRoom, { nodes: [obj(tableA), obj(tableB), presenceBindingNode(parentRemainderKey(diningRoom))] }),
    [tableA]: testLudicGraph(tableA, { nodes: [obj(tableA), obj(cloth), presenceBindingNode('inRoom', diningRoom, { members: [overA] })] }),
    [tableB]: testLudicGraph(tableB, { nodes: [obj(tableB), obj(cloth), presenceBindingNode('inRoom', diningRoom, { members: [overB] })] }),
    // the cloth is spread over both tables: two bindings, one on each, whose covers overlap on the bowl
    [cloth]: testLudicGraph(cloth, { nodes: [
        obj(cloth), obj(bowl), obj(napkin),
        presenceBindingNode('overA', tableAInRoom, { members: [bowlUnder] }),
        presenceBindingNode('overB', tableBInRoom, { members: [bowlUnder, { host: napkin, presence: presence('napkin') }] }),
    ] }),
    // ONE binding of the bowl, which straddles the seam between the tables: both cloth bindings are its parents
    [bowl]: testLudicGraph(bowl, { nodes: [
        obj(bowl), obj(apple),
        presenceBindingNode('bowl', [overA, overB], { members: [{ host: apple, presence: presence('apple') }] }),
    ] }),
    [napkin]: testLudicGraph(napkin, { nodes: [presenceBindingNode('napkin', overB)] }),
    [apple]: testLudicGraph(apple, { nodes: [presenceBindingNode('apple', bowlUnder)] }),
    [pear]: testLudicGraph(pear, { nodes: [presenceBindingNode('pear', tessBase)] }),
    [tess]: testLudicGraph(tess, { nodes: [
        { tag: 'Character' as const, universalKey: tess }, obj(pear),
        presenceBindingNode('Base', undefined, { members: [{ host: pear, presence: presence('pear') }] }),
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

/** Every finding and rebuild the sweep would report, across the hosts named. */
const sweepOf = (graphs: ReadonlyMap<string, EphemeraLudicGraph>, hosts: string[]) => {
    const viewFor = (id: string) => graphs.has(id) ? viewOf(graphs.get(id)!) : undefined
    return hosts.map((host) => ({
        host,
        findings: classifyPresenceCoverDrift(viewOf(graphs.get(host)!), viewFor).findings,
        rebuilds: coverRebuildsFor(viewOf(graphs.get(host)!), (id) => viewFor(id)!),
    }))
}
const clean = (hosts: string[]) => hosts.map((host) => ({ host, findings: [], rebuilds: [] }))
const swept = [tableA, tableB, cloth, bowl, apple]

describe('the fruit bowl shared under both bindings of a cloth spread over two tables (PR-25)', () => {
    it('the fixture is sound: one binding of the bowl, two parents, listed once by each cloth binding', () => {
        const graphs = new Map(Object.entries(world()))

        expect(sweepOf(graphs, swept)).toEqual(clean(swept))
        expect(graphs.get(bowl)!.presenceNodes.filter(({ universalKey }) => universalKey === presence('bowl'))).toHaveLength(1)
        expect(graphs.get(bowl)!.presenceNodes[0].fromHostPresences).toEqual([overA, overB])
        graphs.get(cloth)!.presenceNodes.forEach(({ cover }) => {
            expect(cover.members.filter(({ host }) => host === bowl)).toHaveLength(1)
        })
    })

    describe('an add to the bowl lands once and is seen from both', () => {
        // a pear in Tess's hand is put into the bowl, which is one binding seen through both cloth bindings
        const put = () => planObjectMoveTransfer({
            entityId: pear,
            fromHostId: tess,
            toHostId: bowl,
            getGraph: getGraphOf(world()),
        })

        it('resolves the one shared binding, whichever cloth binding the bowl is seen through', async () => {
            const found = destinationBindingOf((await getGraphOf(world())(bowl)) as EphemeraLudicGraph)

            expect(found).toEqual({ presence: presence('bowl') })
        })

        it('writes one reparent', async () => {
            const planned = await put()
            if (!planned.ok) { throw new Error(planned.errorCode) }

            expect(planned.plan.steps.filter((step) => step.kind === 'reparentPresenceBinding')).toEqual([expect.objectContaining({
                hostId: pear,
                presence: presence('pear'),
                lose: [tessBase],
                gain: [bowlUnder],
            })])
        })

        it('leaves the pear with one parent, listed once by the bowl, and the sweep clean', async () => {
            const planned = await put()
            if (!planned.ok) { throw new Error(planned.errorCode) }

            const after = applyPlanned(planned.plan, world())

            expect(after.get(pear)!.presenceNodes.map(({ fromHostPresences }) => fromHostPresences)).toEqual([[bowlUnder]])
            expect(after.get(bowl)!.presenceNodes).toHaveLength(1)
            expect(after.get(bowl)!.presenceNodes[0].cover.members.filter(({ host }) => host === pear)).toHaveLength(1)
            expect(sweepOf(after, [...swept, pear, tess])).toEqual(clean([...swept, pear, tess]))
        })

        it('is seen from the dining room once, through both cloth bindings', async () => {
            const planned = await put()
            if (!planned.ok) { throw new Error(planned.errorCode) }
            const after = applyPlanned(planned.plan, world())

            const rooms = await roomsForPresenceNode(pear, presence('pear'), getGraphOf(after))

            expect([...rooms]).toEqual([diningRoom])
        })
    })

    describe('an apple leaves the bowl in one move', () => {
        const take = () => planObjectMoveTransfer({
            entityId: apple,
            fromHostId: bowl,
            toHostId: tess,
            getGraph: getGraphOf(world()),
        })

        it('is one reparent that loses the bowl\'s binding, not refused as ambiguous and not two moves', async () => {
            const planned = await take()
            if (!planned.ok) { throw new Error(planned.errorCode) }

            expect(planned.plan.steps.filter((step) => step.kind === 'reparentPresenceBinding')).toEqual([expect.objectContaining({
                hostId: apple,
                presence: presence('apple'),
                lose: [bowlUnder],
                gain: [tessBase],
            })])
        })

        it('leaves the apple in the hand only, out of the bowl, with the sweep clean', async () => {
            const planned = await take()
            if (!planned.ok) { throw new Error(planned.errorCode) }

            const after = applyPlanned(planned.plan, world())

            expect(after.get(apple)!.presenceNodes.map(({ fromHostPresences }) => fromHostPresences)).toEqual([[tessBase]])
            expect(after.get(bowl)!.presenceNodes[0].cover.members).toEqual([])
            expect(sweepOf(after, [...swept, tess])).toEqual(clean([...swept, tess]))
        })

        it('is no longer in the dining room through the bowl', async () => {
            const planned = await take()
            if (!planned.ok) { throw new Error(planned.errorCode) }
            const after = applyPlanned(planned.plan, world())

            // the hand is not in the dining room in this fixture, so the apple reaches no room
            const rooms = await roomsForPresenceNode(apple, presence('apple'), getGraphOf(after))

            expect([...rooms]).toEqual([])
        })
    })
})
