import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraPositionsReadDB } from './fetch'
import {
    getCharacterRoomIdFromDynamo,
    getRoomActiveCharactersFromDynamo,
} from './fetch'
import { positionGraphCacheKey } from './keys'
import {
    projectCharacterGraphFromRoomEndpoint,
    projectRoomGraphFromActiveCharacters,
    projectRoomRosterFromGraph,
} from './project'
import type { PlayPositionGraph, PlayPositionRoomRosterEntry, PositionsCacheSetParams } from './types'

/**
 * Per-invocation read + memo handler for ephemera play position graphs.
 * Dynamo writes stay in positions membership persistence; memo APIs patch in-memory state only.
 */
export class PositionsCacheHandler {
    private readonly _PositionGraphCache: DeferredCache<PlayPositionGraph>
    private _PositionGraphStore: Record<string, PlayPositionGraph> = {}

    constructor(private readonly db: EphemeraPositionsReadDB) {
        this._PositionGraphCache = new DeferredCache<PlayPositionGraph>({
            callback: (key, value) => {
                this._PositionGraphStore[key] = value
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
                            const id = cacheKey.replace('::positionGraph', '') as EphemeraCharacterId | EphemeraRoomId
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

    async getRoomRoster(roomId: EphemeraRoomId): Promise<PlayPositionRoomRosterEntry[]> {
        const graph = await this.getPositionGraph(roomId)
        return projectRoomRosterFromGraph(graph)
    }

    private async loadPositionGraphFromDynamo(
        componentId: EphemeraCharacterId | EphemeraRoomId
    ): Promise<PlayPositionGraph> {
        if (isEphemeraRoomId(componentId)) {
            const activeCharacters = await getRoomActiveCharactersFromDynamo(this.db, componentId)
            return projectRoomGraphFromActiveCharacters(activeCharacters)
        }
        if (isEphemeraCharacterId(componentId)) {
            const roomEndpoint = await getCharacterRoomIdFromDynamo(this.db, componentId)
            return projectCharacterGraphFromRoomEndpoint(componentId, roomEndpoint)
        }
        throw new Error(`Invalid positions component id: ${componentId}`)
    }

    set(params: PositionsCacheSetParams): void {
        const key = positionGraphCacheKey(params.componentId)
        this._PositionGraphStore[key] = params.graph
        this._PositionGraphCache.set(Infinity, key, params.graph)
    }

    invalidate(componentId: EphemeraCharacterId | EphemeraRoomId): void {
        const key = positionGraphCacheKey(componentId)
        delete this._PositionGraphStore[key]
        this._PositionGraphCache.invalidate(key)
    }

    clear(): void {
        this._PositionGraphCache.clear()
        this._PositionGraphStore = {}
    }

    async flush(): Promise<void> {
        await this._PositionGraphCache.flush()
    }
}

export const createPositionsCacheHandler = (db: EphemeraPositionsReadDB): PositionsCacheHandler =>
    new PositionsCacheHandler(db)
