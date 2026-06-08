import { AssetUUID, ComponentUUID, isSchemaAssetUUID, isSchemaComponentUUID } from '@tonylb/mtw-base/ts/schema'

/** Stable pair addressing primitive for normative component-body reads. */
export type ComponentAssetPair = {
    universalKey: ComponentUUID
    assetId: AssetUUID
}

export const componentPairCacheKey = (universalKey: ComponentUUID, assetId: AssetUUID) =>
    `${assetId}::${universalKey}`

/** @deprecated Prefer {@link componentPairCacheKey}. */
export const generateCacheKey = componentPairCacheKey

export const cacheKeyComponents = (cacheKey: string): { EphemeraId: ComponentUUID; assetId: AssetUUID } => {
    const [assetId, EphemeraId] = cacheKey.split('::')
    // ComponentData keys use schema ComponentUUID (includes AREA#, LENS#, etc.), not EphemeraId allowlist.
    if (!(EphemeraId && isSchemaComponentUUID(EphemeraId))) {
        throw new Error(`CacheKey error in ComponentData internalCache (${cacheKey})`)
    }
    if (!assetId || typeof assetId !== 'string' || !isSchemaAssetUUID(assetId)) {
        throw new Error(`CacheKey error in ComponentData internalCache (${cacheKey})`)
    }
    return {
        EphemeraId,
        assetId,
    }
}

export const parseComponentPairCacheKey = (cacheKey: string): ComponentAssetPair => {
    const { EphemeraId, assetId } = cacheKeyComponents(cacheKey)
    return { universalKey: EphemeraId, assetId }
}
