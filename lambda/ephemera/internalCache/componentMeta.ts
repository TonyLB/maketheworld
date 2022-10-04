import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { AssetKey, splitType } from '@tonylb/mtw-utilities/dist/types';
import { CacheConstructor } from './baseClasses'
import { DeferredCache } from './deferredCache'
import { EphemeraRoomAppearance, EphemeraFeatureAppearance, EphemeraRoomId, EphemeraFeatureId, isEphemeraFeatureId, isEphemeraRoomId } from '../cacheAsset/baseClasses'

type ComponentMetaRoomItem = {
    EphemeraId: EphemeraRoomId;
    assetId: string;
    appearances: EphemeraRoomAppearance[];
}
type ComponentMetaFeatureItem = {
    EphemeraId: EphemeraFeatureId;
    assetId: string;
    appearances: EphemeraFeatureAppearance[];
}
type ComponentMetaItem = ComponentMetaRoomItem | ComponentMetaFeatureItem

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
                if (!(isEphemeraFeatureId(EphemeraId) || isEphemeraRoomId(EphemeraId))) {
                    throw new Error('Illegal tag in ComponentMeta internalCache')
                }
                return {
                    EphemeraId,
                    assetId,
                    appearances: []
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

    _setStore(key: string, value: ComponentMetaItem): void {
        this._Store[key] = value
    }

    async _getPromiseFactory<T extends EphemeraRoomAppearance | EphemeraFeatureAppearance>(EphemeraId: EphemeraRoomId | EphemeraFeatureId, assetId: string): Promise<{ appearances: T[] } | undefined> {
        return ephemeraDB.getItem<{ appearances: T[] }>({
            EphemeraId,
            DataCategory: AssetKey(assetId),
            ProjectionFields: ['appearances']
        })
    }

    async get(EphemeraId: EphemeraRoomId, assetId: string): Promise<ComponentMetaRoomItem>
    async get(EphemeraId: EphemeraFeatureId, assetId: string): Promise<ComponentMetaFeatureItem>
    async get(EphemeraId: EphemeraFeatureId | EphemeraRoomId, assetId: string): Promise<ComponentMetaItem>
    async get(EphemeraId: EphemeraFeatureId | EphemeraRoomId, assetId: string): Promise<ComponentMetaItem> {
        const cacheKey = generateCacheKey(EphemeraId, assetId)
        if (!this._Cache.isCached(cacheKey)) {
            //
            // TODO: Figure out how to convince Typescript to evaluate each branch independently, *without* having
            // to copy each branch explicitly
            //
            if (isEphemeraRoomId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (this._getPromiseFactory<EphemeraRoomAppearance>(EphemeraId, assetId)),
                    requiredKeys: [cacheKey],
                    transform: (fetch) => {
                        if (typeof fetch === 'undefined') {
                            return {}
                        }
                        else {
                            return {
                                [cacheKey]: {
                                    EphemeraId,
                                    assetId,
                                    appearances: fetch.appearances
                                }
                            }
                        }
                    }
                })
            }
            if (isEphemeraFeatureId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (this._getPromiseFactory<EphemeraFeatureAppearance>(EphemeraId, assetId)),
                    requiredKeys: [cacheKey],
                    transform: (fetch) => {
                        if (typeof fetch === 'undefined') {
                            return {}
                        }
                        else {
                            return {
                                [cacheKey]: {
                                    EphemeraId,
                                    assetId,
                                    appearances: fetch.appearances
                                }
                            }
                        }
                    }
                })
            }
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey]
    }

    async getAcrossAssets(EphemeraId: EphemeraRoomId, assetList: string[]): Promise<Record<string, ComponentMetaRoomItem>>
    async getAcrossAssets(EphemeraId: EphemeraFeatureId, assetList: string[]): Promise<Record<string, ComponentMetaFeatureItem>>
    async getAcrossAssets(EphemeraId: EphemeraFeatureId | EphemeraRoomId, assetList: string[]): Promise<Record<string, ComponentMetaFeatureItem> | Record<string, ComponentMetaRoomItem>>
    async getAcrossAssets(EphemeraId: EphemeraFeatureId | EphemeraRoomId, assetList: string[]): Promise<Record<string, ComponentMetaFeatureItem> | Record<string, ComponentMetaRoomItem>> {
        if (isEphemeraRoomId(EphemeraId)) {
            this._Cache.add({
                promiseFactory: (cacheKeys: string[]) => {
                    return ephemeraDB.batchGetItem<{ DataCategory: string; appearances: EphemeraRoomAppearance[] }>({
                        Items: cacheKeys
                            .map(cacheKeyComponents)
                            .map(({ assetId }) => ({
                                EphemeraId,
                                DataCategory: AssetKey(assetId)
                            })),
                        ProjectionFields: ['DataCategory', 'appearances']
                    })
                },
                requiredKeys: assetList.map((assetId) => (generateCacheKey(EphemeraId, assetId))),
                transform: (fetchList) => {
                    return fetchList.reduce<Record<string, ComponentMetaRoomItem>>((previous, fetch) => {
                        const assetId = splitType(fetch.DataCategory)[1]
                        return {
                            ...previous,
                            [generateCacheKey(EphemeraId, assetId)]: {
                                EphemeraId,
                                assetId,
                                appearances: fetch.appearances
                            }
                        }
                    }, {})
                }
            })
            const individualMetas = await Promise.all(assetList.map((assetId) => (this.get(EphemeraId, assetId))))
            return individualMetas.reduce<Record<string, ComponentMetaRoomItem>>((previous, item) => ({
                ...previous,
                [item.assetId]: item
            }), {})
        }
        if (isEphemeraFeatureId(EphemeraId)) {
            this._Cache.add({
                promiseFactory: (cacheKeys: string[]) => (ephemeraDB.batchGetItem<{ DataCategory: string; appearances: EphemeraFeatureAppearance[] }>({
                    Items: cacheKeys
                        .map(cacheKeyComponents)
                        .map(({ assetId }) => ({
                            EphemeraId,
                            DataCategory: AssetKey(assetId)
                        })),
                    ProjectionFields: ['DataCategory', 'appearances']
                })),
                requiredKeys: assetList.map((assetId) => (generateCacheKey(EphemeraId, assetId))),
                transform: (fetchList) => {
                    return fetchList.reduce<Record<string, ComponentMetaItem>>((previous, fetch) => {
                        const assetId = splitType(fetch.DataCategory)[1]
                        return {
                            ...previous,
                            [generateCacheKey(EphemeraId, assetId)]: {
                                EphemeraId,
                                assetId,
                                appearances: fetch.appearances
                            }
                        }
                    }, {})
                }
            })
            const individualMetas = await Promise.all(assetList.map((assetId) => (this.get(EphemeraId, assetId))))
            return individualMetas.reduce<Record<string, ComponentMetaFeatureItem>>((previous, item) => ({
                ...previous,
                [item.assetId]: item
            }), {})
        }
        throw new Error()
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
        this._Cache.set(cacheKey, value)
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

export default ComponentMetaItem
