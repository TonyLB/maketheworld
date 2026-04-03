import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { AssetKey, splitType } from '@tonylb/mtw-utilities/ts/types';
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

// Recreated types from deleted cacheAsset/baseClasses
type EphemeraKeyMappingMixin = { EphemeraId: string }
import { componentTagFromUpperCase } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/abstract'

const tagFromEphemeraWrappedId = (ephemeraId: string) => {
    // Extract tag from ephemera ID (e.g., 'ROOM#test' -> 'Room')
    const parts = ephemeraId.split('#')
    if (parts.length !== 2) {
        throw new Error(`Invalid ephemera ID format: ${ephemeraId}`)
    }
    return componentTagFromUpperCase(parts[0] as any)
}
import {
    isEphemeraId,
} from '@tonylb/mtw-interfaces/ts/baseClasses';
import { defaultComponentFromTag, StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses';
import { AssetUUID, ComponentUUID, isSchemaAssetUUID, isSchemaComponentUUID } from '@tonylb/mtw-base/ts/schema';
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses';
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory';
import { isStandardComponentData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes';
import { tagFromEphemeraId } from '@tonylb/mtw-utilities/ts/graphStorage/cache';

type ComponentAssetMetaMixin = { assetId: string }
export type ComponentAssetMetaItem<T extends StandardComponentData = StandardComponentData> = T & EphemeraKeyMappingMixin & ComponentAssetMetaMixin

const generateCacheKey = (EphemeraId: ComponentUUID, assetId: AssetUUID) => (`${assetId}::${EphemeraId}`)
const cacheKeyComponents = (cacheKey: string): { EphemeraId: ComponentUUID, assetId: AssetUUID } => {
    const [assetId, EphemeraId] = cacheKey.split('::')
    if (!(EphemeraId && isEphemeraId(EphemeraId) && isSchemaComponentUUID(EphemeraId))) {
        throw new Error(`CacheKey error in ComponentAssetMeta internalCache (${cacheKey})`)
    }
    if (!assetId || typeof assetId !== 'string' || !isSchemaAssetUUID(assetId)) {
        throw new Error(`CacheKey error in ComponentAssetMeta internalCache (${cacheKey})`)
    }
    return {
        EphemeraId,
        assetId
    }
}

export class ComponentAssetMetaData {
    _Cache: DeferredCache<{ assetId: AssetUUID; component: StandardComponent }>;
    _Store: Record<string, { assetId: AssetUUID; component: StandardComponent }> = {}
    
    constructor() {
        this._Cache = new DeferredCache<{ assetId: AssetUUID; component: StandardComponent }>({
            callback: (key, value) => { this._setStore(key, value) },
            defaultValue: (cacheKey) => {
                if (typeof cacheKey !== 'string' || !cacheKey.includes('::')) {
                    throw new Error('Invalid cache key format in ComponentAssetMeta internalCache')
                }
                const { assetId, EphemeraId } = cacheKeyComponents(cacheKey as `${AssetUUID}::${ComponentUUID}`)
                if (!isSchemaComponentUUID(EphemeraId)) {
                    throw new Error('Invalid EphemeraId in ComponentAssetMeta internalCache')
                }
                if (!isSchemaAssetUUID(assetId)) {
                    throw new Error('Invalid assetId in ComponentAssetMeta internalCache')
                }
                const tag = tagFromEphemeraWrappedId(EphemeraId)
                const defaultData = defaultComponentFromTag(tag, undefined, EphemeraId)
                const { component: defaultComponent } = standardComponentFactory(defaultData)
                if (!defaultComponent) {
                    throw new Error(`No default component found for tag ${tag} and EphemeraId ${EphemeraId}`)
                }
                return {
                    assetId,
                    component: defaultComponent
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

    _setStore(key: string, value: { assetId: AssetUUID; component: StandardComponent }): void {
        this._Store[key] = value
    }

    _getPromiseFactory(EphemeraId: ComponentUUID, assetIds: AssetUUID[]): Promise<{ assetId: AssetUUID; component: StandardComponent }[]> {
        const factory = async () => {
            const queryKeys = assetIds.map((assetId) => ({
                AssetId: EphemeraId,
                DataCategory: assetId
            }));
            
            // Use the new getAllFields option to get all attributes from DynamoDB
            const returnValues = await assetDB.getItems<Omit<StandardComponentData, 'universalKey' | 'tag'> & { DataCategory?: AssetUUID, AssetId: ComponentUUID }>({
                Keys: queryKeys,
                getAllFields: true
            });
            
            const filteredResults = returnValues
                .filter((value) => {
                    // Filter out records with invalid or missing DataCategory
                    const assetId = value.DataCategory ?? ''
                    const isValid = isSchemaAssetUUID(assetId)
                    return isValid
                });
            
            return filteredResults
                .map((value) => {
                    const { DataCategory, AssetId, ...rest } = value
                    const assetId = DataCategory as AssetUUID // Safe after filter
                    const componentData = { universalKey: EphemeraId, tag: tagFromEphemeraId(EphemeraId), ...rest }
                    if (!isStandardComponentData(componentData)) {
                        throw new Error(`Invalid component data for EphemeraId: ${EphemeraId} and DataCategory: ${DataCategory}`)
                    }
                    const { component } = standardComponentFactory(componentData)
                    if (!component) {
                        throw new Error(`Failed to create component for EphemeraId: ${EphemeraId} and DataCategory: ${DataCategory}`)
                    }
                    return { assetId, component }
                })
        }
        return factory()
    }

    async get(EphemeraId: ComponentUUID, assetId: AssetUUID): Promise<{ assetId: AssetUUID; component: StandardComponent }> {
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
                                assetId,
                            } as { assetId: AssetUUID; component: StandardComponent }
                        }
                    }
                }
            })
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey]
    }

    async getAcrossAssets(EphemeraId: ComponentUUID, assetList: AssetUUID[]): Promise<Record<AssetUUID, StandardComponent>> {
        this._Cache.add({
            promiseFactory: (fetchNeeded) => (this._getPromiseFactory(EphemeraId, fetchNeeded.map((cacheKey) => (cacheKeyComponents(cacheKey).assetId)))),
            requiredKeys: assetList.map((assetId) => (generateCacheKey(EphemeraId, assetId))),
            transform: (fetchList) => {
                return fetchList.reduce<Record<string, { assetId: AssetUUID; component: StandardComponent }>>((previous, fetch) => {
                    if (typeof fetch !== 'undefined' && fetch.component.universalKey) {
                        return {
                            ...previous,
                            [generateCacheKey(fetch.component.universalKey, fetch.assetId)]: fetch
                        }
                    }
                    return previous
                }, {})
            }
        })
        const individualMetas = await Promise.all(assetList.map((assetId) => (this.get(EphemeraId, assetId))))
        return individualMetas.reduce<Record<AssetUUID, StandardComponent>>((previous, item) => ({
            ...previous,
            [item.assetId]: item.component
        }), {})

    }

    async getAcrossAllAssets(EphemeraId: ComponentUUID): Promise<Record<AssetUUID, StandardComponent>> {
        const type = splitType(EphemeraId)[0]
        const DataCategory = `Meta::${type[0]}${type.slice(1).toLocaleLowerCase()}`
        const assetListFetch = await assetDB.getItem<{ cached: string[] }>({
            Key: {
                AssetId: EphemeraId,
                DataCategory
            },
            ProjectionFields: ['cached']
        })
        return await this.getAcrossAssets(EphemeraId, (assetListFetch?.cached || []).map((assetKey) => (AssetKey(assetKey))))
    }

    invalidate(EphemeraId: ComponentUUID, assetId: AssetUUID) {
        const cacheKey = generateCacheKey(EphemeraId, assetId)
        if (cacheKey in this._Store) {
            delete this._Store[cacheKey]
        }
        if (cacheKey in this._Cache) {
            delete this._Cache[cacheKey]
        }
    }

    set(EphemeraId: ComponentUUID, assetId: AssetUUID, value: StandardComponent) {
        const cacheKey = generateCacheKey(EphemeraId, assetId)
        this._Cache.set(Infinity, cacheKey, { assetId, component: value })
        this._Store[cacheKey] = { assetId, component: value }
    }
}

export default ComponentAssetMetaData
