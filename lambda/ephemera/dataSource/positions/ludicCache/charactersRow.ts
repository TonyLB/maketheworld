/**
 * The `LudicCache::Characters` row: a room's index of its present characters (bystanders: characters are
 * not in their room's graph, so this row is the room-side record of who is present).
 * Rules: `positions/AGENT.contract.md` (Ludic cache staleness and rebuild); mechanism: `AGENT.implementation.md` (Stored row).
 *
 * One row per room, on `EphemeraId: <roomId>`, one top-level attribute per present character keyed by
 * its id and holding the ids of the character's own bindings into the room. Top-level attributes (not a
 * map) because a `SET` on a path into a missing map attribute fails, while `SET #id` creates the item.
 *
 * **The row is the authority for who is present; the character's own binding pointer governs the row**
 * (the pointer governs): drift between the two is healed from the pointer by the occupancy drift sweep. There is no
 * rebuild: an absent row is an empty room (the first arrival creates it), and the one-time migration
 * (`migrateBystandersToCharactersRow`) wrote every existing room's row before characters left the graphs.
 *
 * **Writer.** The kernel's `cascade` writes it from a sequence's net membership change
 * (`charactersRowItemsFor`), unconditioned: the mover's own graph is in the same `MultiKeyUpdate`, which
 * serializes moves of that character.
 */
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../ludicGraph'
import { parentHostOf } from '../ludicGraph/presenceParent'
import type { MembershipChange } from '../manipulation/kernel/membershipChanges'
import type { MutationKernelStep } from '../manipulation/kernel/kernelStep'
import { characterIdsOf, LUDIC_CACHE_CHARACTERS_DATA_CATEGORY, type LudicCacheCharactersRow } from './charactersRowShape'

export { LUDIC_CACHE_CHARACTERS_DATA_CATEGORY, characterIdsOf } from './charactersRowShape'
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

/**
 * The row items for a sequence's bystander renames: a character's binding into a room changed its id and
 * no membership changed, so `charactersRowItemsFor` writes nothing. One `PrimitiveUpdate` per (room,
 * character), the character's binding ids into the room as the committed graph holds them. A rename never
 * runs beside a membership change of the same room (the Base migration commits alone), so no item is doubled.
 */
export const charactersRowRenameItemsFor = (
    steps: readonly MutationKernelStep[],
    committedGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
) => steps.flatMap((step) => {
    const graph = step.kind === 'renamePresenceBinding' && isEphemeraCharacterId(step.hostId) ? committedGraphs.get(step.hostId) : undefined
    if (step.kind !== 'renamePresenceBinding' || !graph || !step.parent || !isEphemeraRoomId(step.parent.host)) {
        return []
    }
    return [{
        PrimitiveUpdate: {
            Key: { EphemeraId: step.parent.host, DataCategory: LUDIC_CACHE_CHARACTERS_DATA_CATEGORY },
            ProjectionFields: [] as string[],
            UpdateExpression: 'SET #c0 = :b0',
            ExpressionAttributeNames: { '#c0': step.hostId },
            ExpressionAttributeValues: { ':b0': bindingIdsInto(graph, step.parent.host) },
        },
    }]
})

export type ReadRoomCharactersDeps = {
    /** The stored row, strongly consistent; `undefined` when absent. */
    getRow?: (roomId: EphemeraRoomId) => Promise<Partial<LudicCacheCharactersRow> | undefined>
}

const defaultGetRow = (roomId: EphemeraRoomId) => ephemeraDB.getItem<Partial<LudicCacheCharactersRow>>({
    Key: { EphemeraId: roomId, DataCategory: LUDIC_CACHE_CHARACTERS_DATA_CATEGORY },
    ConsistentRead: true,
    getAllFields: true,
})

/** The room's present characters from the row, for readers that do not need the cache. No row: nobody here. */
export const readRoomCharacters = async (roomId: EphemeraRoomId, deps: ReadRoomCharactersDeps = {}): Promise<EphemeraCharacterId[]> => (
    characterIdsOf((await (deps.getRow ?? defaultGetRow)(roomId)) ?? {})
)
