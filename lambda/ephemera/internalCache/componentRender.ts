import type {
    ComponentAcrossAssetsEntry,
    ComponentDataCache,
} from '@tonylb/mtw-gateways/ts/assets/components/componentData'
import {
    mergeRoomExitsToJSON,
    mergeRoomShortNameLiteral,
    roomCharacterListToStandardCharacterData,
} from './roomWireMergeHelpers'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { EphemeraCacheDynamoItem } from '../dataSource/renderCache/baseClasses'
import type { RenderCacheData } from './renderCache'

import { RoomDescribeData, MapDescribeData } from '@tonylb/mtw-interfaces/ts/messages'
import CacheGlobalData from './global';
import { unique } from '@tonylb/mtw-utilities/ts/lists';

import {
    EphemeraCharacterId,
    EphemeraMapId,
    EphemeraMessageId,
    EphemeraRoomId,
    isEphemeraCharacterId,
    isEphemeraMapId,
    isEphemeraMessageId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses';
import { RoomCharacterListItem } from './baseClasses';
import CacheCharacterMetaData, { CharacterMetaItem } from './characterMeta';
import { AssetKey, splitType } from '@tonylb/mtw-utilities/ts/types';
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree';
import { AssetUUID, ComponentUUID, SchemaOutputTag } from '@tonylb/mtw-base/ts/schema';
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree';
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room';
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render';
import StandardMessage from '@tonylb/mtw-wml/ts/standardize/components/message';
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize';
import { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room';
import { StandardCharacterData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/character';
import { SituationRoomFacetPayload, type SituationRoomFacetPayloadType } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { situationRoomRenderPayloadFromCacheRenderedContent } from '../dataSource/renderCache/renderedContentToSituationRoomPayload'
import { assertMapServerRenderRetired } from '../dataSource/maps/stub'

type MessageDescribeData = {
    MessageId: EphemeraMessageId;
    Description: RenderTree;
    rooms: EphemeraRoomId[];
}

export type ComponentDescriptionItem = RoomDescribeData | MapDescribeData | MessageDescribeData

/** Options shape for ComponentRender cache keys (`priorRenderChain` is ignored for the key string). */
export type EphemeraComponentCacheKeyOptions = {
    priorRenderChain?: string[]
    header?: boolean
}

export function generateEphemeraComponentCacheKey(
    CharacterId: EphemeraCharacterId | 'ANONYMOUS',
    EphemeraId: EphemeraRoomId | EphemeraMapId | EphemeraMessageId,
    options?: EphemeraComponentCacheKeyOptions
): string {
    return `${CharacterId}::${EphemeraId}::${options && 'header' in options && options.header ? 'true' : 'false'}`
}

type ComponentDescriptionCache = {
    dependencies: string[]; // StateItemId removed - dependencies no longer tracked
    description: ComponentDescriptionItem;
}

export type ComponentRenderGetOptions = {
    priorRenderChain?: string[];
    header?: boolean;
}

export const isComponentTag = (tag) => (['Room', 'Feature'].includes(tag))

export const isComponentKey = (key) => (['ROOM', 'FEATURE'].includes(splitType(key)[0]))

export class ComponentRenderData {
    _renderCache: RenderCacheData;
    // _evaluateCode removed - Variable/Computed evaluation no longer needed
    _componentData: (
        EphemeraId: ComponentUUID,
        assetList: AssetUUID[]
    ) => Promise<Record<AssetUUID, ComponentAcrossAssetsEntry>>;
    _roomCharacterList: (roomId: EphemeraRoomId) => Promise<RoomCharacterListItem[]>;
    _getAssets: () => Promise<string[]>;
    _characterMeta: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    _Cache: DeferredCache<StandardForm>;
    _Store: Record<ComponentUUID, StandardForm> = {}
    
    constructor(
        componentData: ComponentDataCache,
        roomCharacterList: (roomId: EphemeraRoomId) => Promise<RoomCharacterListItem[]>,
        globalCache: CacheGlobalData,
        characterMeta: CacheCharacterMetaData,
        renderCache: RenderCacheData
    ) {
        this._renderCache = renderCache
        // _evaluateCode removed - Variable/Computed evaluation no longer needed
        this._componentData = (EphemeraId, assetList) => (componentData.getAcrossAssets(EphemeraId, assetList))
        this._roomCharacterList = roomCharacterList
        this._getAssets = async () => (await globalCache.get('assets') || [])
        this._characterMeta = (characterId) => (characterMeta.get(characterId))
        this._Cache = new DeferredCache<StandardForm>({
            callback: (key, description) => {
                this._setStore(key, description)
            },
            defaultValue: (cacheKey) => {
                if (isEphemeraRoomId(cacheKey)) {
                    return new StandardForm([
                        { tag: 'Asset', universalKey: 'ASSET#render' },
                        { tag: 'Room', universalKey: `ROOM#${cacheKey}`, exits: [] }
                    ])
                }
                if (isEphemeraMessageId(cacheKey)) {
                    return new StandardForm([
                        { tag: 'Asset', universalKey: 'ASSET#render' },
                        { tag: 'Message', universalKey: `MESSAGE#${cacheKey}`, rooms: [] }
                    ])
                }
                throw new Error('Illegal tag in ComponentDescription internalCache')
            }
        })
    }

    async flush() {
        this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
        this._Store = {}
    }

    _setStore(key: string, value: StandardForm): void {
        this._Store[key] = value
    }

    async _getPromiseFactory(
            CharacterId: EphemeraCharacterId | 'ANONYMOUS',
            EphemeraId: EphemeraRoomId | EphemeraMessageId,
            getOptions?: ComponentRenderGetOptions
        ): Promise<StandardForm> {
        const [globalAssets, { assets: characterAssets }] = await Promise.all([
            this._getAssets(),
            isEphemeraCharacterId(CharacterId) ? this._characterMeta(CharacterId) : Promise.resolve({ assets: [] })
        ]);

        const allAssets: AssetUUID[] = unique(globalAssets || [], characterAssets).map((key) => AssetKey(key));
        const appearancesByAsset = await this._componentData(
            EphemeraId,
            allAssets.map((key) => AssetKey(key))
        )

        if (isEphemeraRoomId(EphemeraId)) {
            const assetData = allAssets
                .map((assetId) => {
                    const entry = appearancesByAsset[assetId]
                    return entry ? [entry.component] : []
                })
                .flat(1) as StandardRoom[]

            // Room prose: render cache only (no ExamplesData fallback).
            const cacheRecords = await this._renderCache.get(EphemeraId);
            const firstRecord: EphemeraCacheDynamoItem | undefined = cacheRecords.length > 0
                ? cacheRecords[0]
                : undefined;
            let renderPayload: SituationRoomFacetPayloadType | undefined

            if (firstRecord) {
                renderPayload = situationRoomRenderPayloadFromCacheRenderedContent(firstRecord.renderedContent)
            }

            if (renderPayload) {
                const payloadModel = new SituationRoomFacetPayload(renderPayload)
                if (SituationRoomFacetPayload.isEmpty(payloadModel)) {
                    renderPayload = undefined
                }
            }

            const roomCharacterList = await this._roomCharacterList(EphemeraId)
            const exits = mergeRoomExitsToJSON(assetData)
            const shortName = mergeRoomShortNameLiteral(assetData)

            const roomRow: StandardRoomData = {
                tag: 'Room',
                universalKey: EphemeraId,
                ...(exits.length ? { exits } : {}),
                ...(renderPayload ? { render: renderPayload } : {}),
                characters: roomCharacterList.map(char => char.EphemeraId),
                shortName: shortName?.toJSON()
            };

            const characterComponents: StandardCharacterData[] = roomCharacterListToStandardCharacterData(roomCharacterList)

            const formComponents: any[] = [
                { tag: 'Asset' as const, universalKey: 'ASSET#render' as const, key: 'render' },
                roomRow,
                ...characterComponents
            ];

            return new StandardForm(formComponents, { standardizeMode: 'ephemeraWire' })
        }
        if (isEphemeraMessageId(EphemeraId)) {
            const assets = allAssets
                .filter((assetId) => (Boolean(appearancesByAsset[assetId])))
            const assetData = allAssets
                .map((assetId) => {
                    const entry = appearancesByAsset[assetId]
                    return entry ? [entry.component] : []
                })
                .flat(1) as StandardMessage[]
            const merged = assetData.reduce<StandardMessage | undefined>((previous, current) => (previous ? previous.merge(current) as StandardMessage | undefined : current), undefined)
            const { description = new StandardRender([]) } = merged ?? {}
            return new StandardForm([
                { tag: 'Asset', universalKey: 'ASSET#render' },
                { tag: 'Message', universalKey: `MESSAGE#${EphemeraId}`, rooms: [], description: { data: { tag: 'Description' }, children: description.toJSON() as GenericTree<SchemaOutputTag> } },
            ])
        }
        throw new Error('Illegal tag in ComponentDescription internalCache')
    }

    async get(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraRoomId | EphemeraMapId | EphemeraMessageId, options?: ComponentRenderGetOptions): Promise<StandardForm> {
        if (isEphemeraMapId(EphemeraId)) {
            assertMapServerRenderRetired(EphemeraId)
        }
        const cacheKey = generateEphemeraComponentCacheKey(CharacterId, EphemeraId, options)
        if (!this._Cache.isCached(cacheKey)) {
            //
            // TODO: Figure out how to convince Typescript to evaluate each branch independently, *without* having
            // to copy each branch explicitly
            //
            if (isEphemeraRoomId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (
                        (options && 'header' in options && options.header) ? this._getPromiseFactory(CharacterId, EphemeraId, options): this._getPromiseFactory(CharacterId, EphemeraId, { priorRenderChain: options?.priorRenderChain })),
                    requiredKeys: [cacheKey],
                    transform: (fetch) => {
                        if (typeof fetch === 'undefined') {
                            return {}
                        }
                        else {
                            return {
                                [cacheKey]: fetch
                            }
                        }
                    }
                })
            }
            if (isEphemeraMessageId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (this._getPromiseFactory(CharacterId, EphemeraId, options)),
                    requiredKeys: [cacheKey],
                    transform: (fetch) => {
                        if (typeof fetch === 'undefined') {
                            return {}
                        }
                        else {
                            return {
                                [cacheKey]: fetch
                            }
                        }
                    }
                })
            }
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey]
    }

    invalidate(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraRoomId) {
        const cacheKey = generateEphemeraComponentCacheKey(CharacterId, EphemeraId)
        if (cacheKey in this._Store) {
            delete this._Store[cacheKey]
        }
        if (cacheKey in this._Cache) {
            this._Cache[cacheKey].invalidate()
        }
    }

    set(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraRoomId, value: StandardForm) {
        const cacheKey = generateEphemeraComponentCacheKey(CharacterId, EphemeraId)
        this._Cache.set(Infinity, cacheKey, value)
        this._Store[cacheKey] = value
    }

    invalidateByEphemeraId(EphemeraId: string) { // StateItemId removed
        // const cacheKeysToInvalidate = Object.entries(this._Dependencies)
        //     .filter(([key, dependencies]) => (dependencies.includes(EphemeraId)))
        //     .map(([key]) => (key))
        // cacheKeysToInvalidate.forEach((key) => {
        //     this._Cache.invalidate(key)
        //     delete this._Store[key]
        //     delete this._Dependencies[key]
        // })
    }
}

export default ComponentRenderData
