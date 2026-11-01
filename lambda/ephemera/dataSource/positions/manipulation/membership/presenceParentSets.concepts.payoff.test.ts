import type { EphemeraCharacterId, EphemeraConceptId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { classifyPresenceCoverDrift, coverRebuildsFor } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { roomsForPresenceNode } from '../../ludicGraph/presenceRooms'
import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { presenceGraphViewOf } from '../../ludicGraph/presenceParent'
import { applyStepSequenceCore } from '../kernel/applyStepSequenceCore'
import { isKernelMutationStep } from '../kernel/kernelStep'
import { planObjectMoveTransfer } from './planObjectMoveTransfer'

/**
 * PR-C5 re-expressed with its two Concepts: Inherited Furniture (a collection) and Boardgames (a category)
 * each hold a binding in the attic, and the steamer chest is in the attic only through them --- one
 * `Associated` binding under each. The backgammon set's one binding has both chest bindings as parents, as in
 * `presenceParentSets.payoff.test.ts` (the physical-only case, which parents the chest directly on the attic).
 * Beats 2 and 3 run unchanged through the real planner, compiler and kernel apply, judged by the classifier the
 * deployed `PresenceCoverDriftSweep` uses. Beat 1 (covers that differ per association) is not modelled.
 */

const attic = 'ROOM#Attic' as EphemeraRoomId
const furniture = 'CONCEPT#InheritedFurniture' as EphemeraConceptId
const boardgames = 'CONCEPT#Boardgames' as EphemeraConceptId
const chest = 'OBJECT#SteamerChest' as EphemeraObjectId
const set = 'OBJECT#Backgammon' as EphemeraObjectId
const otherGame = 'OBJECT#Chess' as EphemeraObjectId
const die = 'OBJECT#Die' as EphemeraObjectId
const spareDie = 'OBJECT#SpareDie' as EphemeraObjectId
const tess = 'CHARACTER#Tess' as EphemeraCharacterId
const presence = (name: string) => `PRESENCE#${name}` as EphemeraPresenceNodeId
const obj = (universalKey: EphemeraObjectId) => ({ tag: 'Object' as const, universalKey })
const associated = <T extends { tag: string; universalKey: string }>(node: T) => ({ ...node, hostingKind: 'Associated' as const })
const concept = (universalKey: EphemeraConceptId) => ({ tag: 'Concept' as const, universalKey })

const atticBase = { host: attic, presence: presence('Base') }
const furnitureInAttic = { host: furniture, presence: presence('inAttic') }
const boardgamesInAttic = { host: boardgames, presence: presence('inAttic') }
const chestA = { host: chest, presence: presence('chestA') }
const chestB = { host: chest, presence: presence('chestB') }
const bgUnder = { host: set, presence: presence('bg') }
const tessBase = { host: tess, presence: presence('Base') }

const viewOf = presenceGraphViewOf

const world = (): Record<string, EphemeraLudicGraph> => ({
    // the attic hosts each Concept's binding (Associated), and nothing physical
    [attic]: testLudicGraph(attic, { nodes: [
        associated(concept(furniture)), associated(concept(boardgames)),
        presenceBindingNode('Base', undefined, { members: [furnitureInAttic, boardgamesInAttic] }),
    ] }),
    // each Concept: a hostless Base, one binding in the attic, and the chest Associated under that binding
    [furniture]: testLudicGraph(furniture, { nodes: [
        concept(furniture), associated(obj(chest)),
        presenceBindingNode('Base'),
        presenceBindingNode('inAttic', atticBase, { members: [chestA] }),
    ] }),
    [boardgames]: testLudicGraph(boardgames, { nodes: [
        concept(boardgames), associated(obj(chest)),
        presenceBindingNode('Base'),
        presenceBindingNode('inAttic', atticBase, { members: [chestB] }),
    ] }),
    // two bindings of the chest, one under each Concept; their covers overlap on Backgammon
    [chest]: testLudicGraph(chest, { nodes: [
        obj(chest), obj(set), obj(otherGame),
        presenceBindingNode('chestA', furnitureInAttic, { members: [bgUnder] }),
        presenceBindingNode('chestB', boardgamesInAttic, { members: [bgUnder, { host: otherGame, presence: presence('chess') }] }),
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
const swept = [attic, furniture, boardgames, chest, set, die]

describe('PR-C5 with its Concepts: the chest in the attic only through Inherited Furniture and Boardgames', () => {
    it('the fixture is sound: each chest binding sits under one Concept\'s attic binding, and the sweep is clean', () => {
        const graphs = new Map(Object.entries(world()))

        expect(sweepOf(graphs, swept)).toEqual(clean(swept))
        expect(graphs.get(chest)!.presenceNodes.map(({ fromHostPresences }) => fromHostPresences)).toEqual([[furnitureInAttic], [boardgamesInAttic]])
        expect(graphs.get(set)!.presenceNodes[0].fromHostPresences).toEqual([chestA, chestB])
    })

    it('reaches the attic from the set, through both Concepts', async () => {
        const rooms = await roomsForPresenceNode(set, presence('bg'), getGraphOf(world()))

        expect([...rooms]).toEqual([attic])
    })

    describe('beat 2: an add to the set lands once and is seen from the attic', () => {
        const put = () => planObjectMoveTransfer({
            entityId: spareDie,
            fromHostId: tess,
            toHostId: set,
            getGraph: getGraphOf(world()),
        })

        it('writes one reparent onto the shared binding', async () => {
            const planned = await put()
            if (!planned.ok) { throw new Error(planned.errorCode) }

            expect(planned.plan.steps.filter((step) => step.kind === 'reparentPresenceBinding')).toEqual([expect.objectContaining({
                hostId: spareDie,
                presence: presence('spare'),
                lose: [tessBase],
                gain: [bgUnder],
            })])
        })

        it('leaves the sweep clean and the die in the attic, through the chest and both Concepts', async () => {
            const planned = await put()
            if (!planned.ok) { throw new Error(planned.errorCode) }
            const after = applyPlanned(planned.plan, world())

            expect(sweepOf(after, [...swept, spareDie, tess])).toEqual(clean([...swept, spareDie, tess]))
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

        it('is one reparent that loses the set\'s binding', async () => {
            const planned = await take()
            if (!planned.ok) { throw new Error(planned.errorCode) }

            expect(planned.plan.steps.filter((step) => step.kind === 'reparentPresenceBinding')).toEqual([expect.objectContaining({
                hostId: die,
                presence: presence('die'),
                lose: [bgUnder],
                gain: [tessBase],
            })])
        })

        it('leaves the die out of the set and the attic, with the sweep clean and the Concepts untouched', async () => {
            const planned = await take()
            if (!planned.ok) { throw new Error(planned.errorCode) }
            const after = applyPlanned(planned.plan, world())

            expect(sweepOf(after, [...swept, tess])).toEqual(clean([...swept, tess]))
            expect(after.get(set)!.presenceNodes[0].cover.members).toEqual([])
            expect(after.get(furniture)?.toStored() ?? world()[furniture].toStored()).toEqual(world()[furniture].toStored())
            const rooms = await roomsForPresenceNode(die, presence('die'), getGraphOf(after))
            expect([...rooms]).toEqual([])
        })
    })
})
