/**
 * A mover's relations read from the actor's cache (ISS8314): the same boundary edges the graph read finds,
 * with a joined crossing's true far end and an open leg's owner. Hand-authored graphs, injected deps, as `actorCache.test.ts`.
 */
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { mergedComponentResult, type ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { boundaryEdgeOutcomes } from '../ludicGraph/expandValidate/interactionUnderTransfer'
import { buildActorLudicCache } from './actorCache'
import { buildLudicCache } from './fold'
import { actorCacheGraphs, actorCrossingGraphs, actorId, bagId, coinId, graphReader, leashId, lampId, otherId, ropeId, roomId, tableId } from './actorCacheTestFixtures'
import { boundaryRelationsOfEdges, hostEdgeOfCacheEdge, relationsBetweenEdges, securedToSupportEdgeIdsOfEdges } from './boundaryRelations'
import type { EphemeraLudicCacheEdge } from './types'

const aggregateNamed = (): ComponentAggregateMergedCache['get'] => async ([perspective]) => [mergedComponentResult({
    universalKey: perspective.universalKey as EphemeraObjectId,
    merged: new StandardObject({ tag: 'Object', shortName: perspective.universalKey.replace('OBJECT#', '').toLowerCase() }),
    mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
})]

const buildFrom = async (graphs: ReturnType<typeof actorCrossingGraphs>) => {
    const deps = { getLudicGraph: graphReader(graphs), getComponentAggregate: aggregateNamed() }
    const room = (await buildLudicCache(roomId, [], deps)).cache
    return buildActorLudicCache(actorId, roomId, {
        readLudicCache: async () => ({ cache: room, outcome: 'hit' }),
        resolveCanonStack: async () => ['ASSET#Canon'],
        buildDeps: deps,
    })
}

describe('ActorLudicCache.boundaryRelationsOf', () => {
    it('names a joined crossing\'s true far end, from the host that holds the mover\'s leg', async () => {
        const cache = await buildFrom(actorCrossingGraphs())

        const fromTable = cache.boundaryRelationsOf(tableId, [roomId])
        expect(fromTable).toEqual(expect.arrayContaining([
            expect.objectContaining({ movedRole: 'subject', moverHost: roomId, far: { kind: 'named', id: bagId }, edge: expect.objectContaining({ kind: 'Custom', relationLabel: 'tied to' }) }),
        ]))
        // The bag is the target, and the leg touching it sits in the actor's graph.
        expect(cache.boundaryRelationsOf(bagId, [actorId])).toEqual([
            expect.objectContaining({ movedRole: 'target', moverHost: actorId, far: { kind: 'named', id: tableId } }),
        ])
    })

    it('reports an unmatched leg as open, with its owner', async () => {
        const cache = await buildFrom(actorCrossingGraphs())

        // The leash's graph is walked (it is the other character's), but the other character is no seed: the room's leg stays open.
        const open = cache.boundaryRelationsOf(tableId, [roomId]).filter(({ far }) => far.kind === 'open')
        expect(open).toEqual([expect.objectContaining({ far: { kind: 'open', owner: otherId } })])
        expect(open[0].edge).not.toHaveProperty('endHosts')
    })

    it('limits relations to the hosts the mover leaves', async () => {
        const cache = await buildFrom(actorCrossingGraphs())

        expect(cache.boundaryRelationsOf(tableId, [lampId])).toEqual([])
        // A half-held rope taken from the table does not sever what it holds in hand.
        expect(cache.boundaryRelationsOf(ropeId, [tableId]).map(({ moverHost }) => moverHost)).not.toContain(actorId)
        expect(cache.boundaryRelationsOf(ropeId, [actorId]).map(({ moverHost }) => moverHost)).toEqual([actorId])
    })

    it('gives nothing for an object with no relations, or one the cache does not hold', async () => {
        const cache = await buildFrom(actorCacheGraphs())

        expect(cache.boundaryRelationsOf(leashId)).toEqual([])
        expect(cache.boundaryRelationsOf('OBJECT#Absent' as EphemeraObjectId)).toEqual([])
    })

    // Over a world with no crossing legs of the table's, the cache holds the same boundary edges the stored graphs do.
    it.each([lampId, ropeId, tableId, bagId, coinId, leashId])('agrees with the graph read for %s', async (moverId) => {
        const graphs = actorCacheGraphs()
        const cache = await buildFrom(graphs)
        const signature = (kind: string, label: string | undefined, role: string, host: string) => `${kind}|${label ?? ''}|${role}|${host}`

        const fromGraphs = [...graphs.entries()].flatMap(([host, graph]) => boundaryEdgeOutcomes(moverId, graph).map(({ edge, movedRole }) => (
            signature(edge.kind, edge.kind === 'Custom' ? edge.relationLabel : undefined, movedRole, host)
        )))
        const fromCache = cache.boundaryRelationsOf(moverId).map(({ edge, movedRole, moverHost }) => (
            signature(edge.kind, edge.kind === 'Custom' ? edge.relationLabel : undefined, movedRole, moverHost)
        ))

        expect(fromCache.sort()).toEqual(fromGraphs.sort())
    })
})

describe('hostEdgeOfCacheEdge', () => {
    it('drops endHosts and keeps identity, so a stored challenge has the shape a graph edge gives', () => {
        const edge: EphemeraLudicCacheEdge = { tag: 'Relational', from: lampId, to: ropeId, kind: 'Custom', relationLabel: 'is near', edgeId: 'e1', chainId: 'c1', endHosts: { from: tableId, to: tableId } }

        expect(hostEdgeOfCacheEdge(edge)).toEqual({ from: lampId, to: ropeId, kind: 'Custom', relationLabel: 'is near', edgeId: 'e1', chainId: 'c1' })
    })
})

describe('securedToSupportEdgeIdsOfEdges', () => {
    it('finds the edges a Justifies names as supporting a SecuredTo', () => {
        const hosts = { from: tableId, to: tableId }
        const edges: EphemeraLudicCacheEdge[] = [
            { tag: 'Relational', from: lampId, to: ropeId, kind: 'SecuredTo', edgeId: 'secured', endHosts: hosts },
            { tag: 'Relational', from: lampId, to: ropeId, kind: 'Custom', relationLabel: 'knotted', edgeId: 'knot', endHosts: hosts },
            { tag: 'Relational', from: { edgeId: 'knot' }, to: { edgeId: 'secured' }, kind: 'Justifies', endHosts: hosts },
        ]

        expect([...securedToSupportEdgeIdsOfEdges(edges)]).toEqual(['knot'])
        expect(boundaryRelationsOfEdges(edges, lampId).map(({ edge }) => edge.kind)).toEqual(['SecuredTo', 'Custom'])
    })
})

describe('boundaryRelationsOfEdges: two chains for one relation', () => {
    it('keeps both as separate relations, so an ambiguous removal is not hidden', () => {
        const hosts = { from: tableId, to: tableId }
        const edges: EphemeraLudicCacheEdge[] = [
            { tag: 'Relational', from: lampId, to: ropeId, kind: 'Custom', relationLabel: 'tied to', edgeId: 'e1', chainId: 'c1', endHosts: hosts },
            { tag: 'Relational', from: lampId, to: ropeId, kind: 'Custom', relationLabel: 'tied to', edgeId: 'e2', chainId: 'c2', endHosts: hosts },
        ]

        expect(boundaryRelationsOfEdges(edges, lampId).map(({ edge }) => edge.chainId)).toEqual(['c1', 'c2'])
    })
})

describe('relationsBetweenEdges', () => {
    const hosts = { from: tableId, to: tableId }
    const near: EphemeraLudicCacheEdge = { tag: 'Relational', from: lampId, to: ropeId, kind: 'Custom', relationLabel: 'is near', endHosts: hosts }
    const openLeg: EphemeraLudicCacheEdge = { tag: 'Relational', from: lampId, to: { owner: bagId, port: 'PORT-x' }, kind: 'Custom', relationLabel: 'is near', endHosts: hosts }

    it('finds a joined edge in either direction, matching kind and label', () => {
        expect(relationsBetweenEdges([near], ropeId, lampId, 'Custom', 'is near').joined).toEqual([hostEdgeOfCacheEdge(near)])
        expect(relationsBetweenEdges([near], lampId, ropeId, 'Custom', 'is under').joined).toEqual([])
        expect(relationsBetweenEdges([near], lampId, ropeId, 'SecuredTo').joined).toEqual([])
    })

    it('reports an open leg touching either end, with the host that holds it', () => {
        expect(relationsBetweenEdges([openLeg], ropeId, lampId, 'Custom', 'is near')).toEqual({
            joined: [],
            openLegs: [{ hostId: tableId, edge: hostEdgeOfCacheEdge(openLeg) }],
        })
        expect(relationsBetweenEdges([openLeg], ropeId, coinId, 'Custom', 'is near').openLegs).toEqual([])
    })
})
