import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { AssetKey, splitType } from '@tonylb/mtw-utilities/dist/types';
import { CacheConstructor } from './baseClasses'
import { DeferredCache } from './deferredCache'

import { EphemeraRoom, EphemeraFeature, EphemeraKnowledge, EphemeraBookmark, EphemeraMap, EphemeraMessage, EphemeraMoment, EphemeraVariable, EphemeraComputed, EphemeraItem, EphemeraAction } from '../cacheAsset/baseClasses'
import {
    EphemeraActionId,
    EphemeraBookmarkId,
    EphemeraComputedId,
    EphemeraFeatureId,
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
    isEphemeraKnowledgeId,
    isEphemeraMapId,
    isEphemeraMessageId,
    isEphemeraMomentId,
    isEphemeraRoomId,
    isEphemeraVariableId
} from '@tonylb/mtw-interfaces/ts/baseClasses';

type ComponentMetaMixin = { assetId: string }
export type ComponentMetaItem = (
    EphemeraRoom |
    EphemeraFeature |
    EphemeraKnowledge |
    EphemeraBookmark |
    EphemeraMap |
    EphemeraMessage |
    EphemeraMoment |
    EphemeraVariable |
    EphemeraAction |
    EphemeraComputed
) & ComponentMetaMixin
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

export type ComponentMetaFromId<T extends ComponentMetaId> =
    Extract<EphemeraItem, { EphemeraId: T }> & ComponentMetaMixin

const generateCacheKey = (EphemeraId, assetId) => (`${assetId}::${EphemeraId}`)
const cacheKeyComponents = (cacheKey: string): { EphemeraId: string, assetId: string } => {
    const [assetId, EphemeraId] = cacheKey.split('::')
    if (!EphemeraId) {
        throw new Error('CacheKey error in ComponentMeta internalCache')
    }
    return {
        EphemeraId,
        assetId
    }
}

export class ComponentMetaData {
    _Cache: DeferredCache<ComponentMetaItem>;
    _Store: Record<string, ComponentMetaItem> = {}
    
    constructor() {
        this._Cache = new DeferredCache<ComponentMetaItem>({
            callback: (key, value) => { this._setStore(key, value) },
            defaultValue: (cacheKey) => {
                const { assetId, EphemeraId } = cacheKeyComponents(cacheKey)
                if (isEphemeraRoomId(EphemeraId)) {
                    return {
                        EphemeraId,
                        assetId,
                        key: '',
                        name: [],
                        render: [],
                        exits: [],
                        stateMapping: {},
                        keyMapping: {}
                    }
                }
                if (isEphemeraFeatureId(EphemeraId) || isEphemeraKnowledgeId(EphemeraId)) {
                    return {
                        EphemeraId,
                        assetId,
                        key: '',
                        name: [],
                        render: [],
                        stateMapping: {},
                        keyMapping: {}
                    }
                }
                if (isEphemeraBookmarkId(EphemeraId)) {
                    return {
                        EphemeraId,
                        assetId,
                        key: '',
                        render: [],
                        stateMapping: {},
                        keyMapping: {}
                    }
                }
                if (isEphemeraMapId(EphemeraId)) {
                    return {
                        EphemeraId,
                        assetId,
                        key: '',
                        name: [],
                        images: [],
                        rooms: [],
                        stateMapping: {},
                        keyMapping: {}
                    }
                }
                if (isEphemeraMessageId(EphemeraId)) {
                    return {
                        EphemeraId,
                        assetId,
                        key: '',
                        render: [],
                        rooms: [],
                        stateMapping: {},
                        keyMapping: {}
                    }
                }
                if (isEphemeraMomentId(EphemeraId)) {
                    return {
                        EphemeraId,
                        assetId,
                        key: '',
                        messages: [],
                        stateMapping: {}
                    }
                }
                if (isEphemeraVariableId(EphemeraId)) {
                    return {
                        EphemeraId,
                        assetId,
                        key: '',
                        default: ''
                    }
                }
                if (isEphemeraActionId(EphemeraId)) {
                    return {
                        EphemeraId,
                        assetId,
                        key: '',
                        src: ''
                    }
                }
                if (isEphemeraComputedId(EphemeraId)) {
                    return {
                        EphemeraId,
                        assetId,
                        key: '',
                        src: '',
                        dependencies: [],
                        stateMapping: {}
                    }
                }
                throw new Error(`Illegal tag in ComponentMeta internalCache (${EphemeraId})`)
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

    _setStore(key: string, value: ComponentMetaItem): void {
        this._Store[key] = value
    }

    _getPromiseFactory(EphemeraId: ComponentMetaId, assetIds: string[], options?: { multiple: boolean }): Promise<(Omit<ComponentMetaFromId<typeof EphemeraId>, 'assetId'> & { DataCategory?: string })[]> {
        const { multiple } = options ?? { multiple: false }
        const baseProjectionFields = multiple ? ['DataCategory', 'key'] : ['key']
        const factoryReturnValue = async <T extends EphemeraItem>(...fields: string[]): Promise<(T & { DataCategory?: string })[]> => {
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
                .map((partial) => ({ ...partial, EphemeraId } as T & { DataCategory?: string }))
        }
        if (isEphemeraRoomId(EphemeraId)) {
            return factoryReturnValue<EphemeraRoom>('name', 'render', 'exits', 'stateMapping', 'keyMapping')
        }
        if (isEphemeraFeatureId(EphemeraId) || isEphemeraKnowledgeId(EphemeraId)) {
            return factoryReturnValue<EphemeraFeature | EphemeraKnowledge>('name', 'render', 'stateMapping', 'keyMapping')
        }
        if (isEphemeraBookmarkId(EphemeraId)) {
            return factoryReturnValue<EphemeraBookmark>('render', 'stateMapping', 'keyMapping')
        }
        if (isEphemeraMapId(EphemeraId)) {
            return factoryReturnValue<EphemeraMap>('name', 'images', 'rooms', 'stateMapping', 'keyMapping')
        }
        if (isEphemeraMessageId(EphemeraId)) {
            return factoryReturnValue<EphemeraMessage>('render', 'rooms', 'stateMapping', 'keyMapping')
        }
        if (isEphemeraMomentId(EphemeraId)) {
            return factoryReturnValue<EphemeraMoment>('messages', 'stateMapping')
        }
        if (isEphemeraVariableId(EphemeraId)) {
            return factoryReturnValue<EphemeraVariable>('default')
        }
        if (isEphemeraActionId(EphemeraId)) {
            return factoryReturnValue<EphemeraAction>('src')
        }
        if (isEphemeraComputedId(EphemeraId)) {
            return factoryReturnValue<EphemeraComputed>('src', 'dependencies')
        }
        return Promise.resolve([])
    }

    async get(EphemeraId: ComponentMetaId, assetId: string): Promise<ComponentMetaFromId<typeof EphemeraId>> {
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
                            } as ComponentMetaItem
                        }
                    }
                }
            })
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey] as ComponentMetaFromId<typeof EphemeraId>
    }

    async getAcrossAssets(EphemeraId: ComponentMetaId, assetList: string[]): Promise<Record<string, ComponentMetaFromId<typeof EphemeraId>>> {
        this._Cache.add({
            promiseFactory: (fetchNeeded) => (this._getPromiseFactory(EphemeraId, fetchNeeded.map((cacheKey) => (cacheKeyComponents(cacheKey).assetId)), { multiple: true })),
            requiredKeys: assetList.map((assetId) => (generateCacheKey(EphemeraId, assetId))),
            transform: (fetchList) => {
                return fetchList.reduce<Record<string, ComponentMetaItem>>((previous, fetch) => {
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
                                } as ComponentMetaItem
                            }
                        }
                    }
                    return previous
                }, {})
            }
        })
        const individualMetas = await Promise.all(assetList.map((assetId) => (this.get(EphemeraId, assetId))))
        return individualMetas.reduce<Record<string, ComponentMetaFromId<typeof EphemeraId>>>((previous, item) => ({
            ...previous,
            [item.assetId]: item
        }), {})

    }

    async getAcrossAllAssets(EphemeraId: ComponentMetaId): Promise<Record<string, ComponentMetaFromId<typeof EphemeraId>>> {
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

    set(EphemeraId: string, assetId: string, value: ComponentMetaItem) {
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
