import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'

/**
 * Layer participation rule: a catalog or adjacency row is a bump target for an
 * invalidation with editAssetId iff the stored participation stack includes that layer.
 */
export function assetStackIncludesEditAssetId(
    assetStack: readonly AssetUUID[],
    editAssetId: AssetUUID
): boolean {
    return isSchemaAssetUUID(editAssetId) && assetStack.includes(editAssetId)
}
