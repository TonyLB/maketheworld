import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../positions/ludicGraph'
import { buildLudicCache, type BuildLudicCacheDeps } from '../positions/ludicCache/fold'
import type { ActorContainers, ActorLudicCache } from '../positions/ludicCache/actorCache'
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
 * `{ id: [its containers] }` map, or a function for a rule (every object sits in the room).
 */
export const containersCache = (
    hostsOf: Record<string, readonly string[]> | ((id: string) => readonly string[])
): ActorContainers => ({
    containersOf: (id) => [...(typeof hostsOf === 'function' ? hostsOf(id) : hostsOf[id] ?? [])] as EphemeraMembershipHostId[],
})

/** A stand-in for `getActorCache`'s result: the given catalog, and ancestry from `hostsOf` (none by default). */
export const actorCacheStub = (
    entries: ObjectManipulationCatalogEntry[],
    hostsOf: Parameters<typeof containersCache>[0] = {}
): ActorLudicCache => ({ entries: () => entries, ...containersCache(hostsOf) }) as unknown as ActorLudicCache
