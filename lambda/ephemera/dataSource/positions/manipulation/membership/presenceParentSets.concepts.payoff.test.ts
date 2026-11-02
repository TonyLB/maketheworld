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
 * PR-C5 with its two Concepts, Inherited Furniture (a collection) and Boardgames (a category). The steamer
 * chest sits on the attic floor (a physical binding under the attic's Base) and is associated with each
 * Concept (one `Associated` binding under each Concept's attic binding, covering nothing). The games are in
 * the chest's physical binding. Association places nothing: the moves below run through the real planner,
 * compiler and kernel apply, judged by the classifier the deployed `PresenceCoverDriftSweep` uses, and leave
 * the Concepts untouched.
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
const chestOnFloor = { host: chest, presence: presence('onFloor') }
const chestFurniture = { host: chest, presence: presence('asFurniture') }
const chestBoardgames = { host: chest, presence: presence('asBoardgames') }
const bgUnder = { host: set, presence: presence('bg') }
const tessBase = { host: tess, presence: presence('Base') }

const viewOf = presenceGraphViewOf

const world = (): Record<string, EphemeraLudicGraph> => ({
    // the attic hosts the chest physically, and each Concept's binding (Associated)
    [attic]: testLudicGraph(attic, { nodes: [
        obj(chest), associated(concept(furniture)), associated(concept(boardgames)),
        presenceBindingNode('Base', undefined, { members: [chestOnFloor, furnitureInAttic, boardgamesInAttic] }),
    ] }),
    // each Concept: a hostless Base, one binding in the attic, and the chest Associated under that binding
    [furniture]: testLudicGraph(furniture, { nodes: [
        concept(furniture), associated(obj(chest)),
        presenceBindingNode('Base'),
        presenceBindingNode('inAttic', atticBase, { members: [chestFurniture] }),
    ] }),
    [boardgames]: testLudicGraph(boardgames, { nodes: [
        concept(boardgames), associated(obj(chest)),
        presenceBindingNode('Base'),
        presenceBindingNode('inAttic', atticBase, { members: [chestBoardgames] }),
    ] }),
    // the chest: one physical binding holding the games, and one association binding per Concept, covering nothing
    [chest]: testLudicGraph(chest, { nodes: [
        obj(chest), obj(set), obj(otherGame),
        presenceBindingNode('onFloor', atticBase, { members: [bgUnder, { host: otherGame, presence: presence('chess') }] }),
        presenceBindingNode('asFurniture', furnitureInAttic),
        presenceBindingNode('asBoardgames', boardgamesInAttic),
    ] }),
    [set]: testLudicGraph(set, { nodes: [
        obj(set), obj(die),
        presenceBindingNode('bg', chestOnFloor, { members: [{ host: die, presence: presence('die') }] }),
    ] }),
    [otherGame]: testLudicGraph(otherGame, { nodes: [presenceBindingNode('chess', chestOnFloor)] }),
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

describe('PR-C5 with its Concepts: the chest on the attic floor, associated with Inherited Furniture and Boardgames', () => {
    it('the fixture is sound: one physical chest binding and one association binding per Concept, and the sweep is clean', () => {
        const graphs = new Map(Object.entries(world()))

        expect(sweepOf(graphs, swept)).toEqual(clean(swept))
        expect(graphs.get(chest)!.presenceNodes.map(({ fromHostPresences }) => fromHostPresences)).toEqual([[atticBase], [furnitureInAttic], [boardgamesInAttic]])
        expect(graphs.get(set)!.presenceNodes[0].fromHostPresences).toEqual([chestOnFloor])
    })

    it('reaches the attic from the set, through the chest\'s physical binding', async () => {
        const rooms = await roomsForPresenceNode(set, presence('bg'), getGraphOf(world()))

        expect([...rooms]).toEqual([attic])
    })

    describe('a die put into the set is seen from the attic', () => {
        const put = () => planObjectMoveTransfer({
            entityId: spareDie,
            fromHostId: tess,
            toHostId: set,
            getGraph: getGraphOf(world()),
        })

        it('writes one reparent onto the set\'s binding', async () => {
            const planned = await put()
            if (!planned.ok) { throw new Error(planned.errorCode) }

            expect(planned.plan.steps.filter((step) => step.kind === 'reparentPresenceBinding')).toEqual([expect.objectContaining({
                hostId: spareDie,
                presence: presence('spare'),
                lose: [tessBase],
                gain: [bgUnder],
            })])
        })

        it('leaves the sweep clean and the die in the attic, through the chest', async () => {
            const planned = await put()
            if (!planned.ok) { throw new Error(planned.errorCode) }
            const after = applyPlanned(planned.plan, world())

            expect(sweepOf(after, [...swept, spareDie, tess])).toEqual(clean([...swept, spareDie, tess]))
            const rooms = await roomsForPresenceNode(spareDie, presence('spare'), getGraphOf(after))
            expect([...rooms]).toEqual([attic])
        })
    })

    describe('a die taken out of the set leaves the Concepts untouched', () => {
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
