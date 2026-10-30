/**
 * The actor's cache (ISS8314, `AGENT.actorCache.planning.md`): one `ludicCache` for what an actor can reach, held
 * inventory included. It is the room's stored row unioned with a fold seeded at the actor, assembled per command at read
 * time. It is never stored, and never written into the room's row: the row is shared by every viewer, and a room walk
 * never enters a character's shard.
 *
 * **Union (AC-1).** Nodes by `universalKey`, edges by `dedupeEdgesByIdentity`. The fold is per-host and independent, so this
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
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../../internalCache'
import { resolveCanonAssetStackForRoom } from '../../state/resolveAssetStackForRoom'
import { buildLudicCache, type BuildLudicCacheDeps } from './fold'
import { handlesFromCache, type LudicCacheObjectHandle } from './catalogHandles'
import { logLudicCacheRebuild } from './ludicCacheInstrumentation'
import { dedupeEdgesByIdentity } from './mergeReducer'
import { readLudicCacheWithOutcome } from './store'
import type { EphemeraLudicCacheData } from './types'

/** The room's cache and the actor's, as one: nodes by key (the actor's wins a collision), edges deduped by identity. */
export const unionLudicCaches = (room: EphemeraLudicCacheData, actor: EphemeraLudicCacheData): EphemeraLudicCacheData => ({
    hostId: actor.hostId,
    nodes: [...new Map([...room.nodes, ...actor.nodes].map((node) => [node.universalKey, node])).values()],
    edges: dedupeEdgesByIdentity([...room.edges, ...actor.edges]),
})

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
        return handlesFromCache(this.data, this.roomId).handles
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
