import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../positions/ludicGraph'
import { buildLudicCache, type BuildLudicCacheDeps } from '../positions/ludicCache/fold'
import type { RoomObjectCatalogDeps } from './roomObjectCatalogForCharacter'

type ColdCatalogDeps = Pick<RoomObjectCatalogDeps, 'getMembershipContainers'> & {
    getLudicGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    getComponentAggregate?: BuildLudicCacheDeps['getComponentAggregate']
}

/**
 * Test support: the catalog's stored-row read, stood in for by a cold build of the same fixture
 * against a fixed Canon stack. A stored hit equals a cold build (`store.test.ts`), so the cases
 * built on this pin the catalog's own behaviour (names, presence, normalization), not the store's.
 */
export const catalogDepsFromColdBuild = ({ getMembershipContainers, getLudicGraph, getComponentAggregate }: ColdCatalogDeps): Partial<RoomObjectCatalogDeps> => ({
    getMembershipContainers,
    readLudicCache: async (seed) => ({
        cache: (await buildLudicCache(seed, ['ASSET#Test'], { getLudicGraph, getComponentAggregate: getComponentAggregate ?? (async () => []) })).cache,
        outcome: 'hit',
    }),
})
