import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraAreaId, isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraMembershipHostId,
    EphemeraPositionAdjacencyContainedId,
} from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

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
import { projectComponentGraphFromStoredLudicGraph } from './project'
import type {
    MembershipContainersCacheSetParams,
    PlayLudicGraph,
    PositionsCacheSetParams,
} from './types'

/**
 * Per-invocation read + memo handler for ephemera play ludic graphs.
 * Dynamo writes stay in positions membership persistence; memo APIs patch in-memory state only.
 */
export class PositionsCacheHandler {
    private readonly _LudicGraphCache: DeferredCache<PlayLudicGraph>
    private _LudicGraphStore: Record<string, PlayLudicGraph> = {}
    private readonly _MembershipContainersCache: DeferredCache<EphemeraMembershipHostId[]>
    private _MembershipContainersStore: Record<string, EphemeraMembershipHostId[]> = {}

    constructor(private readonly db: EphemeraPositionsReadDB) {
        this._LudicGraphCache = new DeferredCache<PlayLudicGraph>({
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
    ): Promise<PlayLudicGraph> {
        const key = ludicGraphCacheKey(componentId)
        if (!this._LudicGraphCache.isCached(key)) {
            this._LudicGraphCache.add({
                promiseFactory: async (keys: string[]) => {
                    const out: Record<string, PlayLudicGraph> = {}
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
    ): Promise<PlayLudicGraph> {
        if (isEphemeraRoomId(componentId)) {
            const stored = await getRoomLudicGraphFromDynamo(this.db, componentId)
            return projectComponentGraphFromStoredLudicGraph(
                stored ?? { nodes: [], edges: [] }
            )
        }
        if (isEphemeraCharacterId(componentId)) {
            const stored = await getCharacterLudicGraphFromDynamo(this.db, componentId)
            return projectComponentGraphFromStoredLudicGraph(
                stored ?? { nodes: [], edges: [] }
            )
        }
        if (isEphemeraObjectId(componentId)) {
            const stored = await getObjectLudicGraphFromDynamo(this.db, componentId)
            return projectComponentGraphFromStoredLudicGraph(
                stored ?? { nodes: [], edges: [] }
            )
        }
        if (isEphemeraFeatureId(componentId)) {
            const stored = await getFeatureLudicGraphFromDynamo(this.db, componentId)
            return projectComponentGraphFromStoredLudicGraph(
                stored ?? { nodes: [], edges: [] }
            )
        }
        if (isEphemeraAreaId(componentId)) {
            const stored = await getAreaLudicGraphFromDynamo(this.db, componentId)
            return projectComponentGraphFromStoredLudicGraph(
                stored ?? { nodes: [], edges: [] }
            )
        }
        return projectComponentGraphFromStoredLudicGraph({ nodes: [], edges: [] })
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
