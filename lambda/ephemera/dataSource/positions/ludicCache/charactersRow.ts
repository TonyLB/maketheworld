/**
 * The `LudicCache::Characters` row: a room's index of its present characters.
 * Plan: `taskPlanning/.../positions/AGENT.bystanderSeparation.planning.md` (BS-1, BS-5, BS-6).
 *
 * One row per room, on `EphemeraId: <roomId>`, one top-level attribute per present character keyed by
 * its id and holding the ids of the character's own bindings into the room, plus `complete: true` once
 * a rebuild has stood behind the row. Top-level attributes (not a map) because a `SET` on a path into
 * a missing map attribute fails, while `SET #id` creates the item.
 *
 * **It is an index, not an authority** (BS-5): the character's own binding pointer governs, and drift
 * is healed from the pointer.
 *
 * **Writers.** The kernel's `cascade` writes it from a sequence's net membership change
 * (`charactersRowItemsFor`), unconditioned: the mover's own graph is in the same `MultiKeyUpdate`, which
 * serializes moves of that character. A kernel `SET` on an absent row creates an *incomplete* row, so
 * the row is only trusted once `complete` is set, by `rebuildCharactersRow`.
 *
 * **The rebuild is an `UpdateItem`, never a `Put`.** It sets each id with `if_not_exists`, under
 * `attribute_not_exists(complete)`, so an arrival the kernel wrote between the rebuild's graph read and
 * its write survives. **Residual:** a departure landing in that same window is undone (the rebuild
 * writes the departed id back), until the occupancy drift sweep heals it from the pointer.
 */
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../ludicGraph'
import { parentHostOf } from '../ludicGraph/presenceParent'
import type { MembershipChange } from '../manipulation/kernel/membershipChanges'
import { characterIdsOf, isCompleteCharactersRow, LUDIC_CACHE_CHARACTERS_DATA_CATEGORY, type LudicCacheCharactersRow } from './charactersRowShape'
import { getFreshLudicGraph } from './store'

export { LUDIC_CACHE_CHARACTERS_DATA_CATEGORY, characterIdsOf, isCompleteCharactersRow } from './charactersRowShape'
export type { LudicCacheCharactersRow } from './charactersRowShape'

/** The ids of the character's own bindings that point at `roomId`, from the character's graph. */
export const bindingIdsInto = (graph: EphemeraLudicGraph, roomId: EphemeraMembershipHostId): string[] => (
    graph.presenceNodes
        .filter((node) => parentHostOf(node) === roomId)
        .map((node) => node.universalKey)
)

type RoomOps = { set: [EphemeraCharacterId, string[]][]; remove: EphemeraCharacterId[] }

/** `changes`, restricted to characters moving into or out of rooms (what the row indexes), grouped by room. */
const opsByRoom = (
    changes: readonly MembershipChange[],
    committedGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
): [EphemeraRoomId, RoomOps][] => Object.entries(
    changes
        .flatMap(({ entityId, left, arrived }) => {
            if (!isEphemeraCharacterId(entityId)) {
                return []
            }
            const graph = committedGraphs.get(entityId)
            return [
                ...left.filter(isEphemeraRoomId).map((roomId) => ({ roomId, remove: [entityId] as EphemeraCharacterId[], set: [] as RoomOps['set'] })),
                ...arrived.filter(isEphemeraRoomId).map((roomId) => ({ roomId, remove: [] as EphemeraCharacterId[], set: [[entityId, graph ? bindingIdsInto(graph, roomId) : []]] as RoomOps['set'] })),
            ]
        })
        .reduce<Record<EphemeraRoomId, RoomOps>>((byRoom, { roomId, set, remove }) => ({
            ...byRoom,
            [roomId]: { set: [...(byRoom[roomId]?.set ?? []), ...set], remove: [...(byRoom[roomId]?.remove ?? []), ...remove] },
        }), {})
) as [EphemeraRoomId, RoomOps][]

/**
 * The kernel `cascade` items for a sequence's net membership changes: **one `PrimitiveUpdate` per
 * room** (a transaction may not touch an item twice, and two characters can move through one room in
 * one commit), `SET #cN = :bN` for each arrival and `REMOVE #rN` for each departure. Unconditioned.
 */
export const charactersRowItemsFor = (
    changes: readonly MembershipChange[],
    committedGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
) => opsByRoom(changes, committedGraphs).map(([roomId, { set, remove }]) => {
    const sets = set.map((_, index) => `#c${index} = :b${index}`)
    const removes = remove.map((_, index) => `#r${index}`)
    const values = Object.fromEntries(set.map(([, bindingIds], index) => [`:b${index}`, bindingIds]))
    return {
        PrimitiveUpdate: {
            Key: { EphemeraId: roomId, DataCategory: LUDIC_CACHE_CHARACTERS_DATA_CATEGORY },
            ProjectionFields: [] as string[],
            UpdateExpression: [
                ...(sets.length > 0 ? [`SET ${sets.join(', ')}`] : []),
                ...(removes.length > 0 ? [`REMOVE ${removes.join(', ')}`] : []),
            ].join(' '),
            ExpressionAttributeNames: {
                ...Object.fromEntries(set.map(([characterId], index) => [`#c${index}`, characterId])),
                ...Object.fromEntries(remove.map((characterId, index) => [`#r${index}`, characterId])),
            },
            ...(set.length > 0 ? { ExpressionAttributeValues: values } : {}),
        },
    }
})

export type ReadRoomCharactersDeps = {
    /** The stored row, strongly consistent; `undefined` when absent. */
    getRow?: (roomId: EphemeraRoomId) => Promise<Partial<LudicCacheCharactersRow> | undefined>
    getFreshLudicGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    /** The completing write; `false` when the row was already complete. */
    writeRebuild?: (roomId: EphemeraRoomId, membership: ReadonlyMap<EphemeraCharacterId, string[]>) => Promise<boolean>
}

const defaultGetRow = (roomId: EphemeraRoomId) => ephemeraDB.getItem<Partial<LudicCacheCharactersRow>>({
    Key: { EphemeraId: roomId, DataCategory: LUDIC_CACHE_CHARACTERS_DATA_CATEGORY },
    ConsistentRead: true,
    getAllFields: true,
})

const attributeValueOf = (bindingIds: string[]) => ({ L: bindingIds.map((id) => ({ S: id })) })

/**
 * Completes the row. `strictPrimitiveUpdate` takes already-marshalled values (as `markLudicCacheStale`
 * does), and throws; only the condition's refusal is the answer.
 */
const defaultWriteRebuild = async (roomId: EphemeraRoomId, membership: ReadonlyMap<EphemeraCharacterId, string[]>): Promise<boolean> => {
    const entries = [...membership]
    try {
        await ephemeraDB.strictPrimitiveUpdate({
            Key: { EphemeraId: roomId, DataCategory: LUDIC_CACHE_CHARACTERS_DATA_CATEGORY },
            UpdateExpression: `SET #complete = :complete${entries.map((_, index) => `, #c${index} = if_not_exists(#c${index}, :b${index})`).join('')}`,
            ConditionExpression: 'attribute_not_exists(#complete)',
            ExpressionAttributeNames: {
                '#complete': 'complete',
                ...Object.fromEntries(entries.map(([characterId], index) => [`#c${index}`, characterId])),
            },
            ExpressionAttributeValues: {
                ':complete': { BOOL: true },
                ...Object.fromEntries(entries.map(([, bindingIds], index) => [`:b${index}`, attributeValueOf(bindingIds)])),
            },
        })
        return true
    }
    catch (err: any) {
        if (err?.name === 'ConditionalCheckFailedException' || err?.code === 'ConditionalCheckFailedException') {
            return false
        }
        throw err
    }
}

/**
 * Rebuilds a room's row from its graph's `characterIds` and each character's own bindings into the
 * room (Slice 4 changes the source: see the plan), then returns the row as stored afterwards, so an
 * entry the kernel wrote meanwhile is included.
 */
export const rebuildCharactersRow = async (roomId: EphemeraRoomId, deps: ReadRoomCharactersDeps = {}): Promise<EphemeraCharacterId[]> => {
    const getGraph = deps.getFreshLudicGraph ?? getFreshLudicGraph
    const roomGraph = await getGraph(roomId)
    const membership = new Map<EphemeraCharacterId, string[]>(
        await Promise.all([...roomGraph.characterIds].map(async (characterId): Promise<[EphemeraCharacterId, string[]]> => (
            [characterId, bindingIdsInto(await getGraph(characterId), roomId)]
        )))
    )
    await (deps.writeRebuild ?? defaultWriteRebuild)(roomId, membership)
    const stored = await (deps.getRow ?? defaultGetRow)(roomId)
    return isCompleteCharactersRow(stored) ? characterIdsOf(stored) : [...membership.keys()]
}

/**
 * The room's present characters from the row, for readers that do not need the cache. An absent or
 * incomplete row is rebuilt before it is read; it is never answered as "nobody here".
 */
export const readRoomCharacters = async (roomId: EphemeraRoomId, deps: ReadRoomCharactersDeps = {}): Promise<EphemeraCharacterId[]> => {
    const row = await (deps.getRow ?? defaultGetRow)(roomId)
    return isCompleteCharactersRow(row) ? characterIdsOf(row) : rebuildCharactersRow(roomId, deps)
}
