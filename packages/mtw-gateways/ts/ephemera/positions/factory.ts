import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraAreaId, isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraMembershipHostId,
    EphemeraPositionAdjacencyContainedId,
} from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicGraphFieldPayload, EphemeraLudicGraphNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraPositionsReadDB } from './fetch'
import {
    getAreaLudicGraphFromDynamo,
    getCharacterLudicGraphFromDynamo,
    getFeatureLudicGraphFromDynamo,
    getObjectLudicGraphFromDynamo,
    getRoomLudicGraphFromDynamo,
} from './fetch'
import { queryMembershipContainersFromDynamo } from './adjacency'
import { membershipContainersCacheKey, ludicGraphCacheKey } from './keys'
import type {
    MembershipContainersCacheSetParams,
    PositionsCacheSetParams,
} from './types'

/**
 * An absent row's empty graph, rooted at its own host with that root present in `nodes` ---
 * concepts clause 3 / LP4i, enforced by `isEphemeraLudicGraphFieldPayload`. The node tag comes
 * from the caller's own id-kind branch, which already knows it.
 */
const emptyLudicGraphPayload = (
    componentId: EphemeraMembershipHostId,
    tag: EphemeraLudicGraphNode['tag']
): EphemeraLudicGraphFieldPayload => ({
    rootId: componentId,
    nodes: [{ tag, universalKey: componentId } as EphemeraLudicGraphNode],
    edges: [],
    ports: [],
})

/**
 * Fills in the structural fields a pre-LP4a/LP4d row can be missing (`rootId`, the root's own
 * node, `ports`) while passing through everything the row *does* carry.
 *
 * The projection this replaced normalized partial rows as a side effect of discarding most of
 * them, so legacy rows have always read cleanly; that tolerance is preserved deliberately, since
 * the defect being fixed here is dropping data that is *present*, not accepting data that is
 * *absent*. Genuinely stale stored structure is still `ludicGraphStaleStructureSweep`'s to find
 * and `healLudicGraphStructure`'s to repair --- normalizing on read does not write anything back.
 */
const normalizeStoredLudicGraph = (
    stored: EphemeraLudicGraphFieldPayload | undefined,
    componentId: EphemeraMembershipHostId,
    tag: EphemeraLudicGraphNode['tag']
): EphemeraLudicGraphFieldPayload => {
    if (!stored) {
        return emptyLudicGraphPayload(componentId, tag)
    }
    const rootId = stored.rootId ?? componentId
    const nodes = stored.nodes ?? []
    const rootNode = { tag, universalKey: componentId } as EphemeraLudicGraphNode
    return {
        rootId,
        nodes: nodes.some((node) => node.universalKey === componentId) ? nodes : [rootNode, ...nodes],
        ...(stored.edges !== undefined ? { edges: stored.edges } : {}),
        ports: stored.ports ?? [],
    }
}

/**
 * Per-invocation read + memo handler for ephemera play ludic graphs.
 * Dynamo writes stay in positions membership persistence; memo APIs patch in-memory state only.
 *
 * **Caches the stored payload verbatim** (`EphemeraLudicGraphFieldPayload`), not a projection of
 * it. Until 2026-09-03 this memo held the authored `StandardLudicGraphData` shape, so every load
 * and every `set` silently dropped `ports` (and `rootId`, and Room/Feature/Area nodes) --- see
 * `project.ts`. Ports are runtime-minted and have no authored counterpart, so any consumer
 * reading crossings through this cache saw none.
 */
export class PositionsCacheHandler {
    private readonly _LudicGraphCache: DeferredCache<EphemeraLudicGraphFieldPayload>
    private _LudicGraphStore: Record<string, EphemeraLudicGraphFieldPayload> = {}
    private readonly _MembershipContainersCache: DeferredCache<EphemeraMembershipHostId[]>
    private _MembershipContainersStore: Record<string, EphemeraMembershipHostId[]> = {}

    constructor(private readonly db: EphemeraPositionsReadDB) {
        this._LudicGraphCache = new DeferredCache<EphemeraLudicGraphFieldPayload>({
            callback: (key, value) => {
                this._LudicGraphStore[key] = value
            },
        })
        this._MembershipContainersCache = new DeferredCache<EphemeraMembershipHostId[]>({
            callback: (key, value) => {
                this._MembershipContainersStore[key] = value
            },
        })
    }

    async getLudicGraph(
        componentId: EphemeraCharacterId | EphemeraRoomId | EphemeraObjectId | EphemeraFeatureId | EphemeraAreaId
    ): Promise<EphemeraLudicGraphFieldPayload> {
        const key = ludicGraphCacheKey(componentId)
        if (!this._LudicGraphCache.isCached(key)) {
            this._LudicGraphCache.add({
                promiseFactory: async (keys: string[]) => {
                    const out: Record<string, EphemeraLudicGraphFieldPayload> = {}
                    await Promise.all(
                        keys.map(async (cacheKey) => {
                            const id = cacheKey.replace('::ludicGraph', '')
                            out[cacheKey] = await this.loadLudicGraphFromDynamo(id)
                        })
                    )
                    return out
                },
                requiredKeys: [key],
                transform: (out) => out,
            })
        }
        await this._LudicGraphCache.get(key)
        return this._LudicGraphStore[key]
    }

    async getMembershipContainers(
        componentId: EphemeraPositionAdjacencyContainedId
    ): Promise<EphemeraMembershipHostId[]> {
        const key = membershipContainersCacheKey(componentId)
        if (!this._MembershipContainersCache.isCached(key)) {
            this._MembershipContainersCache.add({
                promiseFactory: async (keys: string[]) => {
                    const out: Record<string, EphemeraMembershipHostId[]> = {}
                    await Promise.all(
                        keys.map(async (cacheKey) => {
                            const id = cacheKey.replace('::membershipContainers', '') as EphemeraPositionAdjacencyContainedId
                            out[cacheKey] = await this.loadMembershipContainersFromDynamo(id)
                        })
                    )
                    return out
                },
                requiredKeys: [key],
                transform: (out) => out,
            })
        }
        await this._MembershipContainersCache.get(key)
        return this._MembershipContainersStore[key]
    }

    private async loadLudicGraphFromDynamo(
        componentId: string
    ): Promise<EphemeraLudicGraphFieldPayload> {
        if (isEphemeraRoomId(componentId)) {
            const stored = await getRoomLudicGraphFromDynamo(this.db, componentId)
            return normalizeStoredLudicGraph(stored, componentId, 'Room')
        }
        if (isEphemeraCharacterId(componentId)) {
            const stored = await getCharacterLudicGraphFromDynamo(this.db, componentId)
            return normalizeStoredLudicGraph(stored, componentId, 'Character')
        }
        if (isEphemeraObjectId(componentId)) {
            const stored = await getObjectLudicGraphFromDynamo(this.db, componentId)
            return normalizeStoredLudicGraph(stored, componentId, 'Object')
        }
        if (isEphemeraFeatureId(componentId)) {
            const stored = await getFeatureLudicGraphFromDynamo(this.db, componentId)
            return normalizeStoredLudicGraph(stored, componentId, 'Feature')
        }
        if (isEphemeraAreaId(componentId)) {
            const stored = await getAreaLudicGraphFromDynamo(this.db, componentId)
            return normalizeStoredLudicGraph(stored, componentId, 'Area')
        }
        // Unreachable in practice (componentId's declared type is exhausted above). No host kind
        // is known here, so there is no honest node tag to mint a root with --- an empty node list
        // is the one shape that does not invent a kind the caller never named. This payload does
        // not satisfy `isEphemeraLudicGraphFieldPayload`'s root-in-nodes clause, deliberately: a
        // consumer reaching this branch has already violated the id contract.
        return { rootId: componentId as unknown as EphemeraLudicGraphFieldPayload['rootId'], nodes: [], edges: [], ports: [] }
    }

    private async loadMembershipContainersFromDynamo(
        containedId: EphemeraPositionAdjacencyContainedId
    ): Promise<EphemeraMembershipHostId[]> {
        if (!this.db.query) {
            return []
        }
        return queryMembershipContainersFromDynamo(
            { query: this.db.query.bind(this.db) },
            containedId
        )
    }

    set(params: PositionsCacheSetParams): void {
        const key = ludicGraphCacheKey(params.componentId)
        this._LudicGraphStore[key] = params.graph
        this._LudicGraphCache.set(Infinity, key, params.graph)
    }

    setMembershipContainers(params: MembershipContainersCacheSetParams): void {
        const key = membershipContainersCacheKey(params.componentId)
        this._MembershipContainersStore[key] = params.containers
        this._MembershipContainersCache.set(Infinity, key, params.containers)
    }

    invalidate(componentId: EphemeraCharacterId | EphemeraRoomId | EphemeraObjectId | EphemeraFeatureId | EphemeraAreaId): void {
        const key = ludicGraphCacheKey(componentId)
        delete this._LudicGraphStore[key]
        this._LudicGraphCache.invalidate(key)
    }

    invalidateMembershipContainers(componentId: EphemeraPositionAdjacencyContainedId): void {
        const key = membershipContainersCacheKey(componentId)
        delete this._MembershipContainersStore[key]
        this._MembershipContainersCache.invalidate(key)
    }

    clear(): void {
        this._LudicGraphCache.clear()
        this._LudicGraphStore = {}
        this._MembershipContainersCache.clear()
        this._MembershipContainersStore = {}
    }

    async flush(): Promise<void> {
        await this._LudicGraphCache.flush()
        await this._MembershipContainersCache.flush()
    }
}

export const createPositionsCacheHandler = (db: EphemeraPositionsReadDB): PositionsCacheHandler =>
    new PositionsCacheHandler(db)
