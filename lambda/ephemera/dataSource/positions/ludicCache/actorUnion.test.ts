/**
 * Slice 0 evidence for the actor's cache (ISS8314, `AGENT.actorCache.planning.md`, AC-1): the union of the room's
 * cache and a cache seeded at the actor equals one fold over both walks, and a held binding's parent chain reaches
 * the room. Hand-authored graphs, no `jest.mock`, as the rest of this directory.
 */
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { mergedComponentResult, type ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { EphemeraLudicGraph, toStoredRelationalEdge } from '../ludicGraph'
import { buildLudicCache } from './fold'
import { handlesFromCache } from './catalogHandles'
import { unionLudicCaches } from './actorCache'
import type { EphemeraLudicCacheEdge, EphemeraLudicCacheNode } from './types'
import { isEphemeraLudicCacheData } from './types'
import {
    actorCacheGraphs, actorId, actorInRoom, bagHeld, bagId, coinId, coinInBag, graphReader, lampId, ropeAtTable, ropeHeld, ropeId, roomId, tableId, tableInRoom,
} from './actorCacheTestFixtures'

/** Every object is named for its id, so handles are built. */
const namedAggregate: ComponentAggregateMergedCache['get'] = async ([perspective]) => [mergedComponentResult({
    universalKey: perspective.universalKey as EphemeraObjectId,
    merged: new StandardObject({ tag: 'Object', shortName: perspective.universalKey.replace('OBJECT#', '').toLowerCase() }),
    mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
})]

const noShortNameDeps = () => ({ getComponentAggregate: jest.fn(async () => []) })

const unionOf = unionLudicCaches

const byKey = (nodes: EphemeraLudicCacheNode[]) => [...nodes].sort((a, b) => a.universalKey.localeCompare(b.universalKey))
const edgeSort = (edges: EphemeraLudicCacheEdge[]) => [...edges].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

describe('the actor\'s cache as a union of two folds (AC-1)', () => {
    it('equals one fold over both walks', async () => {
        const graphs = actorCacheGraphs()
        const getLudicGraph = graphReader(graphs)
        const { cache: room } = await buildLudicCache(roomId, [], { getLudicGraph, ...noShortNameDeps() })
        const { cache: actor } = await buildLudicCache(actorId, [], { getLudicGraph, ...noShortNameDeps() })

        // The reference: the actor's graph also names the room as a member, so one `buildLudicCache` seeded at the actor
        // walks (and folds) both walks. (A synthetic seed naming both would not do: the room walk never expands a
        // character other than its seed.)
        const actorGraph = graphs.get(actorId) as EphemeraLudicGraph
        const referenceGraphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>(graphs).set(actorId, EphemeraLudicGraph.fromFieldPayload(actorId, {
            rootId: actorGraph.rootId,
            nodes: [...actorGraph.componentNodes, { tag: 'Room', universalKey: roomId }, ...actorGraph.presenceNodes],
            edges: actorGraph.relationalEdges.map(toStoredRelationalEdge),
            ports: actorGraph.ports,
        }))
        const { cache: reference } = await buildLudicCache(actorId, [], { getLudicGraph: graphReader(referenceGraphs), ...noShortNameDeps() })
        const referenceNodes = reference.nodes

        const union = unionOf(room, actor)
        expect(byKey(union.nodes)).toEqual(byKey(referenceNodes))
        expect(edgeSort(union.edges)).toEqual(edgeSort(reference.edges))
        expect(isEphemeraLudicCacheData(union)).toBe(true)

        // The fixture is not degenerate: both halves contribute, and a node in both is the same node in each.
        expect(room.nodes.map((node) => node.universalKey)).not.toContain(bagId)
        expect(room.nodes.map((node) => node.universalKey)).not.toContain(coinId)
        expect(actor.nodes.map((node) => node.universalKey)).toEqual(expect.arrayContaining([actorId, bagId, coinId, ropeId]))
        expect(room.nodes.find((node) => node.universalKey === ropeId)).toEqual(actor.nodes.find((node) => node.universalKey === ropeId))
        // Edges: the room's same-host edge, the actor's crossing edge (rope -> coin, composed across the bag's port).
        expect(union.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ from: lampId, to: ropeId }),
            expect.objectContaining({ from: ropeId, to: coinId }),
        ]))
        expect(room.edges.some((edge) => edge.to === coinId)).toBe(false)
    })

    it('keeps both of the half-held rope\'s bindings', async () => {
        const { cache: actor } = await buildLudicCache(actorId, [], { getLudicGraph: graphReader(actorCacheGraphs()), ...noShortNameDeps() })
        const rope = actor.nodes.find((node) => node.universalKey === ropeId)
        expect(rope?.presenceNodes.map((binding) => binding.universalKey)).toEqual([ropeAtTable, ropeHeld])
    })
})

describe('the actor\'s cache reaches the room (the actor special case)', () => {
    it('gives a held binding a parent chain through the actor\'s binding to the room', async () => {
        const { cache } = await buildLudicCache(actorId, [], { getLudicGraph: graphReader(actorCacheGraphs()), ...noShortNameDeps() })
        const bindingOf = (host: string, presence: string) => cache.nodes.find((node) => node.universalKey === host)?.presenceNodes.find((binding) => binding.universalKey === presence)
        expect(bindingOf(actorId, actorInRoom)?.fromHostPresences).toEqual([{ host: roomId, presence: expect.any(String) }])
        expect(bindingOf(bagId, bagHeld)?.fromHostPresences).toEqual([{ host: actorId, presence: actorInRoom }])
        expect(bindingOf(coinId, coinInBag)?.fromHostPresences).toEqual([{ host: bagId, presence: bagHeld }])
    })

    it('resolves `rooms` for the held bag, the coin in it and the held part of the rope, and leaves the part tied to the table unresolved (actor fold alone)', async () => {
        const { cache } = await buildLudicCache(actorId, [], { getLudicGraph: graphReader(actorCacheGraphs()), getComponentAggregate: namedAggregate })
        const handles = handlesFromCache(cache, actorId)
        const placementOf = (objectId: string) => handles.find((handle) => handle.objectId === objectId)?.placement
        const ownBinding = (objectId: string, presence: string) => placementOf(objectId)
            ?.find((run) => run.host === objectId)?.bindings.find((binding) => binding.presence === presence)

        expect(ownBinding(bagId, bagHeld)?.rooms).toEqual([roomId])
        expect(ownBinding(coinId, coinInBag)?.rooms).toEqual([roomId])
        expect(ownBinding(ropeId, ropeHeld)?.rooms).toEqual([roomId])
        // Finding: the tied part names the table's binding as its parent, but the table is not in an actor-seeded walk, so
        // an actor-only cache cannot resolve `rooms` for it. The room half of the union supplies the table, which is why
        // the actor's cache is the union and not the actor fold alone (AC-1).
        expect(ownBinding(ropeId, ropeAtTable)?.under).toEqual([{ host: tableId, presence: tableInRoom }])
        expect(ownBinding(ropeId, ropeAtTable)?.rooms).toEqual([])
    })
})
