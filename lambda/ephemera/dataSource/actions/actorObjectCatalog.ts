import { isEphemeraRoomId, type EphemeraCharacterId, type EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import internalCache from '../../internalCache'
import { buildActorLudicCache, type ActorLudicCache, type ActorLudicCacheDeps } from '../positions/ludicCache/actorCache'
import { normalizeExitName } from './roomExitTargetsForCharacter'
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
 * The actor's cache and the one object catalog read from it, for a command's world. Both are absent for a character in no
 * room: no cache, no catalog.
 */
export type ActorWorld = {
    actorCache?: ActorLudicCache
    entries: ObjectManipulationCatalogEntry[]
}

/**
 * The one object catalog of a command, for classify, enrich, and deterministic resolve: everything the actor can reach, in the
 * room or in hand, read from the actor's cache (`positions/ludicCache/actorCache.ts`), so names are the room's Canon +
 * Improvisation names every viewer shares and a thing nested in a held container is in the catalog like any other.
 * `catalogScope` comes from placement (AC-3), not from where an entry was read. A character in no room has no catalog.
 * The cache is returned beside it, so planning reads the same cache the catalog came from.
 *
 * Exhaustive rather than presence-bucket-filtered (see `enrich/objectManipulation/AGENT.md`, "Known gap").
 */
export async function getActorWorld(
    characterId: EphemeraCharacterId,
    deps: ActorObjectCatalogDeps = {}
): Promise<ActorWorld> {
    const [roomId] = await (deps.getMembershipContainers ?? ((id) => internalCache.Positions.getMembershipContainers(id)))(characterId)
    if (!roomId || !isEphemeraRoomId(roomId)) {
        return { entries: [] }
    }
    const actorCache = await buildActorLudicCache(characterId, roomId, deps)
    const held = actorCache.heldObjectIds()
    const entries = actorCache.handles()
        .map(({ objectId, shortName, gloss, presence, placement }): ObjectManipulationCatalogEntry | undefined => {
            const normalizedShortName = normalizeExitName(shortName)
            if (normalizedShortName.length === 0) {
                return undefined
            }
            return {
                objectId,
                normalizedShortName,
                catalogScope: held.has(objectId) ? 'held' : 'room',
                ...(gloss !== undefined ? { gloss } : {}),
                ...(presence !== undefined ? { presence } : {}),
                ...(placement !== undefined ? { placement } : {}),
            }
        })
        .filter((entry): entry is ObjectManipulationCatalogEntry => entry !== undefined)
    return { actorCache, entries }
}

/** The catalog alone, for callers that read nothing else of the actor's world. */
export async function getActorObjectCatalog(
    characterId: EphemeraCharacterId,
    deps: ActorObjectCatalogDeps = {}
): Promise<ObjectManipulationCatalogEntry[]> {
    return (await getActorWorld(characterId, deps)).entries
}
