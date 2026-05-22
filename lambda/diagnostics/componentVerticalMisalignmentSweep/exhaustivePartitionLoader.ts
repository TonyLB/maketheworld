import { createExhaustiveScanCacheHandler } from '@tonylb/mtw-gateways/ts/assets/components/componentData/exhaustiveScanCache'
import type { ExhaustivePartitionLoader } from '@tonylb/mtw-gateways/ts/assets/components/verticals'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

/**
 * Whitelist diagnostics loader: universal-key partition enumerate via `exhaustiveScanCache`.
 * Not registered on `internalCache.ComponentData`.
 */
const exhaustivePartitionCache = createExhaustiveScanCacheHandler(assetDB)

export const exhaustivePartitionLoader: ExhaustivePartitionLoader = {
    get: (componentIds) => exhaustivePartitionCache.get(componentIds),
}
