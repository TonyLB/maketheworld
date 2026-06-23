import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraMembershipHostId,
    EphemeraPositionAdjacencyContainedId,
} from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraPositionsReadDB } from './fetch'
import {
    getCharacterPositionGraphFromDynamo,
    getRoomPositionGraphFromDynamo,
} from './fetch'
import { queryMembershipContainersFromDynamo } from './adjacency'
import { membershipContainersCacheKey, positionGraphCacheKey } from './keys'
import { projectComponentGraphFromStoredPositionGraph } from './project'
import type {
    MembershipContainersCacheSetParams,
    PlayPositionGraph,
    PositionsCacheSetParams,
} from './types'

/**
 * Per-invocation read + memo handler for ephemera play position graphs.
 * Dynamo writes stay in positions membership persistence; memo APIs patch in-memory state only.
 */
export class PositionsCacheHandler {
    private readonly _PositionGraphCache: DeferredCache<PlayPositionGraph>
    private _PositionGraphStore: Record<string, PlayPositionGraph> = {}
    private readonly _MembershipContainersCache: DeferredCache<EphemeraMembershipHostId[]>
    private _MembershipContainersStore: Record<string, EphemeraMembershipHostId[]> = {}

    constructor(private readonly db: EphemeraPositionsReadDB) {
        this._PositionGraphCache = new DeferredCache<PlayPositionGraph>({
            callback: (key, value) => {
                this._PositionGraphStore[key] = value
            },
        })
        this._MembershipContainersCache = new DeferredCache<EphemeraMembershipHostId[]>({
            callback: (key, value) => {
                this._MembershipContainersStore[key] = value
            },
        })
    }

    async getPositionGraph(
        componentId: EphemeraCharacterId | EphemeraRoomId
    ): Promise<PlayPositionGraph> {
        const key = positionGraphCacheKey(componentId)
        if (!this._PositionGraphCache.isCached(key)) {
            this._PositionGraphCache.add({
                promiseFactory: async (keys: string[]) => {
                    const out: Record<string, PlayPositionGraph> = {}
                    await Promise.all(
                        keys.map(async (cacheKey) => {
                            const id = cacheKey.replace('::positionGraph', '')
                            out[cacheKey] = await this.loadPositionGraphFromDynamo(id)
                        })
                    )
                    return out
                },
                requiredKeys: [key],
                transform: (out) => out,
            })
        }
        await this._PositionGraphCache.get(key)
        return this._PositionGraphStore[key]
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

    private async loadPositionGraphFromDynamo(
        componentId: string
    ): Promise<PlayPositionGraph> {
        if (isEphemeraRoomId(componentId)) {
            const stored = await getRoomPositionGraphFromDynamo(this.db, componentId)
            return projectComponentGraphFromStoredPositionGraph(
                stored ?? { nodes: [], edges: [] }
            )
        }
        if (isEphemeraCharacterId(componentId)) {
            const stored = await getCharacterPositionGraphFromDynamo(this.db, componentId)
            return projectComponentGraphFromStoredPositionGraph(
                stored ?? { nodes: [], edges: [] }
            )
        }
        return projectComponentGraphFromStoredPositionGraph({ nodes: [], edges: [] })
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
        const key = positionGraphCacheKey(params.componentId)
        this._PositionGraphStore[key] = params.graph
        this._PositionGraphCache.set(Infinity, key, params.graph)
    }

    setMembershipContainers(params: MembershipContainersCacheSetParams): void {
        const key = membershipContainersCacheKey(params.componentId)
        this._MembershipContainersStore[key] = params.containers
        this._MembershipContainersCache.set(Infinity, key, params.containers)
    }

    invalidate(componentId: EphemeraCharacterId | EphemeraRoomId): void {
        const key = positionGraphCacheKey(componentId)
        delete this._PositionGraphStore[key]
        this._PositionGraphCache.invalidate(key)
    }

    invalidateMembershipContainers(componentId: EphemeraPositionAdjacencyContainedId): void {
        const key = membershipContainersCacheKey(componentId)
        delete this._MembershipContainersStore[key]
        this._MembershipContainersCache.invalidate(key)
    }

    clear(): void {
        this._PositionGraphCache.clear()
        this._PositionGraphStore = {}
        this._MembershipContainersCache.clear()
        this._MembershipContainersStore = {}
    }

    async flush(): Promise<void> {
        await this._PositionGraphCache.flush()
        await this._MembershipContainersCache.flush()
    }
}

export const createPositionsCacheHandler = (db: EphemeraPositionsReadDB): PositionsCacheHandler =>
    new PositionsCacheHandler(db)
