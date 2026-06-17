import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'

export {
    cacheKeyComponents,
    componentPairCacheKey,
    parseComponentPairCacheKey,
    type ComponentAssetPair,
} from '../../assets/components/componentData/keys'

/** Improvisation pair rows always use ASSET#IMPROVISATION as DataCategory. */
export const improvisationAssetId = (): typeof IMPROVISATION_ASSET_ID => IMPROVISATION_ASSET_ID

export const assertImprovisationAssetId = (assetId: AssetUUID): void => {
    if (assetId !== IMPROVISATION_ASSET_ID) {
        throw new Error(`ImprovisationComponentData only serves ASSET#IMPROVISATION pairs (got ${assetId})`)
    }
}
