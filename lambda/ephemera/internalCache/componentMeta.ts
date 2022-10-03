import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { unique } from '@tonylb/mtw-utilities/dist/lists';
import { AssetKey, splitType } from '@tonylb/mtw-utilities/dist/types';
import { CacheConstructor, DependencyEdge, DependencyNode, LegalDependencyTag, isLegalDependencyTag, isDependencyGraphPut, DependencyGraphAction, isDependencyGraphDelete, Deferred } from './baseClasses'
import { DeferredCache } from './deferredCache'
import { EphemeraRoomAppearance, EphemeraFeatureAppearance } from '../cacheAsset/baseClasses'
import { tagFromEphemeraId } from './dependencyGraph';

type ComponentMetaItem = (
    {
        EphemeraId: string;
        assetId: string;
        tag: 'Room';
        appearances: EphemeraRoomAppearance[];
    }
) | (
    {
        EphemeraId: string;
        assetId: string;
        tag: 'Feature';
        appearances: EphemeraFeatureAppearance[];
    }
)

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
        this._Cache = new DeferredCache({
            callback: (key, value) => { this._setStore(key, value) },
            defaultValue: (cacheKey) => {
                const { assetId, EphemeraId } = cacheKeyComponents(cacheKey)
                const tag = tagFromEphemeraId(EphemeraId)
                if (tag !== 'Room' && tag !== 'Feature') {
                    throw new Error('Illegal tag in ComponentMeta internalCache')
                }
                return {
                    EphemeraId,
                    tag,
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

    async get(EphemeraId: string, assetId: string): Promise<ComponentMetaItem> {
        const tag = tagFromEphemeraId(EphemeraId)
        if (tag !== 'Room' && tag !== 'Feature') {
            throw new Error('Illegal tag in ComponentMeta internalCache')
        }
        const cacheKey = generateCacheKey(EphemeraId, assetId)
        if (!this._Cache.isCached(cacheKey)) {
            //
            // TODO: Figure out how to convince Typescript to evaluate each branch independently, *without* having
            // to copy each branch explicitly
            //
            switch(tag) {
                case 'Room':
                    this._Cache.add({
                        promiseFactory: () => (ephemeraDB.getItem<{ appearances: EphemeraRoomAppearance[] }>({
                            EphemeraId,
                            DataCategory: AssetKey(assetId),
                            ProjectionFields: ['appearances']
                        })),
                        requiredKeys: [cacheKey],
                        transform: (fetch) => {
                            if (typeof fetch === 'undefined') {
                                return {}
                            }
                            else {
                                return {
                                    [cacheKey]: {
                                        EphemeraId,
                                        tag,
                                        assetId,
                                        appearances: fetch.appearances
                                    }
                                }
                            }
                        }
                    })        
                    break
                case 'Feature':
                    this._Cache.add({
                        promiseFactory: () => (ephemeraDB.getItem<{ appearances: EphemeraFeatureAppearance[] }>({
                            EphemeraId,
                            DataCategory: AssetKey(assetId),
                            ProjectionFields: ['appearances']
                        })),
                        requiredKeys: [cacheKey],
                        transform: (fetch) => {
                            if (typeof fetch === 'undefined') {
                                return {}
                            }
                            else {
                                return {
                                    [cacheKey]: {
                                        EphemeraId,
                                        tag,
                                        assetId,
                                        appearances: fetch.appearances
                                    }
                                }
                            }
                        }
                    })        
                    break
            }
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey]
    }

    async getAcrossAssets(EphemeraId: string, assetList: string[]): Promise<Record<string, ComponentMetaItem>> {
        const tag = tagFromEphemeraId(EphemeraId)
        if (tag !== 'Room' && tag !== 'Feature') {
            throw new Error('Illegal tag in ComponentMeta internalCache')
        }
        switch(tag) {
            case 'Room':
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
                        return fetchList.reduce<Record<string, ComponentMetaItem>>((previous, fetch) => {
                            const assetId = splitType(fetch.DataCategory)[1]
                            return {
                                ...previous,
                                [generateCacheKey(EphemeraId, assetId)]: {
                                    EphemeraId,
                                    tag,
                                    assetId,
                                    appearances: fetch.appearances
                                }
                            }
                        }, {})
                    }
                })
                break
            case 'Feature':
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
                                    tag,
                                    assetId,
                                    appearances: fetch.appearances
                                }
                            }
                        }, {})
                    }
                })
                break
        }
        const individualMetas = await Promise.all(assetList.map((assetId) => (this.get(EphemeraId, assetId))))
        return individualMetas.reduce<Record<string, ComponentMetaItem>>((previous, item) => ({
            ...previous,
            [item.assetId]: item
        }), {})
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
