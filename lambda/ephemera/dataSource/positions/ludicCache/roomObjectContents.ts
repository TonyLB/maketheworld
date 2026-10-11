/**
 * `AGENT.affordanceLudicCache.planning.md` Slice 1: the room affordance header's reader over the cache. A sibling of
 * `catalogHandles.ts`, not an extension of it --- that file is the command path's flat referent pool, and this one
 * answers a different question: *what does each of the room's direct objects directly hold?*
 *
 * **Read forward, no reverse index.** The caller states the room level (the room's own shard, which names its direct
 * objects). An object's contents are the `cover.members` of its own bindings: a binding's cover is the owner's own
 * graph, root excluded. So a table's contents are what its bindings cover, and a box on the table contributes the box
 * only, since the cup sits in the box's own graph. One level falls out of the data; nothing walks upward.
 *
 * An object whose `shortName` never resolved is dropped at both levels, as `catalogHandles.ts` does. Nothing past this
 * function's return type is cache-shaped.
 */
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { buildLudicCache, type BuildLudicCacheDeps } from './fold'

export type RoomObjectContent = {
    objectId: EphemeraObjectId
    shortName: string
}

export type RoomObjectWithContents = RoomObjectContent & {
    contents: RoomObjectContent[]
}

export const ludicCacheRoomObjectContents = async (
    seedHostId: EphemeraMembershipHostId,
    roomObjectIds: readonly EphemeraObjectId[],
    assetStack: readonly string[],
    deps: BuildLudicCacheDeps = {}
): Promise<RoomObjectWithContents[]> => {
    const { cache } = await buildLudicCache(seedHostId, assetStack, deps)
    const nodeById = new Map(cache.nodes.map((node) => [node.universalKey as string, node]))
    const named = (objectId: string): RoomObjectContent | undefined => {
        const shortName = nodeById.get(objectId)?.shortName
        return isEphemeraObjectId(objectId) && shortName !== undefined ? { objectId, shortName } : undefined
    }
    const contentsOf = (objectId: EphemeraObjectId): RoomObjectContent[] => (nodeById.get(objectId)?.presenceNodes ?? [])
        .flatMap((binding) => binding.cover.members.map(({ host }) => host as string))
        .filter((host, index, hosts) => hosts.indexOf(host) === index)
        .flatMap((host) => named(host) ?? [])
    return roomObjectIds.flatMap((objectId) => {
        const object = named(objectId)
        return object ? [{ ...object, contents: contentsOf(objectId) }] : []
    })
}
