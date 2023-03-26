import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { AssetKey, splitType } from '@tonylb/mtw-utilities/dist/types';
import { CacheConstructor } from './baseClasses'
import { DeferredCache } from './deferredCache'
import { EphemeraRoomAppearance, EphemeraFeatureAppearance, EphemeraMapAppearance, EphemeraBookmarkAppearance, EphemeraMessageAppearance, EphemeraMomentAppearance } from '../cacheAsset/baseClasses'
import {
    EphemeraBookmarkId,
    EphemeraFeatureId,
    EphemeraMapId,
    EphemeraMessageId,
    EphemeraMomentId,
    EphemeraRoomId,
    isEphemeraBookmarkId,
    isEphemeraFeatureId,
    isEphemeraMapId,
    isEphemeraMessageId,
    isEphemeraMomentId,
    isEphemeraRoomId
} from '@tonylb/mtw-interfaces/dist/baseClasses';

export type ComponentMetaRoomItem = {
    EphemeraId: EphemeraRoomId;
    key: string;
    assetId: string;
    appearances: EphemeraRoomAppearance[];
}
export type ComponentMetaFeatureItem = {
    EphemeraId: EphemeraFeatureId;
    key: string;
    assetId: string;
    appearances: EphemeraFeatureAppearance[];
}
export type ComponentMetaBookmarkItem = {
    EphemeraId: EphemeraBookmarkId;
    key: string;
    assetId: string;
    appearances: EphemeraBookmarkAppearance[];
}
export type ComponentMetaMapItem = {
    EphemeraId: EphemeraMapId;
    key: string;
    assetId: string;
    appearances: EphemeraMapAppearance[];
}
export type ComponentMetaMessageItem = {
    EphemeraId: EphemeraMessageId;
    key: string;
    assetId: string;
    appearances: EphemeraMessageAppearance[];
}
export type ComponentMetaMomentItem = {
    EphemeraId: EphemeraMomentId;
    key: string;
    assetId: string;
    appearances: EphemeraMomentAppearance[];
}
export type ComponentMetaItem = ComponentMetaRoomItem | ComponentMetaFeatureItem | ComponentMetaBookmarkItem | ComponentMetaMapItem | ComponentMetaMessageItem | ComponentMetaMomentItem

export type ComponentMetaFromId<T extends EphemeraRoomId | EphemeraFeatureId | EphemeraBookmarkId | EphemeraMapId | EphemeraMessageId | EphemeraMomentId> =
    T extends EphemeraRoomId
        ? ComponentMetaRoomItem
        : T extends EphemeraFeatureId
            ? ComponentMetaFeatureItem
            : T extends EphemeraBookmarkId
                ? ComponentMetaBookmarkItem
                : T extends EphemeraMapId
                    ? ComponentMetaMapItem
                    : T extends EphemeraMessageId
                        ? ComponentMetaMessageItem
                        : T extends EphemeraMomentId
                            ? ComponentMetaMomentItem
                            : never

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
                if (!(isEphemeraFeatureId(EphemeraId) || isEphemeraRoomId(EphemeraId) || isEphemeraMapId(EphemeraId) || isEphemeraMessageId(EphemeraId) || isEphemeraBookmarkId(EphemeraId) || isEphemeraMomentId(EphemeraId))) {
                    throw new Error(`Illegal tag in ComponentMeta internalCache (${EphemeraId})`)
                }
                return {
                    EphemeraId,
                    assetId,
                    key: '',
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

    async _getPromiseFactory<T extends EphemeraRoomAppearance | EphemeraFeatureAppearance | EphemeraBookmarkAppearance | EphemeraMapAppearance | EphemeraMomentAppearance>(EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraBookmarkId | EphemeraMapId | EphemeraMessageId | EphemeraMomentId, assetId: string): Promise<{ key: string; appearances: T[] } | undefined> {
        return ephemeraDB.getItem<{ key: string; appearances: T[] }>({
            EphemeraId,
            DataCategory: AssetKey(assetId),
            ProjectionFields: ['appearances', '#key'],
            ExpressionAttributeNames: {
                '#key': 'key'
            }
        })
    }

    async get<T extends EphemeraFeatureId | EphemeraBookmarkId | EphemeraRoomId | EphemeraMapId | EphemeraMessageId | EphemeraMomentId>(EphemeraId: T, assetId: string): Promise<ComponentMetaFromId<T>> {
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
                                    key: fetch.key,
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
                                    key: fetch.key,
                                    appearances: fetch.appearances
                                }
                            }
                        }
                    }
                })
            }
            if (isEphemeraBookmarkId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (this._getPromiseFactory<EphemeraBookmarkAppearance>(EphemeraId, assetId)),
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
                                    key: fetch.key,
                                    appearances: fetch.appearances
                                }
                            }
                        }
                    }
                })
            }
            if (isEphemeraMessageId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (this._getPromiseFactory<EphemeraMessageAppearance>(EphemeraId, assetId)),
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
                                    key: fetch.key,
                                    appearances: fetch.appearances
                                }
                            }
                        }
                    }
                })
            }
            if (isEphemeraMomentId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (this._getPromiseFactory<EphemeraMomentAppearance>(EphemeraId, assetId)),
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
                                    key: fetch.key,
                                    appearances: fetch.appearances
                                }
                            }
                        }
                    }
                })
            }
            if (isEphemeraMapId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (this._getPromiseFactory<EphemeraMapAppearance>(EphemeraId, assetId)),
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
                                    key: fetch.key,
                                    appearances: fetch.appearances
                                }
                            }
                        }
                    }
                })
            }
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey] as ComponentMetaFromId<T>
    }

    async getAcrossAssets<T extends EphemeraFeatureId | EphemeraBookmarkId | EphemeraRoomId | EphemeraMapId | EphemeraMessageId | EphemeraMomentId>(EphemeraId: T, assetList: string[]): Promise<Record<string, ComponentMetaFromId<T>>> {
        if (isEphemeraRoomId(EphemeraId)) {
            this._Cache.add({
                promiseFactory: (cacheKeys: string[]) => {
                    return ephemeraDB.batchGetItem<{ key: string; DataCategory: string; appearances: EphemeraRoomAppearance[] }>({
                        Items: cacheKeys
                            .map(cacheKeyComponents)
                            .map(({ assetId }) => ({
                                EphemeraId,
                                DataCategory: AssetKey(assetId)
                            })),
                        ProjectionFields: ['DataCategory', 'appearances', '#key'],
                        ExpressionAttributeNames: {
                            '#key': 'key'
                        }
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
                                key: fetch.key,
                                appearances: fetch.appearances
                            }
                        }
                    }, {})
                }
            })
            const individualMetas = await Promise.all(assetList.map((assetId) => (this.get(EphemeraId, assetId))))
            return individualMetas.reduce<Record<string, ComponentMetaFromId<T>>>((previous, item) => ({
                ...previous,
                [item.assetId]: item
            }), {})
        }
        if (isEphemeraFeatureId(EphemeraId)) {
            this._Cache.add({
                promiseFactory: (cacheKeys: string[]) => (ephemeraDB.batchGetItem<{ key: string; DataCategory: string; appearances: EphemeraFeatureAppearance[] }>({
                    Items: cacheKeys
                        .map(cacheKeyComponents)
                        .map(({ assetId }) => ({
                            EphemeraId,
                            DataCategory: AssetKey(assetId)
                        })),
                    ProjectionFields: ['DataCategory', 'appearances', '#key'],
                    ExpressionAttributeNames: {
                        '#key': 'key'
                    }
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
                                key: fetch.key,
                                appearances: fetch.appearances
                            }
                        }
                    }, {})
                }
            })
            const individualMetas = await Promise.all(assetList.map((assetId) => (this.get(EphemeraId, assetId))))
            return individualMetas.reduce<Record<string, ComponentMetaFromId<T>>>((previous, item) => ({
                ...previous,
                [item.assetId]: item
            }), {})
        }
        if (isEphemeraBookmarkId(EphemeraId)) {
            this._Cache.add({
                promiseFactory: (cacheKeys: string[]) => (ephemeraDB.batchGetItem<{ key: string; DataCategory: string; appearances: EphemeraBookmarkAppearance[] }>({
                    Items: cacheKeys
                        .map(cacheKeyComponents)
                        .map(({ assetId }) => ({
                            EphemeraId,
                            DataCategory: AssetKey(assetId)
                        })),
                    ProjectionFields: ['DataCategory', 'appearances', '#key'],
                    ExpressionAttributeNames: {
                        '#key': 'key'
                    }
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
                                key: fetch.key,
                                appearances: fetch.appearances
                            }
                        }
                    }, {})
                }
            })
            const individualMetas = await Promise.all(assetList.map((assetId) => (this.get(EphemeraId, assetId))))
            return individualMetas.reduce<Record<string, ComponentMetaFromId<T>>>((previous, item) => ({
                ...previous,
                [item.assetId]: item
            }), {})
        }
        if (isEphemeraMessageId(EphemeraId)) {
            this._Cache.add({
                promiseFactory: (cacheKeys: string[]) => (ephemeraDB.batchGetItem<{ key: string; DataCategory: string; appearances: EphemeraMessageAppearance[] }>({
                    Items: cacheKeys
                        .map(cacheKeyComponents)
                        .map(({ assetId }) => ({
                            EphemeraId,
                            DataCategory: AssetKey(assetId)
                        })),
                    ProjectionFields: ['DataCategory', 'appearances', '#key'],
                    ExpressionAttributeNames: {
                        '#key': 'key'
                    }
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
                                key: fetch.key,
                                appearances: fetch.appearances
                            }
                        }
                    }, {})
                }
            })
            const individualMetas = await Promise.all(assetList.map((assetId) => (this.get(EphemeraId, assetId))))
            return individualMetas.reduce<Record<string, ComponentMetaFromId<T>>>((previous, item) => ({
                ...previous,
                [item.assetId]: item
            }), {})
        }
        if (isEphemeraMomentId(EphemeraId)) {
            this._Cache.add({
                promiseFactory: (cacheKeys: string[]) => (ephemeraDB.batchGetItem<{ key: string; DataCategory: string; appearances: EphemeraMomentAppearance[] }>({
                    Items: cacheKeys
                        .map(cacheKeyComponents)
                        .map(({ assetId }) => ({
                            EphemeraId,
                            DataCategory: AssetKey(assetId)
                        })),
                    ProjectionFields: ['DataCategory', 'appearances', '#key'],
                    ExpressionAttributeNames: {
                        '#key': 'key'
                    }
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
                                key: fetch.key,
                                appearances: fetch.appearances
                            }
                        }
                    }, {})
                }
            })
            const individualMetas = await Promise.all(assetList.map((assetId) => (this.get(EphemeraId, assetId))))
            return individualMetas.reduce<Record<string, ComponentMetaFromId<T>>>((previous, item) => ({
                ...previous,
                [item.assetId]: item
            }), {})
        }
        if (isEphemeraMapId(EphemeraId)) {
            this._Cache.add({
                promiseFactory: (cacheKeys: string[]) => (ephemeraDB.batchGetItem<{ key: string; DataCategory: string; appearances: EphemeraMapAppearance[] }>({
                    Items: cacheKeys
                        .map(cacheKeyComponents)
                        .map(({ assetId }) => ({
                            EphemeraId,
                            DataCategory: AssetKey(assetId)
                        })),
                    ProjectionFields: ['DataCategory', 'appearances', '#key'],
                    ExpressionAttributeNames: {
                        '#key': 'key'
                    }
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
                                key: fetch.key,
                                appearances: fetch.appearances
                            }
                        }
                    }, {})
                }
            })
            const individualMetas = await Promise.all(assetList.map((assetId) => (this.get(EphemeraId, assetId))))
            return individualMetas.reduce<Record<string, ComponentMetaFromId<T>>>((previous, item) => ({
                ...previous,
                [item.assetId]: item
            }), {})
        }
        throw new Error()
    }

    async getAcrossAllAssets<T extends EphemeraFeatureId | EphemeraBookmarkId | EphemeraRoomId | EphemeraMapId | EphemeraMessageId | EphemeraMomentId>(EphemeraId: T): Promise<Record<string, ComponentMetaFromId<T>>> {
        const type = splitType(EphemeraId)[0]
        const DataCategory = `Meta::${type[0]}${type.slice(1).toLocaleLowerCase()}`
        const assetListFetch = await ephemeraDB.getItem<{ cached: string[] }>({
            EphemeraId,
            DataCategory,
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
