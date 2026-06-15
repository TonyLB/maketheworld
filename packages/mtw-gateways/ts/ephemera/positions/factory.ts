import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraPositionsReadDB } from './fetch'
import {
    getCharacterRoomIdFromDynamo,
    getRoomActiveCharactersFromDynamo,
    getRoomPositionGraphFromDynamo,
} from './fetch'
import { queryMembershipContainersFromDynamo } from './adjacency'
import { membershipContainersCacheKey, positionGraphCacheKey } from './keys'
import {
    projectCharacterInventoryGraphStub,
    projectMembershipContainersFromRoomEndpoint,
    projectRoomGraphFromActiveCharacters,
    projectRoomGraphFromStoredPositionGraph,
    projectRoomRosterFromGraph,
} from './project'
import type {
    MembershipContainersCacheSetParams,
    PlayPositionGraph,
    PlayPositionRoomRosterEntry,
    PositionsCacheSetParams,
} from './types'

/**
 * Per-invocation read + memo handler for ephemera play position graphs.
 * Dynamo writes stay in positions membership persistence; memo APIs patch in-memory state only.
 */
export class PositionsCacheHandler {
    private readonly _PositionGraphCache: DeferredCache<PlayPositionGraph>
    private _PositionGraphStore: Record<string, PlayPositionGraph> = {}
    private readonly _MembershipContainersCache: DeferredCache<EphemeraRoomId[]>
    private _MembershipContainersStore: Record<string, EphemeraRoomId[]> = {}

    constructor(private readonly db: EphemeraPositionsReadDB) {
        this._PositionGraphCache = new DeferredCache<PlayPositionGraph>({
            callback: (key, value) => {
                this._PositionGraphStore[key] = value
            },
        })
        this._MembershipContainersCache = new DeferredCache<EphemeraRoomId[]>({
            callback: (key, value) => {
                this._MembershipContainersStore[key] = value
            },
        })
    }

    async getPositionGraph(
        componentId: EphemeraCharacterId | EphemeraRoomId
    ): Promise<PlayPositionGraph> {
        if (isEphemeraCharacterId(componentId)) {
            return projectCharacterInventoryGraphStub()
        }

        const key = positionGraphCacheKey(componentId)
        if (!this._PositionGraphCache.isCached(key)) {
            this._PositionGraphCache.add({
                promiseFactory: async (keys: string[]) => {
                    const out: Record<string, PlayPositionGraph> = {}
                    await Promise.all(
                        keys.map(async (cacheKey) => {
                            const id = cacheKey.replace('::positionGraph', '') as EphemeraRoomId
                            out[cacheKey] = await this.loadRoomPositionGraphFromDynamo(id)
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
        componentId: EphemeraCharacterId
    ): Promise<EphemeraRoomId[]> {
        const key = membershipContainersCacheKey(componentId)
        if (!this._MembershipContainersCache.isCached(key)) {
            this._MembershipContainersCache.add({
                promiseFactory: async (keys: string[]) => {
                    const out: Record<string, EphemeraRoomId[]> = {}
                    await Promise.all(
                        keys.map(async (cacheKey) => {
                            const id = cacheKey.replace('::membershipContainers', '') as EphemeraCharacterId
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

    async getRoomRoster(roomId: EphemeraRoomId): Promise<PlayPositionRoomRosterEntry[]> {
        const graph = await this.getPositionGraph(roomId)
        return projectRoomRosterFromGraph(graph)
    }

    private async loadRoomPositionGraphFromDynamo(
        roomId: EphemeraRoomId
    ): Promise<PlayPositionGraph> {
        const stored = await getRoomPositionGraphFromDynamo(this.db, roomId)
        if (stored) {
            return projectRoomGraphFromStoredPositionGraph(stored)
        }
        return projectRoomGraphFromActiveCharacters(
            await getRoomActiveCharactersFromDynamo(this.db, roomId)
        )
    }

    private async loadMembershipContainersFromDynamo(
        characterId: EphemeraCharacterId
    ): Promise<EphemeraRoomId[]> {
        if (this.db.query) {
            const fromAdjacency = await queryMembershipContainersFromDynamo(
                { query: this.db.query.bind(this.db) },
                characterId
            )
            if (fromAdjacency.length > 0) {
                return fromAdjacency
            }
        }
        const roomEndpoint = await getCharacterRoomIdFromDynamo(this.db, characterId)
        return projectMembershipContainersFromRoomEndpoint(roomEndpoint)
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

    invalidateMembershipContainers(componentId: EphemeraCharacterId): void {
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
