import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { AssetKey, splitType } from '@tonylb/mtw-utilities/dist/types';
import { CacheConstructor } from './baseClasses'
import { DeferredCache } from './deferredCache'

import { EphemeraRoom, EphemeraFeature, EphemeraKnowledge, EphemeraBookmark, EphemeraMap, EphemeraMessage, EphemeraMoment, EphemeraVariable, EphemeraComputed, EphemeraItem, EphemeraAction, EphemeraKeyMappingMixin, EphemeraStateMappingMixin, tagFromEphemeraWrappedId } from '../cacheAsset/baseClasses'
import {
    EphemeraActionId,
    EphemeraBookmarkId,
    EphemeraComputedId,
    EphemeraFeatureId,
    EphemeraId,
    EphemeraKnowledgeId,
    EphemeraMapId,
    EphemeraMessageId,
    EphemeraMomentId,
    EphemeraRoomId,
    EphemeraVariableId,
    isEphemeraActionId,
    isEphemeraBookmarkId,
    isEphemeraComputedId,
    isEphemeraFeatureId,
    isEphemeraId,
    isEphemeraKnowledgeId,
    isEphemeraMapId,
    isEphemeraMessageId,
    isEphemeraMomentId,
    isEphemeraRoomId,
    isEphemeraVariableId
} from '@tonylb/mtw-interfaces/ts/baseClasses';
import { defaultComponentFromTag, StandardAction, StandardComponentData, StandardComputed, StandardFeature, StandardKnowledge, StandardMap, StandardMessage, StandardMoment, StandardRoom, StandardVariable } from '@tonylb/mtw-wml/ts/standardize/baseClasses';

type ComponentMetaMixin = { assetId: string }
export type ComponentMetaItem<T extends StandardComponentData = StandardComponentData> = T & EphemeraKeyMappingMixin & EphemeraStateMappingMixin & ComponentMetaMixin
export type ComponentMetaId =
    EphemeraRoomId |
    EphemeraFeatureId |
    EphemeraKnowledgeId |
    EphemeraBookmarkId |
    EphemeraMapId |
    EphemeraMessageId |
    EphemeraMomentId |
    EphemeraVariableId |
    EphemeraActionId |
    EphemeraComputedId
const isComponentMetaId = (value: EphemeraId): value is ComponentMetaId => (
    isEphemeraRoomId(value) ||
    isEphemeraFeatureId(value) ||
    isEphemeraKnowledgeId(value) ||
    isEphemeraBookmarkId(value) ||
    isEphemeraMapId(value) ||
    isEphemeraMessageId(value) ||
    isEphemeraMomentId(value) ||
    isEphemeraVariableId(value) ||
    isEphemeraActionId(value) ||
    isEphemeraComputedId(value)
)

const generateCacheKey = (EphemeraId, assetId) => (`${assetId}::${EphemeraId}`)
const cacheKeyComponents = (cacheKey: string): { EphemeraId: EphemeraId, assetId: string } => {
    const [assetId, EphemeraId] = cacheKey.split('::')
    if (!(EphemeraId && isEphemeraId(EphemeraId) && isComponentMetaId(EphemeraId))) {
        throw new Error('CacheKey error in ComponentMeta internalCache')
    }
    return {
        EphemeraId,
        assetId
    }
}

export class ComponentMetaData {
    _Cache: DeferredCache<ComponentMetaItem & { EphemeraId: EphemeraId }>;
    _Store: Record<string, ComponentMetaItem & { EphemeraId: EphemeraId }> = {}
    
    constructor() {
        this._Cache = new DeferredCache<ComponentMetaItem & { EphemeraId: EphemeraId }>({
            callback: (key, value) => { this._setStore(key, value) },
            defaultValue: (cacheKey) => {
                const { assetId, EphemeraId } = cacheKeyComponents(cacheKey)
                const tag = tagFromEphemeraWrappedId(EphemeraId)
                return {
                    EphemeraId: EphemeraId as EphemeraId,
                    assetId,
                    stateMapping: {},
                    keyMapping: {},
                    ...defaultComponentFromTag(tag, '')
                }
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

    _setStore(key: string, value: ComponentMetaItem & { EphemeraId: EphemeraId }): void {
        this._Store[key] = value
    }

    _getPromiseFactory(EphemeraId: ComponentMetaId, assetIds: string[], options?: { multiple: boolean }): Promise<(Omit<ComponentMetaItem, 'assetId'>  & { EphemeraId: EphemeraId; DataCategory?: string })[]> {
        const { multiple } = options ?? { multiple: false }
        const baseProjectionFields = multiple ? ['DataCategory', 'key'] : ['key']
        const factoryReturnValue = async <T extends ComponentMetaItem>(...fields: string[]): Promise<(T & { EphemeraId: EphemeraId; DataCategory?: string })[]> => {
            const returnValue = await ephemeraDB.getItems<Omit<T, 'EphemeraId'> & { DataCategory?: string }>({
                Keys: assetIds
                    .map((assetId) => ({
                        EphemeraId,
                        DataCategory: AssetKey(assetId)
                    })),
                ProjectionFields: [...baseProjectionFields, ...fields]
            })
            return returnValue
                .filter((value): value is Omit<T, 'EphemeraId'> & { DataCategory?: string } => (typeof value !== 'undefined'))
                .map((partial) => ({ ...partial, EphemeraId } as unknown as T & { EphemeraId: EphemeraId; DataCategory?: string }))
        }
        if (isEphemeraRoomId(EphemeraId)) {
            return factoryReturnValue<ComponentMetaItem<StandardRoom>>('shortName', 'name', 'summary', 'description', 'exits', 'stateMapping', 'keyMapping')
        }
        if (isEphemeraFeatureId(EphemeraId) || isEphemeraKnowledgeId(EphemeraId)) {
            return factoryReturnValue<ComponentMetaItem<StandardFeature | StandardKnowledge>>('name', 'description', 'stateMapping', 'keyMapping')
        }
        if (isEphemeraBookmarkId(EphemeraId)) {
            return factoryReturnValue<ComponentMetaItem<StandardKnowledge>>('description', 'stateMapping', 'keyMapping')
        }
        if (isEphemeraMapId(EphemeraId)) {
            return factoryReturnValue<ComponentMetaItem<StandardMap>>('name', 'images', 'rooms', 'stateMapping', 'keyMapping')
        }
        if (isEphemeraMessageId(EphemeraId)) {
            return factoryReturnValue<ComponentMetaItem<StandardMessage>>('description', 'rooms', 'stateMapping', 'keyMapping')
        }
        if (isEphemeraMomentId(EphemeraId)) {
            return factoryReturnValue<ComponentMetaItem<StandardMoment>>('messages', 'stateMapping')
        }
        if (isEphemeraVariableId(EphemeraId)) {
            return factoryReturnValue<ComponentMetaItem<StandardVariable>>('default')
        }
        if (isEphemeraActionId(EphemeraId)) {
            return factoryReturnValue<ComponentMetaItem<StandardAction>>('src')
        }
        if (isEphemeraComputedId(EphemeraId)) {
            return factoryReturnValue<ComponentMetaItem<StandardComputed>>('src', 'dependencies')
        }
        return Promise.resolve([])
    }

    async get(EphemeraId: ComponentMetaId, assetId: string): Promise<ComponentMetaItem & { EphemeraId: EphemeraId }> {
        const cacheKey = generateCacheKey(EphemeraId, assetId)
        if (!this._Cache.isCached(cacheKey)) {
            this._Cache.add({
                promiseFactory: () => (this._getPromiseFactory(EphemeraId, [assetId])),
                requiredKeys: [cacheKey],
                transform: (fetch) => {
                    if (fetch.length === 0) {
                        return {}
                    }
                    else {
                        return {
                            [cacheKey]: {
                                ...fetch[0],
                                EphemeraId,
                                assetId,
                            } as ComponentMetaItem & { EphemeraId: EphemeraId }
                        }
                    }
                }
            })
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey]
    }

    async getAcrossAssets(EphemeraId: ComponentMetaId, assetList: string[]): Promise<Record<string, ComponentMetaItem & { EphemeraId: EphemeraId }>> {
        this._Cache.add({
            promiseFactory: (fetchNeeded) => (this._getPromiseFactory(EphemeraId, fetchNeeded.map((cacheKey) => (cacheKeyComponents(cacheKey).assetId)), { multiple: true })),
            requiredKeys: assetList.map((assetId) => (generateCacheKey(EphemeraId, assetId))),
            transform: (fetchList) => {
                return fetchList.reduce<Record<string, ComponentMetaItem & { EphemeraId: EphemeraId }>>((previous, fetch) => {
                    if (typeof fetch !== 'undefined') {
                        const { DataCategory, ...rest } = fetch
                        if (DataCategory) {
                            const assetId = splitType(DataCategory)[1]
                            return {
                                ...previous,
                                [generateCacheKey(EphemeraId, assetId)]: {
                                    ...rest,
                                    EphemeraId,
                                    assetId,
                                } as ComponentMetaItem & { EphemeraId: EphemeraId }
                            }
                        }
                    }
                    return previous
                }, {})
            }
        })
        const individualMetas = await Promise.all(assetList.map((assetId) => (this.get(EphemeraId, assetId))))
        return individualMetas.reduce<Record<string, ComponentMetaItem & { EphemeraId: EphemeraId }>>((previous, item) => ({
            ...previous,
            [item.assetId]: item
        }), {})

    }

    async getAcrossAllAssets(EphemeraId: ComponentMetaId): Promise<Record<string, ComponentMetaItem>> {
        const type = splitType(EphemeraId)[0]
        const DataCategory = `Meta::${type[0]}${type.slice(1).toLocaleLowerCase()}`
        const assetListFetch = await ephemeraDB.getItem<{ cached: string[] }>({
            Key: {
                EphemeraId,
                DataCategory
            },
            ProjectionFields: ['cached']
        })
        return await this.getAcrossAssets(EphemeraId, assetListFetch?.cached || [])
    }

    invalidate(EphemeraId: string, assetId: string) {
        const cacheKey = generateCacheKey(EphemeraId, assetId)
        if (cacheKey in this._Store) {
            delete this._Store[cacheKey]
        }
        if (cacheKey in this._Cache) {
            delete this._Cache[cacheKey]
        }
    }

    set(EphemeraId: string, assetId: string, value: ComponentMetaItem & { EphemeraId: EphemeraId }) {
        const cacheKey = generateCacheKey(EphemeraId, assetId)
        this._Cache.set(Infinity, cacheKey, value)
        this._Store[cacheKey] = value
    }
}

export const ComponentMeta = <GBase extends CacheConstructor>(Base: GBase) => {
    return class ComponentMeta extends Base {
        ComponentMeta: ComponentMetaData;

        constructor(...rest: any) {
            super(...rest)
            this.ComponentMeta = new ComponentMetaData()
        }
        override clear() {
            this.ComponentMeta.clear()
            super.clear()
        }
        override async flush() {
            await Promise.all([
                this.ComponentMeta.flush(),
                super.flush()
            ])
        }
    }
}

export default ComponentMeta
