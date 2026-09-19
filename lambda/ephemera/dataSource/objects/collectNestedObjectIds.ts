import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraLudicGraph } from '../positions/ludicGraph'

export type GetObjectLudicGraph = (objectId: EphemeraObjectId) => Promise<EphemeraLudicGraph>

/**
 * Walks from a set of object ids into hosted objects' own `ludicGraph`s (CC3): hosting kinds put
 * a subordinate object in its host's own shard, so a nested object is not a member of the room's
 * graph at all --- it is only found by fetching its host's own graph. `visited` terminates a
 * cyclic hand-built fixture; `depthCap` (5, a testing bound rather than a claim about real
 * nesting depth) bounds BFS levels independently of cycles.
 *
 * **Relocated here (rebuild Slice 4, D10) from `actions/roomObjectCatalogForCharacter.ts`.** Its
 * one remaining caller is `clearCoyoteGameImprovisationObjects.ts`'s bulk clear, which must stay
 * exhaustive and presence-blind --- it asks *what is true of the world*, which the presence-aware
 * `ludicCache` is not licensed to answer (P6 clause 1). The candidate-pool path
 * (`roomObjectCatalogForCharacter.ts`) now goes through `ludicCache/catalogHandles.ts` instead.
 */
export async function collectNestedObjectIds(
    initialIds: Iterable<EphemeraObjectId>,
    getObjectLudicGraph: GetObjectLudicGraph,
    depthCap = 5
): Promise<Set<EphemeraObjectId>> {
    const collected = new Set<EphemeraObjectId>(initialIds)
    const visited = new Set<EphemeraObjectId>()
    let frontier = [...initialIds]
    for (let depth = 0; depth < depthCap && frontier.length > 0; depth++) {
        const nextFrontier: EphemeraObjectId[] = []
        for (const objectId of frontier) {
            if (visited.has(objectId)) {
                continue
            }
            visited.add(objectId)
            const hostGraph = await getObjectLudicGraph(objectId)
            for (const hostedId of hostGraph.objectIds) {
                if (!collected.has(hostedId)) {
                    collected.add(hostedId)
                    nextFrontier.push(hostedId)
                }
            }
        }
        frontier = nextFrontier
    }
    return collected
}
