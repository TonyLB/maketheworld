/**
 * The room affordance header's reader over the cache. A sibling of
 * `catalogHandles.ts`, not an extension of it --- that file is the command path's flat referent pool, and this one
 * answers a different question: *what does each of the room's direct objects directly hold?*
 *
 * **Read forward, no reverse index.** The room level is the union of the covers of the room node's bindings (a member may be
 * listed by any of the room's bindings, so all bindings are read). An object's contents are the `cover.members` of its own bindings: a binding's cover is the owner's own
 * graph, root excluded. So a table's contents are what its bindings cover, and a box on the table contributes the box
 * only, since the cup sits in the box's own graph. One level falls out of the data; nothing walks upward.
 *
 * **Structure from the stored row, labels from the viewer.** Which objects exist and what they hold comes from
 * the room's stored cache (`readLudicCacheWithOutcome`, shared by every viewer). The label each is shown under is resolved at read
 * from the viewer's own asset stack, memoized per call, for the room-level objects and one level of contents only. The
 * stored `shortName` is a reasoning name and is never shown as a fallback (reasoning and display names do not cross over).
 * An object is dropped at both levels when its stored node has no `shortName` (it is not named in the reasoning world) or
 * the viewer's label does not resolve. Nothing past this function's return type is cache-shaped.
 */
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'

import internalCache from '../../../internalCache'
import { resolveComponentShortName } from '../../objects/objectShortName'
import { characterIdsOf } from './charactersRowShape'
import { readLudicCacheWithOutcome } from './store'

export type RoomObjectContent = {
    objectId: EphemeraObjectId
    shortName: string
}

export type RoomObjectWithContents = RoomObjectContent & {
    contents: RoomObjectContent[]
}

export type RoomObjectsRead = {
    /** Every room-level Object with a stored `shortName`, before any viewer label is resolved (the improvisation order's input). */
    objectIds: EphemeraObjectId[]
    objects: RoomObjectWithContents[]
    /** The room's present characters, from the characters row read in the same `getItems` as the cache (no row: nobody here). */
    characterIds: EphemeraCharacterId[]
}

export type RoomObjectContentsDeps = {
    readLudicCache?: typeof readLudicCacheWithOutcome
    getComponentAggregate?: ComponentAggregateMergedCache['get']
}

export const ludicCacheRoomObjectContents = async (
    roomId: EphemeraRoomId,
    assetStack: readonly string[],
    deps: RoomObjectContentsDeps = {}
): Promise<RoomObjectsRead> => {
    const { cache, characters } = await (deps.readLudicCache ?? readLudicCacheWithOutcome)(roomId, { reader: 'header', withCharacters: true })
    const getComponentAggregate = deps.getComponentAggregate ?? ((perspectives) => internalCache.ComponentAggregate.get(perspectives))
    const nodeById = new Map(cache.nodes.map((node) => [node.universalKey as string, node]))

    const contentsIdsOf = (objectId: EphemeraObjectId): EphemeraObjectId[] => (nodeById.get(objectId)?.presenceNodes ?? [])
        .flatMap((binding) => binding.cover.members.map(({ host }) => host as string))
        .filter((host, index, hosts) => hosts.indexOf(host) === index)
        .filter((host): host is EphemeraObjectId => isEphemeraObjectId(host) && nodeById.get(host)?.shortName !== undefined)

    const roomObjectIds = (nodeById.get(roomId)?.presenceNodes ?? [])
        .flatMap((binding) => binding.cover.members.map(({ host }) => host as string))
        .filter((host, index, hosts) => hosts.indexOf(host) === index)
        .filter((host): host is EphemeraObjectId => isEphemeraObjectId(host) && nodeById.get(host)?.shortName !== undefined)

    const structured = roomObjectIds
        .map((objectId) => ({ objectId, contents: contentsIdsOf(objectId) }))

    // One label read per distinct displayed object, in parallel.
    const displayed = [...new Set(structured.flatMap(({ objectId, contents }) => [objectId, ...contents]))]
    const labels = new Map(await Promise.all(displayed.map(async (objectId) =>
        [objectId, await resolveComponentShortName(objectId, assetStack, { getComponentAggregate })] as const
    )))
    const labelled = (objectId: EphemeraObjectId): RoomObjectContent | undefined => {
        const shortName = labels.get(objectId)
        return shortName !== undefined ? { objectId, shortName } : undefined
    }

    const objects = structured.flatMap(({ objectId, contents }) => {
        const object = labelled(objectId)
        return object ? [{ ...object, contents: contents.flatMap((content) => labelled(content) ?? []) }] : []
    })
    return { objectIds: roomObjectIds, objects, characterIds: characterIdsOf(characters ?? {}) }
}
