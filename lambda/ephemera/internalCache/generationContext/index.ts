import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import type { ComponentAssetMetaData } from '../componentAssetMeta'
import { mergeRoomShortNameLiteral } from '../componentStackMerge'

export type GenerationContextRoomShortName = {
    componentId: ComponentUUID;
    shortName: StandardLiteral;
}

const generateCacheKey = (roomId: ComponentUUID, assetStack: AssetUUID[]) => (
    `${roomId}::${assetStack.join(',')}`
)

type GenerationContextStoreRecord = GenerationContextRoomShortName | undefined

export class GenerationContextData {
    _Cache: DeferredCache<GenerationContextStoreRecord>;
    _Store: Record<string, GenerationContextStoreRecord> = {}
    _componentAssetMeta: ComponentAssetMetaData;

    constructor(componentAssetMeta: ComponentAssetMetaData) {
        this._componentAssetMeta = componentAssetMeta
        this._Cache = new DeferredCache<GenerationContextStoreRecord>({
            callback: (key, value) => { this._setStore(key, value) },
            defaultValue: () => undefined,
        })
    }

    async flush() {
        this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
        this._Store = {}
    }

    _setStore(key: string, value: GenerationContextStoreRecord): void {
        this._Store[key] = value
    }

    async _getPromiseFactory(roomId: ComponentUUID, assetStack: AssetUUID[]): Promise<GenerationContextStoreRecord> {
        const roomMetaByAsset = await this._componentAssetMeta.getAcrossAssets(roomId, assetStack)
        const mergedShortName = mergeRoomShortNameLiteral(
            Object.values(roomMetaByAsset).flatMap((component) => (
                component instanceof StandardRoom ? [component] : []
            ))
        )
        if (!mergedShortName) {
            return undefined
        }
        return {
            componentId: roomId,
            shortName: mergedShortName,
        }
    }

    async get(roomId: ComponentUUID, assetStack: AssetUUID[]): Promise<GenerationContextStoreRecord> {
        const cacheKey = generateCacheKey(roomId, assetStack)
        if (!this._Cache.isCached(cacheKey)) {
            this._Cache.add({
                promiseFactory: () => (this._getPromiseFactory(roomId, assetStack)),
                requiredKeys: [cacheKey],
                transform: (fetch) => ({ [cacheKey]: fetch }),
            })
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey]
    }

    invalidate(roomId: ComponentUUID) {
        Object.keys(this._Store)
            .filter((key) => key.startsWith(`${roomId}::`))
            .forEach((key) => {
                if (key in this._Store) {
                    delete this._Store[key]
                }
                if (key in this._Cache) {
                    delete this._Cache[key]
                }
            })
    }
}

export default GenerationContextData
