import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../positions/ludicGraph'
import { buildLudicCache, type BuildLudicCacheDeps } from '../positions/ludicCache/fold'
import { ActorLudicCache, type ActorPlanningReads } from '../positions/ludicCache/actorCache'
import { cacheFromHostGraph } from '../positions/ludicCache/cacheFromHostGraph'
import { unionAllLudicCaches } from '../positions/ludicCache/unionCaches'
import { toStoredRelationalEdge } from '../positions/ludicGraph'
import type { EphemeraLudicCacheEdge, EphemeraLudicCacheNode } from '../positions/ludicCache/types'
import type { ActorObjectCatalogDeps, ObjectManipulationCatalogEntry, RoomInPlayObjectCatalogEntry } from './actorObjectCatalog'

type ColdCatalogDeps = {
    getLudicGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    getComponentAggregate?: BuildLudicCacheDeps['getComponentAggregate']
}

/**
 * Test support: the actor catalog's reads, stood in for by cold builds of the same fixture against a fixed Canon
 * stack (the room's stored row included). A stored hit equals a cold build (`store.test.ts`), so the cases built on this
 * pin the catalog's own behaviour (names, presence, placement, scope), not the store's.
 */
export const catalogDepsFromColdBuild = ({ getLudicGraph, getComponentAggregate }: ColdCatalogDeps): ActorObjectCatalogDeps => {
    const buildDeps = { getLudicGraph, getComponentAggregate: getComponentAggregate ?? (async () => []) }
    return {
        readLudicCache: async (seed) => ({ cache: (await buildLudicCache(seed, ['ASSET#Test'], buildDeps)).cache, outcome: 'hit' }),
        resolveCanonStack: async () => ['ASSET#Test'],
        buildDeps,
    }
}

/**
 * Test support: the one scoped catalog of the old `{ room, held }` fixtures. Room entries come first and win on a shared
 * `objectId`; a held-only entry is appended with `held` scope.
 */
export const scopedCatalog = (
    room: readonly RoomInPlayObjectCatalogEntry[] = [],
    held: readonly RoomInPlayObjectCatalogEntry[] = []
): ObjectManipulationCatalogEntry[] => {
    const roomIds = new Set(room.map(({ objectId }) => objectId))
    return [
        // An entry that already has a scope (one the production catalog built) keeps it.
        ...room.map((entry): ObjectManipulationCatalogEntry => ({ catalogScope: 'room', ...entry })),
        ...held.filter(({ objectId }) => !roomIds.has(objectId)).map((entry): ObjectManipulationCatalogEntry => ({ ...entry, catalogScope: 'held' })),
    ]
}

/**
 * Test support: the ancestry a planning test's world has, as the actor's cache answers it (`containersOf`). Pass the world's
 * `{ id: [its containers] }` map, or a function for a rule (every object sits in the room). Pass the world's host graphs as
 * `graphs` too when the case has relations: a mover's relations are then read from a cache built from them
 * (`relationsCacheOfGraphs`); without graphs the world has none.
 */
export const containersCache = (
    hostsOf: Record<string, readonly string[]> | ((id: string) => readonly string[]),
    graphs: readonly EphemeraLudicGraph[] = []
): ActorPlanningReads => {
    const containersOf: ActorPlanningReads['containersOf'] = (id) => [...(typeof hostsOf === 'function' ? hostsOf(id) : hostsOf[id] ?? [])] as EphemeraMembershipHostId[]
    return graphs.length === 0
        ? { containersOf, boundaryRelationsOf: () => [], relationsBetween: () => ({ joined: [], openLegs: [] }), securedToSupportEdgeIds: () => new Set(), presencesOf: () => undefined }
        : { ...relationsCacheOfGraphs(graphs), containersOf }
}

/** A stand-in for `getActorCache`'s result: the given catalog, and ancestry from `hostsOf` (none by default). */
export const actorCacheStub = (
    entries: ObjectManipulationCatalogEntry[],
    hostsOf: Parameters<typeof containersCache>[0] = {}
): ActorLudicCache => ({ entries: () => entries, ...containersCache(hostsOf) }) as unknown as ActorLudicCache

/**
 * Test support: the planning reads of an actor's cache built from hand-authored host graphs, as the fold would
 * (`cacheFromHostGraph` per graph, then the union that joins crossing legs). A graph is one walked host: its
 * bindings nest on a node named for it. A mover's relations come from the graphs' edges; ancestry is `containersCache`'s.
 */
export const relationsCacheOfGraphs = (
    graphs: readonly EphemeraLudicGraph[]
): Omit<ActorPlanningReads, 'containersOf'> => {
    const contributions = graphs.map((graph) => {
        // The fold reads edges through a host's bindings, and every stored host has one (Base). A hand-authored graph with
        // none is read edge by edge instead, so a fixture need not mint a binding to hold a relation.
        const { presenceNodes, edges } = graph.presenceNodes.length > 0
            ? cacheFromHostGraph(graph)
            : {
                presenceNodes: [],
                edges: graph.relationalEdges.map((edge): EphemeraLudicCacheEdge => ({ ...toStoredRelationalEdge(edge), endHosts: { from: graph.hostId, to: graph.hostId } } as EphemeraLudicCacheEdge)),
            }
        return { hostId: graph.hostId, nodes: [{ universalKey: graph.hostId, presenceNodes } as unknown as EphemeraLudicCacheNode], edges }
    })
    const cache = new ActorLudicCache(
        'CHARACTER#Actor' as never,
        'ROOM#Room' as never,
        unionAllLudicCaches(graphs[0]?.hostId ?? ('ROOM#Room' as EphemeraMembershipHostId), contributions)
    )
    return {
        boundaryRelationsOf: (moverId, sourceHosts) => cache.boundaryRelationsOf(moverId, sourceHosts),
        relationsBetween: (subjectId, targetId, kind, label) => cache.relationsBetween(subjectId, targetId, kind, label),
        securedToSupportEdgeIds: () => cache.securedToSupportEdgeIds(),
        presencesOf: (nodeId, host) => cache.presencesOf(nodeId, host),
    }
}
