/**
 * The actor's cache (ISS8314, `AGENT.actorCache.planning.md`): one `ludicCache` for what an actor can reach, held
 * inventory included. It is the room's stored row unioned with a fold seeded at the actor, assembled per command at read
 * time. It is never stored, and never written into the room's row: the row is shared by every viewer, and a room walk
 * never enters a character's shard.
 *
 * **Union (AC-1).** `unionCaches.ts`: nodes by `universalKey`, edges joined at crossing ports then deduped. The fold is per-host and independent, so this
 * equals one fold over both walks (`actorUnion.test.ts`). On a node-key collision the actor half's node wins: a determinism
 * rule, not a freshness claim (AC-4).
 *
 * **Names (AC-2).** The actor half is named with the room's Canon stack, the same as the stored row.
 *
 * **Freshness (AC-4).** None: the actor half uses the ordinary command reads, since it exists only inside one command.
 *
 * **A boundary type (AC-5).** The class keeps the union private; its accessors answer one question each and return flat
 * values, never the cache: `entries` is the command's object catalog (built on the flat handles `catalogHandles.ts`
 * holds), `containersOf` is planning's ancestry (ISS8314 Slice 5).
 */
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../../internalCache'
import { resolveCanonAssetStackForRoom } from '../../state/resolveAssetStackForRoom'
import { buildLudicCache, type BuildLudicCacheDeps } from './fold'
import type { ObjectManipulationCatalogEntry } from '../../actions/actorObjectCatalog'
import { normalizeExitName } from '../../actions/normalizeExitName'
import { handlesFromCache, type LudicCacheObjectHandle } from './catalogHandles'
import { logLudicCacheRebuild } from './ludicCacheInstrumentation'
import { readLudicCacheWithOutcome } from './store'
import { unionLudicCaches } from './unionCaches'

export { unionLudicCaches }
import type { EphemeraLudicCacheData } from './types'

export class ActorLudicCache {
    readonly actorId: EphemeraCharacterId
    readonly roomId: EphemeraRoomId
    private readonly data: EphemeraLudicCacheData

    constructor(actorId: EphemeraCharacterId, roomId: EphemeraRoomId, data: EphemeraLudicCacheData) {
        this.actorId = actorId
        this.roomId = roomId
        this.data = data
    }

    /**
     * The command's one object catalog: every named object the actor can reach, in the room or in hand. `catalogScope` comes
     * from placement (AC-3), not from which half an object was read from. An object whose name normalizes to nothing is left out.
     */
    entries(): ObjectManipulationCatalogEntry[] {
        const held = this.heldObjectIds()
        return this.handles().flatMap(({ objectId, shortName, gloss, presence, placement }): ObjectManipulationCatalogEntry[] => {
            const normalizedShortName = normalizeExitName(shortName)
            return normalizedShortName.length === 0 ? [] : [{
                objectId,
                normalizedShortName,
                catalogScope: held.has(objectId) ? 'held' : 'room',
                ...(gloss !== undefined ? { gloss } : {}),
                ...(presence !== undefined ? { presence } : {}),
                ...(placement !== undefined ? { placement } : {}),
            }]
        })
    }

    /** Every named object the actor can reach, in the room or in hand, as flat handles. */
    private handles(): LudicCacheObjectHandle[] {
        return handlesFromCache(this.data, this.roomId)
    }

    /**
     * The hosts that directly contain a node: the owners of the parents of each of its bindings (`fromHostPresences`), in first-seen
     * order. Empty for a node the cache does not hold, and for one with no parents (a room). A thing in two places (a half-held
     * rope) has both.
     */
    containersOf(id: EphemeraMembershipHostId): EphemeraMembershipHostId[] {
        const node = this.data.nodes.find(({ universalKey }) => universalKey === id)
        return [...new Set((node?.presenceNodes ?? []).flatMap((binding) => binding.fromHostPresences.map(({ host }) => host)))]
    }

    /**
     * The objects wholly in the actor's hands: each has a binding, and every binding sits under the actor, directly or through
     * a chain of parents (the coin in a held bag). A part held and a part elsewhere (a half-held rope) is not wholly held.
     */
    private heldObjectIds(): Set<EphemeraObjectId> {
        const bindings = new Map<string, EphemeraLudicCacheData['nodes'][number]['presenceNodes'][number]>(
            this.data.nodes.flatMap((node) => node.presenceNodes.map((binding) => [`${node.universalKey}|${binding.universalKey}`, binding] as const))
        )
        const underActor = (host: string, presence: string, seen: ReadonlySet<string> = new Set()): boolean => {
            const key = `${host}|${presence}`
            const binding = bindings.get(key)
            return binding !== undefined && !seen.has(key) && binding.fromHostPresences.some((parent) => (
                parent.host === this.actorId || underActor(parent.host, parent.presence, new Set([...seen, key]))
            ))
        }
        return new Set(this.data.nodes.flatMap((node) => (
            isEphemeraObjectId(node.universalKey)
            && node.presenceNodes.length > 0
            && node.presenceNodes.every((binding) => underActor(node.universalKey, binding.universalKey))
                ? [node.universalKey]
                : []
        )))
    }
}

/** What planning asks of the actor's cache about ancestry; tests supply a bare object. */
export type ActorContainers = Pick<ActorLudicCache, 'containersOf'>

export type ActorLudicCacheDeps = {
    readLudicCache?: typeof readLudicCacheWithOutcome
    resolveCanonStack?: (roomId: EphemeraRoomId) => Promise<readonly string[]>
    build?: typeof buildLudicCache
    buildDeps?: BuildLudicCacheDeps
}

export const buildActorLudicCache = async (
    actorId: EphemeraCharacterId,
    roomId: EphemeraRoomId,
    deps: ActorLudicCacheDeps = {}
): Promise<ActorLudicCache> => {
    const roomStartedAt = Date.now()
    const [{ cache: room, outcome }, assetStack] = await Promise.all([
        (deps.readLudicCache ?? readLudicCacheWithOutcome)(roomId, { reader: 'command' }),
        (deps.resolveCanonStack ?? ((id: EphemeraRoomId) => resolveCanonAssetStackForRoom(id, internalCache)))(roomId),
    ])
    logLudicCacheRebuild({
        seedHostId: roomId,
        objectCount: room.nodes.filter(({ universalKey }) => isEphemeraObjectId(universalKey)).length,
        wallTimeMs: Date.now() - roomStartedAt,
        outcome,
    })

    const actorStartedAt = Date.now()
    const { cache: actor, stats } = await (deps.build ?? buildLudicCache)(actorId, assetStack, deps.buildDeps)
    logLudicCacheRebuild({
        seedHostId: actorId,
        shardFetchCount: stats.shardFetchCount,
        maxDepth: stats.maxDepth,
        objectCount: actor.nodes.filter(({ universalKey }) => isEphemeraObjectId(universalKey)).length,
        wallTimeMs: Date.now() - actorStartedAt,
        outcome: 'cold',
    })

    return new ActorLudicCache(actorId, roomId, unionLudicCaches(room, actor))
}
