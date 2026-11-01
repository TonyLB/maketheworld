/**
 * The actor's cache (ISS8314; rules in `positions/AGENT.contract.md`, "A command reads the actor's cache"): one `ludicCache` for what an actor can reach, held
 * inventory included. It is the room's stored row unioned with a fold seeded at the actor, assembled per command at read
 * time. It is never stored, and never written into the room's row: the row is shared by every viewer, and a room walk
 * never enters a character's shard.
 *
 * **Union.** `unionCaches.ts`: nodes by `universalKey`, edges joined at crossing ports then deduped. The fold is per-host and independent, so this
 * equals one fold over both walks (`actorUnion.test.ts`). On a node-key collision the actor half's node wins: a determinism
 * rule, not a freshness claim.
 *
 * **Names.** The actor half is named with the room's Canon stack, the same as the stored row.
 *
 * **Freshness.** None: the actor half uses the ordinary command reads, since it exists only inside one command.
 *
 * **A boundary type.** The class keeps the union private; its accessors answer one question each and return flat
 * values, never the cache: `entries` is the command's object catalog (built on the flat handles `catalogHandles.ts`
 * holds), `containersOf` is planning's ancestry, and `boundaryRelationsOf` / `securedToSupportEdgeIds` /
 * `presencesOf` are what moving an object severs and `relationsBetween` the dry run's dissolve discovery (`boundaryRelations.ts`).
 */
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicNodeTerminal, HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../../internalCache'
import { resolveCanonAssetStackForRoom } from '../../state/resolveAssetStackForRoom'
import { buildLudicCache, type BuildLudicCacheDeps } from './fold'
import type { ObjectManipulationCatalogEntry } from '../../actions/actorObjectCatalog'
import { normalizeExitName } from '../../actions/normalizeExitName'
import { boundaryRelationsOfEdges, presencesOfNode, relationsBetweenEdges, securedToSupportEdgeIdsOfEdges, type BoundaryRelation, type RelationsBetween } from './boundaryRelations'
import { conceptNamesFromCache, handlesFromCache, type LudicCacheObjectHandle } from './catalogHandles'
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
     * from placement, not from which half an object was read from. An object whose name normalizes to nothing is left out.
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

    /** The short names of the Concepts in the cache: not catalog entries, read only by the kind-aware refusal. */
    conceptNames(): string[] {
        return conceptNamesFromCache(this.data)
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
     * What moving `moverId` out of `sourceHosts` severs: each relation with the mover at one end, with the far end named when
     * the cache joined the crossing and `open` when it holds only the leg (the caller names that by the bounded read).
     * Flat records, never the cache's edges.
     */
    boundaryRelationsOf(moverId: EphemeraObjectId, sourceHosts?: readonly EphemeraMembershipHostId[]): BoundaryRelation[] {
        return boundaryRelationsOfEdges(this.data.edges, moverId, sourceHosts)
    }

    /**
     * One named relation between two things: the joined edges with exactly these ends, and the open legs of it touching either
     * end (the dry run's dissolve discovery).
     */
    relationsBetween(
        subjectId: EphemeraLudicNodeTerminal,
        targetId: EphemeraLudicNodeTerminal,
        relationKind: HostRelationalEdgeKind,
        relationLabel?: string
    ): RelationsBetween {
        return relationsBetweenEdges(this.data.edges, subjectId, targetId, relationKind, relationLabel)
    }

    /** The `edgeId`s of the `Custom` edges that justify a `SecuredTo`: a block covers them. */
    securedToSupportEdgeIds(): ReadonlySet<string> {
        return securedToSupportEdgeIdsOfEdges(this.data.edges)
    }

    /** Where `host`'s graph sees a node: the bindings of `host` that hold it, or the room itself. */
    presencesOf(nodeId: EphemeraLudicNodeTerminal, host: EphemeraMembershipHostId): ReturnType<typeof presencesOfNode> {
        return presencesOfNode(this.data, nodeId, host)
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

/** What Expansion asks of the actor's cache about a mover's relations; tests supply a bare object. */
export type ActorBoundaryRelations = Pick<ActorLudicCache, 'boundaryRelationsOf' | 'relationsBetween' | 'securedToSupportEdgeIds' | 'presencesOf'>

/** What the name-only Concept refusal asks of the actor's cache; optional on the planning reads, so a bare test object need not supply it. */
export type ActorConcepts = Pick<ActorLudicCache, 'conceptNames'>

/** Everything planning asks of the actor's cache: ancestry and a mover's relations, and (optionally) the Concepts' names. */
export type ActorPlanningReads = ActorContainers & ActorBoundaryRelations & Partial<ActorConcepts>

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
