import { isEphemeraRoomId, type EphemeraCharacterId, type EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import internalCache from '../../internalCache'
import { buildActorLudicCache, type ActorLudicCache, type ActorLudicCacheDeps } from '../positions/ludicCache/actorCache'
import type { GroundedPresence } from './enrich/objectManipulation/plan/planStep'
import type { PresencePlacement } from './objectViews'

export type RoomInPlayObjectCatalogEntry = {
    objectId: EphemeraObjectId
    normalizedShortName: string
    /** Pre-attached at parse ingress via handleParseRequested (EM-6). */
    embedding?: SemanticEmbedding
    /** From the `ludicCache` node's reasoning gloss (`AGENT.concepts.md`'s `CommandAttempt` section); present only where authored or improvised. */
    gloss?: string
    /** Every place it is seen: its presence buckets, or the room it sits in directly (`GroundedPresence`). */
    presence?: GroundedPresence[]
    /** The structure `presence` is projected from (`audienceBuckets`): each own binding with the parents it sits under, which `readingsOf`/`defaultReading` (`objectViews.ts`) read. Absent, the object has no position to name. */
    placement?: PresencePlacement[]
}

/** `held`: every binding of the object is under the actor, directly or through a held container. Otherwise `room`. */
export type ObjectManipulationCatalogScope = 'room' | 'held'

export type ObjectManipulationCatalogEntry = RoomInPlayObjectCatalogEntry & {
    catalogScope: ObjectManipulationCatalogScope
}

export type ActorObjectCatalogDeps = ActorLudicCacheDeps & {
    getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<string[]>
}

/**
 * The actor's cache for a command's world: everything the actor can reach, in the room or in hand
 * (`positions/ludicCache/actorCache.ts`). Its `entries()` is the command's one object catalog, for classify, enrich, and
 * deterministic resolve, so names are the room's Canon + Improvisation names every viewer shares and a thing nested in a
 * held container is in the catalog like any other; planning reads the same cache. A character in no room has no cache.
 *
 * Exhaustive rather than presence-bucket-filtered (see `enrich/objectManipulation/AGENT.md`, "Known gap").
 */
export async function getActorCache(
    characterId: EphemeraCharacterId,
    deps: ActorObjectCatalogDeps = {}
): Promise<ActorLudicCache | undefined> {
    const [roomId] = await (deps.getMembershipContainers ?? ((id) => internalCache.Positions.getMembershipContainers(id)))(characterId)
    return roomId && isEphemeraRoomId(roomId) ? buildActorLudicCache(characterId, roomId, deps) : undefined
}

/** The catalog alone, for callers that read nothing else of the actor's cache. A character in no room has none. */
export async function getActorObjectCatalog(
    characterId: EphemeraCharacterId,
    deps: ActorObjectCatalogDeps = {}
): Promise<ObjectManipulationCatalogEntry[]> {
    return (await getActorCache(characterId, deps))?.entries() ?? []
}
