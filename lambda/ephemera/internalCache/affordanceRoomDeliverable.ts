/**
 * Affordance-channel room header compose memo for terminal perception publish.
 */
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { aggregatePerspectiveExplicit } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { AffordanceCacheData } from './affordanceCache'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import CacheGlobalData from './global'
import { unique } from '@tonylb/mtw-utilities/ts/lists'
import {
    EphemeraCharacterId,
    EphemeraRoomId,
    isEphemeraCharacterId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import CacheCharacterMetaData, { CharacterMetaItem } from './characterMeta'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { CacheRoomCharacterListsData } from './roomCharacterLists'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import type { RoomCharacterListItem } from './baseClasses'
import { roomCharacterListToStandardCharacterData } from './roomWireMergeHelpers'

/** Cache key for AffordanceRoomDeliverable (characterId, roomId). */
export function generateAffordanceRoomDeliverableCacheKey(
    CharacterId: EphemeraCharacterId | 'ANONYMOUS',
    EphemeraRoomId: EphemeraRoomId
): string {
    return `${CharacterId}::${EphemeraRoomId}`
}

/** True if `cacheKey` is an affordance deliverable key for `roomId` (suffix match; character id must not contain `::`). */
export function affordanceRoomDeliverableCacheKeyForRoom(cacheKey: string, roomId: EphemeraRoomId): boolean {
    return cacheKey.endsWith(`::${roomId}`)
}

/**
 * Per-invocation compose memo: builds affordance-channel room header StandardForm
 * (shortName via ComponentAggregate, exits via AffordanceCache, roster/objects via ephemera meta).
 * Called from perception on Affordances Pertain terminal publish only.
 */
export class AffordanceRoomDeliverableData {
    _componentAggregate: ComponentAggregateMergedCache
    _affordanceCache: AffordanceCacheData
    _roomCharacterList: (roomId: EphemeraRoomId) => Promise<RoomCharacterListItem[]>
    _getAssets: () => Promise<string[]>
    _characterMeta: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>
    _getMetaRoom: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
    _Cache: DeferredCache<StandardForm>
    _Store: Record<string, StandardForm> = {}

    constructor(
        componentAggregate: ComponentAggregateMergedCache,
        affordanceCache: AffordanceCacheData,
        roomCharacterList: CacheRoomCharacterListsData,
        globalCache: CacheGlobalData,
        characterMeta: CacheCharacterMetaData,
        getMetaRoom: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
    ) {
        this._componentAggregate = componentAggregate
        this._affordanceCache = affordanceCache
        this._roomCharacterList = (RoomId) => roomCharacterList.get(RoomId)
        this._getAssets = async () => (await globalCache.get('assets')) || []
        this._characterMeta = (characterId) => characterMeta.get(characterId)
        this._getMetaRoom = getMetaRoom
        this._Cache = new DeferredCache<StandardForm>({
            callback: (key, description) => {
                this._Store[key] = description
            },
        })
    }

    async flush() {
        await this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
        this._Store = {}
    }

    invalidate(roomId: EphemeraRoomId): void {
        const matches = (key: string) => affordanceRoomDeliverableCacheKeyForRoom(key, roomId)
        this._Cache.invalidateWhere(matches)
        for (const key of Object.keys(this._Store)) {
            if (matches(key)) {
                delete this._Store[key]
            }
        }
    }

    async _getPromiseFactory(
        CharacterId: EphemeraCharacterId | 'ANONYMOUS',
        EphemeraRoomId: EphemeraRoomId
    ): Promise<StandardForm> {
        const [globalAssets, { assets: characterAssets }] = await Promise.all([
            this._getAssets(),
            isEphemeraCharacterId(CharacterId) ? this._characterMeta(CharacterId) : Promise.resolve({ assets: [] }),
        ])

        const mergeParticipationOrder: AssetUUID[] = unique(globalAssets || [], characterAssets).map((key) => AssetKey(key))
        const perspectiveKey = computePerspectiveKey(mergeParticipationOrder)

        const perspective = aggregatePerspectiveExplicit({
            universalKey: EphemeraRoomId,
            mergeParticipationOrder,
        })

        const [aggregateResults, affordanceRow, roomCharacterList, meta] = await Promise.all([
            this._componentAggregate.get([perspective]),
            this._affordanceCache.getAffordanceRow(EphemeraRoomId, perspectiveKey),
            this._roomCharacterList(EphemeraRoomId),
            this._getMetaRoom(EphemeraRoomId),
        ])

        if (affordanceRow === undefined) {
            throw new Error(
                `AFFORDANCE_TOPOLOGY_NOT_READY: ${EphemeraRoomId} at ${perspectiveKey} (call ensureAffordanceTopology first)`
            )
        }

        const mergedRoom = aggregateResults[0]?.merged
        if (!(mergedRoom instanceof StandardRoom)) {
            throw new Error(`ComponentAggregate did not return StandardRoom for ${EphemeraRoomId}`)
        }

        const exits = affordanceRow.topology.exits
        const shortNameLiteral = mergedRoom.shortName

        const roomRow: StandardRoomData = {
            tag: 'Room',
            universalKey: EphemeraRoomId,
            ...(exits.length ? { exits } : {}),
            characters: roomCharacterList.map((char) => char.EphemeraId),
            shortName: shortNameLiteral?.toJSON(),
            ...(meta?.objects?.length
                ? {
                    objects: meta.objects.map((o) => ({ uuid: o.uuid, shortName: o.shortName })),
                }
                : {}),
        }

        const characterComponents = roomCharacterListToStandardCharacterData(roomCharacterList)

        return new StandardForm(
            [
                { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
                roomRow,
                ...characterComponents,
            ],
            { standardizeMode: 'ephemeraWire' }
        )
    }

    async get(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraRoomId: EphemeraRoomId): Promise<StandardForm> {
        const cacheKey = generateAffordanceRoomDeliverableCacheKey(CharacterId, EphemeraRoomId)
        if (!this._Cache.isCached(cacheKey)) {
            this._Cache.add({
                promiseFactory: async () => this._getPromiseFactory(CharacterId, EphemeraRoomId),
                requiredKeys: [cacheKey],
                transform: (fetch) => {
                    if (typeof fetch === 'undefined') {
                        return {}
                    }
                    return {
                        [cacheKey]: fetch,
                    }
                },
            })
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey]
    }
}

export default AffordanceRoomDeliverableData
