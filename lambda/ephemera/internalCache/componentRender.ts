import { ComponentAssetMetaData } from './componentAssetMeta'
import {
    generateEphemeraComponentCacheKey,
    mergeRoomExitsToJSON,
    mergeRoomShortNameLiteral,
    roomCharacterListToStandardCharacterData,
} from './componentStackMerge'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { EphemeraCacheDynamoItem } from '../dataSource/renderCache/baseClasses'
import type { RenderCacheData } from './renderCache'

import { RoomDescribeData, MapDescribeData, RoomExit } from '@tonylb/mtw-interfaces/ts/messages'
import CacheGlobalData from './global';
import { unique } from '@tonylb/mtw-utilities/ts/lists';

import {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraMapId,
    EphemeraMessageId,
    EphemeraRoomId,
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraMapId,
    isEphemeraMessageId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses';
import { RoomCharacterListItem } from './baseClasses';
import CacheCharacterMetaData, { CharacterMetaItem } from './characterMeta';
import { AssetKey, splitType } from '@tonylb/mtw-utilities/ts/types';
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree';
import { ExampleComponentId, ExamplesData, ExamplesReturn } from './examples';
import { selectDefaultSituationCacheRecord } from '../dataSource/renderCache/selectDefaultSituationCacheRecord';
import { CacheRoomCharacterListsData } from './roomCharacterLists';
import { AssetUUID, ComponentUUID, SchemaOutputTag } from '@tonylb/mtw-base/ts/schema';
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree';
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses';
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room';
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render';
import StandardMessage from '@tonylb/mtw-wml/ts/standardize/components/message';
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map';
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize';
import { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room';
import { StandardKnowledgeData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/knowledge';
import { StandardMapData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/map';
import { StandardFeatureData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/feature';
import { StandardCharacterData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/character';
import { SituationRoomFacetPayload, type SituationRoomFacetPayloadType } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { situationRoomRenderPayloadFromCacheRenderedContent } from '../dataSource/renderCache/renderedContentToSituationRoomPayload'

type MessageDescribeData = {
    MessageId: EphemeraMessageId;
    Description: RenderTree;
    rooms: EphemeraRoomId[];
}

export type ComponentDescriptionItem = RoomDescribeData | MapDescribeData | MessageDescribeData

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
    _examples: (keys: ExampleComponentId[]) => Promise<Record<ExampleComponentId, ExamplesReturn[]>>;
    _renderCache: RenderCacheData;
    // _evaluateCode removed - Variable/Computed evaluation no longer needed
    _componentAssetMeta: (EphemeraId: ComponentUUID, assetList: AssetUUID[]) => Promise<Record<AssetUUID, StandardComponent>>;
    _roomCharacterList: (roomId: EphemeraRoomId) => Promise<RoomCharacterListItem[]>;
    _getAssets: () => Promise<string[]>;
    _characterMeta: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    _Cache: DeferredCache<StandardForm>;
    _Store: Record<ComponentUUID, StandardForm> = {}
    
    constructor(
        examples: ExamplesData,
        componentAssetMeta: ComponentAssetMetaData,
        roomCharacterList: CacheRoomCharacterListsData,
        globalCache: CacheGlobalData,
        characterMeta: CacheCharacterMetaData,
        renderCache: RenderCacheData
    ) {
        this._examples = (keys) => (examples.get(keys))
        this._renderCache = renderCache
        // _evaluateCode removed - Variable/Computed evaluation no longer needed
        this._componentAssetMeta = (EphemeraId, assetList) => (componentAssetMeta.getAcrossAssets(EphemeraId, assetList))
        this._roomCharacterList = (RoomId) => (roomCharacterList.get(RoomId))
        this._getAssets = async () => (await globalCache.get('assets') || [])
        this._characterMeta = (characterId) => (characterMeta.get(characterId))
        this._Cache = new DeferredCache<StandardForm>({
            callback: (key, description) => {
                this._setStore(key, description)
            },
            defaultValue: (cacheKey) => {
                if (isEphemeraFeatureId(cacheKey)) {
                    return new StandardForm([
                        { tag: 'Asset', universalKey: 'ASSET#render' },
                        { tag: 'Feature', universalKey: `FEATURE#${cacheKey}` }
                    ])
                }
                if (isEphemeraKnowledgeId(cacheKey)) {
                    return new StandardForm([
                        { tag: 'Asset', universalKey: 'ASSET#render' },
                        { tag: 'Knowledge', universalKey: `KNOWLEDGE#${cacheKey}` }
                    ])
                }
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

    async _resolveRenderPayloadFromDefaultCache(
        EphemeraId: EphemeraFeatureId | EphemeraKnowledgeId
    ): Promise<SituationRoomFacetPayloadType | undefined> {
        const cacheRecords = await this._renderCache.get(EphemeraId)
        const record = selectDefaultSituationCacheRecord(cacheRecords)
        let renderPayload = record
            ? situationRoomRenderPayloadFromCacheRenderedContent(record.renderedContent)
            : undefined

        if (renderPayload) {
            const payloadModel = new SituationRoomFacetPayload(renderPayload)
            if (SituationRoomFacetPayload.isEmpty(payloadModel)) {
                renderPayload = undefined
            }
        }
        return renderPayload
    }

    async _getPromiseFactory(
            CharacterId: EphemeraCharacterId | 'ANONYMOUS',
            EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId | EphemeraMessageId | EphemeraMapId,
            getOptions?: ComponentRenderGetOptions
        ): Promise<StandardForm> {
        const [globalAssets, { assets: characterAssets }] = await Promise.all([
            this._getAssets(),
            isEphemeraCharacterId(CharacterId) ? this._characterMeta(CharacterId) : Promise.resolve({ assets: [] })
        ]);

        const allAssets: AssetUUID[] = unique(globalAssets || [], characterAssets).map((key) => AssetKey(key));
        const appearancesByAsset = await this._componentAssetMeta(EphemeraId, allAssets.map((key) => AssetKey(key))) as Record<AssetUUID, StandardComponent>;

        if (isEphemeraRoomId(EphemeraId)) {
            const assetData = allAssets.map((assetId) => (appearancesByAsset[assetId] ? [appearancesByAsset[assetId]] : [])).flat(1) as StandardRoom[];

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

            return new StandardForm(formComponents)
        }
        if (isEphemeraFeatureId(EphemeraId)) {
            const renderPayload = await this._resolveRenderPayloadFromDefaultCache(EphemeraId)
            const featureRow: StandardFeatureData = {
                tag: 'Feature',
                universalKey: EphemeraId,
                ...(renderPayload ? { render: renderPayload } : {}),
            }
            return new StandardForm([
                { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
                featureRow,
            ])
        }
        if (isEphemeraKnowledgeId(EphemeraId)) {
            const renderPayload = await this._resolveRenderPayloadFromDefaultCache(EphemeraId)
            const knowledgeRow: StandardKnowledgeData = {
                tag: 'Knowledge',
                universalKey: EphemeraId,
                ...(renderPayload ? { render: renderPayload } : {}),
            }
            return new StandardForm([
                { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
                knowledgeRow,
            ])
        }
        if (isEphemeraMessageId(EphemeraId)) {
            const assets = allAssets
                .filter((assetId) => (Boolean(appearancesByAsset[assetId])))
            const assetData = allAssets.map((assetId) => (appearancesByAsset[assetId] ? [appearancesByAsset[assetId]] : [])).flat(1) as StandardMessage[]
            const merged = assetData.reduce<StandardMessage | undefined>((previous, current) => (previous ? previous.merge(current) as StandardMessage | undefined : current), undefined)
            const { description = new StandardRender([]) } = merged ?? {}
            return new StandardForm([
                { tag: 'Asset', universalKey: 'ASSET#render' },
                { tag: 'Message', universalKey: `MESSAGE#${EphemeraId}`, rooms: [], description: { data: { tag: 'Description' }, children: description.toJSON() as GenericTree<SchemaOutputTag> } },
            ])
        }
        if (isEphemeraMapId(EphemeraId)) {
            const assets = allAssets
                .filter((assetId) => (Boolean(appearancesByAsset[assetId])))
            const assetData = allAssets.map((assetId) => (appearancesByAsset[assetId] ? [appearancesByAsset[assetId]] : [])).flat(1) as StandardMap[]
            const merged = assetData.reduce<StandardMap | undefined>((previous, current) => (previous ? previous.merge(current) as StandardMap | undefined : current), undefined)
            //
            // Figure out how to properly map room keys to EphemeraId during extraction phases above
            //
            const roomMetaPromise = Promise.all((merged?.positions.items ?? []).map(async (facet) => {
                const ephemeraId = facet.reference.universalKey as EphemeraRoomId
                const metaByAsset = await this._componentAssetMeta(ephemeraId, unique(globalAssets || [], characterAssets) as AssetUUID[])
                const roomMeta = allAssets
                    .map((assetId) => (metaByAsset[assetId] ? [metaByAsset[assetId]] : []))
                    .flat(1) as StandardRoom[]
                const mergedRoom = roomMeta.reduce<StandardRoom | undefined>((previous, current) => (previous ? previous.merge(current) as StandardRoom | undefined : current), undefined)
                return {
                    roomId: ephemeraId,
                    shortName: mergedRoom?.shortName?._payload?.plain?.toJSON?.() as string,
                    exits: (mergedRoom?.exits.items ?? [])
                        .filter((exitFacet) => (Boolean(
                            merged &&
                            merged.positions.items.find((facet) => (facet.reference.standardKey.equals(exitFacet.reference.standardKey)))
                        )))
                        .map((exitFacet) => ({ 
                            description: (typeof exitFacet.payload.toJSON() === 'string' ? exitFacet.payload.toJSON() : '') as string, 
                            to: exitFacet.reference.standardKey.toJSON() as EphemeraRoomId 
                        })),
                    x: facet.payload.plain?.x,
                    y: facet.payload.plain?.y
                }
            }))
            const [rooms, fileURLs, rest] = await Promise.all([
                roomMetaPromise,
                [],
                { shortName: merged?.shortName?._payload?.plain?.toJSON?.() },
            ])
            const mapRow: StandardMapData = {
                tag: 'Map',
                universalKey: EphemeraId,
                images: [],
                positions: merged?.positions?.toJSON() ?? [],
                ...rest
            }
            return new StandardForm([
                { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
                mapRow,
                ...rooms.map((room): StandardRoomData => ({
                    tag: 'Room',
                    universalKey: room.roomId,
                    ...(room.exits.length ? { 
                        exits: room.exits.map(exit => ({
                            reference: { tag: 'Room', ...(typeof exit.to === 'string' ? { universalKey: exit.to } : { key: exit.to }) },
                            payload: exit.description || undefined
                        }))
                    } : {}),
                    shortName: room.shortName
                }))
            ])
        }
        throw new Error('Illegal tag in ComponentDescription internalCache')
    }

    async get(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraFeatureId | EphemeraKnowledgeId | EphemeraRoomId | EphemeraMapId | EphemeraMessageId, options?: ComponentRenderGetOptions): Promise<StandardForm> {
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
            if (isEphemeraFeatureId(EphemeraId) || isEphemeraKnowledgeId(EphemeraId) || isEphemeraMessageId(EphemeraId) || isEphemeraMapId(EphemeraId)) {
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

    invalidate(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId) {
        const cacheKey = generateEphemeraComponentCacheKey(CharacterId, EphemeraId)
        if (cacheKey in this._Store) {
            delete this._Store[cacheKey]
        }
        if (cacheKey in this._Cache) {
            this._Cache[cacheKey].invalidate()
        }
    }

    set(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId, value: StandardForm) {
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