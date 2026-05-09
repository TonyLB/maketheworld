import {
    isEphemeraId,
} from '@tonylb/mtw-interfaces/ts/baseClasses';
import { AssetUUID, ComponentUUID, isSchemaAssetUUID, isSchemaComponentUUID } from '@tonylb/mtw-base/ts/schema';

export const generateCacheKey = (EphemeraId: ComponentUUID, assetId: AssetUUID) => (`${assetId}::${EphemeraId}`)

export const cacheKeyComponents = (cacheKey: string): { EphemeraId: ComponentUUID, assetId: AssetUUID } => {
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
