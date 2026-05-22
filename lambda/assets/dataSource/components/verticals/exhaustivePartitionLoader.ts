import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { createExhaustiveScanCacheHandler } from '@tonylb/mtw-gateways/ts/assets/components/componentData/exhaustiveScanCache'
import type { ExhaustivePartitionLoader } from '@tonylb/mtw-gateways/ts/assets/components/verticals'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

/**
 * Whitelist maintenance loader: universal-key partition enumerate via `exhaustiveScanCache`.
 * Not registered on `internalCache` (see vertical sync / heal AGENT).
 */
const exhaustivePartitionCache = createExhaustiveScanCacheHandler(assetDB)

export const exhaustivePartitionLoader: ExhaustivePartitionLoader = {
    get: (componentIds) => exhaustivePartitionCache.get(componentIds),
}

export function invalidateExhaustivePartitionCache(universalKey: EphemeraId): void {
    exhaustivePartitionCache.invalidate(universalKey)
}
