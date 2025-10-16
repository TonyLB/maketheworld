import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'

/**
 * Phase 1B: Simplified metadata cache structure
 * Stores zone/player directly instead of full AssetWorkspaceAddress
 */
type MetaCache = {
    AssetId: AssetUUID;
    zone?: 'Canon' | 'Library' | 'Personal';
    player?: string;  // Only present for Personal zone
    cached?: boolean;
}

export class AssetMetaData {
    _Cache: DeferredCache<MetaCache>;
    
    constructor() {
        this._Cache = new DeferredCache<MetaCache>({
            defaultValue: (cacheKey) => {
                return {
                    AssetId: cacheKey as AssetUUID
                }
            }
        })
    }

    async flush() {
        this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
    }

    async _getPromiseFactory(AssetIds: AssetUUID[]): Promise<MetaCache[]> {
        const metaItems = (await assetDB.getItems<MetaCache>({
            Keys: AssetIds.map((AssetId) => ({
                AssetId,
                DataCategory: 'Meta::Asset'
            })),
            ProjectionFields: ['AssetId', 'zone', 'player', 'cached']
        })) || []
        // Phase 1B: Only return items that have a zone (i.e., exist in DB)
        return metaItems.filter(({ zone }) => Boolean(zone))
    }

    async get(AssetIds: AssetUUID[]): Promise<MetaCache[]> {
        this._Cache.add({
            promiseFactory: () => (this._getPromiseFactory(AssetIds)),
            requiredKeys: AssetIds,
            transform: (fetches) => {
                return Object.assign(
                    {},
                    ...(fetches.map((fetch) => ({
                        [fetch.AssetId]: {
                            AssetId: fetch.AssetId,
                            zone: fetch.zone,
                            player: fetch.player,
                            cached: fetch.cached
                        }
                    })))
                )
            }
        })
        return await Promise.all(AssetIds.map((AssetId) => (this._Cache.get(AssetId))))
    }

    invalidate(AssetId: AssetUUID) {
        if (AssetId in this._Cache) {
            this._Cache[AssetId].invalidate()
        }
    }

}
