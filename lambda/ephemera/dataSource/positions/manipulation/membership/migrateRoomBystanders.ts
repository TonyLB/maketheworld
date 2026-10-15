/**
 * One-time migration for bystanderSeparation Slice 4: a stored room graph that still holds character
 * nodes (written before bystanders left room graphs) gives them up to the room's `LudicCache::Characters`
 * row. Run per room from the occupancy drift heal (`repairRoomOccupancyDrift`), which the diagnostics
 * sweep triggers for any room whose graph still names a character. A room with no such node is a no-op,
 * so it is safe to keep running after the data is clean.
 *
 * Two writes, in this order, so there is never a moment when a present character is in neither place:
 * (1) the row gains each character whose **own binding still points at the room** (the pointer governs;
 * a graph node with no pointer is a ghost and is dropped, not indexed), `if_not_exists` so a kernel
 * write that landed meanwhile survives; (2) the graph row loses the nodes, in a `MultiKeyUpdate` that
 * conditions on the graph it read and bumps the room's cache marker (the cache held the characters as
 * leaves). Residual, accepted (BS-5): a departure that lands between the two re-appears in the row until
 * the occupancy sweep heals it from the pointer.
 */
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import internalCache from '../../../../internalCache'
import { bindingIdsInto } from '../../ludicCache/charactersRow'
import { LUDIC_CACHE_CHARACTERS_DATA_CATEGORY } from '../../ludicCache/charactersRowShape'
import { getFreshLudicGraph, ludicCacheMarkerBumpItems } from '../../ludicCache/store'
import { EphemeraLudicGraph, graphFromMeta, hostDataCategory } from '../../ludicGraph'

export type MigrateRoomBystandersDeps = {
    getFreshLudicGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    /** Adds the entries to the room's row where absent (`if_not_exists`); creates the row. */
    writeRowEntries?: (roomId: EphemeraRoomId, entries: ReadonlyMap<EphemeraCharacterId, string[]>) => Promise<void>
    /** Removes the nodes from the room's stored graph and marks its cache; returns the characters actually removed. */
    stripNodes?: (roomId: EphemeraRoomId) => Promise<EphemeraCharacterId[]>
}

const attributeValueOf = (bindingIds: string[]) => ({ L: bindingIds.map((id) => ({ S: id })) })

const defaultWriteRowEntries = async (roomId: EphemeraRoomId, entries: ReadonlyMap<EphemeraCharacterId, string[]>): Promise<void> => {
    const list = [...entries]
    await ephemeraDB.strictPrimitiveUpdate({
        Key: { EphemeraId: roomId, DataCategory: LUDIC_CACHE_CHARACTERS_DATA_CATEGORY },
        UpdateExpression: `SET ${list.map((_, index) => `#c${index} = if_not_exists(#c${index}, :b${index})`).join(', ')}`,
        ExpressionAttributeNames: Object.fromEntries(list.map(([characterId], index) => [`#c${index}`, characterId])),
        ExpressionAttributeValues: Object.fromEntries(list.map(([, bindingIds], index) => [`:b${index}`, attributeValueOf(bindingIds)])),
    })
}

const defaultStripNodes = async (roomId: EphemeraRoomId): Promise<EphemeraCharacterId[]> => {
    const removed: EphemeraCharacterId[] = []
    await ephemeraDB.transactWrite([{
        MultiKeyUpdate: {
            Keys: [{ EphemeraId: roomId, DataCategory: hostDataCategory(roomId) }],
            updateKeys: ['ludicGraph'],
            reducer: (draft: Record<string, any>) => {
                removed.length = 0
                const entry = Object.values(draft).find((item: any) => item.EphemeraId === roomId)
                if (!entry) {
                    return
                }
                const graph = graphFromMeta(entry, roomId)
                const stripped = [...graph.characterIds].reduce((accumulator, characterId) => {
                    removed.push(characterId)
                    return accumulator.removeCharacter(characterId)
                }, graph)
                entry.ludicGraph = stripped.toStored()
            },
            cascade: () => (removed.length > 0 ? ludicCacheMarkerBumpItems([roomId]) : []),
        },
    }] as Parameters<typeof ephemeraDB.transactWrite>[0])
    if (removed.length > 0) {
        internalCache.Positions.invalidate(roomId)
        internalCache.ComponentEphemeraMeta.invalidate(roomId)
        internalCache.AffordanceRoomDeliverable.invalidate(roomId)
    }
    return [...removed]
}

/** Moves a room's graph-resident characters to its characters row; returns how many nodes were stripped. */
export const migrateRoomBystanders = async (roomId: EphemeraRoomId, deps: MigrateRoomBystandersDeps = {}): Promise<number> => {
    const getGraph = deps.getFreshLudicGraph ?? getFreshLudicGraph
    const roomGraph = await getGraph(roomId)
    if (roomGraph.characterIds.size === 0) {
        return 0
    }
    const entries = new Map<EphemeraCharacterId, string[]>()
    await Promise.all([...roomGraph.characterIds].map(async (characterId) => {
        const bindingIds = bindingIdsInto(await getGraph(characterId), roomId)
        if (bindingIds.length > 0) {
            entries.set(characterId, bindingIds)
        }
    }))
    if (entries.size > 0) {
        await (deps.writeRowEntries ?? defaultWriteRowEntries)(roomId, entries)
    }
    return (await (deps.stripNodes ?? defaultStripNodes)(roomId)).length
}
