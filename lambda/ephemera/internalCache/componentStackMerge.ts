import { ComponentAssetMetaData } from './componentAssetMeta'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import CacheGlobalData from './global'
import { excludeUndefined, unique } from '@tonylb/mtw-utilities/ts/lists'
import {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraMapId,
    EphemeraMessageId,
    EphemeraRoomId,
    isEphemeraCharacterId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { RoomCharacterListItem } from './baseClasses'
import CacheCharacterMetaData, { CharacterMetaItem } from './characterMeta'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { CacheRoomCharacterListsData } from './roomCharacterLists'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { ExitFacetList } from '@tonylb/mtw-wml/ts/standardize/keys/facets/exit'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import { StandardCharacterData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/character'

/** Options shape accepted for cache keys (aligns with `ComponentRender` room keys; `priorRenderChain` is ignored for the key string). */
export type EphemeraComponentCacheKeyOptions = {
    priorRenderChain?: string[]
    header?: boolean
}

export function generateEphemeraComponentCacheKey(
    CharacterId: EphemeraCharacterId | 'ANONYMOUS',
    EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId | EphemeraMapId | EphemeraMessageId,
    options?: EphemeraComponentCacheKeyOptions
): string {
    return `${CharacterId}::${EphemeraId}::${options && 'header' in options && options.header ? 'true' : 'false'}`
}

/** Cache key for `ComponentStackMerge` only (room structural merge does not depend on `header`). */
export function generateComponentStackMergeCacheKey(
    CharacterId: EphemeraCharacterId | 'ANONYMOUS',
    EphemeraRoomId: EphemeraRoomId
): string {
    return `${CharacterId}::${EphemeraRoomId}`
}

/** True if `cacheKey` is a stack-merge key for `roomId` (suffix match; character id must not contain `::`). */
export function componentStackMergeCacheKeyForRoom(cacheKey: string, roomId: EphemeraRoomId): boolean {
    return cacheKey.endsWith(`::${roomId}`)
}

export function mergeRoomExitsToJSON(assetData: StandardRoom[]) {
    const allExitFacets = assetData.map((asset) => asset.exits.items || []).flat(1)
    return new ExitFacetList(allExitFacets).toJSON()
}

export function mergeRoomShortNameLiteral(assetData: StandardRoom[]): StandardLiteral | undefined {
    return assetData
        .map((component) => component.shortName)
        .filter(excludeUndefined)
        .reduce<StandardLiteral | undefined>(
            (previous, current: StandardLiteral) => (previous ? previous.merge(current) : current),
            undefined
        )
}

export function roomCharacterListToStandardCharacterData(
    roomCharacterList: RoomCharacterListItem[]
): StandardCharacterData[] {
    return roomCharacterList.map((char) => ({
        tag: 'Character' as const,
        universalKey: char.EphemeraId,
        displayName: char.DisplayName ?? undefined,
        image: char.fileURL
            ? {
                  data: { tag: 'Image' as const, key: '', fileURL: char.fileURL },
                  children: [],
              }
            : undefined,
    }))
}

/** Room structural merge cache; key is (characterId, roomId). A future migration toward (componentId, perspectiveKey) would align with render / perception perspectiveKey usage. */
export class ComponentStackMergeData {
    _componentAssetMeta: (EphemeraId: ComponentUUID, assetList: AssetUUID[]) => Promise<Record<AssetUUID, StandardComponent>>
    _roomCharacterList: (roomId: EphemeraRoomId) => Promise<RoomCharacterListItem[]>
    _getAssets: () => Promise<string[]>
    _characterMeta: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>
    _getMetaRoom: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
    _Cache: DeferredCache<StandardForm>
    _Store: Record<string, StandardForm> = {}

    constructor(
        componentAssetMeta: ComponentAssetMetaData,
        roomCharacterList: CacheRoomCharacterListsData,
        globalCache: CacheGlobalData,
        characterMeta: CacheCharacterMetaData,
        getMetaRoom: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
    ) {
        this._componentAssetMeta = (EphemeraId, assetList) => componentAssetMeta.getAcrossAssets(EphemeraId, assetList)
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
        const matches = (key: string) => componentStackMergeCacheKeyForRoom(key, roomId)
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

        const allAssets: AssetUUID[] = unique(globalAssets || [], characterAssets).map((key) => AssetKey(key))
        const appearancesByAsset = (await this._componentAssetMeta(
            EphemeraRoomId,
            allAssets.map((key) => AssetKey(key))
        )) as Record<AssetUUID, StandardComponent>

        const assetData = allAssets.map((assetId) => (appearancesByAsset[assetId] ? [appearancesByAsset[assetId]] : [])).flat(1) as StandardRoom[]

        const [roomCharacterList, meta] = await Promise.all([
            this._roomCharacterList(EphemeraRoomId),
            this._getMetaRoom(EphemeraRoomId),
        ])
        const exits = mergeRoomExitsToJSON(assetData)
        const shortNameLiteral = mergeRoomShortNameLiteral(assetData)

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
        const cacheKey = generateComponentStackMergeCacheKey(CharacterId, EphemeraRoomId)
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

export default ComponentStackMergeData
