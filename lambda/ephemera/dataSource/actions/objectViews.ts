import type { EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { GroundedPresence, GroundedPresenceBinding } from './enrich/objectManipulation/plan/planStep'

/**
 * One binding in a placement. For a binding the object itself owns, `under` names the parent bindings
 * it sits under and `rooms` the rooms reached by walking those parents upward (stopping at the first
 * room on each path), which is what tells the rope on the floor from the rope on the table. A binding
 * of some other host that holds the object (the room's, the table's) has neither.
 */
export type PlacementBinding = {
    presence: EphemeraPresenceNodeId
    under?: GroundedPresenceBinding[]
    rooms?: EphemeraRoomId[]
}

/**
 * One owner's run of bindings that place an object: the object's own bindings (the rope's two), or the
 * bindings of a host that holds it. No `bindings` means the object sits in the room's own graph with no
 * binding, so `host` is that room.
 */
export type PresencePlacement = { host: EphemeraMembershipHostId; bindings: PlacementBinding[] }

/** Every place an object is seen as a flat set: what an audience walks up from. The projection of the structure: derived where a handle is built, so the two cannot disagree. */
export const audienceBuckets = (placement: readonly PresencePlacement[]): GroundedPresence[] => placement.flatMap(({ host, bindings }): GroundedPresence[] =>
    bindings.length === 0 && isEphemeraRoomId(host)
        ? [host]
        : bindings.map(({ presence }): GroundedPresenceBinding => ({ host, presence }))
)

/** The positions an object can be meant in: its own bindings, grouped so bindings under the same parents are one reading. */
export type ObjectReading = {
    bindings: EphemeraPresenceNodeId[]
    under: GroundedPresenceBinding[]
    rooms: EphemeraRoomId[]
}

const parentsKey = (under: readonly GroundedPresenceBinding[]): string =>
    under.map(({ host, presence }) => `${host}|${presence}`).sort().join(',')

/**
 * The object's own bindings as readings. `objectId` picks the owner's run out of the placement; a
 * placement without own bindings (a thing in the room's own graph) has no readings, and reads as the whole.
 */
export const readingsOf = (objectId: string, placement: readonly PresencePlacement[]): ObjectReading[] => {
    const own = placement.filter(({ host }) => host === objectId).flatMap(({ bindings }) => bindings)
    const groups = own.reduce<Map<string, ObjectReading>>((byParents, { presence, under = [], rooms = [] }) => {
        const key = parentsKey(under)
        const held = byParents.get(key)
        return byParents.set(key, held
            ? { ...held, bindings: [...held.bindings, presence], rooms: [...new Set([...held.rooms, ...rooms])] }
            : { bindings: [presence], under, rooms }
        )
    }, new Map())
    return [...groups.values()]
}

/**
 * PR-2's rule: the actor's own position when it is unique. The one reading whose parents reach the
 * actor's room without passing through another room; `undefined` when none does (the whole object,
 * the shim) or when several do (the command asks, Slice 3). Reads the structure only, never a graph.
 */
export const defaultReading = (objectId: string, placement: readonly PresencePlacement[], actorRoom: EphemeraRoomId): ObjectReading | undefined => {
    const here = readingsOf(objectId, placement).filter(({ rooms }) => rooms.includes(actorRoom))
    return here.length === 1 ? here[0] : undefined
}
