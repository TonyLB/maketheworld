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
 * **A boundary type (AC-5).** The class keeps the union private and hands out flat handles (the boundary
 * `catalogHandles.ts` holds); planning-facing accessors are Phase 2.
 */
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../../internalCache'
import { resolveCanonAssetStackForRoom } from '../../state/resolveAssetStackForRoom'
import { buildLudicCache, type BuildLudicCacheDeps } from './fold'
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

    /** Every named object the actor can reach, in the room or in hand, as flat handles. */
    handles(): LudicCacheObjectHandle[] {
        return handlesFromCache(this.data, this.roomId)
    }

    /**
     * The objects wholly in the actor's hands: each has a binding, and every binding sits under the actor, directly or through
     * a chain of parents (the coin in a held bag). A part held and a part elsewhere (a half-held rope) is not wholly held.
     */
    heldObjectIds(): Set<EphemeraObjectId> {
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
