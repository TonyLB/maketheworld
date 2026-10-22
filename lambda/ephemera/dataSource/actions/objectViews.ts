import type { EphemeraCharacterId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
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
 * Whether a reading is at the actor's position: its parents reach the actor's room without passing
 * through another room, or it is held by the actor. A room's cache holds no character, so a held part's
 * walk upward stops at the character; the actor is known by id, so it needs no walk.
 */
const atActorPosition = ({ rooms, under }: ObjectReading, actorRoom: EphemeraRoomId, actorCharacter?: EphemeraCharacterId): boolean => (
    rooms.includes(actorRoom) || (actorCharacter !== undefined && under.some(({ host }) => host === actorCharacter))
)

/**
 * PR-2's rule: the actor's own position when it is unique. The one reading at the actor's position
 * (`atActorPosition`); `undefined` when none is or when several are (the command offers each, and the
 * dry run keeps only those the verb can act on). Reads the structure only, never a graph.
 */
export const defaultReading = (objectId: string, placement: readonly PresencePlacement[], actorRoom: EphemeraRoomId, actorCharacter?: EphemeraCharacterId): ObjectReading | undefined => {
    const here = readingsHere(objectId, placement, actorRoom, actorCharacter)
    return here.length === 1 ? here[0] : undefined
}

/** The readings at the actor's position (`atActorPosition`): the only parts a command can mean, so the only ones it ever offers. */
export const readingsHere = (objectId: string, placement: readonly PresencePlacement[], actorRoom: EphemeraRoomId, actorCharacter?: EphemeraCharacterId): ObjectReading[] => (
    readingsOf(objectId, placement).filter((reading) => atActorPosition(reading, actorRoom, actorCharacter))
)

/**
 * The hosts a view sits under, read from the object's placement (the room's cache): the distinct parents
 * of its bindings, in view order. `undefined` when the placement lacks a binding the view names.
 */
export const placementHostsOfView = (objectId: string, placement: readonly PresencePlacement[], view: readonly EphemeraPresenceNodeId[]): EphemeraMembershipHostId[] | undefined => {
    const own = placement.filter(({ host }) => host === objectId).flatMap(({ bindings }) => bindings)
    const named = view.map((presence) => own.find((binding) => binding.presence === presence))
    return named.some((binding) => binding === undefined)
        ? undefined
        : [...new Set(named.flatMap((binding) => (binding!.under ?? []).map(({ host }) => host)))]
}

/** The part of an object a player chose when asked: one reading's own bindings, or `'whole'` for every part at once (PR-4). Unasked is the absence of an answer. */
export type ViewAnswer = EphemeraPresenceNodeId[] | 'whole'

export const isViewAnswer = (value: unknown): value is ViewAnswer => (
    value === 'whole' || (Array.isArray(value) && value.every((binding) => typeof binding === 'string'))
)

/** What a position-qualified name needs from the world: the actor's room and id, and a host object's short name. */
export type ReadingNaming = {
    actorRoom: EphemeraRoomId
    actorCharacter?: EphemeraCharacterId
    nameOf: (host: EphemeraMembershipHostId) => string | undefined
}

/**
 * A reading named by where it sits ("the cloth on the table", "the cloth in the room"): each parent it
 * sits under, a room as "in the room" (the actor's own) or "in another room", the actor as "in your hands",
 * an object as "on the X". A parent with no name to give is left out, and a reading with nothing to say
 * falls back to the bare name.
 */
export const readingLabel = (shortName: string, reading: ObjectReading, { actorRoom, actorCharacter, nameOf }: ReadingNaming): string => {
    const places = reading.under.flatMap(({ host }): string[] => {
        if (isEphemeraRoomId(host)) {
            return [host === actorRoom ? 'in the room' : 'in another room']
        }
        if (host === actorCharacter) {
            return ['in your hands']
        }
        const name = nameOf(host)
        return name === undefined ? [] : [`on the ${name}`]
    })
    return places.length === 0 ? shortName : `the ${shortName} ${[...new Set(places)].join(' and ')}`
}

/** The option that means every part at once (PR-4): today's whole-object take. */
export const wholeReadingLabel = (shortName: string): string => `both parts of the ${shortName}`
