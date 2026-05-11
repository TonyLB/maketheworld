import { authoritativeComponentDataFromUniversalPartitionRows } from '@tonylb/mtw-gateways/ts/assets/components/assetMeta'
import { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

// Same Dynamo component rows as ephemera's ComponentAssetMeta; shared read helpers live in @tonylb/mtw-gateways (see packages/mtw-gateways/AGENT.md, "Component asset reads: ephemera vs assets").

type ComponentDataCache = {
    ComponentId: EphemeraId;
    byAssets: {
        AssetId: `ASSET#${string}`;
        component: StandardComponent;
    }[]
}

export class ComponentData {
    _Cache: DeferredCache<ComponentDataCache>;
    
    constructor() {
        this._Cache = new DeferredCache<ComponentDataCache>({
            defaultValue: (cacheKey) => {
                return {
                    ComponentId: cacheKey as EphemeraId,
                    byAssets: []
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

    async _getPromiseFactory(ComponentIds: EphemeraId[]): Promise<ComponentDataCache[]> {
        const queryResults = await Promise.all(
            ComponentIds.map(async (ComponentId) => {
                const ndjsonLines =
                    (await assetDB.query<StandardComponentData & { AssetId: string; DataCategory: string }>({
                        Key: { AssetId: ComponentId },
                        allFields: true,
                    })) || []
                return authoritativeComponentDataFromUniversalPartitionRows(ComponentId, ndjsonLines)
            })
        )
        return queryResults
    }

    async get(ComponentIds: EphemeraId[]): Promise<ComponentDataCache[]> {
        this._Cache.add({
            promiseFactory: () => (this._getPromiseFactory(ComponentIds)),
            requiredKeys: ComponentIds,
            transform: (fetches) => {
                return Object.assign(
                    {},
                    ...(fetches.map((fetch) => ({
                        [fetch.ComponentId]: {
                            ComponentId: fetch.ComponentId,
                            byAssets: fetch.byAssets
                        }
                    })))
                )
            }
        })
        return await Promise.all(ComponentIds.map((AssetId) => (this._Cache.get(AssetId))))
    }

    invalidate(ComponentId: EphemeraId) {
        if (ComponentId in this._Cache) {
            this._Cache[ComponentId].invalidate()
        }
    }

}
