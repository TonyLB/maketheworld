import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { isImprovisationAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    ComponentAcrossAssetsEntry,
    ComponentDataCache,
    ComponentPairRow,
} from '@tonylb/mtw-gateways/ts/assets/components/componentData/componentDataCache'
import type { ComponentAssetPair } from '@tonylb/mtw-gateways/ts/assets/components/componentData/keys'
import { cacheKeyComponents } from '@tonylb/mtw-gateways/ts/assets/components/componentData/keys'
import type { ImprovisationComponentDataCache } from '@tonylb/mtw-gateways/ts/ephemera/improvisation/factory'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

type CachedPairRow = ComponentAcrossAssetsEntry & { assetId: AssetUUID }

type ComponentDataDelegate = Pick<
    ComponentDataCache,
    'get' | 'getPairs' | 'getAcrossAssets' | 'set' | 'invalidate' | 'clear' | 'flush'
>

type ImprovisationComponentDataDelegate = Pick<
    ImprovisationComponentDataCache,
    'get' | 'getPairs' | 'getAcrossAssets' | 'set' | 'invalidate' | 'clear' | 'flush'
>

export type EphemeraComponentDataCompositeDeps = {
    assetComponentData: ComponentDataDelegate
    improvisationComponentData: ImprovisationComponentDataDelegate
}

const partitionAssetList = (assetList: readonly AssetUUID[]): {
    assetIds: AssetUUID[]
    improvisationIds: AssetUUID[]
} => {
    const assetIds: AssetUUID[] = []
    const improvisationIds: AssetUUID[] = []
    for (const assetId of assetList) {
        if (isImprovisationAssetId(assetId)) {
            improvisationIds.push(assetId)
        }
        else {
            assetIds.push(assetId)
        }
    }
    return { assetIds, improvisationIds }
}

const partitionPairs = (pairs: readonly ComponentAssetPair[]): {
    assetPairs: ComponentAssetPair[]
    improvisationPairs: ComponentAssetPair[]
} => {
    const assetPairs: ComponentAssetPair[] = []
    const improvisationPairs: ComponentAssetPair[] = []
    for (const pair of pairs) {
        if (isImprovisationAssetId(pair.assetId)) {
            improvisationPairs.push(pair)
        }
        else {
            assetPairs.push(pair)
        }
    }
    return { assetPairs, improvisationPairs }
}

/**
 * Ephemera-local composite router: blueprint bodies from assetDB; ASSET#IMPROVISATION from ephemeraDB.
 * Shares the same improvisation handler instance as persist memo set/invalidate.
 */
export class EphemeraComponentDataCompositeCache {
    constructor(private readonly deps: EphemeraComponentDataCompositeDeps) {}

    async flush(): Promise<void> {
        await Promise.all([
            this.deps.assetComponentData.flush(),
            this.deps.improvisationComponentData.flush(),
        ])
    }

    clear(): void {
        this.deps.assetComponentData.clear()
        this.deps.improvisationComponentData.clear()
    }

    async get(universalKey: ComponentUUID, assetId: AssetUUID): Promise<CachedPairRow> {
        if (isImprovisationAssetId(assetId)) {
            return this.deps.improvisationComponentData.get(universalKey, assetId)
        }
        return this.deps.assetComponentData.get(universalKey, assetId)
    }

    async getPairs(pairs: readonly ComponentAssetPair[]): Promise<readonly ComponentPairRow[]> {
        if (pairs.length === 0) {
            return []
        }
        const { assetPairs, improvisationPairs } = partitionPairs(pairs)
        const [assetRows, improvisationRows] = await Promise.all([
            assetPairs.length > 0 ? this.deps.assetComponentData.getPairs(assetPairs) : Promise.resolve([]),
            improvisationPairs.length > 0
                ? this.deps.improvisationComponentData.getPairs(improvisationPairs)
                : Promise.resolve([]),
        ])
        const byPairKey = new Map<string, ComponentPairRow>()
        for (const row of [...assetRows, ...improvisationRows]) {
            byPairKey.set(`${row.assetId}::${row.universalKey}`, row)
        }
        return pairs.map(({ universalKey, assetId }) => {
            const row = byPairKey.get(`${assetId}::${universalKey}`)
            if (!row) {
                throw new Error(`Missing composite getPairs result for ${assetId}::${universalKey}`)
            }
            return row
        })
    }

    async getAcrossAssets(
        universalKey: ComponentUUID,
        assetList: AssetUUID[]
    ): Promise<Record<AssetUUID, ComponentAcrossAssetsEntry>> {
        const { assetIds, improvisationIds } = partitionAssetList(assetList)
        const [assetResults, improvisationResults] = await Promise.all([
            assetIds.length > 0
                ? this.deps.assetComponentData.getAcrossAssets(universalKey, assetIds)
                : Promise.resolve({} as Record<AssetUUID, ComponentAcrossAssetsEntry>),
            improvisationIds.length > 0
                ? this.deps.improvisationComponentData.getAcrossAssets(universalKey, improvisationIds)
                : Promise.resolve({} as Record<AssetUUID, ComponentAcrossAssetsEntry>),
        ])
        return { ...assetResults, ...improvisationResults }
    }

    invalidate(universalKey: ComponentUUID, assetId: AssetUUID): void {
        if (isImprovisationAssetId(assetId)) {
            this.deps.improvisationComponentData.invalidate(universalKey, assetId)
            return
        }
        this.deps.assetComponentData.invalidate(universalKey, assetId)
    }

    invalidatePairKey(pairKey: string): void {
        const { EphemeraId, assetId } = cacheKeyComponents(pairKey)
        this.invalidate(EphemeraId, assetId)
    }

    set(universalKey: ComponentUUID, assetId: AssetUUID, value: StandardComponent): void {
        if (isImprovisationAssetId(assetId)) {
            this.deps.improvisationComponentData.set(universalKey, assetId, value)
            return
        }
        this.deps.assetComponentData.set(universalKey, assetId, value)
    }
}

export function createEphemeraComponentDataCompositeCacheHandler(
    deps: EphemeraComponentDataCompositeDeps
): EphemeraComponentDataCompositeCache {
    return new EphemeraComponentDataCompositeCache(deps)
}
